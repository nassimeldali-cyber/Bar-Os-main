# Audit de préparation à la mise en production

## État constaté

Le dépôt contient une démonstration web fonctionnelle en local, mais il n'est pas encore prêt à être utilisé pour gérer le service d'un client réel. L'application active est le projet Vite/React à la racine. Le dossier `restaurant-saas/frontend` est encore le modèle Next.js par défaut et le backend NestJS est incomplet. Les trois parties ne forment donc pas une application intégrée.

## Bloqueurs avant utilisation réelle

### P0 — Données communes et persistance

- `src/lib/dbEngine.ts` persiste les commandes, sessions, paiements et menus dans `localStorage`.
- `src/lib/supabaseClient.ts` crée un client Supabase, mais le moteur de données principal ne l'utilise pas.
- `BroadcastChannel` ne synchronise que des onglets du même navigateur; il ne relie pas les appareils du client, du serveur et du gérant.
- Les opérations de commande, session et paiement doivent être déplacées vers une base partagée et des fonctions atomiques côté serveur afin de résister aux actions simultanées et aux coupures réseau.

### P0 — Authentification et autorisation

- `src/context/AuthContext.tsx` accepte un e-mail ou un identifiant sans mot de passe. Ce mécanisme convient à une simulation, pas à des comptes du personnel en production.
- Les rôles et affectations enregistrés dans le navigateur ne constituent pas une frontière de sécurité.
- La migration RLS historique `supabase/migrations/20261008000002_rls_policies.sql` donnait aux utilisateurs anonymes des lectures très larges (`USING (true)`) sur les sessions, commandes et lignes de commande. La nouvelle migration de durcissement retire ces accès directs; les parcours QR attendent encore leurs RPC sécurisées.
- Les opérations client QR doivent être limitées par un jeton QR non devinable et par des fonctions SQL/API qui vérifient table, session, restaurant, produits disponibles et quantités. Le client ne doit jamais pouvoir créer un paiement ni modifier un prix.

### P0 — Schéma et données de départ

- Les schémas de `supabase/migrations/` et `restaurant-saas/database/` ne décrivent pas le même modèle (noms de tables, statuts et relations différents). Il faut choisir une seule source de vérité.
- Le schéma Supabase relie `profiles.id` à `auth.users.id`. La seed a été corrigée pour ne plus tenter d'insérer de faux profils; le provisionnement sécurisé des comptes staff reste à réaliser côté serveur.
- L'ancienne donnée de démonstration associait la table 10 à un autre restaurant; cette incohérence est corrigée dans cette copie de travail.

### P1 — Parcours et interfaces

- Le QR doit ouvrir une URL de déploiement stable et identifier la table avec un secret, pas seulement un identifiant prévisible.
- Le client doit voir uniquement le menu disponible, son panier et les informations de sa session.
- Le serveur doit recevoir commandes et demandes en direct, les transmettre manuellement à la caisse avec auteur/heure, les préparer, les servir et encaisser.
- Le gérant doit pouvoir gérer menu, tables, zones, affectations, personnel et historique; chaque action doit être autorisée côté serveur.
- Les écrans doivent rester utilisables sur téléphone client, tablette serveur et ordinateur gérant, avec états de chargement, erreur, absence de réseau, listes vides et reprise après reconnexion.
- Le MVP ne contient pas d'interface dédiée cuisine/KDS ni de connecteur POS automatique. La transmission à la caisse reste manuelle comme indiqué dans `AGENTS.md`.

### P1 — Cohérence de livraison

- Le sous-projet dormant `restaurant-saas` conserve des données et guides de l'ancien exemple Demo Lounge; il faut le retirer ou le réaligner avant de le présenter comme partie de l'application.
- Le frontend Next.js est encore une page d'accueil générique; il ne doit pas être présenté comme une seconde interface métier.
- Le backend NestJS expose actuellement des réponses de démonstration et des modules vides. Le service Prisma a été réparé dans cette copie, mais le backend ne couvre pas encore les opérations métier.
- Les fichiers `.env.example` côté navigateur ne doivent jamais suggérer d'y placer `SUPABASE_SERVICE_ROLE_KEY`. Une telle clé doit rester exclusivement dans un service serveur sécurisé.
- Le dépôt contient un mot de passe Wi-Fi codé en dur et public. Il a été retiré de cette copie; si cette valeur correspond au réseau du client, il faut aussi la changer sur le routeur. Les informations Wi-Fi doivent être configurées explicitement pour l'établissement.

## Ordre de réalisation recommandé

1. Confirmer le périmètre du premier client : un seul établissement, devise TND, langues d'interface et règles d'encaissement.
2. Retenir l'application racine comme interface métier et définir le backend/base de données comme source de vérité unique.
3. Stabiliser le schéma SQL, les migrations et les données de départ; créer les utilisateurs Auth par un mécanisme d'administration sécurisé.
4. Réduire les politiques RLS et ajouter des opérations serveur transactionnelles pour session, commande, demande de service, transmission caisse et paiement.
5. Remplacer le moteur local en production par les accès distants; garder un mode démonstration explicitement séparé, sans le confondre avec les données client.
6. Vérifier les parcours sur les trois appareils et corriger les états réseau, les erreurs et les doubles soumissions.
7. Préparer les environnements, secrets, sauvegardes, journalisation, déploiement et procédures de restauration.

## Critères d'acceptation avant le premier service client

- Une commande passée depuis un téléphone apparaît sur l'écran serveur et le gérant sans rafraîchissement manuel.
- Deux appareils ne peuvent pas ouvrir deux sessions actives sur la même table ni encaisser deux fois la même session.
- Une table reste occupée jusqu'au paiement confirmé et à la clôture de session.
- Le personnel doit s'authentifier; un serveur ne peut agir que sur les restaurants/tables autorisés.
- Un client QR ne peut consulter que le menu public et l'état de sa propre table/session.
- Les prix et totaux sont calculés et validés côté serveur; aucun secret administratif n'est envoyé au navigateur.
- Les migrations et les comptes de démonstration sont installables depuis une base vide, avec des instructions à jour.
- Les interfaces client, serveur et gérant ont été vérifiées sur les tailles d'écran réellement utilisées par le client.
