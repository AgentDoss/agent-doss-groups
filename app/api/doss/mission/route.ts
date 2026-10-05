import { NextResponse } from "next/server";
import { supabaseForToken } from "@/lib/supabase";
import { streamLLM } from "@/lib/llm";
import { directorRoute, getAgentById, buildAgentSystemPrompt } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let sb;
  try {
    sb = supabaseForToken(token);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuration Supabase manquante" }, { status: 500 });
  }
  const { data: u, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !u?.user) return NextResponse.json({ error: "Session invalide" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) {
    return NextResponse.json({ error: "Message vide ou trop long (max 4000)" }, { status: 400 });
  }

  const route = directorRoute(message);
  const primary = getAgentById(route.primaryAgent) ?? getAgentById("director")!;
  const supporting = route.supportingAgents.flatMap((id) => {
    const a = getAgentById(id);
    return a ? [a.name] : [];
  });
  const system =
    buildAgentSystemPrompt(primary) +
    `\nCONTEXTE : aucune donnée d'entreprise n'est fournie dans cette requête. Ne les invente pas.` +
    (supporting.length ? `\nAgents en renfort à recommander : ${supporting.join(", ")}.` : "");

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ type: "route", route });

      let answer = "";
      let provider: string | null = null;
      let failure = "";
      try {
        for await (const c of streamLLM(system, message)) {
          provider = c.provider;
          answer += c.text;
          send({ type: "delta", text: c.text });
        }
      } catch (e) {
        failure = e instanceof Error ? e.message : "Erreur inconnue";
      }

      const status: "done" | "error" = failure ? "error" : "done";
      let missionId: string | undefined;
      let saveError = "";
      const { data: mission, error } = await sb
        .from("doss_missions")
        .insert({ message, primary_agent: route.primaryAgent, supporting_agents: route.supportingAgents, confidence: route.confidence, status })
        .select("id")
        .single();
      if (error || !mission) {
        saveError = "Réponse non enregistrée : le fichier SQL a-t-il été exécuté dans Supabase ?";
      } else {
        missionId = mission.id;
        await sb.from("doss_messages").insert([
          { mission_id: mission.id, agent_id: "user", role: "user", content: message },
          { mission_id: mission.id, agent_id: route.primaryAgent, role: "agent", content: answer || failure },
        ]);
      }
      send({ type: "done", status, provider, missionId, error: failure || saveError || undefined });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
