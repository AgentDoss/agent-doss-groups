import { DOSS_AGENTS, type AgentId } from "../agents";
import type {
  AgentToolContext,
  AgentToolResult,
  AgentToolSchema,
  AgentToolSession,
  RegisteredAgentTool,
} from "./types";
import { AGENT_TOOL_REGISTRY, CORE_TOOLS_BY_AGENT } from "./tools";

const toolMap = new Map(AGENT_TOOL_REGISTRY.map((tool) => [tool.name, tool]));
const validAgentIds = new Set<string>(DOSS_AGENTS.map((agent) => agent.id));
const EMPTY_ARGS_SCHEMA = { type: "object", properties: {}, required: [], additionalProperties: false };

function validateArgs(value: unknown): value is Record<string, never> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length === 0;
}

function rejected(agentId: AgentId, toolName: string, error: string): AgentToolResult {
  return { ok: false, agentId, toolName, sources: [], facts: [], limitations: [], error };
}

export function getAgentTools(agentId: AgentId): AgentToolSchema[] {
  if (!validAgentIds.has(agentId)) return [];
  return AGENT_TOOL_REGISTRY
    .filter((tool) => tool.allowedAgents.includes(agentId))
    .map(({ name, description, parameters }) => ({ name, description, parameters }));
}

export function isToolAllowed(agentId: AgentId, toolName: string): boolean {
  const tool = toolMap.get(toolName);
  return !!tool && validAgentIds.has(agentId) && tool.allowedAgents.includes(agentId);
}

export function executeAgentTool(
  agentId: AgentId,
  toolName: string,
  args: unknown,
  context: AgentToolContext,
): AgentToolResult {
  if (!validAgentIds.has(agentId)) return rejected(agentId, toolName, "Agent non reconnu.");
  const tool = toolMap.get(toolName);
  if (!tool || !tool.allowedAgents.includes(agentId)) {
    return rejected(agentId, toolName, "Outil inconnu ou non autorisé pour cet agent.");
  }
  if (!validateArgs(args)) {
    return rejected(agentId, toolName, "Arguments invalides : cet outil n'accepte aucun paramètre.");
  }
  try {
    const result = tool.run(context);
    return { ...result, agentId, toolName };
  } catch {
    return rejected(agentId, toolName, "L'outil n'a pas pu produire un résultat sûr.");
  }
}

function serializeEvidence(results: AgentToolResult[]): string {
  if (results.length === 0) return "Aucun outil métier n'a fourni de résultat vérifiable.";
  const compact = results.map((result) => ({
    tool: result.toolName,
    ok: result.ok,
    sources: result.sources,
    facts: result.facts,
    limitations: result.limitations,
    citations: result.citations ?? [],
    ...(result.error ? { error: result.error } : {}),
  }));
  return JSON.stringify(compact).slice(0, 12_000);
}

function serializePublicWeb(context: AgentToolContext, agentId: AgentId): string {
  if (agentId !== "director" && agentId !== "marketing" && agentId !== "strategy") return "";
  const research = context.publicWebResearch;
  if (!research || research.status !== "available") return "";
  const serialized = JSON.stringify({
    provider: research.provider,
    searchedAt: research.searchedAt,
    results: research.results.map(({ title, url, publishedDate, content }) => ({ title, url, publishedDate, excerpt: content })),
  });
  return serialized.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function createAgentToolSession(agentId: AgentId, context: AgentToolContext): AgentToolSession {
  const observations: AgentToolResult[] = [];
  const executed = new Map<string, AgentToolResult>();

  for (const toolName of CORE_TOOLS_BY_AGENT[agentId] ?? []) {
    const result = executeAgentTool(agentId, toolName, {}, context);
    executed.set(toolName, result);
    if (result.ok) observations.push(result);
  }

  return {
    agentId,
    tools: getAgentTools(agentId),
    observations,
    get evidencePrompt() {
      // Les extraits Web disponibles sont rendus dans un bloc utilisateur distinct, jamais dans le prompt système.
      const trustedOnly = observations.filter((result) =>
        !(result.toolName === "public_web_research" && result.facts.some((fact) => fact.key === "public_web_excerpts"))
      );
      return serializeEvidence(trustedOnly);
    },
    get publicWebPrompt() {
      return serializePublicWeb(context, agentId);
    },
    execute: async (name, args) => {
      if (executed.has(name)) return JSON.stringify(executed.get(name));
      const result = executeAgentTool(agentId, name, args, context);
      if (result.ok) {
        executed.set(name, result);
        observations.push(result);
      }
      return JSON.stringify(result);
    },
  };
}

export function publicWebPromptForAgent(sessions: readonly AgentToolSession[], agentId: AgentId): string {
  return sessions.find((session) => session.agentId === agentId)?.publicWebPrompt ?? "";
}

export function validateRegistry(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const tool of AGENT_TOOL_REGISTRY) {
    if (seen.has(tool.name)) errors.push(`Nom d'outil dupliqué : ${tool.name}`);
    seen.add(tool.name);
    if (!tool.allowedAgents.length) errors.push(`Outil sans agent autorisé : ${tool.name}`);
    if (!tool.parameters || tool.parameters.type !== "object" || tool.parameters.additionalProperties !== false) {
      errors.push(`Schéma d'arguments non fermé : ${tool.name}`);
    }
    for (const id of tool.allowedAgents) {
      if (!validAgentIds.has(id)) errors.push(`Agent inconnu ${id} dans ${tool.name}`);
    }
  }
  for (const agent of DOSS_AGENTS) {
    if (!(CORE_TOOLS_BY_AGENT[agent.id]?.length)) errors.push(`Agent sans outil de base : ${agent.id}`);
    if (!AGENT_TOOL_REGISTRY.some((tool: RegisteredAgentTool) => tool.allowedAgents.includes(agent.id))) {
      errors.push(`Agent sans outil déclaré : ${agent.id}`);
    }
  }
  return errors;
}
