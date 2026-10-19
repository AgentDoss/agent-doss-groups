// Réponses en streaming + bascule automatique entre fournisseurs et clés.
// La bascule n'a lieu qu'AVANT le premier mot reçu ; ensuite le flux est conservé tel quel.
// v3 : options par appel (jetons, température, délai global) + completeLLM() pour les étapes internes.

import type { AgentToolSchema, LLMToolCall, LLMToolMessage } from "./agent-experts/types";

export interface LLMOptions {
  maxTokens?: number;           // défaut 2000
  temperature?: number;         // défaut 0.3
  signal?: AbortSignal;         // délai global de l'étape (n'entraîne pas de mise en pause du fournisseur)
  firstTokenTimeoutMs?: number; // défaut 8000
}

type CallParams = { maxTokens: number; temperature: number };

interface Provider {
  id: string;
  open: (system: string, user: string, signal: AbortSignal, p: CallParams) => Promise<Response>;
  parse: (data: unknown) => string;
  openWithTools?: (
    system: string,
    messages: LLMToolMessage[],
    tools: AgentToolSchema[],
    signal: AbortSignal,
    p: CallParams,
    forceTool: boolean,
  ) => Promise<Response>;
  parseWithTools?: (data: unknown) => { text: string; toolCalls: LLMToolCall[] };
}

export class LLMError extends Error {
  constructor(message: string, public status: number | null = null) {
    super(message);
  }
}

export interface LLMChunk { provider: string; text: string }

const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_MAX_TOKENS = 2000; // marge pour les modèles à réflexion (la réflexion consomme des jetons)
const DEFAULT_TEMPERATURE = 0.3;

function openAIMessageHistory(system: string, messages: LLMToolMessage[]) {
  return [
    { role: "system", content: system },
    ...messages.map((message) => {
      if (message.role === "user") return { role: "user", content: message.content };
      if (message.role === "assistant") return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length ? {
          tool_calls: message.toolCalls.map((call, index) => ({
            id: call.id ?? `local_tool_${index + 1}`,
            type: "function",
            function: { name: call.name, arguments: call.arguments },
          })),
        } : {}),
      };
      return {
        role: "tool",
        tool_call_id: message.toolCallId ?? "missing_tool_call_id",
        name: message.toolName,
        content: message.content,
      };
    }),
  ];
}

function oai(id: string, url: string, key: string, model: string): Provider {
  return {
    id,
    open: (system, user, signal, p) =>
      fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, stream: true, temperature: p.temperature, max_tokens: p.maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      }),
    parse: (d) => (d as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta?.content ?? "",
    openWithTools: (system, messages, tools, signal, p, forceTool) =>
      fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: p.temperature,
          max_tokens: p.maxTokens,
          messages: openAIMessageHistory(system, messages),
          ...(tools.length ? {
            tools: tools.map((tool) => ({
              type: "function",
              function: { name: tool.name, description: tool.description, parameters: tool.parameters },
            })),
            tool_choice: forceTool ? "required" : "auto",
          } : {}),
        }),
      }),
    parseWithTools: (d) => {
      const message = (d as { choices?: Array<{ message?: { content?: unknown; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }> })?.choices?.[0]?.message;
      const toolCalls = (message?.tool_calls ?? []).flatMap((call) => {
        const name = call.function?.name;
        if (!name) return [];
        return [{ id: call.id, name, arguments: call.function?.arguments ?? "{}" }];
      });
      return { text: typeof message?.content === "string" ? message.content : "", toolCalls };
    },
  };
}

function parseJsonObject(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return { invalid_json: raw.slice(0, 500) }; }
}

function geminiParameters(parameters: Record<string, unknown>): Record<string, unknown> {
  const compatible = { ...parameters };
  delete compatible.additionalProperties;
  return compatible;
}

function geminiHistory(messages: LLMToolMessage[]) {
  const contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> = [];
  for (const message of messages) {
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      const parts: Array<Record<string, unknown>> = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { ...(call.id ? { id: call.id } : {}), name: call.name, args: parseJsonObject(call.arguments) } });
      }
      if (parts.length) contents.push({ role: "model", parts });
    } else {
      const responsePart: Record<string, unknown> = {
        functionResponse: {
          ...(message.toolCallId ? { id: message.toolCallId } : {}),
          name: message.toolName,
          response: parseJsonObject(message.content),
        },
      };
      const last = contents[contents.length - 1];
      if (last?.role === "user" && last.parts.some((part) => "functionResponse" in part)) last.parts.push(responsePart);
      else contents.push({ role: "user", parts: [responsePart] });
    }
  }
  return contents;
}

