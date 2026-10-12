/**
 * Types de base de données & entités métier BarLounge SaaS
 */

export type UserRole = 'MANAGER' | 'SERVER';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'PAYMENT_PENDING';

export type SessionStatus = 'OPEN' | 'ADDITION_REQUESTED' | 'PAYMENT_PENDING' | 'PAID' | 'CLOSED' | 'CANCELLED';

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'TRANSMITTED_TO_POS' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'TPE';

export type ServiceRequestType = 'CALL_SERVER' | 'BILL_REQUEST' | 'WATER_REQUEST' | 'OTHER';

export type ServiceRequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  logo_url?: string;
  address: string;
  phone: string;
  currency: string;
  tax_rate: number;
  wifi_ssid?: string;
  wifi_password?: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantUser {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface TableItem {
  id: string;
  restaurant_id: string;
  table_number: string;
  zone: string;
  status: TableStatus;
  is_active: boolean;
  qr_code_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  session_code: string;
  status: SessionStatus;
  opened_at: string;
  closed_at?: string | null;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerTableAssignment {
  id: string;
  restaurant_id: string;
  server_id: string;
  table_id: string;
  assigned_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  notes?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  session_id: string;
  table_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  notes?: string;
  pos_transmitted_at?: string | null;
  pos_transmitted_by?: string | null;
  pos_status: 'PENDING' | 'TRANSMITTED' | 'NOT_APPLICABLE';
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  table_number?: string;
}

export interface Payment {
  id: string;
  restaurant_id: string;
  session_id: string;
  table_id: string;
  amount: number;
  method: PaymentMethod;
  status: 'CONFIRMED';
  confirmed_by: string;
  confirmed_at: string;
  notes?: string;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  restaurant_id: string;
  table_id: string;
  session_id?: string | null;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  table_number?: string;
}

export interface AppNotification {
  id: string;
  restaurant_id: string;
  target_user_id?: string | null;
  table_id?: string;
  title: string;
  message: string;
  type: 'ORDER_NEW' | 'BILL_REQUESTED' | 'CALL_SERVER' | 'PAYMENT_RECEIVED' | 'INFO';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  user_id?: string | null;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}
