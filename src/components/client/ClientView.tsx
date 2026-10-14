import React, { useState, useEffect, useMemo } from 'react';
import { dbEngine } from '../../lib/dbEngine';
import { useRealtime } from '../../context/RealtimeContext';
import {
  TableItem,
  Restaurant,
  TableSession,
  Category,
  Product,
  Order,
  CartItem,
  ServiceRequestType
} from '../../types/database';
import {
  ShoppingBag,
  Bell,
  Receipt,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  Trash2,
  Wine,
  Beer,
  Coffee,
  UtensilsCrossed,
  Flame,
  Cake,
  AlertCircle,
  X,
  ChevronRight,
  Sparkles,
  Search,
  Wifi,
  Copy,
  Check,
  Zap,
  Info,
  Droplets,
  Cigarette,
  GlassWater,
  ChevronDown
} from 'lucide-react';

interface ClientViewProps {
  restaurantId: string;
  tableId: string;
  onSwitchTable?: (newTableId: string) => void;
}

export const ClientView: React.FC<ClientViewProps> = ({
  restaurantId,
  tableId,
  onSwitchTable
}) => {
  const { lastEventTimestamp } = useRealtime();

  // Core entities
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<TableItem | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);

  // Navigation & interaction
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessBanner, setOrderSuccessBanner] = useState<string | null>(null);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');

  // Selected product detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalItemNotes, setModalItemNotes] = useState('');
  const [modalItemQty, setModalItemQty] = useState(1);

  // Track product image load errors so we can fall back to placeholder
  const [erroredImages, setErroredImages] = useState<Set<string>>(() => new Set());

  // WiFi Modal & copy
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  // Bill Request Modal
  const [showBillModal, setShowBillModal] = useState(false);

  // Service Request Modal
  const [showServiceMenu, setShowServiceMenu] = useState(false);

  // Table selector toggle (for easy demo testing in one browser)
  const [showTablePicker, setShowTablePicker] = useState(false);
  const allTables = useMemo(() => dbEngine.getTables(restaurantId), [restaurantId, lastEventTimestamp]);

  // Load and sync data
  const loadData = () => {
    const r = dbEngine.getRestaurant(restaurantId);
    const t = dbEngine.getTableById(tableId);
    setRestaurant(r || null);
    setTable(t || null);

    if (r && t) {
      // Get or create active session
      const sess = dbEngine.getOrCreateActiveSession(r.id, t.id);
      setSession(sess);

      // Load menu
      setCategories(dbEngine.getCategories(r.id));
      setProducts(dbEngine.getProducts(r.id));

      // Load session orders
      setSessionOrders(dbEngine.getOrdersBySession(sess.id));
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, tableId, lastEventTimestamp]);

  // Category Icon resolver
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Wine':
        return <Wine className="w-4 h-4" />;
      case 'Beer':
        return <Beer className="w-4 h-4" />;
      case 'Coffee':
        return <Coffee className="w-4 h-4" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Cake':
        return <Cake className="w-4 h-4" />;
      case 'Zap':
        return <Zap className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <UtensilsCrossed className="w-4 h-4" />;
    }
  };

  // Cart actions
  const addToCart = (product: Product, quantity = 1, notes?: string) => {
    if (!product.available) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity, notes: notes || item.notes }
            : item
        );
      }
      return [...prev, { product, quantity, notes }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Place order
  const handlePlaceOrder = async () => {
    if (!restaurant || !table || !session || cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    try {
      const items = cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        notes: c.notes
      }));

      const newOrder = dbEngine.createOrder(
        restaurant.id,
        session.id,
        table.id,
        items,
        orderNotes
      );

      setCart([]);
      setOrderNotes('');
      setIsCartOpen(false);
      setOrderSuccessBanner(`Commande #${newOrder.order_number} transmise au serveur !`);
      setTimeout(() => setOrderSuccessBanner(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la commande');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Service Request
  const handleCallService = (type: ServiceRequestType) => {
    if (!table || !restaurant) return;
    dbEngine.createServiceRequest(table.id, restaurant.id, type, session?.id);
    
    let msg = 'Serveur prévenu, il arrive à votre table !';
    if (type === 'WATER_REQUEST') msg = "Demande d'eau enregistrée !";
    if (type === 'ICE_REQUEST') msg = 'Glaçons supplémentaires demandés !';
    if (type === 'ASHTRAY_REQUEST') msg = 'Cendrier demandé pour votre table !';

    setServiceMessage(msg);
    setShowServiceMenu(false);
    setTimeout(() => setServiceMessage(null), 4000);
  };

  // Request Bill
  const handleConfirmRequestBill = () => {
    if (!session) return;
    if (session.total_amount <= 0 && sessionOrders.length === 0) {
      alert("Vous n'avez pas encore passé de commande sur cette table.");
      return;
    }

    dbEngine.requestBill(session.id);
    setShowBillModal(false);
    setServiceMessage("Addition demandée ! Le serveur arrive avec la facture et le terminal de paiement.");
    setTimeout(() => setServiceMessage(null), 5000);
    loadData();
  };

  // Copy Wifi password
  const handleCopyWifi = () => {
    if (restaurant?.wifi_password) {
      navigator.clipboard.writeText(restaurant.wifi_password);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2500);
    }
  };

  // Filtered products with search and category
  const filteredProducts = useMemo(() => {
    let list = products;

    if (activeCategory !== 'all') {
      list = list.filter((p) => p.category_id === activeCategory);
    }

    if (onlyAvailable) {
      list = list.filter((p) => p.available);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, activeCategory, searchQuery, onlyAvailable]);

  if (!restaurant || !table) {
    return (
      <div className="max-w-md mx-auto p-6 text-center mt-12">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Table introuvable</h2>
        <p className="text-xs text-slate-500 mt-1">
          Le QR Code scanné ne correspond à aucun établissement actif.
        </p>
      </div>
    );
  }

  // If session is closed, display completion screen
  const isSessionClosed = session?.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* =====================================================================
          TOP HEADER: RESTAURANT BRANDING, TABLE NUMBER, & SESSION STATUS
         ===================================================================== */}
      <header className="bg-gradient-to-b from-slate-900 to-slate-950 px-4 pt-4 pb-5 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-md mx-auto">
          {/* Top Brand row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 shadow-md shadow-amber-500/20">
                <Beer className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold tracking-tight text-base text-amber-300">
                    {restaurant.name}
                  </h1>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                    Lounge & Bar
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{restaurant.tagline || 'Lounge, Tapas & Mixologie'}</p>
              </div>
            </div>

            {/* Quick Utility Buttons (WiFi & Table Picker) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowWifiModal(true)}
                title="WiFi Client"
                aria-label="Informations WiFi"
                className="w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-amber-300 flex items-center justify-center border border-slate-700 transition"
              >
                <Wifi className="w-4 h-4" />
              </button>

              {onSwitchTable && (
                <div className="relative">
                  <button
                    onClick={() => setShowTablePicker(!showTablePicker)}
                    aria-label="Changer de table"
                    aria-expanded={showTablePicker}
                    className="text-xs bg-slate-800/90 hover:bg-slate-700 text-amber-400 font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 transition"
                  >
                    <span>Table {table.table_number}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {showTablePicker && (
                    <div className="absolute right-0 top-10 w-48 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl p-2 z-50 border border-slate-700 animate-in fade-in zoom-in-95">
                      <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">Changer de table :</p>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {allTables.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setShowTablePicker(false);
                              onSwitchTable(t.id);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs rounded-xl flex items-center justify-between transition ${
                              t.id === table.id
                                ? 'bg-amber-400 font-bold text-slate-950'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <span>Table {t.table_number}</span>
                            <span className="text-[10px] opacity-75">{t.zone}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Session Info & Total Bar */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 shadow-md flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-400">
                  Table {table.table_number}
                </span>
                <span className="text-[11px] text-slate-400">({table.zone})</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  session?.status === 'OPEN'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : session?.status === 'ADDITION_REQUESTED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {session?.status === 'OPEN'
                    ? 'Session Ouverte'
                    : session?.status === 'ADDITION_REQUESTED'
                    ? 'Addition demandée'
                    : session?.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {sessionOrders.length} commande{sessionOrders.length > 1 ? 's' : ''} • Ref: {session?.session_code || '---'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Session</span>
              <p className="text-base font-black text-amber-400 leading-tight">
                {(session?.total_amount || 0).toFixed(3)} {restaurant.currency}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          NOTIFICATIONS & ALERTS
         ===================================================================== */}
      <div className="max-w-md mx-auto px-4 mt-3 space-y-2">
        {orderSuccessBanner && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{orderSuccessBanner}</span>
          </div>
        )}

        {serviceMessage && (
          <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-lg animate-in fade-in">
            <Bell className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <span>{serviceMessage}</span>
          </div>
        )}

        {session?.status === 'ADDITION_REQUESTED' && (
          <div className="bg-amber-950/90 border border-amber-500/50 text-amber-200 p-3.5 rounded-2xl flex items-center gap-3 text-xs shadow-lg animate-in fade-in">
            <Receipt className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="font-extrabold text-amber-300">Addition en cours de traitement</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Le serveur se déplace vers votre table pour le règlement (Espèces ou Carte/TPE).
              </p>
            </div>
          </div>
        )}

        {isSessionClosed && (
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 text-white p-6 rounded-3xl text-center shadow-2xl my-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-amber-300">Paiement confirmé & Session Clôturée</h3>
            <p className="text-xs text-slate-300 mt-2 mb-4 leading-relaxed">
              Toute l'équipe du <strong>{restaurant.name}</strong> vous remercie de votre visite ! Votre table est prête pour un nouveau service.
            </p>
            <button
              onClick={() => {
                dbEngine.getOrCreateActiveSession(restaurant.id, table.id);
                loadData();
              }}
              className="bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs py-3 px-5 rounded-xl shadow-lg transition"
            >
              Démarrer une nouvelle session
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          QUICK SERVICE ACTIONS BAR (SERVEUR, EAU, HISTORIQUE, ADDITION)
         ===================================================================== */}
      <div className="max-w-md mx-auto px-4 mt-3">
        <div className="grid grid-cols-4 gap-2">
          {/* Service button */}
           <button
            onClick={() => setShowServiceMenu(!showServiceMenu)}
            aria-expanded={showServiceMenu}
            className="flex flex-col items-center justify-center py-3 px-2 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 text-slate-200 text-[11px] font-bold shadow-sm transition active:scale-95 touch-target"
          >
            <Bell className="w-5 h-5 text-amber-400 mb-1" />
            <span>Serveur</span>
          </button>

          {/* Quick Water request */}
          <button
            onClick={() => handleCallService('WATER_REQUEST')}
            aria-label="Demander de l'eau"
            className="flex flex-col items-center justify-center py-3 px-2 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 text-slate-200 text-[11px] font-bold shadow-sm transition active:scale-95 touch-target"
          >
            <GlassWater className="w-5 h-5 text-sky-400 mb-1" />
            <span>Verre / Eau</span>
          </button>

          {/* Orders History */}
          <button
            onClick={() => setIsOrdersOpen(true)}
            aria-label="Historique des commandes"
            className="flex flex-col items-center justify-center py-3 px-2 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 text-slate-200 text-[11px] font-bold shadow-sm transition active:scale-95 relative touch-target"
          >
            <Clock className="w-5 h-5 text-indigo-400 mb-1" />
            <span>Historique</span>
            {sessionOrders.length > 0 && (
              <span className="absolute top-1.5 right-2 bg-indigo-500 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                {sessionOrders.length}
              </span>
            )}
          </button>

          {/* Bill button */}
          <button
            onClick={() => setShowBillModal(true)}
            disabled={session?.status === 'ADDITION_REQUESTED'}
            aria-label="Demander l'addition"
            className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl border text-[11px] font-bold shadow-sm transition active:scale-95 touch-target ${
              session?.status === 'ADDITION_REQUESTED'
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5 text-amber-400 mb-1" />
            <span>Addition</span>
          </button>
        </div>

        {/* Dropdown service options */}
        {showServiceMenu && (
          <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Demande rapide en salle :
            </p>
            <button
              onClick={() => handleCallService('CALL_SERVER')}
              className="w-full flex items-center gap-2 p-3 rounded-xl text-xs font-semibold hover:bg-slate-800 text-left transition"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Appeler le serveur à table</span>
            </button>
            <button
              onClick={() => handleCallService('ICE_REQUEST')}
              className="w-full flex items-center gap-2 p-3 rounded-xl text-xs font-semibold hover:bg-slate-800 text-left transition"
            >
              <Droplets className="w-4 h-4 text-sky-400" />
              <span>Glaçons supplémentaires</span>
            </button>
            <button
              onClick={() => handleCallService('ASHTRAY_REQUEST')}
              className="w-full flex items-center gap-2 p-3 rounded-xl text-xs font-semibold hover:bg-slate-800 text-left transition"
            >
              <Cigarette className="w-4 h-4 text-rose-400" />
              <span>Demander un cendrier</span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          SEARCH & FILTER BAR
         ===================================================================== */}
      <div className="max-w-md mx-auto px-4 mt-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher mojito, crevettes, ojja, celtia..."
            className="w-full bg-slate-900 text-slate-100 pl-10 pr-9 py-2.5 rounded-2xl border border-slate-800 text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          CATEGORIES HORIZONTAL SCROLL
         ===================================================================== */}
      <div className="max-w-md mx-auto px-4 mt-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              activeCategory === 'all'
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tout ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {getCategoryIcon(cat.icon)}
                {cat.name}
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          PRODUCTS LIST / GRID
         ===================================================================== */}
      <div className="max-w-md mx-auto px-4 mt-3 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-400" />
            <p className="text-sm font-bold text-slate-300">Aucun produit trouvé</p>
            <p className="text-xs text-slate-500 mt-1">Essayez un autre mot-clé ou changez de catégorie.</p>
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const inCartItem = cart.find((c) => c.product.id === prod.id);

            return (
              <div
                key={prod.id}
                className={`bg-slate-900 rounded-2xl p-3 border transition flex gap-3 shadow-md ${
                  prod.available
                    ? 'border-slate-800 hover:border-amber-400/50'
                    : 'border-slate-800/60 opacity-60 bg-slate-900/50'
                }`}
              >
                {/* Product Image */}
                <div
                  onClick={() => prod.available && setSelectedProduct(prod)}
                  className="w-24 h-24 rounded-xl bg-slate-950 overflow-hidden shrink-0 relative cursor-pointer group"
                >
                 {prod.image_url && !erroredImages.has(prod.id) ? (
                     <img
                       src={prod.image_url}
                       alt={prod.name}
                       className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                       loading="lazy"
                       onError={() => setErroredImages((prev) => {
                         const next = new Set(prev);
                         next.add(prod.id);
                         return next;
                       })}
                       />
                   ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <UtensilsCrossed className="w-6 h-6" />
                    </div>
                  )}

                  {!prod.available && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center p-1">
                      <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Épuisé
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div
                    onClick={() => prod.available && setSelectedProduct(prod)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-extrabold text-sm text-slate-100 leading-tight">
                        {prod.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                      {prod.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                    <span className="font-black text-sm text-amber-400">
                      {prod.price.toFixed(3)} <span className="text-[10px] font-semibold text-slate-400">{restaurant.currency}</span>
                    </span>

                    {prod.available ? (
                      inCartItem ? (
                       <div className="flex items-center gap-1.5 bg-slate-800 text-white rounded-xl px-1.5 py-1 border border-slate-700 min-w-[92px]">
                         <button
                           onClick={() => updateCartQty(prod.id, -1)}
                           className="p-2 rounded-lg hover:text-amber-400 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                         >
                           <Minus className="w-4 h-4" />
                         </button>
                         <span className="text-xs font-black w-5 text-center">{inCartItem.quantity}</span>
                         <button
                           onClick={() => updateCartQty(prod.id, 1)}
                           className="p-2 rounded-lg hover:text-amber-400 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                       </div>
                      ) : (
                        <button
                          onClick={() => addToCart(prod, 1)}
                          className="bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Ajouter
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Non disponible
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          FLOATING BOTTOM DOCK: CART & BILL SUMMARY
         ===================================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent safe-bottom">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {/* Bill Button */}
          <button
            onClick={() => setShowBillModal(true)}
            disabled={session?.status === 'ADDITION_REQUESTED'}
            className={`flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition shadow-lg ${
              session?.status === 'ADDITION_REQUESTED'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>Addition</span>
          </button>

          {/* Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className={`flex-1 flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-extrabold transition shadow-xl ${
              cartCount > 0
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 hover:from-amber-500 hover:to-amber-600 active:scale-98'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Panier ({cartCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{cartTotal.toFixed(3)} {restaurant.currency}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: PRODUCT DETAIL & QUICK NOTES
         ===================================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="relative h-48 bg-slate-950">
               {selectedProduct.image_url && !erroredImages.has(selectedProduct.id) ? (
                 <img
                   src={selectedProduct.image_url}
                   alt={selectedProduct.name}
                   className="w-full h-full object-cover"
                   onError={() => setErroredImages((prev) => {
                     const next = new Set(prev);
                     next.add(selectedProduct.id);
                     return next;
                   })}
                 />
               ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <UtensilsCrossed className="w-10 h-10" />
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setModalItemNotes('');
                  setModalItemQty(1);
                }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/80 text-white flex items-center justify-center hover:bg-slate-950"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-extrabold text-base text-white">
                  {selectedProduct.name}
                </h3>
                <span className="font-black text-base text-amber-400 shrink-0">
                  {selectedProduct.price.toFixed(3)} {restaurant.currency}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {selectedProduct.description}
              </p>

              {/* Special instructions note */}
              <div className="mt-4">
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Instructions particulières (bar ou cuisine) :
                </label>
                <input
                  type="text"
                  value={modalItemNotes}
                  onChange={(e) => setModalItemNotes(e.target.value)}
                  placeholder="Ex: sans glaçons, piment à part, bien cuit..."
                  className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Quantity and Add Button */}
              <div className="flex items-center gap-3 mt-5">
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 min-w-[100px]">
                  <button
                    onClick={() => setModalItemQty((q) => Math.max(1, q - 1))}
                    className="p-2 rounded-lg text-slate-400 hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black w-5 text-center">{modalItemQty}</span>
                  <button
                    onClick={() => setModalItemQty((q) => q + 1)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    addToCart(selectedProduct, modalItemQty, modalItemNotes);
                    setSelectedProduct(null);
                    setModalItemNotes('');
                    setModalItemQty(1);
                  }}
                  className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter au panier ({(selectedProduct.price * modalItemQty).toFixed(3)} {restaurant.currency})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CART DRAWER & ORDER CONFIRMATION
         ===================================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-t-3xl max-w-md w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border-t border-slate-800">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base text-white">Votre commande — Table {table.table_number}</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                aria-label="Fermer le panier"
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-800/80 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Votre panier est vide. Choisissez des tapas ou boissons pour commander.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="pt-2 pb-3 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-extrabold text-xs text-slate-100">{item.product.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.product.price.toFixed(3)} × {item.quantity} ={' '}
                        <span className="font-bold text-amber-400">
                          {(item.product.price * item.quantity).toFixed(3)} {restaurant.currency}
                        </span>
                      </p>
                      {item.notes && (
                        <p className="text-[10px] text-amber-300 italic mt-0.5">Note: {item.notes}</p>
                      )}
                    </div>

                     <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 min-w-[92px]">
                       <button
                         onClick={() => updateCartQty(item.product.id, -1)}
                         className="p-2 rounded-lg text-slate-400 hover:text-white min-w-[32px] min-h-[32px] flex items-center justify-center"
                       >
                         <Minus className="w-4 h-4" />
                       </button>
                       <span className="text-xs font-black w-4 text-center text-slate-100">{item.quantity}</span>
                       <button
                         onClick={() => updateCartQty(item.product.id, 1)}
                         className="p-2 rounded-lg text-slate-400 hover:text-white min-w-[32px] min-h-[32px] flex items-center justify-center"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                     </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      aria-label={`Supprimer ${item.product.name} du panier`}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              {/* Order Notes */}
              {cart.length > 0 && (
                <div className="pt-3">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Remarques générales pour cette commande :
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ex: servir les boissons d'abord..."
                    className="w-full bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 bg-slate-950 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3 text-sm font-bold">
                  <span className="text-slate-300">Total commande :</span>
                  <span className="text-base text-amber-400 font-black">
                    {cartTotal.toFixed(3)} {restaurant.currency}
                  </span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder}
                  className="w-full bg-amber-400 hover:bg-amber-500 active:scale-98 text-slate-950 font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition shadow-xl"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  {isSubmittingOrder ? 'Transmission en cours...' : `Confirmer et Envoyer (${cartTotal.toFixed(3)} ${restaurant.currency})`}
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  La commande sera immédiatement reçue par le serveur en salle.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: SESSION ORDERS HISTORY DRAWER (MULTI-ORDER TIMELINE)
         ===================================================================== */}
      {isOrdersOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-t-3xl max-w-md w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border-t border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white">
              <div>
                <h3 className="font-extrabold text-base text-amber-300">Historique de la Session</h3>
                <p className="text-[11px] text-slate-400">
                  {session?.session_code} • Table {table.table_number} ({table.zone})
                </p>
              </div>
              <button
                onClick={() => setIsOrdersOpen(false)}
                aria-label="Fermer l'historique"
                className="p-2 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {sessionOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Aucune commande passée dans cette session pour l'instant.
                </div>
              ) : (
                sessionOrders.map((ord) => {
                  const statusColors: Record<string, string> = {
                    NEW: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
                    ACCEPTED: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40',
                    TRANSMITTED_TO_POS: 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
                    PREPARING: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
                    READY: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
                    SERVED: 'bg-slate-700 text-slate-300',
                    CANCELLED: 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  };

                  const statusLabels: Record<string, string> = {
                    NEW: 'Reçue (En attente serveur)',
                    ACCEPTED: 'Acceptée',
                    TRANSMITTED_TO_POS: 'Transmise à la caisse',
                    PREPARING: 'En préparation (Cuisine/Bar)',
                    READY: 'Prête à servir',
                    SERVED: 'Servie à table',
                    CANCELLED: 'Annulée'
                  };

                  return (
                    <div key={ord.id} className="border border-slate-800 rounded-2xl p-3.5 bg-slate-950/60">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-100">
                            Commande #{ord.order_number}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[ord.status] || 'bg-slate-800'}`}>
                          {statusLabels[ord.status] || ord.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        {ord.items?.map((it) => (
                          <div key={it.id} className="flex justify-between text-xs">
                            <span className="text-slate-300">
                              <span className="text-amber-400 font-bold mr-1">{it.quantity}×</span>
                              {it.product_name}
                            </span>
                            <span className="font-semibold text-slate-200">
                              {it.total_price.toFixed(3)} {restaurant.currency}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-bold">
                        <span className="text-slate-400">Sous-total commande :</span>
                        <span className="text-amber-400">{ord.total.toFixed(3)} {restaurant.currency}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Total Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Cumulé Session</span>
                <p className="text-lg font-black text-amber-400">
                  {(session?.total_amount || 0).toFixed(3)} {restaurant.currency}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOrdersOpen(false);
                  setShowBillModal(true);
                }}
                disabled={session?.status === 'ADDITION_REQUESTED'}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition"
              >
                {session?.status === 'ADDITION_REQUESTED' ? 'Addition demandée' : "Demander l'addition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: BILL REQUEST CONFIRMATION
         ===================================================================== */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>

            <h3 className="font-black text-lg text-center text-white">Demande de l'Addition</h3>
            <p className="text-xs text-slate-400 text-center mt-1">
              Table {table.table_number} • {table.zone}
            </p>

            <div className="bg-slate-950 rounded-2xl p-4 my-4 border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Nombre de commandes passées :</span>
                <span className="font-bold text-white">{sessionOrders.length}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Statut session :</span>
                <span className="font-bold text-amber-400">{session?.status}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-200">Montant total dû :</span>
                <span className="text-lg font-black text-amber-400">
                  {(session?.total_amount || 0).toFixed(3)} {restaurant.currency}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mb-5 leading-relaxed">
              Le serveur viendra à votre table procéder à l'encaissement via la caisse physique (Espèces ou Terminal TPE).
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowBillModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmRequestBill}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black shadow-lg transition"
              >
                Confirmer l'addition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: WIFI GUEST DETAILS
         ===================================================================== */}
      {showWifiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-3">
              <Wifi className="w-6 h-6" />
            </div>

            <h3 className="font-black text-lg text-center text-white">Wi-Fi {restaurant.name}</h3>
            <p className="text-xs text-slate-400 text-center mt-1">Connexion gratuite pour nos clients</p>

            <div className="bg-slate-950 rounded-2xl p-4 my-4 border border-slate-800 space-y-3">
              {restaurant.wifi_ssid && restaurant.wifi_password ? (
                <>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Réseau (SSID)</span>
                    <p className="text-sm font-mono font-bold text-slate-200 mt-0.5">{restaurant.wifi_ssid}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Mot de passe</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm font-mono font-bold text-amber-400">{restaurant.wifi_password}</p>
                      <button
                        onClick={handleCopyWifi}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                      >
                        {copiedWifi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedWifi ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-300 text-center">Les informations Wi-Fi ne sont pas configurées.</p>
              )}
            </div>

            <button
              onClick={() => setShowWifiModal(false)}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
