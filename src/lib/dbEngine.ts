/**
 * Database Engine - BarLounge SaaS
 * Provides relational persistence, atomic business operations, 
 * strict constraint enforcement, audit logging, and realtime dispatching.
 */

import {
  Restaurant,
  Profile,
  RestaurantUser,
  TableItem,
  TableSession,
  Category,
  Product,
  Order,
  OrderItem,
  Payment,
  ServiceRequest,
  AppNotification,
  AuditLog,
  ServerTableAssignment,
  OrderStatus,
  PaymentMethod,
  ServiceRequestType
} from '../types/database';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SEED_STATE } from './seedData';

const SYNC_CHANNEL_NAME = 'barlounge_sync_channel';

// Realtime event emitter
export type RealtimeEventType = 
  | 'ORDER_CREATED' 
  | 'ORDER_UPDATED' 
  | 'SESSION_UPDATED' 
  | 'BILL_REQUESTED' 
  | 'PAYMENT_PROCESSED' 
  | 'SERVICE_REQUESTED' 
  | 'NOTIFICATION_CREATED'
  | 'TABLE_STATUS_CHANGED'
  | 'MENU_UPDATED';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: any;
  timestamp: string;
}

type RealtimeListener = (event: RealtimeEventPayload) => void;
const listeners: Set<RealtimeListener> = new Set();

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  broadcastChannel.onmessage = (msgEvent) => {
    if (msgEvent.data && msgEvent.data.type) {
      listeners.forEach((listener) => {
        try {
          listener(msgEvent.data);
        } catch (e) {
          console.error('Error in listener', e);
        }
      });
    }
  };
}

export function subscribeToRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastEvent(type: RealtimeEventType, data: any) {
  const payload: RealtimeEventPayload = {
    type,
    data,
    timestamp: new Date().toISOString()
  };
  
  // Local notification
  listeners.forEach((l) => {
    try {
      l(payload);
    } catch (e) {
      console.error(e);
    }
  });

  // Cross-tab broadcast
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.error(e);
    }
  }
}

export interface DbState {
  restaurants: Restaurant[];
  profiles: Profile[];
  restaurantUsers: RestaurantUser[];
  tables: TableItem[];
  tableSessions: TableSession[];
  serverAssignments: ServerTableAssignment[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
  serviceRequests: ServiceRequest[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  counters: {
    orderSeq: number;
    sessionSeq: number;
  };
}

export const EMPTY_STATE: DbState = SEED_STATE;

class DatabaseEngine {
  private state: DbState;
  private currentRestaurantId: string | null = null;
  private realtimeChannels: any[] = [];

  constructor() {
    this.state = this.loadState();
    this.setupSupabaseRealtime();
    this.tryHydrateFromSupabase();
  }

  private loadState(): DbState {
    return JSON.parse(JSON.stringify(EMPTY_STATE));
  }

  private saveState(state: DbState) {
    this.syncToSupabase(state);
  }

  public async syncToSupabase(state: DbState = this.state): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    const syncTable = async (table: string, data: any[]): Promise<void> => {
      if (data.length === 0) return;
      try {
        await supabase!.from(table).upsert(data, { onConflict: 'id' });
      } catch (e) {
        console.warn(`[Supabase] Sync failed for table "${table}", in-memory state remains source of truth`, e);
      }
    };

    await Promise.all([
      syncTable('restaurants', state.restaurants),
      syncTable('restaurant_users', state.restaurantUsers),
      syncTable('tables', state.tables),
      syncTable('table_sessions', state.tableSessions),
      syncTable('server_table_assignments', state.serverAssignments),
      syncTable('categories', state.categories),
      syncTable('products', state.products),
      syncTable('orders', state.orders),
      syncTable('order_items', state.orderItems),
      syncTable('payments', state.payments),
      syncTable('service_requests', state.serviceRequests),
      syncTable('notifications', state.notifications),
      syncTable('audit_logs', state.auditLogs),
    ]);
  }

  private async tryHydrateFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase || typeof window === 'undefined') return;

    // Get restaurant ID from in-memory cache or seed state
    let restId = this.currentRestaurantId;
    if (!restId) {
      restId = this.state.restaurants[0]?.id;
    }

