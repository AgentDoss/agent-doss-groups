# AGENT DOSS GROUPS — direction produit et architecture des agents

## Direction artistique existante

- **Styles envisagés :** Obsidian Gold / Aurora (0,06), Editorial SaaS lumineux (0,04), Cyber-executive minimal (0,08).
- **Choix :** Obsidian Gold / Aurora.
- **Design movement :** dashboard exécutif premium inspiré des interfaces fintech haut de gamme, enrichi d’une aura aurora maîtrisée.
- **Principes :** hiérarchie forte, densité contrôlée, contraste accessible, actions immédiatement repérables.
- **Philosophie couleur :** obsidienne pour la concentration, or champagne pour la confiance et la valeur, violet/cyan pour signaler l’intelligence et l’activité.
- **Paradigme de layout :** navigation verticale persistante, zone de mission comme scène principale, cartes d’agents en constellation plutôt qu’un simple tableau uniforme.
- **Signature elements :** barre d’accent agent, halos aurora, boutons or à reflet court.
- **Interaction :** chaque survol ou focus confirme l’action sans ralentir le parcours ; les animations indiquent l’activité plutôt qu’elles ne décorent.
- **Animation :** mouvements de 150–350 ms, respect de `prefers-reduced-motion`, aucune animation permanente sur les contenus importants.
- **Typographie :** système sans-serif pour la lisibilité, titres lourds et espacés, labels uppercase pour les métadonnées.
- **Essence :** le centre de commandement IA qui transforme une mission floue en prochaine action concrète.
- **Personnalité :** stratégique, premium, énergique.
- **Voix :** directe et orientée décision. Exemples : « Votre prochaine action est prête. » / « Lancez une mission, gardez le contrôle. »
- **Marque :** monogramme DG dans un carré arrondi, aura dorée sur les surfaces sombres.
- **Couleur propriétaire :** or champagne `#e7c66a`.

## Évolution proposée : des profils de prompt vers des agents outillés

### Résultat visé

Chaque agent conserve son rôle et sa voix, mais reçoit un contrat métier vérifiable : une mission délimitée, des données autorisées, une liste d’outils exécutables côté serveur, une méthode de domaine, une sortie structurée avec preuves et limites, et une validation avant synthèse. Le Directeur n’active que les spécialistes utiles à la mission ; les neuf agents ne sont pas tous appelés à chaque requête. L’interface doit nommer les agents effectivement mobilisés au lieu de laisser croire que neuf experts travaillent toujours en parallèle.

Le premier incrément est limité aux capacités lisibles dans le CRM existant. Les appels d’outils restent en lecture seule et passent par un registre fermé, un contrôle serveur des agents autorisés et une validation stricte des arguments. Le modèle ne reçoit ni code exécutable ni accès direct à Supabase.

### Sources, périmètre et limites

La source de vérité demeure l’application Next.js existante et son client Supabase authentifié. Les sources exploitables sont celles déjà chargées par `app/api/doss/mission/route.ts` : fiche entreprise, agrégats de prospects et données anonymisées de clients. Chaque fait transmis à un spécialiste doit être associé à son origine, à sa période ou taille d’échantillon lorsqu’elles sont disponibles, et à un état explicite (`observé`, `calculé`, `hypothèse` ou `indisponible`).

Le registre de capacités doit refuser une lecture hors périmètre utilisateur/entreprise et limiter chaque agent à ses outils déclarés. Les outils ne modifient pas les enregistrements et n’envoient aucun message ou publication. Les tâches, rendez-vous, historique de ventes transactionnel, charges, marges, campagnes, statistiques de publication, données concurrentielles et recherche web ne sont pas confirmés comme sources disponibles dans le flux de mission actuel : ils doivent être présentés comme indisponibles tant qu’une source réelle n’est pas raccordée. Aucun agent ne peut prétendre avoir trouvé un prospect, vérifié le marché, publié un contenu, programmé un rendez-vous ou exécuté une action externe.

