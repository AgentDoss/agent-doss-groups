// Pipeline de mission en plusieurs étapes.
//
//  quick    : 1 appel          → réponse courte, diffusée en direct, avec préchargement CRM local
//  standard : 2 à 3 appels     → tool-calling borné + relecture qualité (diffusée en direct)
//  expert   : 3 à 7 appels     → plan du Directeur → experts en parallèle → synthèse (diffusée en direct)
//
// Chaque étape respecte un budget de temps (deadlineAt) et dégrade proprement :
// on livre toujours la meilleure version disponible plutôt qu'une erreur.

import { completeLLM, completeLLMWithTools, streamLLM, LLMError, type LLMOptions } from "./llm";
import { createAgentToolSession } from "./agent-experts/registry";
import { formatEvidenceFooter } from "./agent-experts/evidence";
import type { AgentToolContext, AgentToolResult, AgentToolSession } from "./agent-experts/types";
import {
  DOSS_AGENTS,
  getAgentById,
  buildAgentSystemPrompt,
  type AgentId,
  type Depth,
  type DirectorRoute,
  type DossAgent,
  type PromptMode,
} from "./agents";
import { domainRules, collectProblems, formatProblemsForRepair, type Problem } from "./guards";

export type PipelineEvent =
  | { type: "status"; stage: string; label: string }
  | { type: "delta"; text: string };

export interface PipelineInput {
  message: string;
  route: DirectorRoute;
  primary: DossAgent;
  depth: Depth;
  rules: string;    // règles de fiabilité + règle de nombre
  facts: AgentToolContext; // snapshot CRM anonymisé, borné et scoppé par la route authentifiée
  history: string;  // historique récent (peut être vide)
  deadlineAt: number; // epoch ms : au-delà, on dégrade
  emit: (e: PipelineEvent) => void;
}

export interface PipelineResult {
  answer: string;
  provider: string | null;
  depth: Depth;
  interrupted: boolean;
}

const FIRST_TOKEN_MS = 12_000;

/* ---------- Utilitaires ---------- */

// Consigne ajoutée automatiquement quand la demande porte sur des relances (ne dépend pas du modèle).
function taskExtra(message: string): string {
  const m = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\brelanc/.test(m)) return "";
  return `CONSIGNE SPÉCIALE RELANCE
La demande porte sur des relances. Le plan d'action contient, pour les prospects en retard, une séquence de 3 messages écrits en entier et DIFFÉRENTS les uns des autres : J0 (rappel court qui cite le pack d'entrée de la fiche avec son prix réel), J+3 (une valeur ou une question simple), J+7 (dernier message poli). Un bloc par message ; ne répète jamais le même message deux fois ; signe « AGENT DOSS GROUPS ». Ne présuppose aucun besoin ni échange antérieur : n'écris pas « vous avez toujours besoin », « concernant votre projet », « préférez-vous qu'on laisse tomber ». Sans réponse après J+7 : pause de 30 jours, jamais « ne relancez plus ».`;
}

