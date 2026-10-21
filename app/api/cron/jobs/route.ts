import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { directorRoute, getAgentById } from "@/lib/agents";
import { buildReliabilityRules, getRequestedActionCount } from "@/lib/guards";
import { runMissionPipeline } from "@/lib/pipeline";
import { recordAiMetric } from "@/lib/ai-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPANY_COLS = "id,name,activity,offer,target,location,city,country,goals,notes,is_active,lead_count,customer_count,monthly_revenue,ai_score";
const MAX_JOBS_PER_RUN = 3;
const DRAFT_LIMIT = 3900;

type Job = {
  id: string;
  user_id: string;
  company_uuid: string | null;
  company_id: string | null;
  template: string;
  title: string;
  instruction: string;
  web: boolean;
  lease_id: string;
};
type Company = Record<string, unknown>;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer === expected || req.headers.get("x-cron-secret") === expected;
}

function companyContext(company: Company | null): string {
  if (!company) return "CONTEXTE : aucune fiche entreprise renseignée. N'invente aucune donnée.";
  const labels: Array<[string, string]> = [
    ["name", "Nom"], ["activity", "Activité"], ["offer", "Produits/services"], ["target", "Clients visés"],
    ["location", "Zone"], ["city", "Ville"], ["country", "Pays"], ["goals", "Objectifs"], ["notes", "Notes"],
  ];
  const lines = labels.flatMap(([key, label]) => {
    const value = company[key];
    return typeof value === "string" && value.trim() ? [`- ${label} : ${value.trim()}`] : [];
  });
  return `FICHE ENTREPRISE ET DONNÉES DISPONIBLES\n\n${lines.join("\n")}\n\nRÈGLES : utilise uniquement ces données ; signale les informations inconnues ; ne prétends jamais avoir envoyé un message ou exécuté une action externe.`;
}

async function loadCompany(sb: ReturnType<typeof supabaseAdmin>, job: Job): Promise<Company | null> {
  if (job.company_uuid) {
    const { data } = await sb.from("doss_company").select(COMPANY_COLS).eq("id", job.company_uuid).eq("user_id", job.user_id).maybeSingle();
    if (data) return data as Company;
  }
  // Compatibilité temporaire avec les jobs historiques : ne jamais utiliser company_id comme colonne de doss_company.
  if (job.company_id && /^[0-9a-f-]{36}$/i.test(job.company_id)) {
    const { data } = await sb.from("doss_company").select(COMPANY_COLS).eq("id", job.company_id).eq("user_id", job.user_id).maybeSingle();
    if (data) return data as Company;
  }
  const { data } = await sb.from("doss_company").select(COMPANY_COLS).eq("user_id", job.user_id).eq("is_active", true).maybeSingle();
  return (data as Company | null) ?? null;
}

function draftContent(answer: string): string {
  const clean = answer.trim();
  if (clean.length <= DRAFT_LIMIT) return clean;
  return `${clean.slice(0, DRAFT_LIMIT - 95).trim()}\n\n[Résultat abrégé dans le brouillon. Consultez le run complet pour la version intégrale.]`;
}

async function executeJob(sb: ReturnType<typeof supabaseAdmin>, job: Job) {
  const runInsert = await sb.from("doss_runs").insert({
    job_id: job.id, user_id: job.user_id, title: job.title, template: job.template, status: "running",
  }).select("id").single();
  if (runInsert.error || !runInsert.data) {
    await sb.rpc("doss_fail_job", { p_job_id: job.id, p_lease_id: job.lease_id, p_error: "Création du run impossible" });
    return { ok: false, jobId: job.id, error: "run_creation_failed" };
  }

  const runId = runInsert.data.id as string;
  const startedAt = Date.now();
  try {
    const company = await loadCompany(sb, job);
    const message = job.instruction.trim() || job.title;
    const route = directorRoute(message);
    const primary = getAgentById(route.primaryAgent) ?? getAgentById("director")!;
    const result = await runMissionPipeline({
      message, route, primary, depth: "standard",
      rules: buildReliabilityRules(getRequestedActionCount(message)),
      context: companyContext(company), history: "", deadlineAt: startedAt + 48_000, emit: () => undefined,
    });
    const answer = result.answer.trim();
    if (!answer) throw new Error("Réponse IA vide");

    await recordAiMetric({
      userId: job.user_id,
      runId,
      operation: "autonomous_job",
      provider: result.provider,
      inputChars: message.length,
      outputChars: answer.length,
      latencyMs: Date.now() - startedAt,
      status: result.interrupted ? "interrupted" : "success",
    });

    const { error: runError } = await sb.from("doss_runs").update({
      status: "done", summary: answer.slice(0, 500), result: answer,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    if (runError) throw new Error("Sauvegarde du run impossible");

    const { error: draftError } = await sb.from("doss_drafts").insert({
      user_id: job.user_id, run_id: runId, company_uuid: job.company_uuid,
      company_id: job.company_id, agent_id: route.primaryAgent, channel: "post",
      content: draftContent(answer), status: "pending",
    });
    if (draftError) throw new Error("Sauvegarde du brouillon impossible");

    await sb.rpc("doss_complete_job", { p_job_id: job.id, p_lease_id: job.lease_id });
    return { ok: true, jobId: job.id, runId, provider: result.provider, draftCreated: true };
  } catch (error) {
    const safeError = error instanceof Error ? error.message : "Erreur worker";
    await sb.from("doss_runs").update({ status: "error", error: safeError.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", runId);
    await sb.rpc("doss_fail_job", { p_job_id: job.id, p_lease_id: job.lease_id, p_error: safeError });
    console.error("Erreur job autonome", { jobId: job.id, runId, error: safeError.slice(0, 200) });
    return { ok: false, jobId: job.id, runId, error: "execution_failed" };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let sb: ReturnType<typeof supabaseAdmin>;
  try { sb = supabaseAdmin(); } catch { return NextResponse.json({ error: "Configuration serveur indisponible" }, { status: 500 }); }

  const workerStartedAt = Date.now();
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < MAX_JOBS_PER_RUN; i += 1) {
    const { data: claimed, error } = await sb.rpc("doss_claim_job");
    if (error) {
      console.error("Erreur claim job", error.message);
      return NextResponse.json({ ok: false, processed: results.length, error: "claim_failed", results }, { status: 503 });
    }
    const job = (Array.isArray(claimed) ? claimed[0] : claimed) as Job | null | undefined;
    if (!job) break;
    results.push(await executeJob(sb, job));
    if (Date.now() - workerStartedAt > 54_000) break;
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), claimed: results.length > 0, processed: results.length, results });
}