Aucune migration ni donnée Supabase en production ne sera modifiée dans ce premier incrément. L’écart déjà constaté entre migrations versionnées et schéma Supabase actif devra être résolu séparément avant toute nouvelle migration. Le déploiement de production est exclu ; un déploiement Preview ne sera préparé qu’après résolution de l’accès au scope Vercel `agentdoss` et validation de la branche de travail.

### Contrat d’exécution

Le parcours d’une mission devient : authentification et sélection de l’entreprise ; construction d’un instantané métier typé et filtré ; routage vers l’agent principal ; exécution des outils autorisés selon la mission ; production par le spécialiste d’un résultat structuré (`diagnostic`, `preuves`, `calculs`, `hypothèses`, `données manquantes`, `recommandations`, `indicateurs`) ; validation des preuves, calculs et limites ; synthèse du Directeur si plusieurs domaines sont réellement requis ; diffusion de la réponse et indication des spécialistes utilisés. Le mode `expert` conserve un budget borné, les limites de quota et le repli actuel en cas de délai ou d’indisponibilité d’un fournisseur.

Les outils sont distribués par domaine, sans donner artificiellement les mêmes capacités à tous : le Directeur consolide les constats et arbitre ; Marketing construit des stratégies et briefs fondés sur l’offre/la cible, sans métriques de campagne inexistantes ; Prospect analyse les segments et le suivi CRM, mais ne fait pas de recherche web ; Commercial mesure le pipeline et prépare des brouillons sans envoyer de relance ni inventer de prix ; Client segmente les clients enregistrés et distingue l’inactivité démontrée d’une simple absence de date ; Finance calcule seulement les montants dont les champs et devises sont confirmés, et signale l’absence de charges/marges ; Analyste calcule des indicateurs avec taille d’échantillon et période ; Assistant prépare des priorités et projets d’agenda mais n’écrit pas dans un agenda non connecté ; Stratégie construit des scénarios à partir des données de l’entreprise et marque toute analyse de marché non vérifiée comme hypothèse.

### Structure du projet

- `app/api/doss/mission/route.ts` : authentification, vérification de l’entreprise, chargement des données réelles, constitution de l’instantané typé et transmission au pipeline ; aucune opération métier supplémentaire en écriture.
- `lib/agents.ts` : identité, domaines, règles de routage et contrats déclaratifs des neuf rôles ; les capacités annoncées doivent correspondre au registre exécutable.
- `lib/agent-experts/types.ts` : types communs pour les faits sourcés, arguments d’outils, résultats métier et limites de données.
- `lib/agent-experts/registry.ts` : allowlist par `AgentId`, description des outils, validation des arguments et refus par défaut de tout outil inconnu ou non autorisé.
- `lib/agent-experts/tools/` : outils déterministes, en lecture seule, organisés par source/domaine (entreprise, prospects, clients, indicateurs et préparation de recommandations).
- `lib/llm.ts` : adaptation minimale des fournisseurs configurés pour une requête structurée et des appels d’outils bornés ; aucun fallback ne doit transformer silencieusement un outil manquant en fait inventé.
- `lib/pipeline.ts` : orchestration du spécialiste, exécution bornée des outils autorisés, validation du résultat, synthèse et streaming ; conservation du budget de temps et des replis.
- `lib/guards.ts` : contrôles de cohérence étendus aux références de faits, calculs, hypothèses, domaines et prétentions d’action.
- `components/DossTeam.tsx` : affichage fidèle du mode choisi et des agents réellement mobilisés, sans compteur « experts en ligne » trompeur.
- `tests/` et scripts `package.json` : tests de contrats, permissions et règles métier sur données synthétiques, sans données client de production.
- `supabase/` : aucun changement de schéma dans ce lot ; toute migration ultérieure devra d’abord rendre le dépôt reproductible par rapport au schéma live.