export function buildProviders(): Provider[] {
  const list: Provider[] = [];

  // GEMINI_MODEL accepte plusieurs modèles séparés par des virgules : le quota gratuit est
  // compté PAR MODÈLE, donc chaque modèle ajouté donne des requêtes par jour en plus.
  // GEMINI_THINKING : minimal | low | medium | high | off (par défaut « low », plus rapide).
  const thinkingRaw = (process.env.GEMINI_THINKING || "low").trim().toLowerCase();
  const thinkingLevel = ["minimal", "low", "medium", "high"].includes(thinkingRaw) ? thinkingRaw : "";
  const gModels = split(process.env.GEMINI_MODEL);
  if (gModels.length === 0) gModels.push("gemini-3.6-flash");
  const gKeys = [...new Set([...split(process.env.GEMINI_API_KEYS), ...split(process.env.GEMINI_API_KEY)])];
  gModels.forEach((gModel, m) =>
    gKeys.forEach((key, i) =>
      list.push({
        id: `gemini#${i + 1}.${m + 1}`,
        open: async (system, user, signal, p) => {
          const call = (withThinking: boolean) =>
            fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:streamGenerateContent?alt=sse`, {
              method: "POST",
              signal,
              headers: { "Content-Type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: user }] }],
                generationConfig: {
                  maxOutputTokens: p.maxTokens,
                  temperature: p.temperature,
                  // Moins de « réflexion » interne = réponse beaucoup plus rapide (et pas de jetons perdus).
                  ...(withThinking && thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
                },
              }),
            });
          const res = await call(true);
          // Un modèle qui refuse ce réglage : on réessaie une fois sans, sans pénaliser le modèle.
          if (res.status === 400 && thinkingLevel) return call(false);
          return res;
        },
        parse: (d) => {
          const parts = (d as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts ?? [];
          return parts.map((p) => p.text ?? "").join("");
        },
        openWithTools: async (system, messages, tools, signal, p, forceTool) => {
          const call = (withThinking: boolean) =>
            fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent`, {
              method: "POST",
              signal,
              headers: { "Content-Type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: geminiHistory(messages),
                ...(tools.length ? {
                  tools: [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: geminiParameters(tool.parameters) })) }],
                  toolConfig: { functionCallingConfig: { mode: forceTool ? "ANY" : "AUTO" } },
                } : {}),
                generationConfig: {
                  maxOutputTokens: p.maxTokens,
                  temperature: p.temperature,
                  ...(withThinking && thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
                },
              }),
            });
          const res = await call(true);
          return res.status === 400 && thinkingLevel ? call(false) : res;
        },
        parseWithTools: (d) => {
          const parts = (d as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { id?: string; name?: string; args?: unknown } }> } }> })?.candidates?.[0]?.content?.parts ?? [];
          const toolCalls = parts.flatMap((part) => {
            const call = part.functionCall;
            if (!call?.name) return [];
            return [{ id: call.id, name: call.name, arguments: JSON.stringify(call.args ?? {}) }];
          });
          return { text: parts.map((part) => part.text ?? "").join(""), toolCalls };
        },
      })
    )
  );

  const grModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  [...new Set([...split(process.env.GROQ_API_KEYS), ...split(process.env.GROQ_API_KEY)])].forEach((key, i) =>
    list.push(oai(`groq#${i + 1}`, "https://api.groq.com/openai/v1/chat/completions", key, grModel))
  );

  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL) {
    list.push(oai("openrouter", "https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL));
  }
  if (process.env.CUSTOM_LLM_URL && process.env.CUSTOM_LLM_KEY && process.env.CUSTOM_LLM_MODEL) {
    list.push(oai("custom", process.env.CUSTOM_LLM_URL, process.env.CUSTOM_LLM_KEY, process.env.CUSTOM_LLM_MODEL));
  }

  // Ordre personnalisable : LLM_ORDER="groq,gemini,openrouter,custom"
  const order = split(process.env.LLM_ORDER);
  if (order.length) {
    const rank = (p: Provider) => {
      const i = order.indexOf(p.id.split("#")[0]);
      return i < 0 ? 99 : i;
    };
    list.sort((a, b) => rank(a) - rank(b));
  }
  return list;
}

async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) {
        const d = line.slice(5).trim();
        if (d) yield d;
      }
    }
  }
}

