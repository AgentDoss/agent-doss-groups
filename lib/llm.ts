// Réponses en streaming + bascule automatique entre fournisseurs et clés.
// La bascule n'a lieu qu'AVANT le premier mot reçu ; ensuite le flux est conservé tel quel.

interface Provider {
  id: string;
  open: (system: string, user: string, signal: AbortSignal) => Promise<Response>;
  parse: (data: unknown) => string;
}

export class LLMError extends Error {
  constructor(message: string, public status: number | null = null) {
    super(message);
  }
}

export interface LLMChunk { provider: string; text: string }

const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_TOKENS = 900;

function oai(id: string, url: string, key: string, model: string): Provider {
  return {
    id,
    open: (system, user, signal) =>
      fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, stream: true, temperature: 0.3, max_tokens: MAX_TOKENS,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      }),
    parse: (d) => (d as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta?.content ?? "",
  };
}

export function buildProviders(): Provider[] {
  const list: Provider[] = [];

  const gModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  [...new Set([...split(process.env.GEMINI_API_KEYS), ...split(process.env.GEMINI_API_KEY)])].forEach((key, i) =>
    list.push({
      id: `gemini#${i + 1}`,
      open: (system, user, signal) =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:streamGenerateContent?alt=sse`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: MAX_TOKENS },
          }),
        }),
      parse: (d) => {
        const parts = (d as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts ?? [];
        return parts.map((p) => p.text ?? "").join("");
      },
    })
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
const FIRST_TOKEN_TIMEOUT_MS = 8_000;

export async function* streamLLM(system: string, user: string): AsyncGenerator<LLMChunk> {
  const providers = buildProviders();
  if (providers.length === 0) throw new LLMError("Aucune clé IA configurée (GEMINI_API_KEYS, GROQ_API_KEYS…).");

  const now = Date.now();
  const ready = providers.filter((p) => (cooldown.get(p.id) ?? 0) <= now);
  const queue = ready.length > 0 ? ready : providers;
  const tried: string[] = [];

  for (const p of queue) {
    tried.push(p.id);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FIRST_TOKEN_TIMEOUT_MS);
    let started = false;
    try {
      const res = await p.open(system, user, ctrl.signal);
      if (!res.ok) throw new LLMError(`HTTP ${res.status}`, res.status);
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
      if (started) throw e; // coupure en cours de réponse : on garde ce qui a été reçu
      const status = e instanceof LLMError ? e.status : null;
      cooldown.set(p.id, Date.now() + (status === 401 || status === 403 ? 10 * COOLDOWN_MS : COOLDOWN_MS));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LLMError(`Tous les fournisseurs IA ont échoué (${tried.join(", ")}). Quotas épuisés ou clés invalides.`, 503);
}
