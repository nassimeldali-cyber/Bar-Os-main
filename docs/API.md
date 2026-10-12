# Spécifications API & Contrats de Données — non implémentées

> Les routes ci-dessous sont des spécifications produit, pas des endpoints disponibles. Le backend NestJS actuel contient des squelettes et l'application racine fonctionne localement dans le navigateur.

## 1. Endpoints & Opérations Principales

### Tables & Sessions
- `GET /api/table/:restaurantId/:tableId` : Vérifie l'existence de la table, renvoie le restaurant, la table et la session active.
- `POST /api/sessions/open` : Ouvre une nouvelle session si aucune session active n'existe pour cette table.
- `POST /api/sessions/:sessionId/request-bill` : Passe la session à `ADDITION_REQUESTED` et crée une notification serveur.
- `POST /api/sessions/:sessionId/pay` : Réservé au staff. Enregistre le paiement (`CASH` ou `TPE`), clôture la session et libère la table (`AVAILABLE`).

### Commandes
- `POST /api/orders` : Crée une commande client avec vérification de la disponibilité des produits et calcul du montant.
- `PATCH /api/orders/:orderId/pos-transmit` : Marque la commande comme transmise manuellement à la caisse physique avec timestamp et identifiant serveur.
- `PATCH /api/orders/:orderId/status` : Change le statut de préparation (`ACCEPTED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`).

### Appels de Service
- `POST /api/service-requests` : Émet un appel serveur ou demande d'eau depuis la table.
- `PATCH /api/service-requests/:id/resolve` : Traite la demande.

### Menu & Gestion
- `GET /api/menu/:restaurantId` : Récupère les catégories actives et produits disponibles.
- `POST /api/manager/products` : Création ou mise à jour de produit avec contrôle des prix et disponibilité.
