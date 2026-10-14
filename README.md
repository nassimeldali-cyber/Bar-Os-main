# BarLounge SaaS — Gestion Digitale pour Bars, Cafés & Lounges

Prototype de démonstration pour la commande client par QR Code, le suivi des sessions de table et le service en salle. L'application racine fonctionne actuellement en mode local navigateur (`localStorage`); elle ne partage pas encore les commandes entre plusieurs appareils et ne doit pas encore gérer un service client réel.

> **État de préparation :** démonstration locale. L'authentification du personnel est simulée par identifiant, et les données Supabase ne sont pas encore utilisées par le moteur principal. Voir [l'audit de préparation à la production](docs/PRODUCTION_READINESS.md) avant tout déploiement client.

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancement en mode développement
```bash
npm run dev
```
L'application est servie sur `http://localhost:3000`.

---

## 👥 Comptes & Accès de Démonstration

L'application locale est pré-initialisée avec **Zoo Bar** (Monnaie : **TND**) :

| Rôle | Identifiant / Email | Nom | Affectation |
| :--- | :--- | :--- | :--- |
| **Gérant (démo locale)** | `MANAGER_01` ou `manager@zoobar.tn` | Yassine Gérant | Sélection de profil simulée |
| **Serveur 1 (démo locale)** | `U873` ou `u873@zoobar.tn` | Karim Serveur | Tables 01, 02, 03, 08 |
| **Serveur 2 (démo locale)** | `U874` ou `u874@zoobar.tn` | Sarra Serveuse | Tables 04, 05, 06, 07, 09, 10 |
| **Client** | Aucun compte requis | Scan QR Code | Démo locale via `?table=<id>&restaurant=<id>` |

Ces identifiants ne sont pas des comptes sécurisés : le prototype ne demande pas de mot de passe.

---

## 📱 Scénario Complet de Démonstration

1. **Gérant** : Ouvrez le sélecteur de profil en haut à droite et choisissez le profil de démonstration Manager. Visualisez les KPIs, les tables et le menu.
2. **QR Code** : Dans l'onglet *Tables*, cliquez sur l'icône QR de la Table **01** (ou **08**).
3. **Client** : Ouvrez la vue client de la table.
   - Parcourez les catégories (Cocktails, Tapas, Softs...).
   - Ajoutez des articles au panier et passez la **Commande #1**.
   - Notez que la table passe immédiatement à l'état **OCCUPÉE**.
4. **Serveur** : Dans le sélecteur de profil, choisissez Karim (`U873`).
   - La commande apparaît en direct avec signal sonore et visuel.
   - Cliquez sur **"Transmise à la caisse"** (enregistre l'heure et l'auteur).
   - Passez la commande à **"Prête"** puis **"Servie"**.
5. **Client (Deuxième tournée)** : Repassez une commande sur la même table (ex: 2 boissons). Le total de la session s'additionne en temps réel.
6. **Demande d'addition** : Le client clique sur **"Demander l'addition"**.
   - La session passe à `ADDITION_REQUESTED`.
   - Le serveur reçoit l'alerte avec le montant exact.
7. **Paiement & Clôture** :
   - Le serveur clique sur **"Encaisser"**, sélectionne **Espèces** ou **TPE** et valide.
   - La session est clôturée (`CLOSED`).
   - La table redevient immédiatement **LIBRE** (`AVAILABLE`).
   - Un nouveau scan ouvrira une session vierge.

---

## 🗄️ Base de Données & Migrations Supabase
Les migrations SQL se trouvent dans `supabase/migrations/` :
- `20261008000001_initial_schema.sql` : Tables, contraintes, index et types énumérés.
- `20261008000002_rls_policies.sql` : Politiques Row Level Security.
- `20261008000003_functions_triggers.sql` : Triggers de synchronisation et total automatique.
- `20261008000004_seed_data.sql` : Données initiales du restaurant de démonstration Zoo Bar (sans comptes Auth).
- `20261011000001_harden_anonymous_access.sql` : Retire l'accès anonyme direct aux données opérationnelles; les parcours QR Supabase attendent encore des RPC sécurisées.

L'application racine n'est pas encore raccordée à ces migrations. Le déploiement des tables Supabase seul ne rend donc pas les interfaces multi-appareils opérationnelles.

---

## 🧪 Tests Automatisés
Les 15 tests critiques (Section 31 du cahier des charges) sont exécutables directement depuis l'interface Manager > onglet **"Tests & Diagnostics"**.

---

## 🚀 Déploiement sur Render (site statique)

L'application racine (Vite + React) est déployable telle quelle sur Render en **Static Site**. La configuration est fournie par `render.yaml` (build + publish + route SPA) et `.node-version` (Node 22).

### Étapes
1. **Commit & push** des fichiers ajoutés (`render.yaml`, `.node-version`) et des corrections de `package.json`/`vite.config.ts`.
2. Sur [dashboard.render.com](https://dashboard.render.com) → **New +** → **Static Site** → connecter ce dépôt.
3. Render détecte `render.yaml` automatiquement :
   - **Build Command** : `npm install && npm run build`
   - **Publish Directory** : `dist`
4. (Optionnel) Définir les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (déjà renseignées dans `render.yaml`). Si elles sont vides, l'application fonctionne en mode `localStorage`.
5. **Create Static Site** → l'URL publique est de la forme `https://bar-lounge-saas.onrender.com`.

> Note : `restaurant-saas/` (NestJS + Next.js) n'est **pas** déployé par cette configuration — c'est un squelette séparé et incomplet. Seule l'application racine est servie.
