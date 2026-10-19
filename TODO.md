# TODO — Agent Doss Groups

## Terminé

- [x] Direction artistique Obsidian Gold / Aurora définie.
- [x] Hiérarchie dashboard, navigation, cartes, boutons et états focus révisés.
- [x] Responsive mobile conservé et renforcé.
- [x] Animations courtes et compatibles avec `prefers-reduced-motion`.
- [x] Manifeste des routes ajouté pour l’aperçu.
- [x] Retouche de confort visuel : réduction des animations permanentes, amélioration de la lisibilité des titres et contrôles, et prévention du débordement des indicateurs sur mobile.

## Agents experts — 19 octobre 2026

- [x] Contrat d’outils serveur : définir les faits sourcés, résultats structurés, validateurs d’arguments et permissions par `AgentId`; refuser par défaut tout outil inconnu ou non autorisé, et borner l’accès à l’utilisateur et à l’entreprise de la mission.
- [x] Neuf spécialités opérantes : donner à Directeur, Marketing, Prospect, Commercial, Client, Finance, Analyste, Assistant et Stratégie des méthodes/outils distincts fondés uniquement sur les sources CRM vérifiées; exposer explicitement une capacité comme indisponible si la table, le champ, l’historique ou l’intégration requis n’existe pas.
- [x] Réponses vérifiables : associer aux analyses les preuves CRM, calculs, périodes/échantillons et hypothèses disponibles; appliquer les garde-fous empêchant les affirmations non étayées de recherche web, d’envoi, publication, rendez-vous ou action externe.
- [x] Chiffres et conformité : exiger une source vérifiable pour les statistiques, benchmarks et affirmations de droit/anti-spam; sans source et contexte de juridiction, supprimer l’affirmation ou l’indiquer comme hypothèse, sans garantie.
- [x] Orchestration honnête : conserver un budget et une limite d’appels; n’activer que les spécialistes pertinents et afficher les agents et outils réellement mobilisés, sans prétendre que les neuf travaillent sur chaque mission.
- [x] Évaluation synthétique : ajouter des tests automatisés sur des données fictives pour les contrats des neuf agents, le filtrage des outils, les calculs métier et les garde-fous; les vérifications ne lisent ni n’écrivent les données CRM réelles.
- [ ] Vérifier le parcours Web dans le Preview : le rapport reçu est un run Prospect (`prospect_external_search_status`), donc ne teste pas Tavily. Le commit `2926e3b` (`agents a33`) est poussé et le check Vercel est `success`; l’accès API Vercel 403 empêche de vérifier la variable. La capture montre `TAVILY_API_KEY` en Preview et Production : garder Preview et supprimer Production si son activation n’est pas voulue. Tester ensuite une mission campagne en Marketing/Directeur et confirmer les liens source. Ne pas fusionner sur `main`, modifier Supabase en production ou déployer le code en production sans autorisation distincte.

## À vérifier sur l’environnement réel

- [ ] Vérifier les couleurs sur un téléphone Android et un écran desktop.
- [ ] Vérifier les contrastes avec les données réelles de l’entreprise.
- [ ] Vérifier le rendu des réponses longues des agents.

## Autonomie professionnelle — CTO

- [x] Ajouter une migration portable pour jobs, runs, brouillons, RLS et claim atomique.
- [x] Ajouter une API authentifiée de création et consultation des routines.
- [x] Ajouter l’écran mobile « Routines IA ».
- [x] Conserver les sorties en brouillons avec validation humaine obligatoire.
- [ ] Activer une routine commerciale quotidienne après publication et vérification du premier run.

## Industrialisation autonomie — v2.6.0

- [x] Garantir un contexte entreprise canonique par UUID avec validation d’appartenance.
- [x] Traiter plusieurs routines dues par fenêtre Cron bornée.
- [x] Ajouter lease, reprise, backoff et journalisation d’erreur des jobs.
- [x] Ajouter la durée maximale explicite du worker.
- [x] Contrôler la longueur des brouillons et signaler les échecs d’écriture.
- [x] Ajouter l’API et l’interface de validation des brouillons.
- [x] Ajouter pause, reprise et suppression des routines.
- [x] Ajouter l’idempotence des missions interactives.
- [x] Paginer le contrôle des relances CRM.


## Recherche Web publique pour campagnes — 19 octobre 2026

- [x] Ajouter une recherche Tavily serveur, limitée à une requête `basic` par mission de campagne, à cinq résultats et à un timeout; aucun crawl, scraping ni accès de compte privé.
- [x] Réduire la requête aux données publiques minimales de l’entreprise (secteur, cible générale, région); ne transmettre aucun contact, notes CRM, prospect, client ou identifiant.
- [x] Joindre aux réponses marketing les titres et liens réellement retournés, distinguer les preuves et hypothèses, et signaler l’absence réelle d’accès Web si l’API n’est pas configurée ou échoue.
- [x] Couvrir le fournisseur par des tests avec réponses simulées, sans appel Internet dans les tests/builds; séparer les extraits non fiables du prompt système, borner la taille fournisseur et journaliser le hash/statut sans la requête brute.
- [ ] Configurer `TAVILY_API_KEY` côté serveur dans Vercel Preview et valider le parcours réel après autorisation; aucune clé dans Git, aucune modification Supabase ou déploiement Production.
- [ ] Traiter séparément plus tard l’accès aux statistiques privées Meta/Instagram/TikTok via OAuth professionnel en lecture seule, si demandé.
