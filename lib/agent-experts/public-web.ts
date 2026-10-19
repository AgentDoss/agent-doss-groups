import type { AgentId } from "../agents";
import type { CompanyFacts, PublicWebResearch, PublicWebSource } from "./types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 240;
const MAX_SNIPPET_LENGTH = 520;
const MAX_RESPONSE_BYTES = 64_000;

function cleanSegment(value: string | null | undefined, limit: number): string {
  if (!value) return "";
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^\p{L}\p{N}\s&'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function buildPublicMarketingQuery(company: CompanyFacts | null): string | null {
  const segments = [
    cleanSegment(company?.activity, 90),
    cleanSegment(company?.target, 70),
    cleanSegment(company?.city, 60),
    cleanSegment(company?.country, 60),
  ].filter(Boolean);

  if (segments.length === 0) return null;
  return [...segments, "marketing campaign trends advertising public social media"].join(" ").slice(0, MAX_QUERY_LENGTH);
}

export function shouldSearchPublicMarketing(message: string, agentIds: readonly AgentId[]): boolean {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const marketingIntent = /\b(campagn\w*|publicit\w*|marketing|communication|reseaux sociaux|facebook|instagram|tiktok|contenu sponsorise|concurrent\w*|tendance\w* du marche)\b/.test(normalized);
  const eligibleAgent = agentIds.some((id) => id === "director" || id === "marketing" || id === "strategy");
  return marketingIntent && eligibleAgent;
}

function redactContactDetails(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[courriel masqué]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[téléphone masqué]")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeSource(value: unknown): PublicWebSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.title !== "string" || typeof row.url !== "string" || row.url.length > 1_024 || typeof row.content !== "string") return null;

  let url: URL;
  try {
    url = new URL(row.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  url.hash = "";
  const title = redactContactDetails(row.title).slice(0, 140);
  const content = redactContactDetails(row.content).slice(0, MAX_SNIPPET_LENGTH);
  if (!title || !content) return null;

  const publishedDate = typeof row.published_date === "string" && Number.isFinite(Date.parse(row.published_date))
    ? new Date(row.published_date).toISOString()
    : null;
  const score = typeof row.score === "number" && Number.isFinite(row.score)
    ? Math.max(0, Math.min(1, row.score))
    : null;

  const safeUrl = url.toString().replace(/\(/g, "%28").replace(/\)/g, "%29");
  return { title, url: safeUrl, content, publishedDate, score };
}

function unavailable(reason: string, query: string | null = null, requestCount: 0 | 1 = 0): PublicWebResearch {
  return { status: "unavailable", provider: "Tavily", reason, query, requestCount };
}

async function readBoundedJson(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:json|[\w.+-]+\+json)(?:;|$)/i.test(contentType.trim())) return null;

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader && Number.isFinite(Number(lengthHeader)) && Number(lengthHeader) > MAX_RESPONSE_BYTES) {
    try { await response.body?.cancel(); } catch { /* corps rejeté */ }
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* flux annulé */ }
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Recherche publique unique, strictement serveur. Seuls secteur, cible générale et zone
 * sont transmis; ni message brut, ni CRM, ni notes, ni nom d'entreprise ne sont inclus.
 */
export async function searchPublicMarketing(company: CompanyFacts | null): Promise<PublicWebResearch> {
  const query = buildPublicMarketingQuery(company);
  if (!process.env.TAVILY_API_KEY?.trim()) {
    return unavailable("Recherche Web non configurée : la clé serveur Tavily est absente.", query);
  }
  if (!query) {
    return unavailable("Recherche Web non lancée : renseignez au moins l'activité ou la cible dans la fiche entreprise.");
  }

  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "basic",
        max_results: MAX_RESULTS,
        time_range: "year",
        include_answer: false,
        include_raw_content: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });

    if (!response.ok) {
      const reason = response.status === 401 || response.status === 403
        ? "Le fournisseur de recherche a refusé la clé ou son accès."
        : response.status === 429
          ? "Le quota du fournisseur de recherche est atteint; aucune nouvelle recherche n'a été relancée."
          : "Le fournisseur de recherche Web est temporairement indisponible.";
      return unavailable(reason, query, 1);
    }

    const payload = await readBoundedJson(response);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return unavailable("Le fournisseur a renvoyé une réponse non JSON, illisible ou trop volumineuse.", query, 1);
    }
    const rawResults = (payload as Record<string, unknown>).results;
    const results = Array.isArray(rawResults)
      ? rawResults.slice(0, MAX_RESULTS).map(safeSource).filter((item): item is PublicWebSource => item !== null)
      : [];

    if (results.length === 0) {
      return unavailable("La recherche a été effectuée, mais aucun résultat public exploitable n'a été renvoyé.", query, 1);
    }

    return {
      status: "available",
      provider: "Tavily",
      query,
      searchedAt: new Date().toISOString(),
      results,
      requestCount: 1,
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return unavailable(timedOut
      ? "La recherche Web a dépassé son délai; la mission continue sans source externe."
      : "La recherche Web n'a pas abouti; la mission continue sans source externe.", query, 1);
  }
}
