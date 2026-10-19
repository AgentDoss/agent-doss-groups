import type { AgentToolResult } from "./types";

export function formatEvidenceFooter(results: AgentToolResult[]): string {
  const unique = new Map<string, AgentToolResult>();
  for (const result of results) {
    const key = `${result.agentId}:${result.toolName}`;
    if (result.ok && !unique.has(key)) unique.set(key, result);
  }
  const items = [...unique.values()];
  if (!items.length) return "";

  const sources = [...new Set(items.flatMap((item) => item.sources))];
  const unavailable = [...new Set(items.flatMap((item) => item.limitations))].slice(0, 6);
  const labels: Record<string, string> = {
    "doss_company (fiche entreprise)": "Fiche entreprise",
    "doss_prospects (résumé CRM anonymisé)": "CRM prospects anonymisé",
    "doss_clients (résumé CRM anonymisé)": "CRM clients anonymisé",
  };
  const lines = ["", "---", "### Données réellement mobilisées"];
  lines.push(sources.length ? `- Sources : ${sources.map((source) => labels[source] ?? source).join(", ")}.` : "- Aucun enregistrement CRM exploitable n'a été chargé.");
  lines.push(`- Outils spécialisés exécutés : ${items.map((item) => `${item.agentId}/${item.toolName}`).join(", ")}.`);
  if (unavailable.length) lines.push(`- Limites : ${unavailable.join(" ")}`);
  return lines.join("\n");
}
