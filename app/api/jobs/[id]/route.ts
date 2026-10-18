import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES = new Set(["prospection", "rapport", "contenu", "relances", "custom"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.title === "string" && body.title.trim().length <= 120) patch.title = body.title.trim();
  if (typeof body?.instruction === "string" && body.instruction.trim().length <= 2000) patch.instruction = body.instruction.trim();
  if (typeof body?.everyHours === "number" && Number.isInteger(body.everyHours) && body.everyHours >= 6 && body.everyHours <= 720) patch.every_hours = body.everyHours;
  if (typeof body?.template === "string" && TEMPLATES.has(body.template)) patch.template = body.template;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Aucune modification valide" }, { status: 400 });
  const { data, error } = await auth.sb.from("doss_jobs").update(patch).eq("id", id).eq("user_id", auth.userId)
    .select("id,title,template,instruction,company_uuid,enabled,every_hours,next_run_at,last_run_at,attempt_count,last_error,once,created_at").single();
  if (error || !data) return NextResponse.json({ error: "Routine introuvable ou non modifiable" }, { status: 404 });
  return NextResponse.json({ job: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const { error } = await auth.sb.from("doss_jobs").delete().eq("id", id).eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: "Routine introuvable ou non supprimable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
