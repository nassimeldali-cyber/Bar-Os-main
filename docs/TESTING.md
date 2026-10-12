# Guide des Tests & Scénarios Critiques

> Le banc `src/lib/testRunner.ts` valide le moteur local de démonstration. Il ne teste ni Supabase, ni les politiques RLS, ni la concurrence entre appareils; ces validations sont nécessaires avant une mise en production.

## 1. Les 15 Scénarios de Test Exigés (Section 31)

1. **Création session** : Le scan QR d'une table disponible crée une session `OPEN` et passe la table à `OCCUPIED`.
2. **Impossibilité de créer deux sessions ouvertes** : Toute tentative de créer une deuxième session sur une table déjà occupée est rejetée.
3. **Création commande** : Le client ajoute des articles et valide une commande valide avec numéro incrémenté.
4. **Commandes multiples dans une session** : Le client peut passer plusieurs commandes successives (ex: boissons à 19h20, tapas à 20h10) qui s'additionnent sur la même session.
5. **Notification serveur** : Toute nouvelle commande déclenche une notification temps réel avec alerte sonore/visuelle chez le serveur.
6. **Demande d'addition** : Le client clique sur "Demander l'addition", la session passe à `ADDITION_REQUESTED`, la table à `BILL_REQUESTED`, et le serveur est alerté.
7. **Paiement sécurisé** : Seul le serveur ou le manager peut enregistrer et confirmer le paiement (choix Cash ou TPE).
8. **Fermeture session** : La confirmation du paiement clôture formellement la session (`CLOSED`).
9. **Libération table** : Dès la fermeture de la session, la table repasse automatiquement à `AVAILABLE`.
10. **Séparation multi-restaurant A/B** : Les commandes et tables du Restaurant A sont hermétiquement invisibles pour le Restaurant B.
11. **Permissions serveur** : Un serveur ne peut pas modifier les prix du menu, ni s'auto-attribuer les droits MANAGER.
12. **Permissions manager** : Le gérant a accès aux KPIs financiers, configuration du menu, des tables et du personnel.
13. **Sécurité RLS** : Les clients non authentifiés ne peuvent pas exécuter de mutations non autorisées.
14. **Double paiement impossible** : Une session déjà réglée ne peut être encaissée une seconde fois.
15. **Produit indisponible** : Les produits avec `available = false` ne peuvent être ajoutés au panier ni commandés.

## 2. Exécution du banc de test automatisé
L'application intègre une suite de tests automatisés accessible :
- Directement dans le tableau de bord Manager (onglet "Tests & Diagnostics") avec affichage vert/rouge et temps de réponse pour chaque test.
- Via le runner TypeScript `src/lib/testRunner.ts`.