// Mémoire d'instance (non partagée entre instances serverless)
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 8_000;

export async function* streamLLM(system: string, user: string, options: LLMOptions = {}): AsyncGenerator<LLMChunk> {
  const providers = buildProviders();
  if (providers.length === 0) throw new LLMError("Aucune clé IA configurée (GEMINI_API_KEYS, GROQ_API_KEYS…).");

  const params: CallParams = {
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  };
  const firstTokenMs = options.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_TIMEOUT_MS;
  const outer = options.signal;

  const now = Date.now();
  const ready = providers.filter((p) => (cooldown.get(p.id) ?? 0) <= now);
  const queue = ready.length > 0 ? ready : providers;
  const failures: string[] = [];

  for (const p of queue) {
    if (outer?.aborted) throw new LLMError("Délai global de l'étape dépassé", 408);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), firstTokenMs);
    const onOuterAbort = () => ctrl.abort();
    outer?.addEventListener("abort", onOuterAbort, { once: true });
    let started = false;
    let dailyExhausted = false;

    try {
      const res = await p.open(system, user, ctrl.signal, params);
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).replace(/\s+/g, " ");
        const detail = body.slice(0, 140);
        // Quota journalier épuisé : inutile de réessayer avant longtemps.
        if (res.status === 429 && /per ?day|daily|PerDay/i.test(body)) dailyExhausted = true;
        throw new LLMError(`HTTP ${res.status} ${detail}`.trim(), res.status);
      }
      for await (const raw of sseData(res)) {
        let text = "";
        try { text = p.parse(JSON.parse(raw)); } catch { continue; }
        if (!text) continue;
        if (!started) { started = true; clearTimeout(timer); }
        yield { provider: p.id, text };
      }
      if (started) { cooldown.delete(p.id); return; }
      throw new LLMError("Réponse vide");
    } catch (e) {
      if (started) throw e; // coupure en cours de réponse : l'appelant décide quoi garder
      // Notre propre délai global n'est pas la faute du fournisseur : pas de mise en pause.
      if (outer?.aborted) throw new LLMError("Délai global de l'étape dépassé", 408);
      const status = e instanceof LLMError ? e.status : null;
      failures.push(`${p.id} : ${e instanceof Error && e.name === "AbortError" ? "délai dépassé" : e instanceof Error ? e.message : "erreur"}`);
      cooldown.set(
        p.id,
        Date.now() + (dailyExhausted ? 30 * COOLDOWN_MS : status === 401 || status === 403 ? 10 * COOLDOWN_MS : COOLDOWN_MS)
      );
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuterAbort);
    }
  }
  throw new LLMError(`Tous les fournisseurs IA ont échoué — ${failures.join(" | ")}`, 503);
}

// Appel sans affichage progressif : pour les étapes internes (plan, brouillons, analyses d'experts).
export async function completeLLM(
  system: string,
  user: string,
  options: LLMOptions = {}
): Promise<{ text: string; provider: string }> {
  let text = "";
  let provider = "";
  for await (const c of streamLLM(system, user, options)) {
    provider = c.provider;
    text += c.text;
  }
  return { text, provider };
}

export type LLMToolExecutor = (name: string, args: unknown) => Promise<string>;

/**
 * Une seule phase de function-calling (maximum deux exécutions), puis un appel final sans outils.
 * Les fonctions ne sont jamais exécutées par le fournisseur : elles sont validées/exécutées par
 * l'application via `execute`. Si aucun fournisseur ne prend en charge les outils, l'appel texte
 * normal reste utilisable avec les preuves préchargées par l'agent.
 */