## Implémentation de l’interface déjà réalisée

La retouche de confort visuel réutilise les composants et actifs existants, sans ajouter d’illustration décorative inutile à un outil de pilotage. Les ajustements sont principalement réalisés dans `app/globals.css` et `TODO.md`.

## État de mise en œuvre — 19 octobre 2026

### Livré sur la branche locale `feature/expert-agents-foundation`

- Contrats de faits, preuves et résultats typés, avec allowlist fermée et contrôle `AgentId`; les arguments non vides, outils inconnus ou outils d’un autre domaine sont refusés.
- Snapshot CRM anonymisé construit après authentification et vérification de l’entreprise. Les lectures sont scoppées par `user_id` et `company_id`, limitées à 500 prospects et 1 000 clients, sans identité/contact des lignes; les e-mails et téléphones détectés dans les notes libres sont masqués.
- Outils déterministes distincts pour les neuf spécialisations : couverture de données, CRM prospects et relances, clients/récence, chiffre d’affaires et données financières manquantes, qualité/KPI, agenda indisponible, campagne/marché/web indisponibles et recommandations conditionnelles.
- Appels function-calling bornés pour les API OpenAI-compatibles et Gemini : une seule phase, au plus deux exécutions locales par étape, validation côté application, limites de taille, aucune requête directe à Supabase depuis le modèle et aucun effet externe.
- Les modes existants sont préservés : réponse rapide avec preuves préchargées, standard avec étape outillée et relecture, expert avec sélection des spécialistes nécessaires. La provenance nomme les agents et outils effectivement exécutés.
- Tests synthétiques pour permissions, privacy, calculs, données incomplètes et protocoles fournisseur simulés.

### Vérifications locales

`npm test`, `npm run typecheck`, `npm run build` et `git diff --check` réussissent. Les tests d’API LLM sont simulés; aucune clé fournisseur, donnée CRM de production ou écriture Supabase n’a été utilisée.

### Limites et actions non réalisées

Les outils Web/recherche de prospects, tendances et concurrents, campagnes/publiés, agenda, transactions et dépenses ne sont pas connectés : les agents les déclarent indisponibles au lieu de les inventer. Aucun agent n’envoie de message, ne modifie le CRM, ne publie ou ne crée un rendez-vous. Les migrations et policies Supabase n’ont pas été modifiées; le drift Git/Supabase et les alertes de sécurité de l’audit restent ouverts. À la rédaction initiale de cette section, l’accès Vercel au scope `agentdoss` était refusé; depuis, la branche a été poussée et le check Vercel est signalé `success` (voir la section suivante).


## Mise à jour après publication GitHub — 19 octobre 2026

