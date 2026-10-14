import React, { useState, useMemo } from 'react';
import { dbEngine } from '../../lib/dbEngine';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { QRCodeModal } from '../common/QRCodeModal';
import { runAllTests, TestResult } from '../../lib/testRunner';
import {
  TableItem,
  Category,
  Product
} from '../../types/database';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Users,
  QrCode,
  UtensilsCrossed,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
   FileText,
  ChevronDown,
  LogOut
} from 'lucide-react';

interface ManagerViewProps {
  onOpenTableClient?: (restaurantId: string, tableId: string) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({ onOpenTableClient }) => {
  const { currentRestaurant, currentUser, switchUser } = useAuth();
  const { lastEventTimestamp } = useRealtime();

  const [activeTab, setActiveTab] = useState<
    'KPIS' | 'TABLES' | 'SERVERS' | 'MENU' | 'SESSIONS' | 'PAYMENTS' | 'AUDIT' | 'TESTS'
  >('KPIS');

  const restaurantId = currentRestaurant?.id || dbEngine.getAllRestaurants()[0]?.id || '';
  const currency = currentRestaurant?.currency || 'DT';

  const staffProfiles = dbEngine.getStaffProfiles(restaurantId);

  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Data fetching
  const tables = useMemo(() => dbEngine.getTables(restaurantId), [restaurantId, lastEventTimestamp]);
  const categories = useMemo(() => dbEngine.getCategories(restaurantId), [restaurantId, lastEventTimestamp]);
  const products = useMemo(() => dbEngine.getProducts(restaurantId), [restaurantId, lastEventTimestamp]);
  const servers = useMemo(() => dbEngine.getStaffProfiles(restaurantId).filter((p) => p.role === 'SERVER'), [restaurantId, lastEventTimestamp]);
  const sessions = useMemo(() => dbEngine.getAllSessions(restaurantId), [restaurantId, lastEventTimestamp]);
  const payments = useMemo(() => dbEngine.getPayments(restaurantId), [restaurantId, lastEventTimestamp]);
  const auditLogs = useMemo(() => dbEngine.getAuditLogs(restaurantId), [restaurantId, lastEventTimestamp]);
  const allOrders = useMemo(() => dbEngine.getAllOrders(restaurantId), [restaurantId, lastEventTimestamp]);

  // QR Modal
  const [selectedQrTable, setSelectedQrTable] = useState<TableItem | null>(null);

  // New Table Form
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableZone, setNewTableZone] = useState('Terrasse');

