import { supabaseAdmin } from "@/lib/supabase-admin";

type MetricInput = {
  userId?: string | null;
  missionId?: string | null;
  runId?: string | null;
  operation: "interactive_mission" | "autonomous_job";
  provider: string | null;
  inputChars: number;
  outputChars: number;
  latencyMs: number;
  status: "success" | "error" | "interrupted";
  errorCode?: string | null;
};

function estimatedTokens(chars: number) {
  return Math.max(0, Math.ceil(chars / 4));
}

/**
 * Les métriques sont best-effort : une panne de télémétrie ne doit jamais
 * transformer une réponse IA réussie en erreur utilisateur.
 */
export async function recordAiMetric(input: MetricInput) {
  const payload = {
    user_id: input.userId ?? null,
    mission_id: input.missionId ?? null,
    run_id: input.runId ?? null,
    operation: input.operation,
    provider: input.provider,
    input_chars: Math.max(0, Math.round(input.inputChars)),
    output_chars: Math.max(0, Math.round(input.outputChars)),
    estimated_input_tokens: estimatedTokens(input.inputChars),
    estimated_output_tokens: estimatedTokens(input.outputChars),
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    status: input.status,
    error_code: input.errorCode ?? null,
  };

  try {
    const { error } = await supabaseAdmin().from("doss_ai_metrics").insert(payload);
    if (error) console.error("ai_metric_persist_failed", { operation: input.operation, code: error.code });
  } catch (error) {
    console.error("ai_metric_unavailable", { operation: input.operation, error: error instanceof Error ? error.message : "unknown" });
  }

  console.info("ai_metric", {
    operation: payload.operation,
    provider: payload.provider,
    latencyMs: payload.latency_ms,
    inputTokens: payload.estimated_input_tokens,
    outputTokens: payload.estimated_output_tokens,
    status: payload.status,
  });
}
