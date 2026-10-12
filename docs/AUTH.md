# Authentification & Gestion des Rôles — cible de production

> Ce document décrit le flux visé. L'application racine utilise encore une sélection locale de profils sans mot de passe; elle ne met pas en œuvre l'authentification décrite ci-dessous.

## 1. Principes d'Authentification

L'authentification s'appuie sur Supabase Auth couplé à la table applicative `profiles` et `restaurant_users`.

### Rôles pris en charge :
1. `MANAGER` : Accès d'administration globale au restaurant.
2. `SERVER` : Accès opérationnel dédié au service en salle.
3. `CLIENT` : Accès QR visé par jeton de table; la démo actuelle utilise l'URL à paramètres `?table=<id>&restaurant=<id>` avec des identifiants prévisibles.

## 2. Découpage des flux de connexion

- **Gérant** :
  - En cible : connexion Supabase Auth, puis espace manager autorisé pour son restaurant.
  - En démo locale : sélectionner le profil Manager depuis le menu de rôles (aucun mot de passe).

- **Serveurs** :
  - En cible : connexion Supabase Auth et filtre serveur sur les tables assignées.
  - En démo locale : choisir le profil `U873` ou `U874` depuis le menu de rôles (aucun mot de passe).

- **Clients** :
  - Aucun compte requis; le scan ouvre la vue QR locale avec des paramètres d'identifiant prévisibles.
  - En cible : un jeton QR non devinable doit limiter l'accès à la table et à sa session.
