export type UserRole = 'OWNER' | 'EMPLOYEE' | 'TAILOR';
export type ShopType = 'retail' | 'wholesale';
export type AssignedShop = 'retail' | 'wholesale' | 'all';

export interface UserPermissions {
  user_id?: string;
  can_billing: number;
  can_credit: number;
  can_inventory: number;
  can_stock_transfer: number;
  can_tailors: number;
  can_salary: number;
  can_expenses: number;
  can_suppliers: number;
  can_reports: number;
  can_profit_view: number;
  can_settings: number;
  can_users: number;
}

export interface User {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  assigned_shop: AssignedShop;
  is_active: number;
  tailor_id?: string | null;
  tailor_code?: string | null;
  tailor_profile?: Tailor | null;
  permissions: UserPermissions;
}

export interface Shop {
  id: string;
  name: string;
  code: string;
  type: ShopType;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  brand?: string;
  size?: string;
  color?: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  selling_price: number;
  min_stock: number;
  hsn?: string;
  gst_rate: number;
  is_active: number;
  current_stock?: number;
  retail_stock?: number;
  wholesale_stock?: number;
  total_stock?: number;
}

export interface BillItem {
  id?: string;
  bill_id?: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  available_stock?: number;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit' | 'partial';
export type BillType = 'normal' | 'gst';
export type BillStatus = 'paid' | 'pending' | 'partial' | 'overdue' | 'cancelled';

export interface Bill {
  id: string;
  bill_number: string;
  bill_type: BillType;
  shop_id: string;
  shop_name?: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  discount: number;
  tax_amount: number;
  grand_total: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  pending_amount: number;
  due_date?: string | null;
  status: BillStatus;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  items?: BillItem[];
  days_overdue?: number;
}

export interface Payment {
  id: string;
  payment_number: string;
  bill_id: string;
  customer_id?: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
  received_by?: string;
}

export interface Tailor {
  id: string;
  tailor_code: string;
  name: string;
  phone?: string;
  joining_date?: string;
  assigned_shop: string;
  salary_type: 'per_piece' | 'monthly' | 'daily' | 'hybrid';
  monthly_rate: number;
  daily_rate: number;
  shirt_rate: number;
  pant_rate: number;
  blouse_rate: number;
  other_rate: number;
  account_status: 'active' | 'inactive';
  linked_user_id?: string | null;
  notes?: string;
  total_pieces?: number;
  earned_amount?: number;
  pending_salary?: number;
  attendance_status?: string;
}

export interface TailorProduction {
  id: string;
  tailor_id: string;
  tailor_name?: string;
  tailor_code?: string;
  date: string;
  shop_id: string;
  shirts_qty: number;
  pants_qty: number;
  blouses_qty: number;
  others_qty: number;
  total_pieces: number;
  earned_amount: number;
  notes?: string;
  created_at: string;
}

export interface TailorWorkOrder {
  id: string;
  order_number: string;
  tailor_id: string;
  tailor_name?: string;
  tailor_code?: string;
  shop_id: string;
  item_type: string;
  given_qty: number;
  stitched_qty: number;
  balance_qty: number;
  rate_per_piece: number;
  earned_amount?: number;
  due_date?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  assigned_by?: string;
  assigned_by_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface TailorAttendance {
  id: string;
  tailor_id: string;
  date: string;
  shop_id: string;
  status: 'present' | 'absent' | 'leave' | 'half_day';
  notes?: string;
}

export interface TailorSalary {
  id: string;
  tailor_id: string;
  tailor_name?: string;
  tailor_code?: string;
  period_start: string;
  period_end: string;
  salary_type: string;
  total_pieces: number;
  earned_amount: number;
  advance_deductions: number;
  net_salary: number;
  paid_amount: number;
  pending_amount: number;
  status: 'pending' | 'partial' | 'paid';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  customer_type: 'retail' | 'wholesale';
  shop_id: string;
  total_bills?: number;
  total_spent?: number;
  pending_credit?: number;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  shop_id: string;
  description?: string;
  payment_method: string;
  receipt_ref?: string;
  creator_name?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  products_supplied?: string;
  payable_balance: number;
  notes?: string;
}

export interface Notification {
  id: string;
  type: 'payment_due' | 'payment_overdue' | 'low_stock' | 'pending_salary' | 'stock_transfer' | 'system';
  title: string;
  message: string;
  related_id?: string;
  related_type?: string;
  shop_id?: string;
  is_read: number;
  target_role: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name: string;
  action: string;
  module: string;
  record_id?: string;
  shop_id?: string;
  details?: string;
  created_at: string;
}

export interface DressType {
  id: string;
  name: string;
  default_rate: number;
  category: string;
  is_active: number;
  created_at?: string;
}

export interface StitchingReturn {
  id: string;
  return_number: string;
  assignment_id: string;
  tailor_id: string;
  tailor_name?: string;
  tailor_code?: string;
  dress_type: string;
  completed_qty: number;
  rate_per_piece: number;
  earned_amount: number;
  return_date: string;
  notes?: string;
  recorded_by?: string;
  recorded_by_name?: string;
  order_number?: string;
  original_assigned_qty?: number;
  current_total_completed?: number;
  current_remaining_qty?: number;
  created_at: string;
}

export interface DressTypeBreakdown {
  dress_type: string;
  order_count: number;
  assigned_qty: number;
  completed_qty: number;
  pending_qty: number;
  earned_amount: number;
  avg_rate: number;
}

export interface TailorProfileResponse {
  tailor: Tailor & { login_user_id?: string; email?: string; is_active?: number };
  kpis: {
    total_assigned: number;
    total_completed: number;
    total_pending: number;
    total_earned: number;
    total_assignments: number;
    active_jobs: number;
    completed_jobs: number;
  };
  dress_types_breakdown: DressTypeBreakdown[];
  assignments: (TailorWorkOrder & { remaining_qty: number; current_earned: number; total_expected_amount: number })[];
  returns: StitchingReturn[];
  financials: {
    total_salary: number;
    total_paid: number;
    pending_salary: number;
    recent_payments: any[];
  };
}

export interface BusinessOverviewMetrics {
  combinedSales: number;
  combinedBills: number;
  retailSales: number;
  wholesaleSales: number;
  retailBills: number;
  wholesaleBills: number;
  retailAvgBill: number;
  wholesaleAvgBill: number;
  retailPaid: number;
  wholesalePaid: number;
  retailPending: number;
  wholesalePending: number;
  bestShop: string;
  bestShopReason: string;
}

export interface BusinessOverviewData {
  metrics: BusinessOverviewMetrics;
  dailyComparison: {
    date: string;
    retail_sales: number;
    wholesale_sales: number;
    retail_bills: number;
    wholesale_bills: number;
  }[];
  monthlyComparison: {
    month: string;
    retail_sales: number;
    wholesale_sales: number;
    retail_bills: number;
    wholesale_bills: number;
  }[];
  categoryShare: {
    category: string;
    retail_sales: number;
    wholesale_sales: number;
    total_qty: number;
  }[];
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  source_shop: string;
  dest_shop: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  quantity: number;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
}
