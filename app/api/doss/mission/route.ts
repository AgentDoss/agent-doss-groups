
function chooseDepth(
  requested: unknown,
  message: string,
  route: ReturnType<typeof directorRoute>
): Depth {
  // Respecter le choix explicite de l'utilisateur.
  if (
    typeof requested === "string" &&
    (DEPTHS as string[]).includes(requested)
  ) {
    return requested as Depth;
  }

  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Les messages très courts et les salutations restent rapides.
  const simpleMessages = [
    "bonjour",
    "salut",
    "bonsoir",
    "merci",
    "ca va",
    "qui es-tu",
    "qui es tu",
  ];

  if (
    text.length < 30 &&
    simpleMessages.some(
      (item) => text === item || text.startsWith(item + " ")
    )
  ) {
    return "quick";
  }

  // Missions exigeant plusieurs domaines ou une coordination.
  const complexPatterns = [
    /\bstrategie\b/,
    /\bplan strategique\b/,
    /\bplan complet\b/,
    /\banalyse approfondie\b/,
    /\bdiagnostic complet\b/,
    /\bplan d'action\b/,
    /\bplan d execution\b/,
    /\b30\s*[-a]\s*90\s*jours\b/,
    /\bplusieurs domaines\b/,
    /\bde bout en bout\b/,
    /\bautomatiser\b/,
    /\bdevelopper l'entreprise\b/,
    /\bcroissance\b/,
    /\baugmenter les ventes\b/,
    /\btrouver des clients et fideliser\b/,
  ];

  const explicitlyComplex = complexPatterns.some((pattern) =>
    pattern.test(text)
  );

  if (
    explicitlyComplex ||
    route.requiresLLM ||
    route.supportingAgents.length >= 2
  ) {
    return "expert";
  }

  // Une mission identifiée dans un seul domaine reçoit une analyse
  // approfondie suivie d'une relecture qualité.
  return "standard";
    }
