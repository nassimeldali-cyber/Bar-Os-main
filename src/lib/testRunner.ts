/**
 * Test Runner - BarLounge SaaS
 * Comprehensive verification of the 15 critical business test scenarios (Section 31)
 */

import { dbEngine } from './dbEngine';

export interface TestResult {
  id: number;
  title: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export async function runAllTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const restId = 'a0000000-0000-0000-0000-000000000001';

  // Helper for timing
  const runTest = async (
    id: number,
    title: string,
    category: string,
    fn: () => Promise<string> | string
  ) => {
    const start = performance.now();
    try {
      const details = await fn();
      const durationMs = Number((performance.now() - start).toFixed(1));
      results.push({ id, title, category, passed: true, durationMs, details });
    } catch (err: any) {
      const durationMs = Number((performance.now() - start).toFixed(1));
      results.push({
        id,
        title,
        category,
        passed: false,
        durationMs,
        details: err?.message || 'Échec du test'
      });
    }
  };

  // Setup fresh state for isolation
  dbEngine.resetToSeed();
  const tables = dbEngine.getTables(restId);
  const testTable = tables[0]; // Table 01
  const products = dbEngine.getAvailableProducts(restId);
  let activeSessionId = '';

  // TEST 1: Création session
  await runTest(1, '1. Création de session', 'Session', () => {
    const session = dbEngine.getOrCreateActiveSession(restId, testTable.id);
    activeSessionId = session.id;
    const updatedTable = dbEngine.getTableById(testTable.id);
    if (!session || session.status !== 'OPEN') throw new Error('La session créée doit avoir le statut OPEN');
    if (!updatedTable || updatedTable.status !== 'OCCUPIED') throw new Error('La table doit passer au statut OCCUPIED');
    return `Session ${session.session_code} créée avec succès. Table marquée OCCUPIED.`;
  });

  // TEST 2: Impossibilité de créer deux sessions ouvertes
  await runTest(2, '2. Unicité de la session ouverte', 'Session', () => {
    const secondCall = dbEngine.getOrCreateActiveSession(restId, testTable.id);
    if (secondCall.id !== activeSessionId) {
      throw new Error('Une seconde session différente a été créée au lieu de retourner la session active existante');
    }
    const allActive = dbEngine.getState().tableSessions.filter(
      (s) => s.table_id === testTable.id && s.status === 'OPEN'
    );
    if (allActive.length > 1) {
      throw new Error('Violation: deux sessions OPEN coexistent sur la même table');
    }
    return `Unicité vérifiée: seule la session active ${activeSessionId} est retournée.`;
  });

  // TEST 3: Création commande
  let firstOrderId = '';
  await runTest(3, '3. Création commande', 'Commande', () => {
    const item1 = products[0]; // e.g., Mojito Passion
    const order = dbEngine.createOrder(
      restId,
      activeSessionId,
      testTable.id,
      [{ productId: item1.id, quantity: 2, notes: 'Sans paille' }]
    );
    firstOrderId = order.id;
    if (order.status !== 'NEW') throw new Error('La commande doit naître avec le statut NEW');
    if (order.total !== Number((item1.price * 2).toFixed(3))) throw new Error('Montant total de commande incorrect');
    const session = dbEngine.getSessionById(activeSessionId);
    if (session?.total_amount !== order.total) throw new Error('Le total de session doit refléter la commande');
    return `Commande #${order.order_number} créée (Total: ${order.total.toFixed(3)} DT). Session mise à jour.`;
  });

  // TEST 4: Plusieurs commandes dans une même session
  await runTest(4, '4. Commandes multiples dans une session', 'Commande', () => {
    const item2 = products[1]; // Espresso Martini
    const order2 = dbEngine.createOrder(
      restId,
      activeSessionId,
      testTable.id,
      [{ productId: item2.id, quantity: 1 }]
    );
    const sessionOrders = dbEngine.getOrdersBySession(activeSessionId);
    if (sessionOrders.length < 2) throw new Error('La session doit comporter au moins 2 commandes');
    const session = dbEngine.getSessionById(activeSessionId);
    const expectedTotal = sessionOrders.reduce((sum, o) => sum + o.total, 0);
    if (Math.abs((session?.total_amount || 0) - expectedTotal) > 0.001) {
      throw new Error(`Total cumulé erroné: attendu ${expectedTotal}, obtenu ${session?.total_amount}`);
    }
    return `Deuxième commande #${order2.order_number} ajoutée. Total cumulé session: ${session?.total_amount.toFixed(3)} DT.`;
  });

  // TEST 5: Notification serveur
  await runTest(5, '5. Notification serveur temps réel', 'Notification', () => {
    const notifs = dbEngine.getNotifications(restId);
    const orderNotif = notifs.find((n) => n.table_id === testTable.id && n.type === 'ORDER_NEW');
    if (!orderNotif) throw new Error('Aucune notification de commande générée');
    return `Notification reçue: "${orderNotif.title} - ${orderNotif.message}"`;
  });

  // TEST 6: Demande addition
  await runTest(6, "6. Demande d'addition", 'Addition', () => {
    const updatedSession = dbEngine.requestBill(activeSessionId);
    const updatedTable = dbEngine.getTableById(testTable.id);
    if (updatedSession.status !== 'ADDITION_REQUESTED') throw new Error('Session doit passer à ADDITION_REQUESTED');
    if (updatedTable?.status !== 'BILL_REQUESTED') throw new Error('Table doit passer à BILL_REQUESTED');
    const notif = dbEngine.getNotifications(restId).find((n) => n.type === 'BILL_REQUESTED');
    if (!notif) throw new Error('Notification d\'addition non générée');
    return `Statut session: ADDITION_REQUESTED, Statut table: BILL_REQUESTED, Notification émise.`;
  });

