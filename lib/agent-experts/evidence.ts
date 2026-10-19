import type { AgentToolResult } from "./types";

function safeCitationUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function formatEvidenceFooter(results: AgentToolResult[]): string {
  const unique = new Map<string, AgentToolResult>();
  for (const result of results) {
    const key = `${result.agentId}:${result.toolName}`;
    if (result.ok && !unique.has(key)) unique.set(key, result);
  }
  const items = [...unique.values()];
  if (!items.length) return "";

  const sources = [...new Set(items.flatMap((item) => item.sources))];
  const citationMap = new Map<string, { title: string; url: string; publishedDate: string | null }>();
  for (const citation of items.flatMap((item) => item.citations ?? [])) {
    const url = safeCitationUrl(citation.url);
    if (url && !citationMap.has(url)) citationMap.set(url, { ...citation, url });
  }
  const citations = [...citationMap.values()].slice(0, 5);
  const unavailable = [...new Set(items.flatMap((item) => item.limitations))].slice(0, 6);
  const labels: Record<string, string> = {
    "doss_company (fiche entreprise)": "Fiche entreprise",
    "doss_prospects (résumé CRM anonymisé)": "CRM prospects anonymisé",
    "doss_clients (résumé CRM anonymisé)": "CRM clients anonymisé",
  };
  const lines = ["", "---", "### Données réellement mobilisées"];
  lines.push(sources.length ? `- Sources : ${sources.map((source) => labels[source] ?? source).join(", ")}.` : "- Aucun enregistrement CRM exploitable n'a été chargé.");
  if (citations.length) {
    const links = citations.map((citation) => {
      const label = citation.title.replace(/[\[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Source Web";
      const published = citation.publishedDate ? ` (${citation.publishedDate.slice(0, 10)})` : "";
      return `[${label}](${citation.url})${published}`;
    });
    lines.push(`- Sources Web consultées : ${links.join(" · ")}.`);
  }
  lines.push(`- Outils spécialisés exécutés : ${items.map((item) => `${item.agentId}/${item.toolName}`).join(", ")}.`);
  if (unavailable.length) lines.push(`- Limites : ${unavailable.join(" ")}`);
  return lines.join("\n");
}
