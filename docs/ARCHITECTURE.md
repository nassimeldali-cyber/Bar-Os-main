# Architecture Technique — BarLounge SaaS

> Ce schéma décrit l'architecture cible. La version actuellement livrée à la racine est un prototype Vite local; le backend, les opérations Supabase et le partage temps réel entre appareils restent à réaliser.

## 1. Vue d'ensemble du système

Le SaaS **BarLounge** est conçu selon une architecture multi-tenant moderne, sécurisée et temps-réel pour digitaliser l'expérience client et fluidifier le travail en salle des bars, cafés et lounges :

```
       [ Client Mobile (QR Code) ]
                    │  (URL QR de démonstration avec paramètres de table)
                    ▼
          ┌─────────────────────┐
          │  Table Session Hub  │
          └──────────┬──────────┘
                     │ Commandes, Service, Addition
                     ▼
  ┌──────────────────────────────────────────────┐
  │         Supabase / PostgreSQL Engine         │
  │   - Row Level Security (RLS) Multi-Tenant    │
  │   - Atomic Transactions (Single Open Session)│
  │   - Realtime Broadcast & Triggers            │
  └──────────────┬───────────────────────────────┘
                 │ Realtime Notifications
        ┌────────┴────────┐
        ▼                 ▼
[ Serveur Dashboard ]  [ Manager Backoffice ]
  - Mes tables           - KPIs Live & Chiffre d'affaires
  - Commandes en cours   - Configuration Menu & Tables
  - Saisie Caisse POS    - Affectation Serveurs
  - Encaissement         - Journal d'audit complet
```

## 2. Rôles et Frontières de Sécurité

1. **Client (Anonyme par QR Session)** :
   - Aucun compte utilisateur requis.
   - Accès restreint via les identifiants uniques de table (`restaurant_id` et `table_id`).
   - Ne peut jamais voir les autres tables ni modifier les prix ou statuts financiers.
   - Ne peut jamais fermer unilatéralement une session ni confirmer un paiement.

2. **Serveur (Role: SERVER)** :
   - Authentifié avec profil d'équipe (`username` ou email).
   - Accède à ses tables assignées par le manager (ou vue globale selon configuration).
   - Reçoit en temps réel les notifications de nouvelles commandes, appels serveur et demandes d'addition.
   - Effectue la passerelle avec la caisse physique ("Transmise à la caisse").
   - Encaisse les règlements (Espèces / TPE) et clôture la session.

3. **Gérant (Role: MANAGER)** :
   - Supervise l'ensemble de l'établissement.
   - Dispose du tableau de bord complet avec métriques en temps réel.
   - Gère les tables, le menu, les prix, la disponibilité, les serveurs et l'affectation.
   - Consulte le journal d'audit chronologique.

## 3. Workflow de la Session de Table

```
Table disponible [AVAILABLE]
        │
        ▼ Client scanne QR
Session créée [OPEN] ───────────► Table marquée [OCCUPIED]
        │
        ├─ Commande #1 (NEW ─► TRANSMITTED_TO_POS ─► SERVED)
        ├─ Commande #2 (CUMULATIVE)
        │
        ▼ Client clique "Demander l'addition"
Session [ADDITION_REQUESTED] ───► Table marquée [BILL_REQUESTED]
        │
        ▼ Serveur prépare l'encaissement
Session [PAYMENT_PENDING] ─────► Table [PAYMENT_PENDING]
        │
        ▼ Serveur confirme paiement (CASH ou TPE)
Paiement enregistré [CONFIRMED]
Session marquée [PAID] puis [CLOSED]
        │
        ▼
Table redevient libre [AVAILABLE]
(Tout scan ultérieur créera une NOUVELLE session)
```