function sys(i: PipelineInput, agent: DossAgent, mode: PromptMode, extra = "", moreAgents: string[] = [], evidence = ""): string {
  // Ordre recommandé pour Gemini 3 : rôle et méthode, puis données, puis consignes de la tâche,
  // et les règles essentielles TOUTES À LA FIN (les contraintes en fin de prompt sont les mieux suivies).
  return [
    buildAgentSystemPrompt(agent, mode),
    evidence ? `PREUVES STRUCTURÉES FOURNIES PAR LES OUTILS AUTORISÉS\n${evidence}` : "",
    i.history,
    domainRules([agent.id, ...moreAgents]),
    extra,
    taskExtra(i.message),
    i.rules,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const PIPELINE_VERSION = "p6";
const remaining = (i: PipelineInput) => i.deadlineAt - Date.now();
const within = (ms: number) => AbortSignal.timeout(Math.max(3_000, ms));

function opts(maxTokens: number, signal: AbortSignal, temperature?: number): LLMOptions {
  return { maxTokens, signal, temperature, firstTokenTimeoutMs: FIRST_TOKEN_MS };
}

// Diffuse l'étape finale vers le client. Si elle échoue avant tout texte : l'erreur remonte.
// Si elle échoue en cours de route : on garde ce qui a été reçu.
async function streamFinal(
  system: string,
  user: string,
  o: LLMOptions,
  emit: PipelineInput["emit"]
): Promise<{ text: string; provider: string | null; interrupted: boolean }> {
  let text = "";
  let provider: string | null = null;
  let interrupted = false;
  try {
    for await (const c of streamLLM(system, user, o)) {
      provider = c.provider;
      text += c.text;
      emit({ type: "delta", text: c.text });
    }
  } catch (e) {
    if (!text) throw e;
    interrupted = true;
  }
  if (!text.trim()) throw new LLMError("Réponse vide");
  return { text, provider, interrupted };
}

function attachEvidence(
  i: PipelineInput,
  result: PipelineResult,
  observations: AgentToolResult[],
): PipelineResult {
  const footer = formatEvidenceFooter(observations);
  if (!footer) return result;
  i.emit({ type: "delta", text: footer });
  return { ...result, answer: result.answer + footer };
}

function collectEvidence(sessions: AgentToolSession[]): AgentToolResult[] {
  const unique = new Map<string, AgentToolResult>();
  for (const session of sessions) {
    for (const result of session.observations) {
      if (result.ok) unique.set(`${result.agentId}:${result.toolName}`, result);
    }
  }
  return [...unique.values()];
}

function evidencePrompt(sessions: AgentToolSession[]): string {
  return sessions.map((session) => `${session.agentId}: ${session.evidencePrompt}`).join("\n").slice(0, 18_000);
}

/* ---------- Étape de relecture qualité ---------- */

const REVIEW_INSTRUCTIONS = `MODE RELECTURE QUALITÉ
Tu reçois un BROUILLON de ta propre réponse. Améliore-le, puis livre la version finale. Ne commente pas la relecture.
Grille :
1. Spécificité : chaque recommandation est-elle reliée à CETTE entreprise ? Sinon, concrétise-la ou supprime-la.
2. Profondeur : raisonnement (pourquoi), alternatives, étapes concrètes, exemples ou modèles utilisables, indicateur de réussite.
3. Fiabilité : tout chiffre, promesse, offre, fonctionnalité ou action non confirmés devient une hypothèse ou un objectif ; la RÈGLE DE NOMBRE est respectée ; les étiquettes [Fiche] / [Hypothèse] / [Repère général] sont justes.
4. Complétude : ajoute ce qu'un expert senior ajouterait (risques, ordre d'exécution, cas limites).
5. Cohérence avec les données : compte exactement ce que disent les données (un prospect « Client gagné » n'est plus un prospect ouvert ; une ancienneté n'est pas un retard de relance). Si deux chiffres de ta réponse se contredisent, corrige-les.
6. Périmètre : le plan traite-t-il d'abord le domaine de TON rôle ? Sinon recentre-le et renvoie vers l'agent concerné en une ligne. Les options comparées doivent être de vraies alternatives, pas un homme de paille.
7. Messages types : supprime toute formule qui présuppose un échange, une proposition, un essai ou un tarif non confirmés (« suite à nos échanges », « notre proposition ») ; les seuls emplacements permis sont [Nom du prospect], [Prénom] et [Quartier] ; l'offre, la solution et le prix sont écrits en toutes lettres à partir de la fiche (jamais [à compléter], [votre offre] ni [votre solution]).
8. Clarté : titres nets, phrases directes, aucune répétition.
Réécris les parties faibles ; n'allonge pas sans valeur ajoutée. Réponds uniquement avec la version finale complète, dans la même structure.`;

async function reviewAndStream(
  i: PipelineInput,
  agent: DossAgent,
  draft: string,
  provider: string | null,
  evidence = "",
): Promise<PipelineResult> {
  // Plus assez de temps : on livre le brouillon tel quel.
  if (remaining(i) < 12_000) {
    i.emit({ type: "delta", text: draft });
    return { answer: draft, provider, depth: i.depth, interrupted: false };
  }

  i.emit({ type: "status", stage: "review", label: "Contrôle qualité et approfondissement…" });
  try {
    const r = await streamFinal(
      sys(i, agent, "deep", REVIEW_INSTRUCTIONS + formatProblemsForRepair(collectProblems(draft)), [], evidence),
      `DEMANDE DE L'UTILISATEUR :\n${i.message}\n\nBROUILLON À AMÉLIORER :\n${draft}`,
      opts(3500, within(remaining(i))),
      i.emit
    );
    return { answer: r.text, provider: r.provider ?? provider, depth: i.depth, interrupted: r.interrupted };
  } catch {
    // La relecture a échoué avant d'écrire quoi que ce soit : le brouillon reste une bonne réponse.
    i.emit({ type: "delta", text: draft });
    return { answer: draft, provider, depth: i.depth, interrupted: false };
  }
}

/* ---------- Mode expert : plan → experts → synthèse ---------- */

interface Task { agent: DossAgent; question: string; mode: PromptMode }
interface Plan { need: string; missing: string[]; tasks: Array<{ agent: AgentId; question: string }> }

const PLANNABLE = new Set<AgentId>(
  DOSS_AGENTS.filter((a) => a.status === "active" && a.id !== "director").map((a) => a.id)
);

function planSystem(i: PipelineInput, evidence: string): string {
  const team = DOSS_AGENTS.filter((a) => PLANNABLE.has(a.id))
    .map((a) => `- ${a.id} : ${a.role}`)
    .join("\n");
  return `Tu es DOSS Directeur. Prépare le travail de ton équipe pour la mission reçue.

Agents disponibles :
${team}

Retourne UNIQUEMENT un objet JSON valide, sans texte autour ni balises :
{"need":"reformulation du vrai besoin en 1 à 2 phrases","missing_info":["information manquante utile"],"tasks":[{"agent":"id_agent","question":"sous-question précise pour cet expert"}]}

Règles :
- 2 à 3 tâches, agents distincts, ids de la liste uniquement.
- Les sous-questions sont complémentaires, sans chevauchement, et reliées à la situation de l'entreprise.
- Agent principal pressenti : ${i.primary.id === "director" ? "à toi de choisir" : i.primary.id}.
- missing_info : 0 à 3 éléments, seulement ce qui change vraiment l'analyse.

PREUVES DE COUVERTURE FOURNIES PAR LES OUTILS DU DIRECTEUR :
${evidence}`;
}

function parsePlan(raw: string): Plan | null {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const j = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>;
    const need = typeof j.need === "string" ? j.need.trim() : "";
    const missing = Array.isArray(j.missing_info)
      ? j.missing_info.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 3)
      : [];
    const seen = new Set<string>();
    const tasks: Plan["tasks"] = [];
    if (Array.isArray(j.tasks)) {
      for (const t of j.tasks as Array<Record<string, unknown>>) {
        const id = t?.agent as AgentId;
        const q = typeof t?.question === "string" ? t.question.trim() : "";
        if (PLANNABLE.has(id) && q && !seen.has(id)) {
          seen.add(id);
          tasks.push({ agent: id, question: q });
        }
      }
    }
    return tasks.length ? { need, missing, tasks: tasks.slice(0, 3) } : null;
  } catch {
    return null;
  }
}

