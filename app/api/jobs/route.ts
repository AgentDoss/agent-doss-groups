import { NextResponse } from "next/server";
import { supabaseForToken } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES = ["prospection", "rapport", "contenu", "relances", "custom"] as const;
type Template = (typeof TEMPLATES)[number];

function tokenFrom(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

async function authenticated(req: Request) {
  const token = tokenFrom(req);
  if (!token) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const sb = supabaseForToken(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Session invalide" }, { status: 401 }) };
  return { sb, userId: data.user.id };
}

export async function GET(req: Request) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.sb
    .from("doss_jobs")
    .select("id,title,template,instruction,company_id,enabled,every_hours,next_run_at,last_run_at,once,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Impossible de charger les routines" }, { status: 503 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  const template = typeof body?.template === "string" && TEMPLATES.includes(body.template as Template)
    ? body.template
    : "custom";
  const everyHours = typeof body?.everyHours === "number" ? body.everyHours : 24;
  const companyId = typeof body?.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const once = body?.once === true;

  if (title.length < 1 || title.length > 120 || instruction.length < 1 || instruction.length > 2000) {
    return NextResponse.json({ error: "Titre ou instruction invalide" }, { status: 400 });
  }
  if (!Number.isInteger(everyHours) || everyHours < 6 || everyHours > 720) {
    return NextResponse.json({ error: "La fréquence doit être comprise entre 6 et 720 heures" }, { status: 400 });
  }

  const { data, error } = await auth.sb.from("doss_jobs").insert({
    user_id: auth.userId,
    title,
    instruction,
    template,
    company_id: companyId,
    enabled: true,
    every_hours: everyHours,
    next_run_at: new Date().toISOString(),
    once,
    web: false,
  }).select("id,title,template,instruction,company_id,enabled,every_hours,next_run_at,once,created_at").single();

  if (error) return NextResponse.json({ error: "Impossible de créer la routine" }, { status: 503 });
  return NextResponse.json({ job: data }, { status: 201 });
}
