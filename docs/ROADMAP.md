# Roadmap Produit — BarLounge SaaS

## Phase 1 : MVP cible (à terminer avant le premier service client)
- Commande client sur smartphone via QR Code par table sans compte obligatoire.
- Gestion des sessions uniques de table et total cumulé en temps réel.
- Dashboard serveur avec tables assignées et transmission manuelle à la caisse physique ("Transmise à la caisse").
- Demandes de service et d'addition instantanées avec notifications en direct.
- Règlements physiques Cash et TPE enregistrés par le personnel avec libération automatique de la table.
- Dashboard gérant avec KPIs du jour, gestion des tables, du menu et des serveurs.
- Journal d'audit et politiques RLS strictes.

**État actuel :** une partie de ces parcours existe en simulation locale. Les comptes, opérations atomiques, partage multi-appareils et autorisations Supabase restent à terminer; voir `PRODUCTION_READINESS.md`.

## Phase 2 : Connecteurs POS & Matériel
- Connecteur API direct vers caisses tactiles et logiciels POS populaires.
- Impression automatique des tickets de préparation via imprimantes thermiques ESC/POS (Cuisine & Bar).
- Écran KDS (Kitchen Display System) dédié au barman et aux cuisiniers.

## Phase 3 : Paiement Digital & Fidélité
- Paiement par carte bancaire directement sur le smartphone du client (Stripe, Konnect, Flouci, etc.).
- Partage d'addition dynamique entre convives d'une même table.
- Programme de fidélité et offres promotionnelles ciblées ("Happy Hour" programmable).

## Phase 4 : Multi-Sites & Franchise
- Gestion d'enseignes multi-établissements avec reporting consolidé.
- Gestion des stocks d'ingrédients en temps réel avec alertes de rupture.