  // New Server Form
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServerUsername, setNewServerUsername] = useState('');
  const [newServerName, setNewServerName] = useState('');
  const [newServerEmail, setNewServerEmail] = useState('');

  // Assign tables to server modal
  const [assigningServer, setAssigningServer] = useState<string | null>(null);
  const [assignedTablesSelection, setAssignedTablesSelection] = useState<string[]>([]);

  // Menu Creation Modals
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');

  // Automated Tests State
  const [testResults, setTestResults] = useState<{
    total: number;
    passed: number;
    failed: number;
    results: TestResult[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Calculate KPIs
  const totalRevenue = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const cashRevenue = useMemo(() => {
    return payments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const tpeRevenue = useMemo(() => {
    return payments.filter((p) => p.method === 'TPE').reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const openSessionsCount = useMemo(() => {
    return sessions.filter((s) => ['OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'].includes(s.status)).length;
  }, [sessions]);

  const occupiedTablesCount = useMemo(() => {
    return tables.filter((t) => t.status !== 'AVAILABLE').length;
  }, [tables]);

  const availableTablesCount = useMemo(() => {
    return tables.filter((t) => t.status === 'AVAILABLE').length;
  }, [tables]);

  const pendingOrdersCount = useMemo(() => {
    return allOrders.filter((o) => !['SERVED', 'CANCELLED'].includes(o.status)).length;
  }, [allOrders]);

  const billsRequestedCount = useMemo(() => {
    return sessions.filter((s) => s.status === 'ADDITION_REQUESTED').length;
  }, [sessions]);

  // Handlers
  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    try {
      dbEngine.createTable(restaurantId, newTableNum.trim(), newTableZone);
      setNewTableNum('');
      setIsAddingTable(false);
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerUsername || !newServerName || !newServerEmail) return;
    try {
      dbEngine.createServerProfile(restaurantId, newServerUsername, newServerName, newServerEmail);
      setNewServerUsername('');
      setNewServerName('');
      setNewServerEmail('');
      setIsAddingServer(false);
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const handleSaveAssignments = () => {
    if (!assigningServer) return;
    dbEngine.setServerTableAssignments(restaurantId, assigningServer, assignedTablesSelection);
    setAssigningServer(null);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    dbEngine.createCategory(restaurantId, newCategoryName);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdCategory || !newProdPrice) return;
    dbEngine.createProduct(restaurantId, {
      category_id: newProdCategory,
      name: newProdName,
      description: newProdDesc,
      price: parseFloat(newProdPrice),
      available: true,
      display_order: products.length + 1
    });
    setNewProdName('');
    setNewProdDesc('');
    setNewProdPrice('');
    setIsAddingProduct(false);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runAllTests();
      setTestResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white px-4 py-5 border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs">
                GÉRANT
              </span>
              <h1 className="text-xl font-black tracking-tight">
                Direction — {currentRestaurant?.name}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervision temps réel, menu, tables et journal d'audit
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                   if (window.confirm('Effacer les données locales et recharger depuis la base de données ?')) {
                   dbEngine.resetToSeed();
                 }
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser Démo
            </button>
            <button
              onClick={() => {
                setActiveTab('TESTS');
                handleRunTests();
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Lancer les 15 Tests
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-2.5">
          {[
            { id: 'KPIS', label: 'Indicateurs KPIs', icon: TrendingUp },
            { id: 'TABLES', label: 'Gestion Tables & QR', icon: QrCode },
            { id: 'SERVERS', label: 'Serveurs & Affectations', icon: Users },
            { id: 'MENU', label: 'Menu & Produits', icon: UtensilsCrossed },
            { id: 'SESSIONS', label: 'Sessions & Commandes', icon: Clock },
            { id: 'PAYMENTS', label: 'Encaissements', icon: CreditCard },
            { id: 'AUDIT', label: 'Journal d\'Audit', icon: FileText },
            { id: 'TESTS', label: 'Tests & Diagnostics (15)', icon: ShieldCheck, highlight: true }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : tab.highlight
                    ? 'text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.highlight && !isSelected ? 'text-amber-600' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ===================================================================
            TAB 1: KPIS DASHBOARD
           =================================================================== */}
        {activeTab === 'KPIS' && (
          <div className="space-y-6">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Chiffre d'Affaires (Jour)
                </span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {totalRevenue.toFixed(3)} <span className="text-xs font-bold text-slate-500">{currency}</span>
                </p>
                <div className="mt-2 text-[10px] text-slate-500 flex gap-2">
                  <span>Espèces: <strong>{cashRevenue.toFixed(3)}</strong></span>
                  <span>•</span>
                  <span>TPE: <strong>{tpeRevenue.toFixed(3)}</strong></span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sessions Ouvertes
                </span>
                <p className="text-2xl font-black text-indigo-600 mt-1">
                  {openSessionsCount}
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  {billsRequestedCount} demande(s) d'addition
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Occupation des Tables
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-slate-900">{occupiedTablesCount}</p>
                  <span className="text-xs font-semibold text-slate-400">/ {tables.length} tables</span>
                </div>
                <p className="text-[10px] text-emerald-600 font-semibold mt-2">
                  {availableTablesCount} table(s) disponibles
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Commandes en Cours
                </span>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {pendingOrdersCount}
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  {allOrders.length} commande(s) au total
                </p>
              </div>
            </div>

            {/* Split Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Methods Breakdown */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
                <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Répartition des Règlements
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs">Espèces (Cash)</p>
                        <p className="text-[10px] text-slate-400">
                          {payments.filter((p) => p.method === 'CASH').length} transaction(s)
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900">{cashRevenue.toFixed(3)} {currency}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs">TPE (Carte bancaire)</p>
                        <p className="text-[10px] text-slate-400">
                          {payments.filter((p) => p.method === 'TPE').length} transaction(s)
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900">{tpeRevenue.toFixed(3)} {currency}</span>
                  </div>
                </div>
              </div>

              {/* Realtime Live Room Status */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
                <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  État Instantané des Tables
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {tables.map((tbl) => {
                    const statusColor = {
                      AVAILABLE: 'bg-emerald-100 border-emerald-300 text-emerald-900',
                      OCCUPIED: 'bg-blue-100 border-blue-300 text-blue-900',
                      BILL_REQUESTED: 'bg-amber-300 border-amber-500 text-slate-950 font-black animate-pulse',
                      PAYMENT_PENDING: 'bg-purple-100 border-purple-300 text-purple-900'
                    };
                    return (
                      <div
                        key={tbl.id}
                        className={`p-2 rounded-xl border text-center ${statusColor[tbl.status]}`}
                      >
                        <span className="text-xs font-black block">#{tbl.table_number}</span>
                        <span className="text-[9px] uppercase tracking-wider block opacity-75">{tbl.status.slice(0, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: TABLES & QR MANAGEMENT
           =================================================================== */}
        {activeTab === 'TABLES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-base text-slate-900">Tables & QR Codes</h2>
                <p className="text-xs text-slate-500">Chaque table dispose d'un QR code permanent unique</p>
              </div>
              <button
                onClick={() => setIsAddingTable(true)}
                className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                + Ajouter une Table
              </button>
            </div>

            {/* Add Table Modal */}
            {isAddingTable && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 animate-in fade-in">
                <form onSubmit={handleCreateTable} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Numéro de table :</label>
                    <input
                      type="text"
                      value={newTableNum}
                      onChange={(e) => setNewTableNum(e.target.value)}
                      placeholder="Ex: 11"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-32 focus:outline-hidden focus:border-amber-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Zone :</label>
                    <select
                      value={newTableZone}
                      onChange={(e) => setNewTableZone(e.target.value)}
                      className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-400"
                    >
                      <option value="Terrasse">Terrasse</option>
                      <option value="Salle Lounge">Salle Lounge</option>
                      <option value="Bar VIP">Bar VIP</option>
                      <option value="Mezzanine">Mezzanine</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingTable(false)}
                    className="py-2.5 px-3 text-xs text-slate-500 hover:text-slate-800"
                  >
                    Annuler
                  </button>
                </form>
              </div>
            )}

            {/* Tables Table Grid */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-3.5">Numéro</th>
                    <th className="p-3.5">Zone</th>
                    <th className="p-3.5">Statut Actuel</th>
                    <th className="p-3.5">Session en cours</th>
                    <th className="p-3.5">Serveurs assignés</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tables.map((t) => {
                    const activeSess = dbEngine.getActiveSession(t.id);
                    const assignedServers = servers.filter((s) =>
                      dbEngine.getServerAssignedTableIds(s.id).includes(t.id)
                    );

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-black text-slate-900 text-sm">Table {t.table_number}</td>
                        <td className="p-3.5 text-slate-600">{t.zone}</td>
                        <td className="p-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'BILL_REQUESTED'
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {activeSess ? (
                            <span className="font-mono text-indigo-600 font-bold">
                              {activeSess.session_code} ({activeSess.total_amount.toFixed(3)} {currency})
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {assignedServers.length > 0 ? (
                            assignedServers.map((s) => s.username).join(', ')
                          ) : (
                            <span className="text-amber-600 text-[10px]">Non assignée</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => setSelectedQrTable(t)}
                            className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            QR Code
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: SERVERS & ASSIGNMENTS
           =================================================================== */}
         {activeTab === 'SERVERS' && (
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <div>
                 <h2 className="font-black text-base text-slate-900">Équipe & Affectation des Tables</h2>
                 <p className="text-xs text-slate-500">Affectez plusieurs tables à chaque serveur (Section 7 & 13)</p>
               </div>
               <div className="flex items-center gap-2">
                 <div className="relative">
                   <button
                     onClick={() => setShowAccountMenu(!showAccountMenu)}
                     className="flex items-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition border border-slate-700"
                   >
                     <span>Changer de compte (Démo)</span>
                     <ChevronDown className="w-3.5 h-3.5" />
                   </button>

                   {showAccountMenu && (
                     <>
                       <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                       <div className="absolute right-0 top-10 w-56 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in duration-150">
                         <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
                           Comptes de démonstration
                         </p>
                          {staffProfiles.map((staff) => (
                            <button
                              key={staff.id}
                              onClick={() => {
                                switchUser(staff.id);
                                setShowAccountMenu(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                                currentUser?.id === staff.id
                                  ? 'bg-amber-100 text-amber-900 font-semibold'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <div>
                                <div>{staff.full_name} ({staff.role === 'MANAGER' ? 'Gérant' : 'Serveur'})</div>
                                <div className="text-[10px] text-slate-400">{staff.username}</div>
                              </div>
                              {currentUser?.id === staff.id && (
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                              )}
                            </button>
                          ))}
                       </div>
                     </>
                   )}
                 </div>
                 <button
                   onClick={() => setIsAddingServer(true)}
                   className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                 >
                   + Nouveau Serveur
                 </button>
               </div>
             </div>

            {/* Add Server Form */}
            {isAddingServer && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 animate-in fade-in">
                <form onSubmit={handleCreateServer} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Identifiant (Username) :</label>
                    <input
                      type="text"
                      value={newServerUsername}
                      onChange={(e) => setNewServerUsername(e.target.value)}
                      placeholder="Ex: U875"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full focus:outline-hidden focus:border-amber-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Nom complet :</label>
                    <input
                      type="text"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      placeholder="Ex: Hedi Serveur"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full focus:outline-hidden focus:border-amber-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Email :</label>
                    <input
                      type="email"
                      value={newServerEmail}
                      onChange={(e) => setNewServerEmail(e.target.value)}
                      placeholder="hedi@demolounge.tn"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full focus:outline-hidden focus:border-amber-400"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="py-2.5 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition"
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingServer(false)}
                      className="py-2.5 px-3 text-xs text-slate-500 hover:text-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Servers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.map((srv) => {
                const assigned = dbEngine.getServerAssignedTableIds(srv.id);
                const assignedTableNumbers = tables
                  .filter((t) => assigned.includes(t.id))
                  .map((t) => t.table_number);

                return (
                  <div key={srv.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">{srv.full_name}</span>
                            <span className="bg-slate-900 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-full">
                              {srv.username}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{srv.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          srv.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {srv.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </div>

                      <div className="py-3">
                        <span className="text-xs font-bold text-slate-700 block mb-1.5">
                          Tables affectées ({assignedTableNumbers.length}) :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedTableNumbers.length === 0 ? (
                            <span className="text-xs text-slate-400">Aucune table attribuée</span>
                          ) : (
                            assignedTableNumbers.map((num) => (
                              <span
                                key={num}
                                className="bg-slate-100 text-slate-800 font-extrabold text-xs px-2.5 py-1 rounded-lg border border-slate-200"
                              >
                                Table {num}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                      <button
                        onClick={() => {
                          setAssigningServer(srv.id);
                          setAssignedTablesSelection(assigned);
                        }}
                        className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                      >
                        Modifier les tables
                      </button>
                      <button
                        onClick={() => dbEngine.toggleServerStatus(srv.id, restaurantId)}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                      >
                        {srv.is_active ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Assign Tables */}
            {assigningServer && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
                  <h3 className="font-black text-base mb-1">Affecter les tables</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Cochez les tables attribuées à ce serveur. Il recevra uniquement les alertes de ses tables.
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto mb-4 p-1">
                    {tables.map((t) => {
                      const isChecked = assignedTablesSelection.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setAssignedTablesSelection((prev) =>
                              isChecked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                            isChecked
                              ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>Table {t.table_number}</span>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAssignments}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                    >
                      Enregistrer Affectation
                    </button>
                    <button
                      onClick={() => setAssigningServer(null)}
                      className="py-2.5 px-4 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: MENU & PRODUCTS MANAGEMENT
           =================================================================== */}
        {activeTab === 'MENU' && (
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-base text-slate-900">Carte & Produits</h2>
                <p className="text-xs text-slate-500">
                  Gérez les prix, descriptions et la disponibilité instantanée
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  + Nouvelle Catégorie
                </button>
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  + Nouveau Produit
                </button>
              </div>
            </div>

            {/* Add Category Form */}
            {isAddingCategory && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in">
                <form onSubmit={handleCreateCategory} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nom de la catégorie (ex: Vins & Champagnes)"
                    className="text-xs p-2.5 rounded-xl border border-slate-200 flex-1 focus:outline-hidden focus:border-amber-400"
                    required
                  />
                  <button type="submit" className="py-2.5 px-4 bg-amber-400 text-slate-950 font-bold text-xs rounded-xl">
                    Ajouter
                  </button>
                  <button type="button" onClick={() => setIsAddingCategory(false)} className="text-xs text-slate-500">
                    Annuler
                  </button>
                </form>
              </div>
            )}

            {/* Add Product Form */}
            {isAddingProduct && (
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-md animate-in fade-in">
                <h4 className="font-bold text-sm mb-3">Créer un nouveau produit</h4>
                <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Nom du produit :</label>
                    <input
                      type="text"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="Ex: Gin Tonic Concombre"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Catégorie :</label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full"
                      required
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Prix ({currency}) :</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      placeholder="Ex: 19.500"
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Description :</label>
                    <input
                      type="text"
                      value={newProdDesc}
                      onChange={(e) => setNewProdDesc(e.target.value)}
                      placeholder="Ingrédients, saveurs..."
                      className="text-xs p-2.5 rounded-xl border border-slate-200 w-full"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2 pt-2">
                    <button type="submit" className="py-2.5 px-4 bg-amber-400 font-bold text-xs text-slate-950 rounded-xl">
                      Enregistrer le produit
                    </button>
                    <button type="button" onClick={() => setIsAddingProduct(false)} className="text-xs text-slate-500">
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-3.5">Produit</th>
                    <th className="p-3.5">Catégorie</th>
                    <th className="p-3.5">Prix</th>
                    <th className="p-3.5">Disponibilité</th>
                    <th className="p-3.5 text-right">Action Disponibilité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          <span className="text-[11px] text-slate-500 line-clamp-1">{p.description}</span>
                        </td>
                        <td className="p-3.5 text-slate-600">{cat?.name || '—'}</td>
                        <td className="p-3.5 font-extrabold text-slate-900 text-sm">
                          {p.price.toFixed(3)} {currency}
                        </td>
                        <td className="p-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 font-black'
                          }`}>
                            {p.available ? 'Disponible' : 'Épuisé'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => dbEngine.toggleProductAvailability(p.id)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto ${
                              p.available
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {p.available ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                                Mettre en rupture
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Rendre disponible
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 5: SESSIONS & LIVE ORDERS
           =================================================================== */}
        {activeTab === 'SESSIONS' && (
          <div className="space-y-4">
            <h2 className="font-black text-base text-slate-900">Registre des Sessions de Table</h2>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-3.5">Session</th>
                    <th className="p-3.5">Table</th>
                    <th className="p-3.5">Ouverture</th>
                    <th className="p-3.5">Clôture</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5 text-right">Total Cumulé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => {
                    const tbl = tables.find((t) => t.id === s.table_id);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-mono font-bold text-indigo-600">{s.session_code}</td>
                        <td className="p-3.5 font-bold text-slate-900">Table {tbl?.table_number || '?'}</td>
                        <td className="p-3.5 text-slate-500">{new Date(s.opened_at).toLocaleTimeString()}</td>
                        <td className="p-3.5 text-slate-500">
                          {s.closed_at ? new Date(s.closed_at).toLocaleTimeString() : '—'}
                        </td>
                        <td className="p-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'CLOSED'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                          {s.total_amount.toFixed(3)} {currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 6: PAYMENTS JOURNAL
           =================================================================== */}
        {activeTab === 'PAYMENTS' && (
          <div className="space-y-4">
            <h2 className="font-black text-base text-slate-900">Journal des Paiements & Règlements</h2>

            {payments.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Aucun paiement enregistré pour l'instant.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3.5">Date & Heure</th>
                      <th className="p-3.5">Table</th>
                      <th className="p-3.5">Mode</th>
                      <th className="p-3.5">Montant</th>
                      <th className="p-3.5">Encaissé par</th>
                      <th className="p-3.5 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => {
                      const tbl = tables.find((t) => t.id === p.table_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3.5 text-slate-600">
                            {new Date(p.created_at).toLocaleString()}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">Table {tbl?.table_number || '?'}</td>
                          <td className="p-3.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              p.method === 'CASH' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {p.method}
                            </span>
                          </td>
                          <td className="p-3.5 font-black text-sm text-slate-900">
                            {p.amount.toFixed(3)} {currency}
                          </td>
                          <td className="p-3.5 text-slate-600">{p.notes || 'Staff'}</td>
                          <td className="p-3.5 text-right">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 7: AUDIT LOGS
           =================================================================== */}
        {activeTab === 'AUDIT' && (
          <div className="space-y-4">
            <h2 className="font-black text-base text-slate-900">Journal d'Audit Sécurisé (Section 24)</h2>
            <p className="text-xs text-slate-500">Traçabilité complète des actions personnel et client</p>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/50">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{log.action}</span>
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-600">
                          {log.entity_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Par: <strong>{log.user_name || 'Système'}</strong> • Détails :{' '}
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 8: AUTOMATED TESTS & DIAGNOSTICS (SECTION 31)
           =================================================================== */}
        {activeTab === 'TESTS' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-lg">Banc de Test Automatisé des 15 Scénarios Critiques</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Exécute et valide les 15 flux métier critiques décrits dans la Section 31 du cahier des charges : session unique, commandes multiples, transmission caisse, RLS, double paiement bloqué, libération table, et produit indisponible.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="py-3 px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg transition shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                {isRunningTests ? 'Exécution des tests...' : 'Exécuter tous les tests'}
              </button>
            </div>

            {testResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <span className="text-xs text-slate-500">Total Scénarios</span>
                    <p className="text-2xl font-black text-slate-900">{testResults.total}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <span className="text-xs text-emerald-700 font-bold">Succès (100%)</span>
                    <p className="text-2xl font-black text-emerald-800">{testResults.passed}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-200">
                    <span className="text-xs text-red-700 font-bold">Échecs</span>
                    <p className="text-2xl font-black text-red-800">{testResults.failed}</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-2xs">
                  {testResults.results.map((r) => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50">
                      <div className="flex items-start gap-3">
                        {r.passed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900">{r.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                              {r.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{r.details}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                        {r.durationMs} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      {selectedQrTable && currentRestaurant && (
        <QRCodeModal
          table={selectedQrTable}
          restaurant={currentRestaurant}
          onClose={() => setSelectedQrTable(null)}
          onOpenClientView={(restId, tblId) => {
            setSelectedQrTable(null);
            if (onOpenTableClient) onOpenTableClient(restId, tblId);
          }}
        />
      )}
    </div>
  );
};
