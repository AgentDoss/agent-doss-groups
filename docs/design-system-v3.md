# AGENT DOSS GROUPS — Direction interface v3

## Références étudiées

- Linear : hiérarchie claire, activité visible, navigation orientée travail et agents.
- Raycast : command center rapide, actions courtes, accès direct aux outils.
- Agent UX : transparence, statut proactif, contrôle humain, reprise et historique des actions.

Ces références servent de principes, pas de modèles à copier.

## Décisions de design

AGENT DOSS GROUPS devient un **command center d’exploitation** : l’utilisateur formule une mission, suit l’activité des agents et valide les actions importantes depuis le même espace.

- Palette : obsidienne stable, or comme signal d’action et cyan comme signal de système ; les gradients restent réservés aux actions principales.
- Hiérarchie : une mission principale, quatre métriques utiles, puis le contexte et l’activité. Aucun décor ne doit concurrencer la décision.
- Interaction : chaque action autonome doit avoir un état visible, une explication courte et un point de contrôle.
- Densité : cartes plus plates, bordures fines, espaces réguliers, titres lisibles et navigation compacte.
- Mobile : priorité à une action par écran, boutons accessibles au pouce, aucun texte essentiel dépendant d’un hover.
- Confiance : jamais de publication sociale sans brouillon approuvé ; les erreurs expliquent ce qui s’est passé et quoi faire ensuite.

## Contrat d’interface agent

1. **Avant** : montrer l’intention et l’agent responsable.
2. **Pendant** : afficher la progression et l’état courant.
3. **Après** : fournir le résultat, la source ou la métrique utile.
4. **Contrôle** : permettre validation, rejet, pause ou nouvelle tentative selon le type d’action.

## Anti-patterns rejetés

- Chatbot seul utilisé comme historique d’autonomie.
- Animations décoratives qui masquent l’état réel.
- Carte colorée sans action claire.
- Badge de succès sans métrique ou trace vérifiable.
- Secret social ou token embarqué dans le client mobile.