function fallbackPlan(i: PipelineInput): Plan {
  const ids = [i.primary.id, ...i.route.supportingAgents].filter((id) => PLANNABLE.has(id));
  return {
    need: "",
    missing: [],
    tasks: [...new Set(ids)].slice(0, 3).map((agent) => ({ agent, question: i.message })),
  };
}

function buildTeam(i: PipelineInput, plan: Plan): Task[] {
  const team: Task[] = [];
  if (i.primary.id !== "director") {
    const own = plan.tasks.find((t) => t.agent === i.primary.id);
    team.push({ agent: i.primary, question: own?.question ?? i.message, mode: "deep" });
  }
  for (const t of plan.tasks) {
    if (team.length >= 3) break;
    const agent = getAgentById(t.agent);
    if (agent && !team.some((x) => x.agent.id === agent.id)) {
      team.push({ agent, question: t.question, mode: "contribution" });
    }
  }
  // Aucun spécialiste identifié : le Directeur traite lui-même en profondeur.
  if (team.length === 0) team.push({ agent: i.primary, question: i.message, mode: "deep" });
  return team;
}

const SYNTHESIS_INSTRUCTIONS = `MODE SYNTHÈSE DU DIRECTEUR
Tu reçois les analyses de plusieurs experts de ton équipe. Produis la réponse finale UNIQUE destinée au chef d'entreprise, dans la structure du FORMAT ci-dessus.
Méthode :
1. Fusionne, ne juxtapose pas : supprime les répétitions, relie les analyses entre elles.
2. Résous les contradictions : indique ce que tu retiens et pourquoi.
3. Priorise (impact × effort) et ordonne dans le temps (cette semaine, 30 jours, 90 jours si pertinent).
4. Garde ce qui est spécifique et concret (scripts, modèles, exemples) ; retire les généralités.
5. Corrige toute affirmation non soutenue : chiffre, promesse, offre, fonctionnalité ou action présentée comme réalisée devient une hypothèse ou un objectif.
6. Dans le plan d'action, indique l'agent DOSS responsable de chaque action.
7. Intègre les informations manquantes signalées dans la section « Pour affiner ».
8. Conserve en entier les messages prêts à copier et les séquences (J0, J+3, J+7) rédigés par les experts : ne les résume jamais. Les seuls emplacements permis sont [Nom du prospect], [Prénom] et [Quartier] ; l'offre et le prix viennent de la fiche. Applique aussi les RÈGLES DES EXPERTS ci-dessous.
Réponds uniquement avec la réponse finale complète.`;

