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

  const team = DOSS_AGENTS.filter((a) => a.status === "active").map((a) => a.name).join(", ");

  // Huit règles seulement : au-delà de 5 à 7 règles prioritaires, les modèles en oublient.
  // Le détail propre à chaque métier est dans domainRules(), et les contrôles précis dans CHECKS.
  return `RÈGLES ESSENTIELLES (vérifie-les une à une avant de répondre)
1. DONNÉES. Appuie-toi uniquement sur la fiche et les données enregistrées ci-dessus. Ce qui n'y figure pas est « non renseigné » ou une [Hypothèse] explicite. N'invente ni client, ni chiffre, ni statistique, ni prix, ni offre, ni remise, ni cadeau, ni délai, ni essai ou audit gratuit, ni fonctionnalité, ni témoignage, ni résultat.
2. ÉTIQUETTES. Six seulement : [Fiche] (écrit tel quel dans les données), [Calcul] (montre le calcul), [Hypothèse] (tout taux, volume ou délai estimé, et toute motivation supposée d'un prospect), [Repère général] (méthode, sans chiffre), [Objectif] (cible proposée), [Analyse] (ton interprétation). Aucune autre étiquette, aucun numéro de règle.
3. CHIFFRES. Reprends les chiffres du CRM exactement (prospects à traiter = ligne « encore ouverts »). Si une ligne CALCUL DE RÉFÉRENCE existe, reprends-la sans refaire le calcul. Un pipeline ne convertit jamais à 100 % : applique 20 % [Hypothèse]. Mêmes taux et mêmes nombres dans toute la réponse ; le rythme proposé égale le total annoncé.
4. MESSAGES À COPIER. Texte entier, prêt à envoyer, avec l'offre et le prix réels de la fiche ; seuls [Nom du prospect], [Prénom] et [Quartier] restent à remplir ; signé AGENT DOSS GROUPS. Écris un simple rappel court, sans échange antérieur présupposé (« que nous avions évoqué », « avez-vous pu avancer »), sans gain chiffré promis, sans statistique.
5. PROMESSES. Présente tout résultat comme un objectif. Ni garantie, ni « places limitées », ni preuve client inventée.
6. RÔLE. Reste dans ton domaine. Tu recommandes, l'humain exécute : n'écris jamais qu'une action est faite ni qu'Internet a été consulté. Responsables possibles : ${team}, ou l'humain.
7. FORME. En français ; formules en texte simple (pas de LaTeX) ; pas de tableau Markdown ; aucun fournisseur d'IA nommé ; outils à coût nul d'abord, « gratuit » seulement s'il l'est réellement.
8. QUESTIONS. « Pour affiner » : 3 questions au plus, jamais sur une donnée déjà fournie. Information manquante : pose une hypothèse et poursuis.

RÈGLE DE NOMBRE
${countRule}`;
}

/* ---------- Règles de métier (chargées seulement pour les agents concernés) ---------- */

const FINANCE_RULES = `FINANCE ET CHIFFRES
- Marges, coûts et délais de paiement ne sont jamais présentés comme connus s'ils ne sont pas dans la fiche ; pas de « marge de 100 % », pas d'indicateur absolu (« 0 charge ») : donne un objectif réaliste et mesurable.
- Données chiffrées manquantes : ne conclus pas « impossible ». Construis un petit modèle avec formules (chiffre d'affaires = prix × nombre de clients ; seuil de rentabilité = charges fixes ÷ marge par client), trois scénarios [Hypothèse] (le prudent est le PIRE cas : charges les plus élevées, marge la plus faible), calcule avec des chiffres d'exemple et dis quelles données remplir.
- Une absence de donnée (« 0 FCFA de charges enregistrées ») s'écrit « non renseigné », pas [Fiche]. Un taux ou un coût estimé est [Hypothèse], jamais [Calcul].`;

