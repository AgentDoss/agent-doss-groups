# TODO — Refonte premium

## Terminé

- [x] Direction artistique Obsidian Gold / Aurora définie.
- [x] Hiérarchie dashboard, navigation, cartes, boutons et états focus révisés.
- [x] Responsive mobile conservé et renforcé.
- [x] Animations courtes et compatibles avec `prefers-reduced-motion`.
- [x] Manifeste des routes ajouté pour l’aperçu.

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
