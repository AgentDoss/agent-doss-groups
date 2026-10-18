import { NextResponse } from "next/server";
import { supabaseForToken } from "@/lib/supabase";

export function tokenFrom(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export async function authenticated(req: Request) {
  const token = tokenFrom(req);
  if (!token) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const sb = supabaseForToken(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Session invalide" }, { status: 401 }) };
  return { sb, userId: data.user.id };
}
