import React, { useState, useMemo } from 'react';
import { dbEngine } from '../../lib/dbEngine';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import {
  TableItem,
  Order,
  TableSession,
  PaymentMethod,
  OrderStatus
} from '../../types/database';
import {
  LayoutGrid,
  ShoppingBag,
  Receipt,
  Bell,
  CheckCircle2,
  Clock,
  Send,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  X,
  ExternalLink,
  ChefHat
} from 'lucide-react';

interface ServerViewProps {
  onOpenTableClient?: (restaurantId: string, tableId: string) => void;
}

export const ServerView: React.FC<ServerViewProps> = ({ onOpenTableClient }) => {
  const { currentUser, currentRestaurant } = useAuth();
  const { lastEventTimestamp } = useRealtime();

  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDERS' | 'BILLS' | 'CALLS'>('TABLES');
  const [filterMode, setFilterMode] = useState<'ASSIGNED' | 'ALL'>('ASSIGNED');

  // Payment modal state
  const [payingSession, setPayingSession] = useState<{ session: TableSession; table: TableItem } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TPE');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Selected table modal
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);

  const restaurantId = currentRestaurant?.id || 'a0000000-0000-0000-0000-000000000001';
  const currency = currentRestaurant?.currency || 'DT';

  // Load server assigned table IDs
  const assignedTableIds = useMemo(() => {
    if (!currentUser) return [];
    return dbEngine.getServerAssignedTableIds(currentUser.id);
  }, [currentUser, lastEventTimestamp]);

  // Load all tables
  const allTables = useMemo(() => {
    return dbEngine.getTables(restaurantId);
  }, [restaurantId, lastEventTimestamp]);

  // Tables to show based on filter
  const displayedTables = useMemo(() => {
    if (filterMode === 'ASSIGNED') {
      return allTables.filter((t) => assignedTableIds.includes(t.id));
    }
    return allTables;
  }, [allTables, assignedTableIds, filterMode]);

  // Orders
  const allOrders = useMemo(() => {
    return dbEngine.getAllOrders(restaurantId);
  }, [restaurantId, lastEventTimestamp]);

  // Active / in-progress orders
  const activeOrders = useMemo(() => {
    return allOrders.filter((o) => !['SERVED', 'CANCELLED'].includes(o.status));
  }, [allOrders]);

  // Filtered orders for server's tables
  const displayedOrders = useMemo(() => {
    if (filterMode === 'ASSIGNED') {
      return activeOrders.filter((o) => assignedTableIds.includes(o.table_id));
    }
    return activeOrders;
  }, [activeOrders, assignedTableIds, filterMode]);

  // Sessions requesting bill
  const activeSessions = useMemo(() => {
    return dbEngine.getAllSessions(restaurantId);
  }, [restaurantId, lastEventTimestamp]);

  const billRequestedSessions = useMemo(() => {
    return activeSessions.filter((s) => s.status === 'ADDITION_REQUESTED');
  }, [activeSessions]);

  // Service requests
  const serviceRequests = useMemo(() => {
    return dbEngine.getState().serviceRequests
      .filter((r) => r.restaurant_id === restaurantId && r.status === 'PENDING');
  }, [restaurantId, lastEventTimestamp]);

  // Actions: Transmit to POS
  const handleTransmitToPos = (order: Order) => {
    if (!currentUser) return;
    try {
      dbEngine.transmitOrderToPos(order.id, currentUser.id, currentUser.full_name);
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Actions: Update order status
  const handleUpdateStatus = (orderId: string, status: OrderStatus) => {
    if (!currentUser) return;
    try {
      dbEngine.updateOrderStatus(orderId, status, currentUser.id, currentUser.full_name);
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Actions: Confirm payment
  const handleConfirmPayment = () => {
    if (!payingSession || !currentUser || isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      dbEngine.confirmPayment(
        payingSession.session.id,
        paymentMethod,
        currentUser.id,
        currentUser.full_name,
        paymentNotes
      );
      setPayingSession(null);
      setPaymentNotes('');
    } catch (err: any) {
      alert(err?.message || 'Erreur lors du paiement');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Actions: Resolve service request
  const handleResolveService = (reqId: string) => {
    if (!currentUser) return;
    dbEngine.resolveServiceRequest(reqId, currentUser.id, currentUser.full_name);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Server Header Banner */}
      <div className="bg-slate-900 text-white px-4 py-4 border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
              {currentUser?.username || 'SRV'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">{currentUser?.full_name || 'Espace Serveur'}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-400/30">
                  {currentUser?.username}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {assignedTableIds.length} tables assignées en salle
              </p>
            </div>
          </div>

          {/* Table filter toggle: Assigned vs All */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl self-start md:self-auto border border-slate-700">
            <button
              onClick={() => setFilterMode('ASSIGNED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterMode === 'ASSIGNED'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Mes tables ({assignedTableIds.length})
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterMode === 'ALL'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Toutes les tables ({allTables.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('TABLES')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'TABLES'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Mes Tables
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-extrabold">
              {displayedTables.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 relative ${
              activeTab === 'ORDERS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-500" />
            Commandes en cours
            {displayedOrders.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold animate-pulse">
                {displayedOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('BILLS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'BILLS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-500" />
            Additions demandées
            {billRequestedSessions.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold animate-bounce">
                {billRequestedSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CALLS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'CALLS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-4 h-4 text-blue-500" />
            Appels Client
            {serviceRequests.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-extrabold">
                {serviceRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ===================================================================
            TAB 1: TABLES GRID
           =================================================================== */}
        {activeTab === 'TABLES' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>Plan de Salle</span>
                <span className="text-xs font-normal text-slate-500">
                  ({displayedTables.length} tables visibles)
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {displayedTables.map((tbl) => {
                const activeSession = dbEngine.getActiveSession(tbl.id);
                const tableOrders = activeSession ? dbEngine.getOrdersBySession(activeSession.id) : [];
                const isAssigned = assignedTableIds.includes(tbl.id);

                // Status theme
                const statusStyles = {
                  AVAILABLE: 'border-emerald-200 bg-white hover:border-emerald-400',
                  OCCUPIED: 'border-blue-300 bg-blue-50/40 hover:border-blue-500',
                  BILL_REQUESTED: 'border-amber-400 bg-amber-50 hover:border-amber-600 ring-2 ring-amber-400/30',
                  PAYMENT_PENDING: 'border-purple-300 bg-purple-50/40 hover:border-purple-500'
                };

                const statusBadges = {
                  AVAILABLE: { label: 'Libre', color: 'bg-emerald-100 text-emerald-800' },
                  OCCUPIED: { label: 'Occupée', color: 'bg-blue-100 text-blue-800' },
                  BILL_REQUESTED: { label: 'Addition !', color: 'bg-amber-400 text-slate-950 font-black animate-pulse' },
                  PAYMENT_PENDING: { label: 'En caisse', color: 'bg-purple-100 text-purple-800' }
                };

                return (
                  <div
                    key={tbl.id}
                    onClick={() => setSelectedTable(tbl)}
                    className={`rounded-2xl p-3.5 border-2 transition shadow-2xs cursor-pointer flex flex-col justify-between ${
                      statusStyles[tbl.status] || 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-black text-slate-900">
                          #{tbl.table_number}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadges[tbl.status].color}`}>
                          {statusBadges[tbl.status].label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">{tbl.zone}</p>
                      {isAssigned && (
                        <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md">
                          Affectée
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-200/70">
                      {activeSession ? (
                        <div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 text-[10px]">
                              {tableOrders.length} cmd
                            </span>
                            <span className="font-extrabold text-slate-900">
                              {activeSession.total_amount.toFixed(3)} {currency}
                            </span>
                          </div>
                          {tbl.status === 'BILL_REQUESTED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayingSession({ session: activeSession, table: tbl });
                              }}
                              className="mt-2 w-full py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition"
                            >
                              Encaisser
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Prête à accueillir</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: LIVE ORDERS (MANUAL POS TRANSMISSION WORKFLOW)
           =================================================================== */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
              <ChefHat className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-950">
                <p className="font-bold">Passerelle Caisse Physique (Section 6 & 9)</p>
                <p className="text-indigo-800 mt-0.5">
                  Pour chaque nouvelle commande, saisissez les articles sur la caisse physique du bar, puis cliquez sur <strong>"Transmise à la caisse"</strong>. L'heure et votre matricule seront enregistrés.
                </p>
              </div>
            </div>

            {displayedOrders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Aucune commande en attente.</p>
                <p className="text-xs text-slate-500 mt-1">Les nouvelles commandes apparaîtront instantanément ici.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedOrders.map((ord) => {
                  const tbl = dbEngine.getTableById(ord.table_id);

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        {/* Order Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900">
                                Commande #{ord.order_number}
                              </span>
                              <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-slate-900 text-white">
                                Table {tbl?.table_number || ord.table_number}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              Reçue à {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              ord.status === 'NEW'
                                ? 'bg-blue-100 text-blue-800 animate-pulse'
                                : ord.status === 'TRANSMITTED_TO_POS'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ord.status === 'NEW'
                                ? 'À saisir en caisse'
                                : ord.status === 'TRANSMITTED_TO_POS'
                                ? 'Transmise Caisse'
                                : ord.status}
                            </span>
                            <p className="text-sm font-black text-slate-900 mt-1">
                              {ord.total.toFixed(3)} {currency}
                            </p>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="py-3 space-y-1.5">
                          {ord.items?.map((it) => (
                            <div key={it.id} className="flex justify-between text-xs">
                              <span className="font-semibold text-slate-800">
                                <span className="text-amber-600 font-bold mr-1.5">{it.quantity}×</span>
                                {it.product_name}
                              </span>
                              <span className="text-slate-500">{it.total_price.toFixed(3)} {currency}</span>
                            </div>
                          ))}

                          {ord.notes && (
                            <div className="mt-2 p-2 bg-amber-50 rounded-xl text-[11px] text-amber-900 border border-amber-200">
                              <strong>Note client :</strong> {ord.notes}
                            </div>
                          )}
                        </div>

                        {/* POS Transmission info if transmitted */}
                        {ord.pos_transmitted_at && (
                          <div className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-xl mb-3 flex items-center gap-1.5 border border-purple-200">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Saisie caisse confirmée à {new Date(ord.pos_transmitted_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                        {ord.status === 'NEW' && (
                          <button
                            onClick={() => handleTransmitToPos(ord)}
                            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Transmise à la caisse
                          </button>
                        )}

                        {ord.status === 'TRANSMITTED_TO_POS' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'PREPARING')}
                            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            En préparation
                          </button>
                        )}

                        {ord.status === 'PREPARING' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'READY')}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Commande prête
                          </button>
                        )}

                        {ord.status === 'READY' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'SERVED')}
                            className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            Marquer servie
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 3: BILLS & ENCAISSEMENTS
           =================================================================== */}
        {activeTab === 'BILLS' && (
          <div className="space-y-4">
            <h2 className="font-extrabold text-base text-slate-900">
              Demandes d'Addition en Salle ({billRequestedSessions.length})
            </h2>

            {billRequestedSessions.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Aucune addition demandée pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {billRequestedSessions.map((sess) => {
                  const tbl = dbEngine.getTableById(sess.table_id);
                  const orders = dbEngine.getOrdersBySession(sess.id);

                  return (
                    <div
                      key={sess.id}
                      className="bg-white rounded-2xl border-2 border-amber-300 p-4 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <span className="text-lg font-black text-slate-900">
                              Table #{tbl?.table_number}
                            </span>
                            <p className="text-xs text-slate-500 font-mono">{sess.session_code}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Montant total</span>
                            <p className="text-xl font-black text-amber-600">
                              {sess.total_amount.toFixed(3)} {currency}
                            </p>
                          </div>
                        </div>

                        <div className="py-3 text-xs text-slate-600">
                          <p>{orders.length} commande(s) dans cette session :</p>
                          <div className="mt-1 space-y-1">
                            {orders.map((o) => (
                              <div key={o.id} className="flex justify-between text-[11px] text-slate-500">
                                <span>Cmd #{o.order_number} ({o.items?.length || 0} articles)</span>
                                <span>{o.total.toFixed(3)} {currency}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (tbl) setPayingSession({ session: sess, table: tbl });
                        }}
                        className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
                      >
                        <Receipt className="w-4 h-4" />
                        Procéder à l'encaissement ({sess.total_amount.toFixed(3)} {currency})
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: CALLS / SERVICE REQUESTS
           =================================================================== */}
        {activeTab === 'CALLS' && (
          <div className="space-y-4">
            <h2 className="font-extrabold text-base text-slate-900">
              Appels Client en Attente ({serviceRequests.length})
            </h2>

            {serviceRequests.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Aucun appel client en attente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl border-2 border-blue-200 p-4 shadow-2xs flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          Table {req.table_number || '?'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {req.type === 'CALL_SERVER' ? 'Demande un serveur' : "Demande d'eau"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResolveService(req.id)}
                      className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Acquitter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL: PAYMENT CONFIRMATION (CASH / TPE)
         ===================================================================== */}
      {payingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Encaisser — Table {payingSession.table.table_number}</h3>
                <p className="text-xs text-slate-400">{payingSession.session.session_code}</p>
              </div>
              <button
                onClick={() => setPayingSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Total amount highlight */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                <span className="text-xs font-bold text-amber-800 uppercase">Montant à régler</span>
                <p className="text-3xl font-black text-slate-950 mt-1">
                  {payingSession.session.total_amount.toFixed(3)}{' '}
                  <span className="text-sm font-bold text-amber-700">{currency}</span>
                </p>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Mode de règlement physique :
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition font-bold text-xs ${
                      paymentMethod === 'CASH'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-6 h-6 text-emerald-600" />
                    <span>Espèces (Cash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TPE')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition font-bold text-xs ${
                      paymentMethod === 'TPE'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 text-indigo-600" />
                    <span>TPE (Carte)</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Note ou référence ticket POS :
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex: Reçu TPE #8843, pourboire..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* Explanatory notice */}
              <p className="text-[11px] text-slate-500 leading-snug">
                En confirmant ce paiement, la session sera clôturée et la <strong>Table {payingSession.table.table_number}</strong> redeviendra immédiatement <strong>LIBRE</strong> pour de nouveaux clients.
              </p>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingSession(null)}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isProcessingPayment}
                  className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  {isProcessingPayment ? 'Validation...' : 'Confirmer Paiement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TABLE QUICK DETAILS
         ===================================================================== */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">Table #{selectedTable.table_number}</h3>
                <p className="text-xs text-slate-400">Zone : {selectedTable.zone}</p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {(() => {
                const activeSess = dbEngine.getActiveSession(selectedTable.id);
                const orders = activeSess ? dbEngine.getOrdersBySession(activeSess.id) : [];

                if (!activeSess) {
                  return (
                    <div className="text-center py-6 text-slate-500">
                      <p className="text-sm font-semibold">Table actuellement LIBRE</p>
                      <button
                        onClick={() => {
                          if (onOpenTableClient) onOpenTableClient(restaurantId, selectedTable.id);
                          setSelectedTable(null);
                        }}
                        className="mt-4 py-2 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Simuler scan QR client
                      </button>
                    </div>
                  );
                }

                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">Session en cours :</span>
                      <span className="text-xs font-mono font-bold text-indigo-600">{activeSess.session_code}</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl p-2 mb-3">
                      {orders.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">Session ouverte, aucune commande passée.</p>
                      ) : (
                        orders.map((o) => (
                          <div key={o.id} className="py-2 text-xs flex justify-between">
                            <div>
                              <span className="font-bold">Cmd #{o.order_number}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">({o.status})</span>
                            </div>
                            <span className="font-semibold">{o.total.toFixed(3)} {currency}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-between items-center font-black text-sm mb-4">
                      <span>Total Table :</span>
                      <span className="text-amber-600 text-lg">{activeSess.total_amount.toFixed(3)} {currency}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setPayingSession({ session: activeSess, table: selectedTable });
                          setSelectedTable(null);
                        }}
                        className="py-2.5 px-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition"
                      >
                        Encaisser
                      </button>
                      <button
                        onClick={() => {
                          if (onOpenTableClient) onOpenTableClient(restaurantId, selectedTable.id);
                          setSelectedTable(null);
                        }}
                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Vue Client
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