La branche `feature/expert-agents-foundation` a été poussée sur `AgentDoss/agent-doss-groups` au commit `695e52e825ebd8c3d5f3998c68d80bec4047a491`. GitHub rapporte le check `Vercel` en `success` ainsi que `Vercel Preview Comments` terminé avec succès. La [page de statut Vercel](https://vercel.com/agentdoss/agent-doss-groups/FH7Eo98ij4YWAjH3gfXMHdQrQVD9) donne accès aux détails du déploiement; l’URL publique du Preview et son rendu n’ont pas été inspectés directement car l’accès au scope Vercel reste refusé dans cette session. La branche n’est pas fusionnée sur `main`; aucune mise en production ni modification Supabase n’a été faite.


## Phase suivante — recherche Web publique pour campagnes — 19 octobre 2026

### Choix technique

Pour les missions de campagne, ajouter Tavily Search côté serveur plutôt que Grounding with Google Search. L’application conserve les réponses dans l’historique et les relit avec ses propres agents; les conditions Google Search grounding imposent l’affichage associé de Search Suggestions et restreignent fortement le cache et l’usage des résultats. Tavily fournit des résultats structurés pour les flux agentiques avec titres, extraits et URL citables. La documentation consultée indique 1 crédit pour une recherche `basic`, 1 000 crédits gratuits par mois, puis un tarif pay-as-you-go annoncé de 0,008 USD par crédit; le budget du compte Tavily reste à surveiller.

### Architecture et garde-fous

- Une recherche Tavily `basic` au maximum par mission pertinente, avec un petit nombre de résultats, un timeout court et une taille maximale de réponse; pas de crawl ni de lecture de pages privées.
- Déclenchement uniquement pour les missions liées au marketing/campagne et seulement si `TAVILY_API_KEY` est configurée. En l’absence de clé ou en cas d’échec, le moteur doit indiquer clairement que le Web n’a pas été consulté.
- N’envoyer au fournisseur que le secteur, la cible générale et la zone géographique de la fiche entreprise; exclure CRM, notes libres, contacts, identifiants, courriels, téléphones et comptes sociaux privés.
- Joindre à la réponse les titres et URLs réellement retournés; séparer faits de sources, hypothèses et recommandations. Aucune action de publication, message, modification publicitaire ou budget.
- La première phase couvre seulement le Web public et les publications sociales qui sont effectivement indexées et accessibles publiquement. Les statistiques de comptes privés/entreprise Meta, Instagram ou TikTok requièrent une intégration OAuth officielle distincte, pas incluse dans cette phase.
- Tests unitaires avec réponse Tavily simulée; aucun appel Web réel pendant le build/CI. `TAVILY_API_KEY` reste une variable serveur Vercel, jamais un fichier du dépôt ni une variable `NEXT_PUBLIC_*`.

### Activation

Le code pourra être testé sans clé via mocks. L’accès réel restera inactif tant que la clé Tavily n’est pas configurée dans Vercel Preview; ne pas ajouter la clé à Production ni déclencher de modification Supabase pendant cette phase.

Références officielles : [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search), [FAQ et tarifs Tavily](https://docs.tavily.com/faq/faq), [conditions Tavily](https://tavily.com/terms), [Google Search Grounding et ses conditions](https://ai.google.dev/gemini-api/docs/generate-content/google-search).


### Résultat de l’implémentation locale — 19 octobre 2026, 14:30 UTC

- Recherche Tavily serveur implémentée : une requête `basic` maximum par mission de campagne après authentification et réservation, jusqu’à cinq résultats, timeout 7 s, Content-Type JSON requis et body plafonné à 64 Ko avant parsing.
- Le fournisseur reçoit uniquement les segments activité, cible générale, ville et pays; la requête et les extraits ne sont pas persistés dans le CRM. Les liens cités proviennent des résultats HTTPS réels. La recherche publique ne connecte aucun compte privé Instagram/Facebook/TikTok et n’effectue aucune publication.
- Les extraits sont séparés du prompt système, envoyés comme JSON non fiable uniquement aux spécialistes Directeur, Marketing et Stratégie. Le planificateur a sa propre défense contre les instructions Web; le fallback de relecture sélectionne les sources par identité de l’expert qui a effectivement réussi.
- Log serveur minimal par mission : hash SHA-256 de la requête, statut, nombre réel d’appels, résultats et durée, sans texte brut, coordonnées, extraits ni clé. Les réponses Tavily non JSON ou trop volumineuses sont rejetées.
- Validation locale : `npm test` (7/7), `npm run typecheck`, `npm run build` et `git diff --check` réussissent. Une revue indépendante finale ne relève aucun blocage P1/P2.

**Activation encore en attente :** aucune clé Tavily n’est présente dans la session ni dans le projet; l’accès live demeure donc inactif. La prochaine étape est d’obtenir la clé par saisie sécurisée et de l’ajouter uniquement à l’environnement **Preview** Vercel de la branche, puis de tester un vrai parcours. Production, `main` et Supabase ne sont pas modifiés. Les publications sociales privées restent une intégration OAuth distincte.
