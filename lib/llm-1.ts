// Réponses en streaming + bascule automatique entre fournisseurs et clés.
// La bascule n'a lieu qu'AVANT le premier mot reçu ; ensuite le flux est conservé tel quel.
// v3 : options par appel (jetons, température, délai global) + completeLLM() pour les étapes internes.

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
  };
}

export function buildProviders(): Provider[] {
  const list: Provider[] = [];

  // GEMINI_MODEL accepte plusieurs modèles séparés par des virgules : le quota gratuit est
  // compté PAR MODÈLE, donc chaque modèle ajouté donne des requêtes par jour en plus.
  // GEMINI_THINKING : minimal | low | medium | high | off (par défaut « low », plus rapide).
  const thinkingRaw = (process.env.GEMINI_THINKING || "low").trim().toLowerCase();
  const thinkingLevel = ["minimal", "low", "medium", "high"].includes(thinkingRaw) ? thinkingRaw : "";
  const tRaw = (process.env.GEMINI_TEMPERATURE || "").trim();
  const geminiTemperature = tRaw !== "" && Number.isFinite(Number(tRaw)) ? Number(tRaw) : null;
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
                  // Gemini 3 : Google recommande de garder la température par défaut (1,0) ; la baisser dégrade le raisonnement.
                  ...(geminiTemperature !== null ? { temperature: geminiTemperature } : {}),
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
