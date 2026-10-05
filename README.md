# AGENT DOSS GROUPS — projet Next.js complet (déploiement Vercel)

Projet **autonome** : à mettre seul à la racine d'un dépôt GitHub propre (rien d'autre dedans).

## 1. Supabase
1. SQL Editor → coller et exécuter `supabase/001_doss_groups.sql`.
2. Authentication → Providers : « Email » activé (désactivez « Confirm email » pour tester plus vite).
3. Project Settings → API : copier **Project URL** et **anon public key**.

## 2. Vercel
1. New Project → importer le dépôt. Framework : **Next.js** (détecté). **Root Directory : vide (racine)**.
2. Environment Variables (Production + Preview) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEYS` (une ou plusieurs clés séparées par des virgules)
   - `GEMINI_MODEL` (optionnel — vérifier le nom courant dans Google AI Studio)
   - Facultatif, pour la bascule : `GROQ_API_KEYS`, `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`, `CUSTOM_LLM_*` (voir `.env.example`)
3. Deploy. Après tout ajout de variable : **Redeploy**.

## 3. Test
Ouvrir `/login` → créer un compte → `/doss` → envoyer une mission.

## Diagnostic rapide
| Symptôme | Cause probable |
|---|---|
| Build : « Could not find package.json / next » | Mauvais Root Directory ou fichiers dans un sous-dossier |
| Build : erreurs de types | Copier le message exact |
| Page : « Variables … manquantes » | Variables Vercel absentes → Redeploy |
| 401 « Session invalide » | Se reconnecter ; vérifier l'URL/clé Supabase |
| 500 « Enregistrement impossible » | SQL non exécuté |
| 502 « Tous les fournisseurs IA ont échoué » | Clés invalides, quotas épuisés ou noms de modèles périmés |

## Bascule automatique des API
Les fournisseurs sont essayés dans l'ordre : Gemini (chaque clé) → Groq → OpenRouter → personnalisé. En cas de quota épuisé (429/402), clé refusée (401/403), panne (5xx), délai dépassé ou erreur réseau, le suivant prend le relais. Un fournisseur en échec est mis de côté 60 s (10 min si la clé est refusée). Cette pause est propre à chaque instance serverless : elle n'est pas partagée.

## Vitesse et qualité
- Les réponses s'affichent **en direct** (streaming) ; l'interface indique le temps du premier mot et le moteur utilisé.
- Les agents répondent en format expert : Synthèse, Analyse, Plan d'action, Prochaine action recommandée (120 à 300 mots).
- Pour la vitesse maximale, ajoutez une clé Groq et mettez `LLM_ORDER=groq,gemini`.
- La bascule vers un autre fournisseur se fait uniquement avant le premier mot ; une coupure en cours de réponse conserve le texte déjà reçu.
- Logo DG : `app/icon.svg` (icône du site) et `components/Logo.tsx` (interface).

## Animations fantasy
Fond d'orbes lumineux et poussière d'étoiles (`components/MagicBackground.tsx`), aura et reflet du logo, runes flottantes, éclats à l'envoi d'une mission, cartes d'agents qui flottent avec bordure lumineuse au survol, icône qui pulse pendant la rédaction. Tout est désactivé si l'appareil demande de réduire les animations.
