# AGENT DOSS GROUPS

Application SaaS Next.js pour piloter une équipe de neuf agents IA, une fiche entreprise et un CRM prospects/clients avec Supabase.

## Statut du projet

Cette version contient :

- le tableau de bord responsive ;
- l’authentification Supabase et la récupération de mot de passe ;
- le CRM prospects et clients ;
- le streaming des missions IA ;
- la bascule Gemini/Groq/OpenRouter ;
- les garde-fous métier ;
- une migration Supabase complète et idempotente ;
- les RLS multi-utilisateur ;
- la RPC atomique de quota et de limitation de débit ;
- aucune route legacy d’envoi d’e-mails commerciaux automatique.

Le code est prêt à être configuré et testé sur un projet Supabase de staging. Les clés et les réglages de production restent propres à votre environnement et ne sont pas inclus dans l’archive.

## Installation locale

```bash
npm ci
cp .env.example .env.local
npm run typecheck
npm run build
npm run dev
```

Puis ouvrir `http://localhost:3000/login`.

## Configuration Supabase

1. Créer un projet Supabase.
2. Dans **SQL Editor**, exécuter `supabase/001_doss_groups.sql`.
3. Activer le provider **Email** dans Authentication.
4. Configurer les URLs de redirection pour l’application, le reset password et OAuth si Google/Apple sont activés.
5. Copier l’URL et la clé anon dans `.env.local` ou Vercel.

La migration crée :

- `doss_profiles` ;
- `doss_company` ;
- `doss_prospects` ;
- `doss_clients` ;
- `doss_missions` ;
- `doss_messages` ;
- index, contraintes, triggers, RLS ;
- `doss_create_mission_with_quota`.

La migration est conçue pour être réexécutée sur une installation déjà initialisée. Faites néanmoins une sauvegarde avant toute migration sur des données réelles.

## Variables d’environnement

Voir `.env.example`. Les clés IA et `SUPABASE_SERVICE_ROLE_KEY` doivent rester côté serveur. Ne jamais les préfixer par `NEXT_PUBLIC_`.

Variables principales :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- au moins un fournisseur parmi `GEMINI_API_KEYS`, `GROQ_API_KEYS` ou `OPENROUTER_API_KEY`
- `CRON_SECRET` si le cron de vérification est activé

## Déploiement Vercel

1. Importer le dépôt avec la racine du projet comme **Root Directory**.
2. Ajouter les variables d’environnement pour Preview et Production.
3. Déployer avec `npm ci` puis `npm run build`.
4. Exécuter la migration Supabase avant le premier test métier.
5. Vérifier une inscription, une entreprise, un prospect et une mission complète.

Le cron `/api/cron/follow-ups` vérifie les relances arrivées à échéance. Il ne réalise aucun envoi automatique WhatsApp ou e-mail.

## Contrôles recommandés avant ouverture

```bash
npm run typecheck
npm run build
```

À tester ensuite avec deux comptes Supabase distincts :

- un utilisateur ne voit jamais les données de l’autre ;
- une entreprise active ne déborde pas sur le compte voisin ;
- la conversion prospect-client est idempotente ;
- le quota gratuit bloque après dix missions réservées ou terminées dans le mois ;
- le rate limit bloque après six réservations en soixante secondes ;
- une panne LLM bascule vers le fournisseur suivant ;
- une session expirée renvoie `401` sur la route mission.

## Limites assumées

Le projet ne peut pas être déclaré « 100 % garanti » sans exécution sur votre projet Supabase réel, vos fournisseurs IA et vos paramètres Vercel. La compilation locale valide le code, tandis que les tests d’intégration doivent valider les migrations, RLS, quotas, OAuth et limites de fournisseurs dans votre environnement.

## Refonte interface premium 2.2.0

L’interface adopte une direction artistique **Obsidian Gold / Aurora** : fond profond, accent champagne, halos violet/cyan, cartes en verre, boutons d’action plus visibles, états focus accessibles, navigation plus nette et adaptation mobile renforcée. Les animations restent courtes et sont désactivées automatiquement avec `prefers-reduced-motion`.

## Agents autonomes et exécution téléphone éteint

Le projet inclut maintenant le worker `GET /api/cron/jobs`. Vercel Cron l’appelle chaque jour à 09:00 UTC. Le worker réclame un seul job Supabase avec `doss_claim_job`, ce qui évite les doubles exécutions, lance le pipeline IA, enregistre le run dans `doss_runs` et conserve la production dans `doss_drafts` avec le statut `pending`. Aucun envoi WhatsApp, e-mail ou publication externe n’est automatique : la sortie reste un brouillon à valider.

Pour activer un job, il faut créer une ligne dans `doss_jobs` avec `enabled=true`, `every_hours` compris entre 6 et 720, `next_run_at` et une instruction précise. Le compte doit disposer de `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` et d’au moins une clé IA dans Vercel Production.

Le téléphone peut être éteint : l’exécution est hébergée par Vercel et Supabase. Le mode gratuit permet une automatisation limitée et non garantie : fréquence de Cron, quotas Vercel/Supabase et quotas gratuits des fournisseurs IA s’appliquent. Pour une exécution toutes les heures ou toutes les 5 minutes, il faudra vérifier les limites du plan actif ou utiliser Supabase pg_cron/Edge Functions selon les quotas disponibles.

## Routines autonomes — mode CTO

L’application possède une page `/routines` et une API authentifiée `/api/jobs` pour créer et consulter les routines. La première routine Production activée est **Audit commercial quotidien**. Elle s’exécute via Vercel Cron, analyse les prospects ouverts et prépare des brouillons. Elle ignore les prospects gagnés ou perdus et n’envoie aucun message automatiquement.

La règle de sécurité est volontaire : analyse automatique, brouillon automatique, validation humaine avant envoi. Les jobs sont réclamés atomiquement par `doss_claim_job`, les runs sont journalisés dans `doss_runs`, et les brouillons dans `doss_drafts`.