function dedupeProblems(list: Problem[]): Problem[] {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x.warning) ? false : (seen.add(x.warning), true)));
}

function fallbackAnswer(parts: Array<{ task: Task; text: string }>): string {
  const deep = parts.find((p) => p.task.mode === "deep");
  if (deep) return deep.text;
  return parts.map((p) => `# ${p.task.agent.name}\n\n${p.text}`).join("\n\n");
}

async function runExpert(i: PipelineInput): Promise<PipelineResult> {
  const sessions: AgentToolSession[] = [];
  let plan = fallbackPlan(i);
  const directorSession = i.primary.id === "director" ? createAgentToolSession("director", i.facts) : null;
  if (directorSession) sessions.push(directorSession);

  // 1. PLAN du Directeur (court, JSON). En cas d'échec : plan de secours issu du routage local.
  // L'appel de plan n'est utile que si le routage local n'a trouvé aucun spécialiste (économise 1 appel).
  if (i.primary.id === "director" && remaining(i) > 35_000) {
    i.emit({ type: "status", stage: "plan", label: "Le Directeur analyse la mission et la répartit…" });
    try {
      const r = await completeLLM(
        planSystem(i, directorSession?.evidencePrompt ?? ""),
        `MISSION :\n${i.message}`,
        opts(700, within(9_000), 0.2),
      );
      plan = parsePlan(r.text) ?? plan;
    } catch {
      /* plan de secours conservé */
    }
  }

  // 2. EXPERTS en parallèle : l'agent principal en profondeur, les autres en contribution ciblée.
  const team = buildTeam(i, plan);
  i.emit({
    type: "status",
    stage: "experts",
    label: `Analyse en cours : ${team.map((t) => t.agent.name).join(", ")}…`,
  });

  const budget = Math.min(28_000, Math.max(10_000, remaining(i) - 22_000));
  const teamSessions = team.map((task) => createAgentToolSession(task.agent.id, i.facts));
  sessions.push(...teamSessions);
  const toolCallingIndex = Math.max(0, team.findIndex((task) => task.mode === "deep"));
  const settled = await Promise.allSettled(
    team.map((t, index) => {
      const session = teamSessions[index];
      const system = sys(i, t.agent, t.mode, "", [], session.evidencePrompt);
      const user =
        `MISSION DE L'UTILISATEUR :\n${i.message}\n\n` +
        (plan.need ? `BESOIN IDENTIFIÉ PAR LE DIRECTEUR :\n${plan.need}\n\n` : "") +
        `TA SOUS-MISSION :\n${t.question}`;
      const options = opts(t.mode === "deep" ? 3000 : 1500, within(budget));
      const call = index === toolCallingIndex
        ? completeLLMWithTools(system, user, session.tools, session.execute, options)
        : completeLLM(system, user, options);
      return call.then((r) => ({ task: t, text: r.text.trim(), provider: r.provider }));
    })
  );
  const parts = settled.flatMap((s) => (s.status === "fulfilled" && s.value.text ? [s.value] : []));
  if (parts.length === 0) throw new LLMError("Aucun agent n'a pu produire d'analyse (délai ou fournisseurs indisponibles).", 503);

  const lastProvider = parts[parts.length - 1].provider;
  const observations = collectEvidence(sessions);
  const dataEvidence = evidencePrompt(sessions);

  // Un seul expert disponible : relecture qualité classique.
  if (parts.length === 1) {
    const result = await reviewAndStream(i, parts[0].task.agent, parts[0].text, lastProvider, dataEvidence);
    return attachEvidence(i, result, observations);
  }

  // Plus assez de temps pour la synthèse : on livre le meilleur contenu disponible.
  if (remaining(i) < 14_000) {
    const answer = fallbackAnswer(parts);
    i.emit({ type: "delta", text: answer });
    return attachEvidence(i, { answer, provider: lastProvider, depth: i.depth, interrupted: false }, observations);
  }

  // 3. SYNTHÈSE du Directeur, diffusée en direct.
  i.emit({ type: "status", stage: "synthesis", label: "Le Directeur fusionne les analyses…" });
  const director = getAgentById("director")!;
  const synthesisUser =
    `DEMANDE DU CHEF D'ENTREPRISE :\n${i.message}\n\n` +
    (plan.need ? `BESOIN IDENTIFIÉ : ${plan.need}\n\n` : "") +
    (plan.missing.length ? `INFORMATIONS MANQUANTES SIGNALÉES :\n${plan.missing.map((m) => `- ${m}`).join("\n")}\n\n` : "") +
    `ANALYSES DES EXPERTS :\n\n` +
    parts
      .map((p) => `### ${p.task.agent.name} (${p.task.mode === "deep" ? "analyse principale" : "contribution"})\n${p.text}`)
      .join("\n\n");

  try {
    const r = await streamFinal(
      sys(
        i,
        director,
        "deep",
        SYNTHESIS_INSTRUCTIONS +
          "\nRÈGLES DES EXPERTS :\n" +
        [...new Set(parts.flatMap((p) => (p.task.agent.id === "director" ? [] : p.task.agent.guardrails)))]
            .map((g) => `- ${g}`)
            .join("\n") +
          formatProblemsForRepair(dedupeProblems(parts.flatMap((p) => collectProblems(p.text)))),
        parts.map((p) => p.task.agent.id),
        dataEvidence,
      ),
      synthesisUser,
      opts(4000, within(remaining(i))),
      i.emit
    );
    return attachEvidence(i, { answer: r.text, provider: r.provider ?? lastProvider, depth: i.depth, interrupted: r.interrupted }, observations);
  } catch {
    const answer = fallbackAnswer(parts);
    i.emit({ type: "delta", text: answer });
    return attachEvidence(i, { answer, provider: lastProvider, depth: i.depth, interrupted: false }, observations);
  }
}

