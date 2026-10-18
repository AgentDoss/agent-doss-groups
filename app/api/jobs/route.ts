import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES = ["prospection", "rapport", "contenu", "relances", "custom"] as const;
type Template = (typeof TEMPLATES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.sb.from("doss_jobs")
    .select("id,title,template,instruction,company_uuid,enabled,every_hours,next_run_at,last_run_at,attempt_count,last_error,once,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Impossible de charger les routines" }, { status: 503 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  const template = typeof body?.template === "string" && TEMPLATES.includes(body.template as Template) ? body.template : "custom";
  const everyHours = typeof body?.everyHours === "number" ? body.everyHours : 24;
  const requestedCompany = typeof body?.companyId === "string" ? body.companyId.trim() : "";
  const once = body?.once === true;

  if (title.length < 1 || title.length > 120 || instruction.length < 1 || instruction.length > 2000) {
    return NextResponse.json({ error: "Titre ou instruction invalide" }, { status: 400 });
  }
  if (!Number.isInteger(everyHours) || everyHours < 6 || everyHours > 720) {
    return NextResponse.json({ error: "La fréquence doit être comprise entre 6 et 720 heures" }, { status: 400 });
  }
  if (requestedCompany && !UUID.test(requestedCompany)) return NextResponse.json({ error: "Entreprise invalide" }, { status: 400 });

  const companyQuery = requestedCompany
    ? auth.sb.from("doss_company").select("id").eq("id", requestedCompany).eq("user_id", auth.userId).maybeSingle()
    : auth.sb.from("doss_company").select("id").eq("user_id", auth.userId).eq("is_active", true).maybeSingle();
  const { data: company, error: companyError } = await companyQuery;
  if (companyError) return NextResponse.json({ error: "Impossible de vérifier l’entreprise" }, { status: 503 });
  if (!company?.id) return NextResponse.json({ error: "Aucune entreprise autorisée trouvée" }, { status: 400 });

  const { data, error } = await auth.sb.from("doss_jobs").insert({
    user_id: auth.userId, company_uuid: company.id, title, instruction, template,
    enabled: true, every_hours: everyHours, next_run_at: new Date().toISOString(), once, web: false,
  }).select("id,title,template,instruction,company_uuid,enabled,every_hours,next_run_at,last_run_at,attempt_count,last_error,once,created_at").single();
  if (error) return NextResponse.json({ error: "Impossible de créer la routine" }, { status: 503 });
  return NextResponse.json({ job: data }, { status: 201 });
}
