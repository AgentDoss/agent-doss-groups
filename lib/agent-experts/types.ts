import type { AgentId } from "../agents";

export type EvidenceStatus = "observed" | "calculated" | "assumption" | "unavailable";
export type EvidenceValue = string | number | boolean | null;

export interface CompanyFacts {
  name: string | null;
  activity: string | null;
  offer: string | null;
  target: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  goals: string | null;
  notes: string | null;
  customerCount: number | null;
  leadCount: number | null;
  monthlyRevenue: number | null;
  aiScore: number | null;
}

export interface PublicWebSource {
  title: string;
  url: string;
  content: string;
  publishedDate: string | null;
  score: number | null;
}

export type PublicWebResearch =
  | { status: "available"; provider: "Tavily"; query: string; searchedAt: string; results: PublicWebSource[]; requestCount: 1 }
  | { status: "unavailable"; provider: "Tavily"; reason: string; query: string | null; requestCount: 0 | 1 };

// Les lignes ne contiennent jamais de nom, téléphone, courriel ou identifiant de personne.
export interface ProspectFacts {
  status: string | null;
  source: string | null;
  nextFollowUp: string | null;
  createdAt: string | null;
}

export interface ClientFacts {
  status: string | null;
  totalAmount: number | null;
  lastPurchaseDate: string | null;
  nextFollowUp: string | null;
  createdAt: string | null;
  source: string | null;
  product: string | null;
}

export interface SampledDataset<T> {
  totalCount: number | null;
  sampleSize: number;
  complete: boolean;
  rows: T[];
}

/** Snapshot construit dans la route après vérification du token et du périmètre entreprise. */
export interface AgentToolContext {
  snapshotAt: string;
  company: CompanyFacts | null;
  prospects: SampledDataset<ProspectFacts> | null;
  clients: SampledDataset<ClientFacts> | null;
  publicWebResearch?: PublicWebResearch | null;
}

export interface EvidenceFact {
  key: string;
  label: string;
  value: EvidenceValue;
  source: string;
  status: EvidenceStatus;
  note?: string;
  sampleSize?: number;
}

export interface PublicWebCitation {
  title: string;
  url: string;
  publishedDate: string | null;
}

export interface AgentToolResult {
  ok: boolean;
  agentId: AgentId;
  toolName: string;
  sources: string[];
  facts: EvidenceFact[];
  limitations: string[];
  citations?: PublicWebCitation[];
  error?: string;
}

export interface AgentToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RegisteredAgentTool extends AgentToolSchema {
  allowedAgents: readonly AgentId[];
  run: (context: AgentToolContext) => Omit<AgentToolResult, "agentId" | "toolName">;
}

export interface LLMToolCall {
  id?: string;
  name: string;
  arguments: string;
}

export type LLMToolMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LLMToolCall[] }
  | { role: "tool"; content: string; toolCallId?: string; toolName: string };

export interface AgentToolSession {
  readonly agentId: AgentId;
  readonly tools: AgentToolSchema[];
  readonly observations: AgentToolResult[];
  readonly evidencePrompt: string;
  readonly publicWebPrompt: string;
  execute: (name: string, args: unknown) => Promise<string>;
}