const FUNNEL_RULES = `ENTONNOIR ET OBJECTIFS
- Distingue les démarches (messages envoyés à froid), les prospects qualifiés (ceux qui répondent) et les clients. Le taux de 20 % [Hypothèse] s'applique aux prospects qualifiés, jamais aux démarches à froid. Démarches nécessaires = prospects qualifiés ÷ taux de réponse (10 à 30 % selon le scénario).
- Écris « atteignable » seulement si ventes par mois × nombre de mois atteint l'objectif ; sinon écris « non atteint en N mois » et dis combien de mois il faut. Un taux calculé sur 4 prospects n'est pas une donnée fiable.
- Si les données contiennent une ligne « CALCUL DE RÉFÉRENCE », reprends ses chiffres tels quels (démarches, mois) sans refaire un autre calcul.
- Il reste toujours un actif exploitable (prospects ouverts, client existant) : ne réponds jamais « impossible ».`;

const CLIENT_RULES = `CLIENTS ET PREUVES
- Si la demande part d'une prémisse fausse (par exemple « relancer mes clients inactifs » alors qu'il y en a 0), corrige-la en UNE phrase, puis traite la version la plus utile dans ton domaine (satisfaire et faire recommander le ou les clients existants). Renvoie vers l'agent concerné seulement pour sa partie.
- Ne propose aucune action qui suppose des clients, factures ou fonctionnalités inexistants. Ne présuppose pas ce que le client a acheté : écris « votre achat » ou reprends la ligne « offre achetée » des données.
- Aucune preuve inventée (« j'ai récemment aidé un client », « résultat : +X % ») : écris « [votre résultat réel, si vous en avez un] ».
- N'écris pas de message d'abonnement à un client qui vient d'acheter (moins de 14 jours) : demande d'abord son retour d'expérience, puis propose l'abonnement.`;

const CALENDAR_RULES = `CALENDRIER ET CONTENU
- Numérote « Jour N » ; n'écris jamais « dimanche » ni « fin du mois » pour un jour du plan. Chaque jour a sa propre ligne et son texte prêt à publier.
- Pas de statistique de marché, pas de « coulisses » ni de projet ou client en cours qui n'existe pas.`;

const DOMAIN_BY_AGENT: Record<string, string[]> = {
  finance: [FINANCE_RULES, FUNNEL_RULES],
  strategy: [FUNNEL_RULES, FINANCE_RULES],
  analyst: [FUNNEL_RULES, FINANCE_RULES],
  director: [FUNNEL_RULES, CLIENT_RULES],
  prospect: [FUNNEL_RULES, CLIENT_RULES],
  commercial: [CLIENT_RULES, FUNNEL_RULES],
  marketing: [CALENDAR_RULES, CLIENT_RULES],
  client: [CLIENT_RULES],
  assistant: [FUNNEL_RULES],
};

export function domainRules(agentIds: string[]): string {
  const blocks = [...new Set(agentIds.flatMap((id) => DOMAIN_BY_AGENT[id] ?? []))];
  return blocks.length ? `RÈGLES DE MÉTIER (dans ton domaine)\n${blocks.join("\n\n")}` : "";
}

