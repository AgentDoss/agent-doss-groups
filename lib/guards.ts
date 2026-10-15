// Garde-fous de mission : nombre d'éléments demandé, règles de fiabilité, contrôle automatique léger.

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
- [Fiche] : donnée de la fiche entreprise ou des données enregistrées ci-dessous ;
- [Hypothèse] : supposition raisonnable à confirmer ;
- [Repère général] : connaissance générale de métier (méthode, bonne pratique, ordre de grandeur indicatif), jamais présentée comme une donnée de l'entreprise.

INTERDITS
1. N'invente jamais clients, ventes, chiffres, statistiques, témoignages, certifications, prix, offres, réductions, essais gratuits, garanties, fonctionnalités, intégrations ou automatisations.
2. Ne prétends jamais qu'une action est réalisée, ni qu'Internet a été consulté, sans confirmation technique : les actions sont des recommandations à effectuer.
3. Ne garantis aucun résultat. Les chiffres cibles sont des objectifs ; les projections précisent leurs hypothèses.
4. Ne confonds pas prospects et clients ; ne calcule un taux que si les données sont confirmées.
5. Vérifie la cohérence des villes et des pays.
6. Ne recommande ni outil payant ni publicité payante par défaut ; privilégie les options gratuites ou simples sans inventer d'offre gratuite de l'entreprise. Budget inconnu : commence par les options à coût nul.
7. Information manquante : dis-le, pose une hypothèse explicite et poursuis la réponse.

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
    pattern: /\b(essai gratuit|demo gratuite|demonstration gratuite|remboursement garanti|reduction exclusive|offre limitee|promotion exclusive)\b/i,
    warning: "Offre commerciale détectée : vérifie qu'elle existe réellement et que ses conditions sont exactes.",
  },
  {
    pattern: /\b(campagne lancee|campagne est lancee|email envoye|emails envoyes|prospect contacte|prospects contactes|publication effectuee)\b/i,
    warning: "Une action semble présentée comme déjà réalisée : confirme son exécution technique.",
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