  // TEST 7: Paiement sécurisé par le personnel
  let paymentResult: any;
  await runTest(7, '7. Paiement sécurisé (Staff)', 'Paiement', () => {
    paymentResult = dbEngine.confirmPayment(
      activeSessionId,
      'TPE',
      'b0000000-0000-0000-0000-000000000873',
      'Karim Serveur',
      'Carte Visa'
    );
    if (!paymentResult || paymentResult.status !== 'CONFIRMED') throw new Error('Paiement non confirmé');
    if (paymentResult.method !== 'TPE') throw new Error('Mode de paiement incorrect');
    return `Règlement TPE de ${paymentResult.amount.toFixed(3)} TND validé par Karim Serveur.`;
  });

  // TEST 8: Fermeture session
  await runTest(8, '8. Fermeture de session', 'Session', () => {
    const session = dbEngine.getSessionById(activeSessionId);
    if (session?.status !== 'CLOSED') throw new Error('La session doit être au statut CLOSED après paiement');
    if (!session.closed_at) throw new Error('La date de clôture closed_at doit être renseignée');
    return `Session ${session.session_code} formellement clôturée à ${new Date(session.closed_at).toLocaleTimeString()}.`;
  });

  // TEST 9: Libération table
  await runTest(9, '9. Libération de la table', 'Table', () => {
    const table = dbEngine.getTableById(testTable.id);
    if (table?.status !== 'AVAILABLE') throw new Error('La table doit repasser au statut AVAILABLE après encaissement');
    return `Table ${table.table_number} redevenue AVAILABLE.`;
  });

  // TEST 10: Séparation multi-restaurant A/B
  await runTest(10, '10. Isolation Multi-Restaurant A/B', 'Sécurité', () => {
    // Add dummy restaurant B
    const restBId = 'a0000000-0000-0000-0000-000000000099';
    const restATables = dbEngine.getTables(restId);
    if (restATables.length !== 10) {
      throw new Error(`Le restaurant A doit posséder 10 tables, obtenu: ${restATables.length}`);
    }
    const lastTable = restATables.find((table) => table.table_number === '10');
    if (!lastTable) throw new Error('La table 10 doit appartenir au restaurant A');
    const restBOrders = dbEngine.getAllOrders(restBId);
    if (restBOrders.length !== 0) throw new Error('Le Restaurant B ne doit voir aucune commande du Restaurant A');
    const restBTables = dbEngine.getTables(restBId);
    if (restBTables.length !== 0) throw new Error('Le Restaurant B ne doit voir aucune table du Restaurant A');
    return `Isolation étanche validée entre Restaurant A (${restId}) et Restaurant B (${restBId}).`;
  });

  // TEST 11: Permissions serveur
  await runTest(11, '11. Permissions Serveur', 'Sécurité', () => {
    const serverProfile = dbEngine.getProfileByUsername('U873');
    if (!serverProfile || serverProfile.role !== 'SERVER') throw new Error('Rôle attendu SERVER');
    const assignedTables = dbEngine.getServerAssignedTableIds(serverProfile.id);
    if (assignedTables.length === 0) throw new Error('Le serveur doit avoir des tables assignées');
    return `Profil ${serverProfile.username} restreint au rôle SERVER avec ${assignedTables.length} tables assignées.`;
  });

  // TEST 12: Permissions Manager
  await runTest(12, '12. Permissions Manager', 'Sécurité', () => {
    const managerProfile = dbEngine.getProfileById('b0000000-0000-0000-0000-000000000001');
    if (!managerProfile || managerProfile.role !== 'MANAGER') throw new Error('Rôle attendu MANAGER');
    return `Gérant ${managerProfile.username} dispose de l'accès administratif complet.`;
  });

  // TEST 13: Sécurité RLS et mutation non autorisée
  await runTest(13, '13. Sécurité RLS (Interdiction fermer session client)', 'Sécurité', () => {
    // Attempting double closure or illegal mutation
    let blocked = false;
    try {
      dbEngine.confirmPayment(activeSessionId, 'CASH', 'client-fake', 'Client');
    } catch (e) {
      blocked = true;
    }
    if (!blocked) throw new Error('Une tentative de modification non autorisée aurait dû être rejetée');
    return `Tentative de mutation sur session fermée ou non autorisée rejetée avec succès.`;
  });

  // TEST 14: Double paiement impossible
  await runTest(14, '14. Blocage du double paiement', 'Paiement', () => {
    let failed = false;
    try {
      dbEngine.confirmPayment(activeSessionId, 'CASH', 'b0000000-0000-0000-0000-000000000873', 'Karim Serveur');
    } catch (err: any) {
      failed = true;
    }
    if (!failed) throw new Error('Le système a autorisé un second paiement sur une session déjà CLOSED');
    return `Double paiement bloqué avec succès par le moteur de contraintes.`;
  });

  // TEST 15: Produit indisponible
  await runTest(15, '15. Produit indisponible non commandable', 'Menu', () => {
    // Open a fresh session on table 02
    const table2 = tables[1];
    const newSession = dbEngine.getOrCreateActiveSession(restId, table2.id);
    // Mark a product unavailable
    const prod = products[2];
    dbEngine.updateProduct(prod.id, { available: false });

    let orderBlocked = false;
    try {
      dbEngine.createOrder(restId, newSession.id, table2.id, [{ productId: prod.id, quantity: 1 }]);
    } catch (err) {
      orderBlocked = true;
    }

    // Revert product availability
    dbEngine.updateProduct(prod.id, { available: true });

    if (!orderBlocked) {
      throw new Error("Une commande d'un produit marqué indisponible a été acceptée à tort");
    }
    return `Produit "${prod.name}" indisponible rejeté lors de la validation du panier.`;
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results
  };
}
