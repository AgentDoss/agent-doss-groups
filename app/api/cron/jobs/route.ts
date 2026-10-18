import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { directorRoute, getAgentById } from "@/lib/agents";
import { buildReliabilityRules, getRequestedActionCount } from "@/lib/guards";
import { runMissionPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPANY_COLS = "id,company_id,name,activity,offer,target,location,city,country,goals,notes,is_active,lead_count,customer_count,monthly_revenue,ai_score";

type Job = {
  id: string;
  user_id: string;
  company_id: string | null;
  template: string;
  title: string;
  instruction: string;
  web: boolean;
};

type Company = Record<string, unknown>;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
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
  if (job.company_id) {
    const byCompanyId = await sb.from("doss_company").select(COMPANY_COLS).eq("company_id", job.company_id).eq("user_id", job.user_id).maybeSingle();
    if (byCompanyId.data) return byCompanyId.data as Company;
    const byId = await sb.from("doss_company").select(COMPANY_COLS).eq("id", job.company_id).eq("user_id", job.user_id).maybeSingle();
    if (byId.data) return byId.data as Company;
  }
  const active = await sb.from("doss_company").select(COMPANY_COLS).eq("user_id", job.user_id).eq("is_active", true).maybeSingle();
  return (active.data as Company | null) ?? null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let sb: ReturnType<typeof supabaseAdmin>;
  try {
    sb = supabaseAdmin();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Configuration indisponible" }, { status: 500 });
  }

  const { data: claimed, error: claimError } = await sb.rpc("doss_claim_job");
  if (claimError) {
    console.error("Erreur claim job :", claimError.message);
    return NextResponse.json({ error: "Impossible de réclamer le job" }, { status: 503 });
  }

  const job = (Array.isArray(claimed) ? claimed[0] : claimed) as Job | null | undefined;
  if (!job) return NextResponse.json({ ok: true, claimed: false, message: "Aucun job à exécuter" });

  const runInsert = await sb.from("doss_runs").insert({
    job_id: job.id,
    user_id: job.user_id,
    title: job.title,
    template: job.template,
    status: "running",
  }).select("id").single();

  if (runInsert.error || !runInsert.data) {
    console.error("Erreur création run :", runInsert.error?.message);
    return NextResponse.json({ error: "Job réclamé mais run impossible à créer", jobId: job.id }, { status: 500 });
  }

  const runId = runInsert.data.id as string;
  const startedAt = Date.now();
  let answer = "";
  let provider: string | null = null;

  try {
    const company = await loadCompany(sb, job);
    const message = job.instruction.trim() || job.title;
    const route = directorRoute(message);
    const primary = getAgentById(route.primaryAgent) ?? getAgentById("director")!;
    const result = await runMissionPipeline({
      message,
      route,
      primary,
      depth: "standard",
      rules: buildReliabilityRules(getRequestedActionCount(message)),
      context: companyContext(company),
      history: "",
      deadlineAt: startedAt + 50_000,
      emit: () => undefined,
    });
    answer = result.answer.trim();
    provider = result.provider;
    if (!answer) throw new Error("Réponse IA vide");

    const { error: runError } = await sb.from("doss_runs").update({
      status: "done",
      summary: answer.slice(0, 500),
      result: answer,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    if (runError) throw new Error(`Sauvegarde run impossible : ${runError.message}`);

    const { error: draftError } = await sb.from("doss_drafts").insert({
      user_id: job.user_id,
      run_id: runId,
      company_id: job.company_id,
      agent_id: route.primaryAgent,
      channel: "post",
      content: answer,
      status: "pending",
    });
    if (draftError) console.error("Brouillon non enregistré :", draftError.message);

    return NextResponse.json({ ok: true, claimed: true, runId, jobId: job.id, provider, draftCreated: !draftError });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur worker inconnue";
    await sb.from("doss_runs").update({ status: "error", error: message.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", runId);
    console.error("Erreur job autonome :", message);
    return NextResponse.json({ ok: false, claimed: true, runId, jobId: job.id, error: message }, { status: 500 });
  }
}
