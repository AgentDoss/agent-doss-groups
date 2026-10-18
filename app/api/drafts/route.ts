import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticated(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.sb.from("doss_drafts")
    .select("id,run_id,agent_id,channel,recipient,content,status,created_at,reviewed_at,review_note,company_uuid")
    .order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Impossible de charger les brouillons" }, { status: 503 });
  return NextResponse.json({ drafts: data ?? [] });
}
