import type { AgentToolContext, ClientFacts, CompanyFacts, ProspectFacts } from "./types";

interface RawDataset {
  totalCount: number | null;
  rows: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\u0000/g, "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function redactContacts(value: unknown): string | null {
  const source = text(value, 1200);
  if (!source) return null;
  return source
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[courriel masqué]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[téléphone masqué]");
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function date(value: unknown): string | null {
  const s = text(value, 80);
  if (!s) return null;
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function companyFacts(value: unknown): CompanyFacts | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    name: text(row.name, 160),
    activity: text(row.activity, 500),
    offer: text(row.offer, 1000),
    target: text(row.target, 500),
    location: text(row.location, 200),
    city: text(row.city, 120),
    country: text(row.country, 120),
    goals: text(row.goals, 1000),
    notes: redactContacts(row.notes),
    customerCount: number(row.customer_count),
    leadCount: number(row.lead_count),
    monthlyRevenue: number(row.monthly_revenue),
    aiScore: number(row.ai_score),
  };
}

function prospectFact(value: unknown): ProspectFacts | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    status: text(row.status, 100),
    source: text(row.source, 160),
    nextFollowUp: date(row.next_follow_up),
    createdAt: date(row.created_at),
  };
}

function clientFact(value: unknown): ClientFacts | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    status: text(row.status, 100),
    totalAmount: number(row.total_amount),
    lastPurchaseDate: date(row.last_purchase_date),
    nextFollowUp: date(row.next_follow_up),
    createdAt: date(row.created_at),
    source: text(row.source, 160),
    product: text(row.product, 200),
  };
}

function dataset<T>(raw: RawDataset | null, toFact: (value: unknown) => T | null, maximum: number) {
  if (!raw) return null;
  const rows = raw.rows.slice(0, maximum).map(toFact).filter((row): row is T => row !== null);
  const totalCount = Number.isInteger(raw.totalCount) && raw.totalCount !== null && raw.totalCount >= 0
    ? raw.totalCount
    : null;
  return {
    totalCount,
    sampleSize: rows.length,
    complete: totalCount !== null && rows.length === totalCount,
    rows,
  };
}

/**
 * Construit un snapshot isolé par la route authentifiée. Les identifiants/coordonnées
 * des personnes ne font pas partie de ce contrat et ne peuvent pas atteindre le modèle.
 */
export function buildAgentToolContext(input: {
  snapshotAt?: string;
  company: unknown;
  prospects: RawDataset | null;
  clients: RawDataset | null;
}): AgentToolContext {
  return {
    snapshotAt: date(input.snapshotAt) ?? new Date().toISOString(),
    company: companyFacts(input.company),
    prospects: dataset(input.prospects, prospectFact, 500),
    clients: dataset(input.clients, clientFact, 1000),
  };
}