export const RULES_VERSION = "r33";

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
    pattern: /\b(gagn\w*|economis\w*)\s+(?:desormais |environ |jusqu'a )?\d+(?:[.,]\d+)?\s?(?:h\b|heures?|minutes?|%)/i,
    warning: "Un gain chiffré (« gagner 1 h par jour »…) est promis : vérifie qu'il est démontré, sinon présente-le comme un objectif ou retire-le.",
    ignoreNegated: true,
  },
  {
    pattern: /\b(?:(?:[1-9]\d?) ?% des (?:ventes|clients|commercants|entreprises|pme|consommateurs|boutiques|personnes)|le saviez-vous|statistiquement)\b/i,
    warning: "Une statistique sans source est avancée (« 80 % des… » ou « statistiquement ») : retire-la ou remplace-la par une question que ton client peut vérifier lui-même.",
  },
  {
    pattern: /\b(?:(?:je |nous |on )?(?:vous )?(?:offre|offrons|offrirai|offrirons|accorde|accordons|accorderai)\w* (?:\w+ ){0,3}(?:reduction|remise|rabais|cadeau|bonus)|reduction sur votre)/i,
    warning: "Offre commerciale détectée : vérifie qu'elle existe réellement et que ses conditions sont exactes.",
  },
  {
    pattern: /\b(?:avez-vous pu avancer|que nous avions (?:evoque|discute)|nous avons (?:evoque|discute)|suite a (?:notre|nos) (?:echange|discussion|conversation|appel))\b/i,
    warning: "Le message présuppose un échange passé : remplace-le par un rappel court qui cite le pack et son prix, ou vérifie que cet échange a bien eu lieu.",
  },
  {
    pattern: /\b(?:diviser par (?:deux|2|trois|3)|divise par (?:deux|2|trois|3)|multiplier par \d|multiplie par \d|doubler (?:vos|votre|les)|doublez (?:vos|votre|les))/i,
    warning: "Un gain chiffré (« diviser par deux »…) est promis : vérifie qu'il est démontré, sinon écris « gagner du temps ».",
  },
  {
    pattern: /\[(?:risque|probleme|raisonnement|calcul de reference|manque|verification|solution|conseil|astuce|attention|recommandation|point de vigilance|constat|alerte)\]/i,
    warning: "Une étiquette non autorisée (par exemple [Risque]) est utilisée : seules [Fiche], [Calcul], [Hypothèse], [Repère général], [Objectif] et [Analyse] sont valides.",
  },
  {
    pattern: /\[(?!(?:fiche|calcul|hypothese|repere general|objectif|analyse|source|sources)\b[^\]]*\]|constat\]|alerte\]|conseil\]|astuce\]|attention\]|recommandation\]|nom du prospect\]|nom du client\]|risque\]|probleme\]|raisonnement\]|calcul de reference\]|manque\]|verification\]|solution\]|texte\]|image\]|photo\]|video\]|produit\]|statut\]|prenom\]|votre nom\]|votre prenom\]|quartier\]|nom\]|sources?\])[^\]]{3,70}\]/i,
    warning: "Un emplacement à compléter ou une référence interne apparaît dans un message (par exemple [Nom du pack], [votre offre], [Règle 15]) : remplace-le par l'offre ou le prix réel de ta fiche avant d'envoyer.",
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

export interface Problem {
  warning: string;
  excerpt: string; // phrase d'origine (non normalisée), tronquée
}

// Même contrôle que collectWarnings, mais renvoie aussi la phrase fautive :
// sert à demander au modèle une correction ciblée avant l'affichage.
export function collectProblems(answer: string): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<string>();
  const originals = answer
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const push = (warning: string, original: string) => {
    if (seen.has(warning)) return;
    seen.add(warning);
    out.push({ warning, excerpt: original.length > 160 ? original.slice(0, 157) + "…" : original });
  };

  for (const check of CHECKS) {
    for (const original of originals) {
      const s = normalizeText(original);
      if (check.pattern.test(s) && !(check.ignoreNegated && isNegated(s))) {
        push(check.warning, original);
        break;
      }
    }
  }
  // Association ville/pays dans une même phrase (et non plus n'importe où dans le texte).
  for (const [city, country, warning] of GEO_PAIRS) {
    const hit = originals.find((o) => {
      const s = normalizeText(o);
      return s.includes(city) && s.includes(country);
    });
    if (hit) push(warning, hit);
  }
  return out;
}

export function collectWarnings(answer: string): string[] {
  return collectProblems(answer).map((p) => p.warning);
}

// Texte injecté dans la relecture / la synthèse : une ligne par problème, avec la phrase à corriger.
export function formatProblemsForRepair(problems: Problem[]): string {
  if (problems.length === 0) return "";
  return (
    "\nCORRECTIONS OBLIGATOIRES détectées automatiquement dans le texte à améliorer. Corrige chacune en réécrivant la phrase concernée (offre et prix réels de la fiche à la place d'un emplacement, aucune statistique ni promesse chiffrée sans source, aucun échange passé présupposé) :\n" +
    problems.slice(0, 8).map((p) => `- ${p.warning} Phrase concernée : « ${p.excerpt} »`).join("\n")
  );
}

export function formatWarnings(warnings: string[]): string {
  return (
    "\n\n## Vérifications conseillées avant utilisation\n\n" +
    "Un contrôle automatique a détecté les points suivants. " +
    "Il ne s'agit pas d'une vérification externe des faits :\n\n" +
    warnings.map((w) => `- ${w}`).join("\n")
  );
}