export async function completeLLMWithTools(
  system: string,
  user: string,
  tools: AgentToolSchema[],
  execute: LLMToolExecutor,
  options: LLMOptions = {},
): Promise<{ text: string; provider: string; toolNames: string[] }> {
  const providers = buildProviders();
  const params: CallParams = {
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  };
  const signal = options.signal ?? AbortSignal.timeout(25_000);
  const available = providers.filter((provider) => provider.openWithTools && provider.parseWithTools);
  const now = Date.now();
  const ready = available.filter((provider) => (cooldown.get(provider.id) ?? 0) <= now);
  const queue = ready.length > 0 ? ready : available;
  const failures: string[] = [];

  for (const provider of queue) {
    if (signal.aborted) throw new LLMError("Délai global de l'étape dépassé", 408);
    let dailyExhausted = false;
    try {
      const initialMessages: LLMToolMessage[] = [{ role: "user", content: user }];
      const firstResponse = await provider.openWithTools!(system, initialMessages, tools, signal, params, true);
      if (!firstResponse.ok) {
        const body = (await firstResponse.text().catch(() => "")).replace(/\s+/g, " ");
        dailyExhausted = firstResponse.status === 429 && /per ?day|daily|PerDay/i.test(body);
        throw new LLMError(`HTTP ${firstResponse.status} ${body.slice(0, 140)}`.trim(), firstResponse.status);
      }
      const first = provider.parseWithTools!(await firstResponse.json());
      if (!first.toolCalls.length) {
        if (!first.text.trim()) throw new LLMError("Réponse vide sans appel d'outil");
        cooldown.delete(provider.id);
        return { text: first.text.trim(), provider: provider.id, toolNames: [] };
      }
      if (first.toolCalls.length > 6) throw new LLMError("Nombre d'appels d'outil au-delà de la limite de sécurité.");

      const messages: LLMToolMessage[] = [
        ...initialMessages,
        { role: "assistant", content: first.text || null, toolCalls: first.toolCalls },
      ];
      const toolNames: string[] = [];
      for (const [index, call] of first.toolCalls.entries()) {
        let content: string;
        if (index >= 2) {
          content = JSON.stringify({ ok: false, error: "Limite de deux appels d'outil par étape atteinte." });
        } else {
          let args: unknown;
          try {
            args = call.arguments.length <= 4096 ? JSON.parse(call.arguments || "{}") : null;
          } catch { args = null; }
          try {
            content = await execute(call.name, args);
            toolNames.push(call.name);
          } catch {
            content = JSON.stringify({ ok: false, error: "Échec contrôlé de l'outil." });
          }
        }
        messages.push({ role: "tool", content, ...(call.id ? { toolCallId: call.id } : {}), toolName: call.name });
      }

      try {
        const finalResponse = await provider.openWithTools!(system, messages, [], signal, params, false);
        if (!finalResponse.ok) {
          const body = (await finalResponse.text().catch(() => "")).replace(/\s+/g, " ");
          throw new LLMError(`HTTP ${finalResponse.status} ${body.slice(0, 140)}`.trim(), finalResponse.status);
        }
        const final = provider.parseWithTools!(await finalResponse.json());
        if (!final.text.trim()) throw new LLMError("Réponse finale vide après les outils");
        cooldown.delete(provider.id);
        return { text: final.text.trim(), provider: provider.id, toolNames };
      } catch {
        if (signal.aborted) throw new LLMError("Délai global de l'étape dépassé", 408);
        const toolResults = messages
          .filter((message): message is Extract<LLMToolMessage, { role: "tool" }> => message.role === "tool")
          .map((message) => `- ${message.toolName}: ${message.content}`)
          .join("\n");
        const fallback = await completeLLM(
          system,
          `${user}\n\nRÉSULTATS D'OUTILS LOCAUX DÉJÀ EXÉCUTÉS :\n${toolResults}`,
          options,
        );
        return { ...fallback, toolNames };
      }
    } catch (error) {
      if (signal.aborted) throw new LLMError("Délai global de l'étape dépassé", 408);
      const status = error instanceof LLMError ? error.status : null;
      failures.push(`${provider.id} : ${error instanceof Error ? error.message : "erreur"}`);
      cooldown.set(
        provider.id,
        Date.now() + (dailyExhausted ? 30 * COOLDOWN_MS : status === 401 || status === 403 ? 10 * COOLDOWN_MS : COOLDOWN_MS),
      );
    }
  }

  // Le fallback conserve l'exécution des outils déterministes préchargés dans le prompt de l'agent.
  try {
    return { ...(await completeLLM(system, user, options)), toolNames: [] };
  } catch (error) {
    if (failures.length && error instanceof LLMError) {
      throw new LLMError(`${error.message} (tool-calling: ${failures.join(" | ")})`, error.status);
    }
    throw error;
  }
}
