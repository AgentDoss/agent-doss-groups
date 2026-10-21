import { NextResponse } from "next/server";
import { supabaseForToken } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const sb = supabaseForToken(token);
    const { data: auth, error: authError } = await sb.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Session invalide" }, { status: 401 });

    const [metricsResult, jobsResult, draftsResult, missionsResult] = await Promise.all([
      sb.from("doss_ai_metrics")
        .select("id,operation,provider,input_chars,output_chars,estimated_input_tokens,estimated_output_tokens,latency_ms,status,error_code,created_at")
        .order("created_at", { ascending: false }).limit(200),
      sb.from("doss_jobs")
        .select("id,enabled,last_error,last_run_at,attempt_count")
        .limit(100),
      sb.from("doss_drafts")
        .select("id,status,created_at")
        .order("created_at", { ascending: false }).limit(200),
      sb.from("doss_missions")
        .select("id,status,created_at")
        .order("created_at", { ascending: false }).limit(200),
    ]);

    if (metricsResult.error) throw metricsResult.error;
    const metrics = metricsResult.data ?? [];
    const jobs = jobsResult.data ?? [];
    const drafts = draftsResult.data ?? [];
    const missions = missionsResult.data ?? [];
    const success = metrics.filter((m) => m.status === "success").length;
    const totalLatency = metrics.reduce((sum, m) => sum + (Number(m.latency_ms) || 0), 0);
    const inputTokens = metrics.reduce((sum, m) => sum + (Number(m.estimated_input_tokens) || 0), 0);
    const outputTokens = metrics.reduce((sum, m) => sum + (Number(m.estimated_output_tokens) || 0), 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        calls: metrics.length,
        successRate: metrics.length ? Math.round((success / metrics.length) * 100) : 0,
        averageLatencyMs: metrics.length ? Math.round(totalLatency / metrics.length) : 0,
        inputTokens,
        outputTokens,
        activeJobs: jobs.filter((j) => j.enabled).length,
        failedJobs: jobs.filter((j) => Boolean(j.last_error)).length,
        pendingDrafts: drafts.filter((d) => d.status === "pending").length,
        completedMissions: missions.filter((m) => m.status === "done").length,
      },
      providers: Object.entries(metrics.reduce<Record<string, number>>((acc, m) => {
        const key = m.provider || "inconnu";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})).map(([provider, calls]) => ({ provider, calls })),
      recent: metrics.slice(0, 12),
      jobs: jobs.slice(0, 12),
    });
  } catch (error) {
    console.error("metrics_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Les métriques sont temporairement indisponibles." }, { status: 503 });
  }
}
