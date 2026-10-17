// Garde-fous de mission : nombre d'éléments demandé, règles de fiabilité, contrôle automatique léger.
import { DOSS_AGENTS } from "./agents";

export function normalizeText(value: string): string {
  return value
    .replace(/[’‘`´]/g, "'") // apostrophes typographiques → apostrophe droite
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/* ---------- Nombre d'éléments demandé ---------- */

const NOUNS = "(?:actions?|etapes?|idees?|conseils?|recommandations?|solutions?|points?|propositions?|pistes?|astuces?)";
const NUM_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
};
// Un nombre n'est une contrainte que s'il suit un verbe de demande ("donne-moi 3 idées").
// Évite les faux positifs : "j'ai une idée", "passer à l'étape 2", "3 solutions déjà testées".
const REQUEST =
  "(?:donne|donnez|propose|proposez|liste|listez|suggere|suggerez|cite|citez|identifie|genere|generez|fais|sors|veux|voudrais|souhaite|besoin|faut|exactement|precisement|seulement|uniquement|top)";
const NUM_TOKEN = `(\\d{1,2}|${Object.keys(NUM_WORDS).join("|")})`;
const COUNT_RE = new RegExp(`\\b${REQUEST}\\b[^.!?\\n]{0,40}?\\b${NUM_TOKEN}\\s+(?:(?:des|de)\\s+)?${NOUNS}\\b`);

export function getRequestedActionCount(message: string): number | null {
  const m = normalizeText(message).match(COUNT_RE);
  if (!m) return null;
  const raw = m[1];
  const n = /^\d+$/.test(raw) ? Number(raw) : NUM_WORDS[raw];
  return n >= 1 && n <= 20 ? n : null;
}

/* ---------- Règles de fiabilité (injectées dans le prompt) ---------- */

export function buildReliabilityRules(requestedCount: number | null): string {
  const countRule =
    requestedCount !== null
      ? `L'utilisateur demande ${requestedCount} élément(s) : la liste principale contient exactement ${requestedCount} élément(s), chacun développé en profondeur.`
      : "Le plan d'action contient 3 à 5 actions priorisées, chacune développée (pourquoi, comment, indicateur). Préfère moins d'actions mieux creusées à une longue liste superficielle.";

  return `RÈGLES DE FIABILITÉ — AGENT DOSS GROUPS
Profondeur et rigueur vont ensemble : ton expertise vient du raisonnement et des méthodes éprouvées, jamais de données inventées.

ÉTIQUETTES — marque l'origine de chaque affirmation importante :
- [Fiche] : UNIQUEMENT une donnée écrite telle quelle dans la fiche ou dans les données enregistrées ci-dessous. Une déduction, un calcul ou un objectif n'est jamais [Fiche] ;
- [Calcul] : résultat d'un calcul à partir de données [Fiche] (montre le calcul) ;
- [Hypothèse] : supposition raisonnable à confirmer, y compris tout taux de conversion, volume ou délai que tu estimes ;
- [Repère général] : connaissance générale de métier (méthode, bonne pratique), sans chiffre précis présenté comme une statistique ;
- [Objectif] : une cible que tu proposes (jamais un fait). N'utilise AUCUNE autre étiquette.

INTERDITS
1. N'invente jamais clients, ventes, chiffres, statistiques, témoignages, certifications, prix, offres, réductions, essais gratuits, tests gratuits, audits gratuits, pilotes, garanties, fonctionnalités, intégrations ou automatisations. Ne chiffre pas un gain (« multiplier par trois », « taux proche de zéro ») sans le marquer [Hypothèse].
2. Offres dans les messages types : si la fiche ne décrit pas l'offre ou le prix, écris un emplacement à remplir, par exemple « [votre offre d'entrée] » ou « [votre prix] ». Ne propose un essai, un test, un audit ou une démonstration gratuits que comme une OPTION à décider (« si vous choisissez d'offrir… »), jamais comme une offre existante.
3. Ne prétends jamais qu'une action est réalisée, ni qu'Internet a été consulté, sans confirmation technique : les actions sont des recommandations à effectuer.
4. Ne garantis aucun résultat. Les chiffres cibles sont des objectifs ; les projections précisent leurs hypothèses.
5. Ne confonds pas prospects et clients ; n'appelle pas un prospect « chaud » ou « qualifié » sans donnée qui le confirme ; ne calcule un taux que si les données sont confirmées.
6. Vérifie la cohérence des villes et des pays.
7. Outils : ne recommande ni outil payant ni publicité payante par défaut. N'écris « gratuit » que si l'outil l'est réellement ; s'il est payant ou limité, écris « payant » ou « version gratuite limitée ». Budget inconnu : commence par les options à coût nul.
8. Équipe : ne cite comme responsable d'une action que les agents DOSS qui existent : ${DOSS_AGENTS.filter((a) => a.status === "active").map((a) => a.name).join(", ")}. N'invente aucun autre agent ; l'humain peut aussi être responsable.
9. Cohérence des chiffres : quand tu proposes un objectif (clients, ventes), reconstitue l'entonnoir (contacts → réponses → rendez-vous → clients) avec des taux marqués [Hypothèse] et signale si l'objectif demande un taux de conversion irréaliste ; propose alors un objectif réaliste ou un volume de contacts plus élevé.
10. Ordre logique : ne propose aucune action qui suppose des clients, factures, données ou fonctionnalités qui n'existent pas encore (exemple : relances de facturation alors qu'il y a 0 client). Ne dis jamais « configurez votre agent X » ou « via les outils en place » sans que cette fonctionnalité soit confirmée.
11. Marges et coûts : ne présente jamais une marge, un coût ou un délai de paiement comme connus s'ils ne sont pas dans la fiche. Pas de « marge de 100 % », pas d'indicateur de réussite absolu (« 0 charge », « 100 % des factures payées en 48 h ») : donne un objectif réaliste et mesurable.
12. Données chiffrées manquantes (prix, coûts, volumes) : n'en conclus rien ; construis un petit modèle à emplacements avec les formules (par exemple : chiffre d'affaires = prix × nombre de clients ; seuil de rentabilité = charges fixes ÷ marge par client), des scénarios prudent / central / optimiste marqués [Hypothèse] (le scénario prudent est le PIRE cas : charges les plus élevées, marge la plus faible), et dis quelles données remplir. Fais les calculs toi-même avec des chiffres d'exemple au lieu de répondre « impossible ».
13. Demande sans objet : si la demande part d'une prémisse fausse (exemple : « relancer mes clients inactifs » alors qu'il y en a 0), corrige-la en UNE phrase, puis traite la version la plus utile de la demande DANS TON DOMAINE (exemple : sécuriser, satisfaire et faire recommander les clients existants, même s'il n'y en a qu'un). Ne bascule pas entièrement vers un autre domaine : renvoie vers l'agent concerné seulement pour la partie qui le regarde.
14. Données du CRM : n'écris pas « il est impossible » quand il reste un actif exploitable. Ne pose jamais dans « Pour affiner » une question dont la réponse figure déjà dans les données ci-dessous (statuts, origines, relances, nombre de clients) : exploite-les d'abord. Les noms et coordonnées ne te sont pas communiqués : utilise des emplacements [Nom du client].
15. Messages types : ne présuppose aucun échange antérieur, aucun essai ni aucune démonstration déjà faits (pas de « suite à nos échanges », « notre premier échange », « avez-vous testé… »), ni ce que le destinataire a acheté ou utilise (pas de « votre agent IA », « vos premiers pas avec… ») sauf si les données ci-dessous le confirment ; utilise des emplacements [à compléter]. Ne propose de partager un cas d'usage, un témoignage ou un retour d'expérience que s'il existe réellement : sinon écris « [si vous en avez un] ».
16. Information manquante : dis-le, pose une hypothèse explicite et poursuis la réponse.
17. Chiffres du CRM : reprends-les exactement. Le nombre de prospects à traiter est celui de la ligne « encore ouverts » (hors « Client gagné » et « Perdu ») ; n'écris jamais le total des prospects à sa place. N'écris jamais « agent IA », « configuration » ou « acquisition » pour décrire ce que le client a acheté : écris « votre achat » ou « [ce que le client a acheté] ». Les outils recommandés sont ceux qui existent réellement ; n'invente pas de nom d'outil (« CRM intelligent »).
18. Preuves et rareté : n'écris jamais « j'ai récemment aidé un client », « nous avons automatisé… pour un client », « résultat : +X % », ni de cas client, comme s'ils existaient. Rédige à la place un emplacement : « [votre résultat réel, si vous en avez un] ». N'invente ni « places limitées », ni « 3 places », ni date limite, ni démonstration offerte. N'affirme aucune fonctionnalité du produit (paiement Mobile Money, installation simple…) que la fiche ne confirme pas.
19. Écriture : écris les formules en texte simple, par exemple « Seuil de rentabilité = charges fixes ÷ marge par vente ». N'utilise jamais de LaTeX (pas de $…$, \\frac, \\text) : il s'affiche tel quel sur téléphone.
20. Étiquettes exactes : une absence de donnée (« 0 FCFA de charges enregistrées ») n'est pas [Fiche] : écris « non renseigné ». Un taux ou un coût que tu estimes (frais Mobile Money, coût de l'IA) est [Hypothèse], jamais [Calcul]. Ne nomme aucun fournisseur d'IA ou d'outil que la fiche ne mentionne pas : écris « coût de l'IA » ou « abonnements ». Ne commence jamais la synthèse par « impossible ».
21. Étiquettes autorisées, et seulement celles-là : [Fiche], [Calcul], [Hypothèse], [Repère général], [Objectif], [Analyse] (ton interprétation à partir des données, jamais un fait de la fiche). N'écris jamais [Problème], [Risque] ou d'autres étiquettes inventées. [Fiche] ne s'applique qu'à un chiffre ou un fait écrit dans les données : jamais à « vous », à une ville citée en exemple, à un outil que la fiche ne mentionne pas, ni à un usage de marché. Ce que tu supposes des motivations d'un prospect ou d'un client (« ils sont saturés », « ils hésitent à cause du prix ») est une [Hypothèse], jamais un fait. Un même taux de conversion doit rester identique dans toute la réponse.

RÈGLE DE NOMBRE
${countRule}`;
}

/* ---------- Contrôle automatique léger ---------- */
// Filet de sécurité uniquement. La qualité est assurée par la passe de relecture du pipeline.

const isNegated = (sentence: string): boolean =>
  /\b(ne|n'est pas|n'a pas|n'ont pas|pas encore|aucun|aucune|sans|ne sera pas|ne sont pas|ne garantit pas|ne promet pas)\b/i.test(sentence);

const CHECKS: Array<{ pattern: RegExp; warning: string; ignoreNegated?: boolean }> = [
  {
    pattern: /\b(resultats? garantis?|garantit une augmentation|garantit des ventes|sans aucun risque)\b/i,
    warning: "Promesse de résultat ou garantie détectée : confirme qu'elle est justifiée avant publication.",
    ignoreNegated: true,
  },
  {
    pattern: /\b(essai gratuit|test gratuit|audit gratuit|pilote gratuit|consultation gratuite|demo gratuite|demonstration gratuite|\d+ ?% de (?:remise|reduction)|remise de \d+|(?:essai|test|pilote) de \d+ jours?|remboursement garanti|reduction exclusive|offre limitee|promotion exclusive)\b/i,
    warning: "Offre commerciale détectée : vérifie qu'elle existe réellement et que ses conditions sont exactes.",
  },
  {
    pattern: /\b(campagne lancee|campagne est lancee|publication effectuee|(?:j'ai|nous avons|on a|ont ete|a ete) (?:deja )?(?:envoye|contacte|publie|lance))\b/i,
    warning: "Une action semble présentée comme déjà réalisée : confirme son exécution technique.",
    ignoreNegated: true,
  },
  {
    pattern: /\b((?:j'ai|nous avons|on a) (?:recemment |deja )?(?:aide|accompagne|automatise|permis|realise)\b[^.]{0,60}\bclients?|\d+ places? (?:disponibles?|restantes?|offertes?|pour|cette)|places? limitees?|dernieres? places?)\b/i,
    warning: "Une preuve client ou une rareté (places limitées…) est affirmée : vérifie qu'elle est réelle, sinon remplace-la par un emplacement.",
    ignoreNegated: true,
  },
  {
    pattern: /\b(integration native|integre automatiquement|connecte automatiquement|connexion automatique)\b/i,
    warning: "Une intégration ou automatisation est mentionnée : confirme que cette fonctionnalité existe.",
  },
  {
    pattern: /\b(temoignage client|certifie par|certification obtenue|nos clients ont obtenu|etude de cas client)\b/i,
    warning: "Une preuve sociale ou une certification est évoquée : vérifie qu'elle est documentée.",
  },
];

const GEO_PAIRS: Array<[string, string, string]> = [
  ["abidjan", "senegal", "Vérifie l'association entre Abidjan et le Sénégal."],
  ["dakar", "cote d'ivoire", "Vérifie l'association entre Dakar et la Côte d'Ivoire."],
  ["lagos", "ghana", "Vérifie l'association entre Lagos et le Ghana."],
  ["accra", "nigeria", "Vérifie l'association entre Accra et le Nigeria."],
  ["nairobi", "tanzanie", "Vérifie l'association entre Nairobi et la Tanzanie."],
  ["kampala", "kenya", "Vérifie l'association entre Kampala et le Kenya."],
];

export function collectWarnings(answer: string): string[] {
  const warnings = new Set<string>();
  const sentences = normalizeText(answer)
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const check of CHECKS) {
    const hit = sentences.some(
      (s) => check.pattern.test(s) && !(check.ignoreNegated && isNegated(s))
    );
    if (hit) warnings.add(check.warning);
  }
  // Association ville/pays dans une même phrase (et non plus n'importe où dans le texte).
  for (const [city, country, warning] of GEO_PAIRS) {
    if (sentences.some((s) => s.includes(city) && s.includes(country))) warnings.add(warning);
  }
  return Array.from(warnings);
}

export function formatWarnings(warnings: string[]): string {
  return (
    "\n\n## Vérifications conseillées avant utilisation\n\n" +
    "Un contrôle automatique a détecté les points suivants. " +
    "Il ne s'agit pas d'une vérification externe des faits :\n\n" +
    warnings.map((w) => `- ${w}`).join("\n")
  );
}
