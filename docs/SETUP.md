# Guide d'Installation & Configuration (SETUP)

## 1. Prérequis
- Node.js version 18+ ou 20+
- Un projet Supabase (Cloud ou local via Supabase CLI) OU l'émulateur backend persistant embarqué.

## 2. Déploiement des Migrations SQL sur Supabase
Si vous utilisez un projet Supabase distant :
1. Rendez-vous dans la console Supabase du projet > **SQL Editor**.
2. Exécutez dans l'ordre les scripts du dossier `supabase/migrations/` :
   - `20261008000001_initial_schema.sql`
   - `20261008000002_rls_policies.sql`
   - `20261008000003_functions_triggers.sql`
   - `20261008000004_seed_data.sql`
   - `20261011000001_harden_anonymous_access.sql`
3. Vérifiez que la publication temps réel `supabase_realtime` est active pour les tables `tables`, `table_sessions`, `orders`, `notifications`.

> **Important :** la migration de durcissement bloque l'accès anonyme direct aux tables opérationnelles. Les RPC sécurisées de commande par QR ne sont pas encore livrées, et l'application racine n'utilise pas encore Supabase. Cette configuration prépare les règles de sécurité; elle ne suffit pas à rendre l'application opérationnelle en multi-appareils.

## 3. Variables d'Environnement
Dans votre fichier `.env` ou sur AI Studio :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

La clé `service_role` ne doit jamais être placée dans le frontend ni dans un fichier `.env` utilisé par Vite. Aucun flux serveur sécurisé ne l'utilise encore dans ce projet.

## 4. Démonstration locale uniquement
```bash
npm install
npm run dev
```
L'application de démonstration démarre sur `http://localhost:3000`. Chaque navigateur conserve son propre état dans `localStorage`; les identifiants affichés dans le README ne sont pas protégés par mot de passe. Ne l'utilisez pas pour traiter des commandes ou paiements réels.
