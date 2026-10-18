import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status;
  if (status !== "approved" && status !== "rejected" && status !== "sent") {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 1000) : null;
  const { data, error } = await auth.sb.from("doss_drafts").update({
    status, review_note: reviewNote, reviewed_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", auth.userId).eq("status", "pending")
    .select("id,run_id,agent_id,channel,content,status,created_at,reviewed_at,review_note").single();
  if (error || !data) return NextResponse.json({ error: "Brouillon introuvable ou déjà traité" }, { status: 404 });
  return NextResponse.json({ draft: data });
}