    try {
      // Load public data (accessible to anon via RLS policies)
      const { data: cats, error: cErr } = await supabase.from('categories').select('*');
      const { data: prods, error: prErr } = await supabase.from('products').select('*');

      // Load restaurant (may require auth — fall back to restaurant_users for ID)
      let restaurantsData: Restaurant[] = [];
      if (restId) {
        const { data: rests, error: rErr } = await supabase.from('restaurants').select('*').eq('id', restId);
        if (!rErr && rests) {
          restaurantsData = rests as Restaurant[];
        } else {
          console.warn('[Supabase] Cannot read restaurants table (missing GRANT). Using fallback.');
        }
      }

      // Load protected data (requires auth session)
      let tablesData: TableItem[] = [];
      let sessionsData: TableSession[] = [];
      let ordersData: Order[] = [];
      let orderItemsData: OrderItem[] = [];
      let paymentsData: Payment[] = [];
      let serviceReqsData: ServiceRequest[] = [];
      let notifsData: AppNotification[] = [];
      let profilesData: Profile[] = [];
      let restUsersData: any[] = [];
      let serverAssignsData: ServerTableAssignment[] = [];

      const getSettledData = <T,>(result: PromiseSettledResult<any>): T => {
        if (result.status === 'fulfilled') {
          return result.value?.data || [] as T;
        }
        return [] as T;
      };

      if (restId) {
        const results = await Promise.allSettled([
          supabase.from('tables').select('*').eq('restaurant_id', restId),
          supabase.from('table_sessions').select('*').eq('restaurant_id', restId),
          supabase.from('orders').select('*').eq('restaurant_id', restId),
          supabase.from('order_items').select('*'),
          supabase.from('payments').select('*').eq('restaurant_id', restId),
          supabase.from('service_requests').select('*').eq('restaurant_id', restId),
          supabase.from('notifications').select('*').eq('restaurant_id', restId),
          supabase.from('profiles').select('*'),
          supabase.from('restaurant_users').select('*').eq('restaurant_id', restId),
          supabase.from('server_table_assignments').select('*').eq('restaurant_id', restId),
        ]);

        tablesData = getSettledData<TableItem[]>(results[0]);
        sessionsData = getSettledData<TableSession[]>(results[1]);
        ordersData = getSettledData<Order[]>(results[2]);
        orderItemsData = getSettledData<OrderItem[]>(results[3]);
        paymentsData = getSettledData<Payment[]>(results[4]);
        serviceReqsData = getSettledData<ServiceRequest[]>(results[5]);
        notifsData = getSettledData<AppNotification[]>(results[6]);
        profilesData = getSettledData<Profile[]>(results[7]);
        restUsersData = getSettledData<any[]>(results[8]);
        serverAssignsData = getSettledData<ServerTableAssignment[]>(results[9]);
      }

      // Merge with existing state, replacing what we successfully loaded
      this.state = {
        restaurants: restaurantsData.length > 0 ? restaurantsData : this.state.restaurants,
        profiles: profilesData.length > 0 ? (profilesData as Profile[]) : this.state.profiles,
        restaurantUsers: restUsersData as any[],
        tables: tablesData as TableItem[],
        tableSessions: sessionsData as TableSession[],
        serverAssignments: serverAssignsData as ServerTableAssignment[],
        categories: cats as Category[],
        products: prods as Product[],
        orders: ordersData as Order[],
        orderItems: orderItemsData as OrderItem[],
        payments: paymentsData as Payment[],
        serviceRequests: serviceReqsData as ServiceRequest[],
        notifications: notifsData as AppNotification[],
        auditLogs: this.state.auditLogs,
        counters: this.state.counters,
      };

       console.log('[Supabase] State hydrated from database — Supabase is primary source');
      broadcastEvent('SESSION_UPDATED', { source: 'supabase_hydration' });
      broadcastEvent('TABLE_STATUS_CHANGED', {});
      broadcastEvent('MENU_UPDATED', {});
    } catch (e) {
      console.warn('[Supabase] Hydration failed, using in-memory seed state', e);
    }
  }

  private setupSupabaseRealtime(): void {
    if (!isSupabaseConfigured || !supabase) return;

    const tableMap: Record<string, RealtimeEventType> = {
      table_sessions: 'SESSION_UPDATED',
      orders: 'ORDER_UPDATED',
      order_items: 'ORDER_UPDATED',
      payments: 'PAYMENT_PROCESSED',
      service_requests: 'SERVICE_REQUESTED',
      notifications: 'NOTIFICATION_CREATED',
      tables: 'TABLE_STATUS_CHANGED',
    };

    Object.entries(tableMap).forEach(([tbl, eventType]) => {
      const channel = supabase!.channel(`public:${tbl}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tbl }, async (payload) => {
          await this.refreshStateFromSupabase();
          broadcastEvent(eventType, payload.new || payload);
        })
        .subscribe();
      this.realtimeChannels.push(channel);
    });
  }

  private async refreshStateFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    let restId = this.currentRestaurantId;
    if (!restId) {
      restId = this.state.restaurants[0]?.id;
    }
    if (!restId) return;
    try {
      const results = await Promise.allSettled([
        supabase.from('tables').select('*').eq('restaurant_id', restId),
        supabase.from('table_sessions').select('*').eq('restaurant_id', restId),
        supabase.from('orders').select('*').eq('restaurant_id', restId),
        supabase.from('order_items').select('*'),
        supabase.from('payments').select('*').eq('restaurant_id', restId),
        supabase.from('service_requests').select('*').eq('restaurant_id', restId),
        supabase.from('notifications').select('*').eq('restaurant_id', restId),
        supabase.from('categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('restaurant_users').select('*').eq('restaurant_id', restId),
        supabase.from('server_table_assignments').select('*').eq('restaurant_id', restId),
      ]);

      const getSettledData = <T,>(result: PromiseSettledResult<any>): T => {
        if (result.status === 'fulfilled') {
          return result.value?.data || [] as T;
        }
        return [] as T;
      };

      const tablesResult = getSettledData<TableItem[]>(results[0]);
      const sessionsResult = getSettledData<TableSession[]>(results[1]);
      const ordersResult = getSettledData<Order[]>(results[2]);
      const orderItemsResult = getSettledData<OrderItem[]>(results[3]);
      const paymentsResult = getSettledData<Payment[]>(results[4]);
      const serviceReqsResult = getSettledData<ServiceRequest[]>(results[5]);
      const notifsResult = getSettledData<AppNotification[]>(results[6]);
      const catsResult = getSettledData<Category[]>(results[7]);
      const prodsResult = getSettledData<Product[]>(results[8]);
      const profilesResult = getSettledData<Profile[]>(results[9]);
      const restUsersResult = getSettledData<any[]>(results[10]);
      const serverAssignsResult = getSettledData<ServerTableAssignment[]>(results[11]);

      if (tablesResult.length) this.state.tables = tablesResult;
      if (sessionsResult.length) this.state.tableSessions = sessionsResult;
      if (ordersResult.length) this.state.orders = ordersResult;
      if (orderItemsResult.length) this.state.orderItems = orderItemsResult;
      if (paymentsResult.length) this.state.payments = paymentsResult;
      if (serviceReqsResult.length) this.state.serviceRequests = serviceReqsResult;
      if (notifsResult.length) this.state.notifications = notifsResult;
      if (catsResult.length) this.state.categories = catsResult;
      if (prodsResult.length) this.state.products = prodsResult;
      if (profilesResult.length) this.state.profiles = profilesResult;
      if (restUsersResult.length) this.state.restaurantUsers = restUsersResult;
      if (serverAssignsResult.length) this.state.serverAssignments = serverAssignsResult;

      if (typeof window !== 'undefined') {
        this.syncToSupabase();
      }
    } catch (e) {
      console.warn('[Supabase] Realtime refresh failed', e);
    }
  }

  public destroy(): void {
    this.realtimeChannels.forEach((ch) => supabase?.removeChannel(ch));
    this.realtimeChannels = [];
  }

  public resetToSeed(): DbState {
    this.state = JSON.parse(JSON.stringify(EMPTY_STATE));
    this.currentRestaurantId = null;
    this.saveState(this.state);
    broadcastEvent('MENU_UPDATED', {});
    broadcastEvent('TABLE_STATUS_CHANGED', {});
    setTimeout(() => this.tryHydrateFromSupabase(), 500);
    return this.state;
  }

  public getState(): DbState {
    return this.state;
  }

  private persist() {
    this.saveState(this.state);
  }

  private logAudit(
    restaurantId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>,
    userId?: string,
    userName?: string
  ) {
    const entry: AuditLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      user_id: userId || null,
      user_name: userName || (userId ? 'Staff' : 'Client QR'),
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString()
    };
    this.state.auditLogs.unshift(entry);
  }

  // --------------------------------------------------------------------------
  // RESTAURANTS & PROFILES
  // --------------------------------------------------------------------------
  public getRestaurant(restaurantId: string): Restaurant | undefined {
    return this.getState().restaurants.find((r) => r.id === restaurantId);
  }

  public getAllRestaurants(): Restaurant[] {
    return this.getState().restaurants;
  }

  public getRestaurantId(): string | null {
    if (this.currentRestaurantId) return this.currentRestaurantId;
    const state = this.getState();
    if (state.restaurants[0]?.id) return state.restaurants[0].id;
    if (state.restaurantUsers[0]?.restaurant_id) return state.restaurantUsers[0].restaurant_id;
    return null;
  }

  public setRestaurant(restaurantId: string): void {
    this.currentRestaurantId = restaurantId;
    void this.tryHydrateFromSupabase();
  }

  public getProfileByUsername(username: string): Profile | undefined {
    return this.getState().profiles.find(
      (p) => (p.username || '').toUpperCase() === username.trim().toUpperCase() && p.is_active
    );
  }

  public getProfileByEmail(email: string): Profile | undefined {
    return this.getState().profiles.find(
      (p) => (p.email || '').toLowerCase() === email.trim().toLowerCase() && p.is_active
    );
  }

  public getProfileById(id: string): Profile | undefined {
    return this.getState().profiles.find((p) => p.id === id);
  }

  public getStaffProfiles(restaurantId: string): Profile[] {
    const userIds = this.getState().restaurantUsers
      .filter((ru) => ru.restaurant_id === restaurantId)
      .map((ru) => ru.user_id);
    return this.getState().profiles.filter((p) => userIds.includes(p.id));
  }

  public createServerProfile(restaurantId: string, username: string, fullName: string, email: string): Profile {
    this.getState();
    const existing = this.state.profiles.find(
      (p) =>
        (p.username || '').toUpperCase() === username.trim().toUpperCase() ||
        (p.email || '').toLowerCase() === email.trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`Un serveur avec cet identifiant ou cet email existe déjà (${username})`);
    }

    const newProfile: Profile = {
      id: 'srv-' + Math.random().toString(36).substring(2, 9),
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      username: username.trim().toUpperCase(),
      role: 'SERVER',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.profiles.push(newProfile);
    this.state.restaurantUsers.push({
      id: 'ru-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      user_id: newProfile.id,
      role: 'SERVER',
      created_at: new Date().toISOString()
    });

    this.logAudit(restaurantId, 'CREATE_SERVER', 'PROFILE', newProfile.id, { username, fullName });
    this.persist();
    return newProfile;
  }

  public toggleServerStatus(serverId: string, restaurantId: string): Profile {
    this.getState();
    const p = this.state.profiles.find((prof) => prof.id === serverId);
    if (!p) throw new Error('Serveur introuvable');
    const isMember = this.state.restaurantUsers.some(
      (ru) => ru.user_id === serverId && ru.restaurant_id === restaurantId
    );
    if (!isMember) throw new Error('Ce profil n\'appartient pas à cet établissement');
    p.is_active = !p.is_active;
    p.updated_at = new Date().toISOString();
    this.logAudit(restaurantId, 'TOGGLE_SERVER_STATUS', 'PROFILE', serverId, { active: p.is_active });
    this.persist();
    return p;
  }

  public updateProfile(profileId: string, updates: Partial<Profile>): Profile {
    this.getState();
    const p = this.state.profiles.find((prof) => prof.id === profileId);
    if (!p) throw new Error('Profil introuvable');
    const { id, ...rest } = updates as Partial<Profile>;
    Object.assign(p, rest, { updated_at: new Date().toISOString() });
    const restUser = this.state.restaurantUsers.find((ru) => ru.user_id === profileId);
    this.logAudit(restUser?.restaurant_id || '', 'UPDATE_PROFILE', 'PROFILE', profileId, updates);
    this.persist();
    return p;
  }

  // --------------------------------------------------------------------------
  // TABLES & ASSIGNMENTS
  // --------------------------------------------------------------------------
  public getTables(restaurantId: string): TableItem[] {
    return this.getState().tables.filter((t) => t.restaurant_id === restaurantId && t.is_active);
  }

  public getTableById(tableId: string): TableItem | undefined {
    return this.getState().tables.find((t) => t.id === tableId);
  }

  public getTableByNumber(restaurantId: string, tableNumber: string): TableItem | undefined {
    return this.getState().tables.find(
      (t) => t.restaurant_id === restaurantId && t.table_number.toLowerCase() === tableNumber.trim().toLowerCase()
    );
  }

  public createTable(restaurantId: string, tableNumber: string, zone: string): TableItem {
    this.getState();
    const existing = this.state.tables.find(
      (t) => t.restaurant_id === restaurantId && t.table_number === tableNumber.trim()
    );
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        existing.zone = zone;
        existing.updated_at = new Date().toISOString();
        this.persist();
        broadcastEvent('TABLE_STATUS_CHANGED', existing);
        return existing;
      }
      throw new Error(`La table numéro ${tableNumber} existe déjà.`);
    }

    const newTable: TableItem = {
      id: 'tbl-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      table_number: tableNumber.trim(),
      zone: zone.trim() || 'Salle Principale',
      status: 'AVAILABLE',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.tables.push(newTable);
    this.logAudit(restaurantId, 'CREATE_TABLE', 'TABLE', newTable.id, { tableNumber, zone });
    this.persist();
    broadcastEvent('TABLE_STATUS_CHANGED', newTable);
    return newTable;
  }

  public updateTable(tableId: string, updates: Partial<TableItem>): TableItem {
    this.getState();
    const t = this.state.tables.find((tbl) => tbl.id === tableId);
    if (!t) throw new Error('Table introuvable');
    const safe: Partial<TableItem> = { ...updates };
    delete safe.id;
    delete safe.restaurant_id;
    Object.assign(t, safe, { updated_at: new Date().toISOString() });
    this.logAudit(t.restaurant_id, 'UPDATE_TABLE', 'TABLE', tableId, updates);
    this.persist();
    broadcastEvent('TABLE_STATUS_CHANGED', t);
    return t;
  }

  public deleteTable(tableId: string): void {
    this.getState();
    const idx = this.state.tables.findIndex((t) => t.id === tableId);
    if (idx === -1) throw new Error('Table introuvable');
    const t = this.state.tables[idx];
    const hasActiveSession = this.state.tableSessions.some(
      (s) => s.table_id === tableId && ['OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'].includes(s.status)
    );
    if (hasActiveSession) throw new Error('Impossible de supprimer une table avec une session active');
    this.state.tables.splice(idx, 1);
    this.logAudit(t.restaurant_id, 'DELETE_TABLE', 'TABLE', tableId, {});
    this.persist();
    broadcastEvent('TABLE_STATUS_CHANGED', t);
  }

  public getServerAssignedTableIds(serverId: string): string[] {
    return this.getState().serverAssignments
      .filter((a) => a.server_id === serverId)
      .map((a) => a.table_id);
  }

  public setServerTableAssignments(restaurantId: string, serverId: string, tableIds: string[]) {
    this.getState();
    // Remove existing assignments for this server
    this.state.serverAssignments = this.state.serverAssignments.filter(
      (a) => a.server_id !== serverId
    );
    // Add new assignments
    tableIds.forEach((tableId) => {
      this.state.serverAssignments.push({
        id: 'sa-' + Math.random().toString(36).substring(2, 9),
        restaurant_id: restaurantId,
        server_id: serverId,
        table_id: tableId,
        assigned_at: new Date().toISOString()
      });
    });

    this.logAudit(restaurantId, 'ASSIGN_TABLES', 'SERVER_ASSIGNMENT', serverId, { tableCount: tableIds.length, tableIds });
    this.persist();
    broadcastEvent('TABLE_STATUS_CHANGED', {});
  }

  // --------------------------------------------------------------------------
  // TABLE SESSIONS
  // --------------------------------------------------------------------------
  public getActiveSession(tableId: string): TableSession | undefined {
    return this.getState().tableSessions.find(
      (s) => s.table_id === tableId && ['OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'].includes(s.status)
    );
  }

  public getSessionById(sessionId: string): TableSession | undefined {
    return this.getState().tableSessions.find((s) => s.id === sessionId);
  }

  public getAllSessions(restaurantId: string): TableSession[] {
    return this.getState().tableSessions
      .filter((s) => s.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  }

  public getOrCreateActiveSession(restaurantId: string, tableId: string): TableSession {
    this.getState();
    const table = this.state.tables.find((t) => t.id === tableId && t.restaurant_id === restaurantId);
    if (!table) {
      throw new Error("Table inexistante ou n'appartenant pas à cet établissement");
    }

    // Check if an open/active session already exists
    const existing = this.getActiveSession(tableId);
    if (existing) {
      return existing;
    }

    // Open a new session
    this.state.counters.sessionSeq += 1;
    const sessionCode = `SES-2026-${String(this.state.counters.sessionSeq).padStart(6, '0')}`;

    const newSession: TableSession = {
      id: 'ses-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      table_id: tableId,
      session_code: sessionCode,
      status: 'OPEN',
      opened_at: new Date().toISOString(),
      closed_at: null,
      total_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.tableSessions.push(newSession);

    // CRITICAL: Table MUST become OCCUPIED immediately
    table.status = 'OCCUPIED';
    table.updated_at = new Date().toISOString();

    this.logAudit(restaurantId, 'OPEN_SESSION', 'TABLE_SESSION', newSession.id, {
      sessionCode,
      tableNumber: table.table_number
    });

    this.persist();
    broadcastEvent('SESSION_UPDATED', newSession);
    broadcastEvent('TABLE_STATUS_CHANGED', table);
    return newSession;
  }

  // --------------------------------------------------------------------------
  // ORDERS & POS TRANSMISSION
  // --------------------------------------------------------------------------
  public getOrdersBySession(sessionId: string): Order[] {
    const orders = this.getState().orders.filter((o) => o.session_id === sessionId);
    const items = this.getState().orderItems;
    return orders.map((o) => ({
      ...o,
      items: items.filter((it) => it.order_id === o.id)
    }));
  }

  public getAllOrders(restaurantId: string): Order[] {
    const state = this.getState();
    const orders = state.orders.filter((o) => o.restaurant_id === restaurantId);
    const items = state.orderItems;
    const tablesMap = new Map(state.tables.map((t) => [t.id, t.table_number]));

    return orders
      .map((o) => ({
        ...o,
        items: items.filter((it) => it.order_id === o.id),
        table_number: tablesMap.get(o.table_id) || '?'
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getOrderById(orderId: string): Order | undefined {
    const state = this.getState();
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    const items = state.orderItems.filter((it) => it.order_id === order.id);
    const table = state.tables.find((t) => t.id === order.table_id);
    return {
      ...order,
      items,
      table_number: table ? table.table_number : order.table_number
    };
  }

  public cancelOrder(orderId: string, actorId?: string, actorName?: string): Order {
    return this.updateOrderStatus(orderId, 'CANCELLED', actorId, actorName);
  }

  public createOrder(
    restaurantId: string,
    sessionId: string,
    tableId: string,
    itemsToOrder: { productId: string; quantity: number; notes?: string }[],
    customerNotes?: string
  ): Order {
    this.getState();
    const session = this.state.tableSessions.find((s) => s.id === sessionId);
    if (!session || !['OPEN', 'ADDITION_REQUESTED'].includes(session.status)) {
      throw new Error('Impossible de commander sur une session fermée ou inexistante.');
    }
    if (session.restaurant_id !== restaurantId) {
      throw new Error('Cette session n\'appartient pas à cet établissement');
    }

    const table = this.state.tables.find((t) => t.id === tableId);
    if (!table) throw new Error('Table invalide');
    if (table.restaurant_id !== restaurantId) {
      throw new Error('Cette table n\'appartient pas à cet établissement');
    }

    if (itemsToOrder.length === 0) {
      throw new Error('Le panier est vide.');
    }

    // Verify product availability and calculate subtotal
    let subtotal = 0;
    const orderItemsToCreate: OrderItem[] = [];
    const orderId = 'ord-' + Math.random().toString(36).substring(2, 9);

    for (const item of itemsToOrder) {
      const prod = this.state.products.find((p) => p.id === item.productId);
      if (!prod) {
        throw new Error(`Produit introuvable (ID: ${item.productId})`);
      }
      if (!prod.available) {
        throw new Error(`Le produit "${prod.name}" est actuellement indisponible.`);
      }
      if (item.quantity <= 0) {
        throw new Error('Quantité invalide.');
      }

      const itemTotal = Number((prod.price * item.quantity).toFixed(3));
      subtotal += itemTotal;

      orderItemsToCreate.push({
        id: 'oit-' + Math.random().toString(36).substring(2, 9),
        order_id: orderId,
        product_id: prod.id,
        product_name: prod.name,
        unit_price: prod.price,
        quantity: item.quantity,
        total_price: itemTotal,
        notes: item.notes
      });
    }

    this.state.counters.orderSeq += 1;
    const orderNumber = String(this.state.counters.orderSeq).padStart(3, '0');

    const newOrder: Order = {
      id: orderId,
      restaurant_id: restaurantId,
      session_id: sessionId,
      table_id: tableId,
      order_number: orderNumber,
      status: 'NEW',
      subtotal: Number(subtotal.toFixed(3)),
      total: Number(subtotal.toFixed(3)),
      notes: customerNotes,
      pos_status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      table_number: table.table_number
    };

    this.state.orders.push(newOrder);
    this.state.orderItems.push(...orderItemsToCreate);

    // Recalculate session total
    this.recalculateSessionTotal(sessionId);

    // Create immediate Realtime Notification for server
    const notif: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      table_id: tableId,
      title: 'Nouvelle commande',
      message: `Nouvelle commande #${orderNumber} — Table ${table.table_number} (${orderItemsToCreate.length} articles, ${newOrder.total.toFixed(3)} TND)`,
      type: 'ORDER_NEW',
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.state.notifications.unshift(notif);

    this.logAudit(restaurantId, 'CREATE_ORDER', 'ORDER', orderId, {
      orderNumber,
      tableNumber: table.table_number,
      total: newOrder.total,
      itemCount: orderItemsToCreate.length
    });

    this.persist();

    const fullOrder = { ...newOrder, items: orderItemsToCreate };
    broadcastEvent('ORDER_CREATED', fullOrder);
    broadcastEvent('NOTIFICATION_CREATED', notif);
    broadcastEvent('SESSION_UPDATED', session);

    return fullOrder;
  }

  public transmitOrderToPos(orderId: string, serverId: string, serverName: string): Order {
    this.getState();
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Commande introuvable');

    order.status = 'TRANSMITTED_TO_POS';
    order.pos_transmitted_at = new Date().toISOString();
    order.pos_transmitted_by = serverId;
    order.pos_status = 'TRANSMITTED';
    order.updated_at = new Date().toISOString();

    this.logAudit(order.restaurant_id, 'TRANSMIT_TO_POS', 'ORDER', orderId, {
      orderNumber: order.order_number,
      serverId,
      serverName,
      timestamp: order.pos_transmitted_at
    }, serverId, serverName);

    this.persist();
    broadcastEvent('ORDER_UPDATED', order);
    return order;
  }

  public updateOrderStatus(orderId: string, status: OrderStatus, actorId?: string, actorName?: string): Order {
    this.getState();
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Commande introuvable');

    order.status = status;
    order.updated_at = new Date().toISOString();

    if (status === 'CANCELLED') {
      this.recalculateSessionTotal(order.session_id);
    }

    this.logAudit(order.restaurant_id, 'UPDATE_ORDER_STATUS', 'ORDER', orderId, {
      orderNumber: order.order_number,
      status
    }, actorId, actorName);

    this.persist();
    broadcastEvent('ORDER_UPDATED', order);
    return order;
  }

  private recalculateSessionTotal(sessionId: string) {
    const session = this.state.tableSessions.find((s) => s.id === sessionId);
    if (!session) return;

    const sessionOrders = this.state.orders.filter(
      (o) => o.session_id === sessionId && o.status !== 'CANCELLED'
    );
    const sum = sessionOrders.reduce((acc, curr) => acc + curr.total, 0);
    session.total_amount = Number(sum.toFixed(3));
    session.updated_at = new Date().toISOString();
  }

  // --------------------------------------------------------------------------
  // SERVICE REQUESTS & BILL
  // --------------------------------------------------------------------------
  public getServiceRequests(restaurantId: string): ServiceRequest[] {
    return this.getState().serviceRequests
      .filter((r) => r.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getServiceRequestsByTable(tableId: string): ServiceRequest[] {
    return this.getState().serviceRequests
      .filter((r) => r.table_id === tableId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getServiceRequestById(requestId: string): ServiceRequest | undefined {
    return this.getState().serviceRequests.find((r) => r.id === requestId);
  }

  public requestBill(sessionId: string): TableSession {
    this.getState();
    const session = this.state.tableSessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'CLOSED' || session.status === 'PAID') {
      throw new Error('Cette session est déjà clôturée');
    }

    session.status = 'ADDITION_REQUESTED';
    session.updated_at = new Date().toISOString();

    const table = this.state.tables.find((t) => t.id === session.table_id);
    if (table) {
      table.status = 'BILL_REQUESTED';
      table.updated_at = new Date().toISOString();
    }

    const notif: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: session.restaurant_id,
      table_id: session.table_id,
      title: 'Addition demandée',
      message: `Table ${table ? table.table_number : '?'} — Addition demandée (${session.total_amount.toFixed(3)} TND)`,
      type: 'BILL_REQUESTED',
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.state.notifications.unshift(notif);

    this.logAudit(session.restaurant_id, 'REQUEST_BILL', 'TABLE_SESSION', sessionId, {
      total: session.total_amount,
      tableNumber: table?.table_number
    });

    this.persist();
    broadcastEvent('SESSION_UPDATED', session);
    broadcastEvent('TABLE_STATUS_CHANGED', table);
    broadcastEvent('NOTIFICATION_CREATED', notif);
    return session;
  }

  public createServiceRequest(tableId: string, restaurantId: string, type: ServiceRequestType, sessionId?: string): ServiceRequest {
    this.getState();
    const table = this.state.tables.find((t) => t.id === tableId);
    if (!table) throw new Error('Table introuvable');
    if (table.restaurant_id !== restaurantId) {
      throw new Error('Cette table n\'appartient pas à cet établissement');
    }
    const req: ServiceRequest = {
      id: 'sr-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      table_id: tableId,
      session_id: sessionId || null,
      type,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      table_number: table.table_number
    };

    this.state.serviceRequests.unshift(req);

    const titleMap: Record<ServiceRequestType, string> = {
      CALL_SERVER: 'Client demande un serveur',
      BILL_REQUEST: "Demande d'addition",
      WATER_REQUEST: "Demande d'eau / verre",
      ICE_REQUEST: 'Demande de glaçons supplémentaires',
      ASHTRAY_REQUEST: 'Demande de cendrier',
      OTHER: 'Appel table'
    };

    const notif: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      table_id: tableId,
      title: titleMap[type] || 'Appel Table',
      message: `${titleMap[type]} — Table ${table?.table_number || '?'}`,
      type: 'CALL_SERVER',
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.state.notifications.unshift(notif);

    this.logAudit(restaurantId, 'SERVICE_REQUEST', 'SERVICE_REQUEST', req.id, { type, tableNumber: table?.table_number });
    this.persist();

    broadcastEvent('SERVICE_REQUESTED', req);
    broadcastEvent('NOTIFICATION_CREATED', notif);
    return req;
  }

  public resolveServiceRequest(requestId: string, resolvedBy: string, resolvedByName?: string): ServiceRequest {
    this.getState();
    const req = this.state.serviceRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Demande introuvable');

    req.status = 'RESOLVED';
    req.resolved_by = resolvedBy;
    req.resolved_at = new Date().toISOString();

    this.logAudit(req.restaurant_id, 'RESOLVE_SERVICE_REQUEST', 'SERVICE_REQUEST', requestId, {}, resolvedBy, resolvedByName);
    this.persist();
    broadcastEvent('SERVICE_REQUESTED', req);
    return req;
  }

  // --------------------------------------------------------------------------
  // PAYMENTS & SESSION CLOSING
  // --------------------------------------------------------------------------
  public confirmPayment(
    sessionId: string,
    method: PaymentMethod,
    confirmedBy: string,
    confirmedByName: string,
    notes?: string
  ): Payment {
    this.getState();
    const session = this.state.tableSessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session introuvable');

    if (session.status === 'PAID' || session.status === 'CLOSED') {
      throw new Error('Cette session est déjà payée et fermée. Double paiement rejeté.');
    }

    const table = this.state.tables.find((t) => t.id === session.table_id);
    if (!table) throw new Error('Table introuvable');

    const paymentAmount = session.total_amount;

    const payment: Payment = {
      id: 'pay-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: session.restaurant_id,
      session_id: sessionId,
      table_id: session.table_id,
      amount: paymentAmount,
      method,
      status: 'CONFIRMED',
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      notes,
      created_at: new Date().toISOString()
    };

    this.state.payments.unshift(payment);

    // State transition: PAID -> CLOSED
    session.status = 'CLOSED';
    session.closed_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();

    // Table status transition: table becomes AVAILABLE!
    table.status = 'AVAILABLE';
    table.updated_at = new Date().toISOString();

    const notif: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: session.restaurant_id,
      table_id: table.id,
      title: 'Paiement confirmé & Table libérée',
      message: `Table ${table.table_number} — Règlement ${paymentAmount.toFixed(3)} TND (${method}) validé par ${confirmedByName}. Table disponible.`,
      type: 'PAYMENT_RECEIVED',
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.state.notifications.unshift(notif);

    this.logAudit(
      session.restaurant_id,
      'PAYMENT_CONFIRMED',
      'PAYMENT',
      payment.id,
      {
        sessionCode: session.session_code,
        tableNumber: table.table_number,
        amount: paymentAmount,
        method,
        confirmedBy: confirmedByName
      },
      confirmedBy,
      confirmedByName
    );

    this.persist();
    broadcastEvent('PAYMENT_PROCESSED', payment);
    broadcastEvent('SESSION_UPDATED', session);
    broadcastEvent('TABLE_STATUS_CHANGED', table);
    broadcastEvent('NOTIFICATION_CREATED', notif);
    return payment;
  }

  // --------------------------------------------------------------------------
  // MENU MANAGEMENT
  // --------------------------------------------------------------------------
  public getCategories(restaurantId: string): Category[] {
    return this.getState().categories
      .filter((c) => c.restaurant_id === restaurantId && c.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  }

  public getCategoryById(categoryId: string): Category | undefined {
    return this.getState().categories.find((c) => c.id === categoryId);
  }

  public getProducts(restaurantId: string): Product[] {
    return this.getState().products
      .filter((p) => p.restaurant_id === restaurantId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  public getAvailableProducts(restaurantId: string): Product[] {
    return this.getState().products
      .filter((p) => p.restaurant_id === restaurantId && p.available)
      .sort((a, b) => a.display_order - b.display_order);
  }

  public createCategory(restaurantId: string, name: string, icon?: string): Category {
    this.getState();
    const newCat: Category = {
      id: 'cat-' + Math.random().toString(36).substring(2, 9),
      restaurant_id: restaurantId,
      name: name.trim(),
      icon: icon || 'Utensils',
      display_order: this.state.categories.length + 1,
      is_active: true,
      created_at: new Date().toISOString()
    };
    this.state.categories.push(newCat);
    this.logAudit(restaurantId, 'CREATE_CATEGORY', 'CATEGORY', newCat.id, { name });
    this.persist();
    broadcastEvent('MENU_UPDATED', newCat);
    return newCat;
  }

  public updateCategory(categoryId: string, updates: Partial<Category>): Category {
    this.getState();
    const c = this.state.categories.find((cat) => cat.id === categoryId);
    if (!c) throw new Error('Catégorie introuvable');
    const safe: Partial<Category> = { ...updates };
    delete safe.id;
    delete safe.restaurant_id;
    Object.assign(c, safe);
    this.logAudit(c.restaurant_id, 'UPDATE_CATEGORY', 'CATEGORY', categoryId, updates);
    this.persist();
    broadcastEvent('MENU_UPDATED', c);
    return c;
  }

  public deleteCategory(categoryId: string): void {
    this.getState();
    const idx = this.state.categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) throw new Error('Catégorie introuvable');
    const hasProducts = this.state.products.some((p) => p.category_id === categoryId);
    if (hasProducts) throw new Error('Impossible de supprimer une catégorie contenant des produits');
    const c = this.state.categories[idx];
    this.state.categories.splice(idx, 1);
    this.logAudit(c.restaurant_id, 'DELETE_CATEGORY', 'CATEGORY', categoryId, {});
    this.persist();
    broadcastEvent('MENU_UPDATED', c);
  }

  public createProduct(restaurantId: string, productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'restaurant_id'>): Product {
    this.getState();
    const newProduct: Product = {
      ...productData,
      restaurant_id: restaurantId,
      id: 'p-' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.products.push(newProduct);
    this.logAudit(restaurantId, 'CREATE_PRODUCT', 'PRODUCT', newProduct.id, { name: newProduct.name, price: newProduct.price });
    this.persist();
    broadcastEvent('MENU_UPDATED', newProduct);
    return newProduct;
  }

  public getProductById(productId: string): Product | undefined {
    return this.getState().products.find((p) => p.id === productId);
  }

  public updateProduct(productId: string, updates: Partial<Product>): Product {
    this.getState();
    const p = this.state.products.find((prod) => prod.id === productId);
    if (!p) throw new Error('Produit introuvable');
    const safe: Partial<Product> = { ...updates };
    delete safe.id;
    delete safe.restaurant_id;
    Object.assign(p, safe, { updated_at: new Date().toISOString() });
    this.logAudit(p.restaurant_id, 'UPDATE_PRODUCT', 'PRODUCT', productId, updates);
    this.persist();
    broadcastEvent('MENU_UPDATED', p);
    return p;
  }

  public toggleProductAvailability(productId: string): Product {
    this.getState();
    const p = this.state.products.find((prod) => prod.id === productId);
    if (!p) throw new Error('Produit introuvable');
    p.available = !p.available;
    p.updated_at = new Date().toISOString();
    this.logAudit(p.restaurant_id, 'TOGGLE_PRODUCT_AVAILABILITY', 'PRODUCT', productId, { available: p.available });
    this.persist();
    broadcastEvent('MENU_UPDATED', p);
    return p;
  }

  public deleteProduct(productId: string): void {
    this.getState();
    const idx = this.state.products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error('Produit introuvable');
    const activeOrder = this.state.orderItems.some((it) => it.product_id === productId);
    if (activeOrder) throw new Error('Impossible de supprimer un produit référencé par des commandes');
    const p = this.state.products[idx];
    this.state.products.splice(idx, 1);
    this.logAudit(p.restaurant_id, 'DELETE_PRODUCT', 'PRODUCT', productId, { name: p.name });
    this.persist();
    broadcastEvent('MENU_UPDATED', p);
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS & AUDIT
  // --------------------------------------------------------------------------
  public getNotifications(restaurantId: string, targetUserId?: string): AppNotification[] {
    const state = this.getState();
    return state.notifications
      .filter((n) => n.restaurant_id === restaurantId && (!n.target_user_id || n.target_user_id === targetUserId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getNotificationById(notifId: string): AppNotification | undefined {
    return this.getState().notifications.find((n) => n.id === notifId);
  }

  public markNotificationAsRead(notifId: string): AppNotification | undefined {
    this.getState();
    const n = this.state.notifications.find((notif) => notif.id === notifId);
    if (n) {
      n.is_read = true;
      this.persist();
      return n;
    }
    return undefined;
  }

  public markAllNotificationsAsRead(restaurantId: string) {
    this.getState();
    this.state.notifications.forEach((n) => {
      if (n.restaurant_id === restaurantId) n.is_read = true;
    });
    this.persist();
  }

  public getAuditLogs(restaurantId: string): AuditLog[] {
    return this.getState().auditLogs
      .filter((l) => l.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getPayments(restaurantId: string): Payment[] {
    return this.getState().payments
      .filter((p) => p.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getPaymentById(paymentId: string): Payment | undefined {
    return this.getState().payments.find((p) => p.id === paymentId);
  }

  public getPaymentBySession(sessionId: string): Payment | undefined {
    return this.getState().payments.find((p) => p.session_id === sessionId);
  }

  public getPaymentByTable(tableId: string): Payment | undefined {
    const sessions = this.getState().tableSessions.filter((s) => s.table_id === tableId);
    const sessionIds = sessions.map((s) => s.id);
    return this.getState().payments.find((p) => sessionIds.includes(p.session_id));
  }
}

export const dbEngine = new DatabaseEngine();
