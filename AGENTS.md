# AGENTS.md — Directives & Architecture pour Agents Autonomes

## 1. Contexte du Projet
Ce projet est un SaaS de gestion de commandes et de service en salle pour les débits de boissons, cafés et lounges.
Points d'attention capitaux :
1. **Une table reste OCCUPIED pendant TOUTE la session**, même si toutes les commandes sont servies. Seul le paiement confirmé et la fermeture de la session libèrent la table.
2. **Une seule session ouverte par table** à tout instant (contrainte d'index partiel et validation applicative).
3. **Le client ne s'authentifie pas** : son identité est dérivée de son QR Code de table.
4. **La transmission à la caisse est manuelle pour ce MVP** : le serveur doit disposer d'un bouton explicite "Transmise à la caisse" avec traçabilité (`pos_transmitted_at`, `pos_transmitted_by`).
5. **Multi-restaurant étanche** : toute requête doit être scellée par `restaurant_id`.

## 2. Structure des Fichiers Clés
- `src/types/database.ts` : Définitions TypeScript strictes des entités.
- `src/lib/dbEngine.ts` : Moteur de base de données relationnelle locale & proxy Supabase avec notifications BroadcastChannel et transactions atomiques.
- `src/lib/supabaseClient.ts` : Client Supabase officiel.
- `src/lib/testRunner.ts` : Suite de tests couvrant les 15 scénarios critiques.
- `src/context/AuthContext.tsx` : Fournisseur de contexte d'authentification Manager & Serveur.
- `src/context/RealtimeContext.tsx` : Abonnements en direct (Commandes, Additions, Service, Tables).
- `supabase/migrations/` : Scripts SQL PostgreSQL complets.
