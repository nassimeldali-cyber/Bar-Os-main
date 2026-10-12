# Politiques de Sécurité — Row Level Security (RLS)

> **État :** les politiques historiques de la migration `20261008000002_rls_policies.sql` accordaient un accès anonyme trop large. La migration `20261011000001_harden_anonymous_access.sql` retire ces accès directs et ne laisse publiques que les catégories actives et les produits disponibles. Les flux QR opérationnels ne sont pas encore réimplémentés via des RPC vérifiant un jeton de table.

## 1. Principes RLS fondamentaux

Chaque requête vers PostgreSQL passe par l'application stricte des règles RLS définies dans `supabase/migrations/20261008000002_rls_policies.sql`.

### Règles pour le MANAGER :
- Accès en lecture/écriture total et exclusif à toutes les entités rattachées à son `restaurant_id`.
- Interdiction totale de lire ou modifier les restaurants tiers (isolation multi-tenant stricte).

### Règles pour le SERVER :
- Lecture des tables du restaurant, avec restriction des mises à jour aux tables assignées via `server_table_assignments`.
- Gestion des commandes et transmission caisse pour son établissement.
- Interdiction de modifier les configurations du restaurant, les prix, les catégories ou de créer des serveurs.

### Règles pour le CLIENT :
- Lecture autorisée des données publiques du menu (`categories`, `products` avec `available = true`).
- Lecture autorisée de la table scannée et de la session active de cette table.
- Création de commande (`INSERT INTO orders`) uniquement sur une session `OPEN` valide.
- Mise à jour autorisée uniquement pour passer la session au statut `ADDITION_REQUESTED`.
- **Interdiction formelle** d'accéder aux données financières globales, aux dashboards staff, ou de modifier les paiements.