/* ---------- Point d'entrée ---------- */

export async function runMissionPipeline(i: PipelineInput): Promise<PipelineResult> {
  if (i.depth === "quick") {
    i.emit({ type: "status", stage: "quick", label: `${i.primary.name} répond…` });
    const session = createAgentToolSession(i.primary.id, i.facts);
    const r = await streamFinal(
      sys(i, i.primary, "quick", "", [], session.evidencePrompt),
      i.message,
      opts(1500, within(remaining(i))),
      i.emit,
    );
    return attachEvidence(i, { answer: r.text, provider: r.provider, depth: "quick", interrupted: r.interrupted }, session.observations);
  }

  if (i.depth === "standard") {
    i.emit({ type: "status", stage: "draft", label: `${i.primary.name} prépare une analyse approfondie…` });
    const session = createAgentToolSession(i.primary.id, i.facts);
    const draft = await completeLLMWithTools(
      sys(i, i.primary, "deep", "", [], session.evidencePrompt),
      i.message,
      session.tools,
      session.execute,
      opts(3000, within(remaining(i) - 15_000)),
    );
    if (!draft.text.trim()) throw new LLMError("Le modèle IA n'a retourné aucune réponse.");
    const result = await reviewAndStream(i, i.primary, draft.text.trim(), draft.provider, session.evidencePrompt);
    return attachEvidence(i, result, session.observations);
  }

  return runExpert(i);
}
