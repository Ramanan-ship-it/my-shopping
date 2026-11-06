const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('sds_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('sds_token', token);
  } else {
    localStorage.removeItem('sds_token');
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...rest } = options;
  
  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const token = getAuthToken();
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers: {
      ...authHeaders,
      ...headers,
    },
    ...rest,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = (typeof data === 'object' && data?.error) || response.statusText || 'Request failed';
    throw new Error(errorMessage);
  }

  return data as T;
}

// API methods grouped by module
export const api = {
  // Auth
  auth: {
    login: (credentials: { identifier: string; password: string }) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    me: () => request<{ user: any }>('/auth/me'),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
    resetPassword: (user_id: string, new_password: string) =>
      request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ user_id, new_password }),
      }),
  },

  // Billing
  billing: {
    createBill: (billData: any) =>
      request<{ success: boolean; bill: any }>('/billing/create', {
        method: 'POST',
        body: JSON.stringify(billData),
      }),
    getBills: (params?: { shop_id?: string; status?: string; bill_type?: string; search?: string; from_date?: string; to_date?: string }) =>
      request<{ bills: any[]; summary: any }>('/billing/bills', { params }),
    getBillById: (id: string) => request<{ bill: any }>('/billing/bills/' + id),
    processReturn: (returnData: any) =>
      request<{ success: boolean; return: any }>('/billing/return', {
        method: 'POST',
        body: JSON.stringify(returnData),
      }),
  },

  // Inventory
  inventory: {
    getProducts: (params?: { category?: string; search?: string; shop_id?: string; low_stock?: boolean }) =>
      request<{ products: any[] }>('/inventory/products', { params }),
    addProduct: (productData: any) =>
      request<{ success: boolean; product: any }>('/inventory/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      }),
    updateProduct: (id: string, productData: any) =>
      request<{ success: boolean; product: any }>(`/inventory/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      }),
    adjustStock: (adjustment: { product_id: string; shop_id: string; adjustment_qty: number; reason: string }) =>
      request<{ success: boolean; new_stock: number }>('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(adjustment),
      }),
    transferStock: (transfer: { source_shop: string; dest_shop: string; product_id: string; quantity: number; notes?: string }) =>
      request<{ success: boolean; transfer: any }>('/inventory/transfer', {
        method: 'POST',
        body: JSON.stringify(transfer),
      }),
    getTransfers: () => request<{ transfers: any[] }>('/inventory/transfers'),
    getMovements: (params?: { product_id?: string; shop_id?: string }) =>
      request<{ movements: any[] }>('/inventory/movements', { params }),
  },

  // Tailors
  tailors: {
    getAll: (params?: { shop_id?: string; status?: string }) => request<{ tailors: any[] }>('/tailors', { params }),
    getById: (id: string) => request<{ tailor: any; production: any[]; attendance: any[]; salary_summary: any }>('/tailors/' + id),
    getProfile: (tailorId: string, params?: { time_range?: string; start_date?: string; end_date?: string; dress_type?: string }) =>
      request<any>(`/tailors/${tailorId}/profile`, { params }),
    createTailor: (data: any) => request<{ success: boolean; tailor: any }>('/tailors', { method: 'POST', body: JSON.stringify(data) }),
    updateTailor: (id: string, data: any) =>
      request<{ success: boolean; tailor: any }>(`/tailors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getDressTypes: () => request<{ dress_types: any[] }>('/tailors/dress-types'),
    addDressType: (data: { name: string; default_rate?: number; category?: string }) =>
      request<{ success: boolean; message: string; dress_type: any }>('/tailors/dress-types', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    recordReturn: (data: { assignment_id: string; completed_qty: number; return_date?: string; notes?: string }) =>
      request<{
        success: boolean;
        message: string;
        return_id: string;
        return_number: string;
        assignment_id: string;
        completed_qty: number;
        total_completed: number;
        remaining_qty: number;
        status: string;
        earned_amount: number;
      }>('/tailors/work-orders/return', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getReturnsHistory: (params?: { tailor_id?: string; dress_type?: string; start_date?: string; end_date?: string; assignment_id?: string }) =>
      request<{ returns: any[]; summary: any }>('/tailors/returns/history', { params }),
    getProduction: (params?: { tailor_id?: string; from_date?: string; to_date?: string }) =>
      request<{ production: any[] }>('/tailors/production/list', { params }),
    recordProduction: (data: { tailor_id?: string; date: string; shop_id: string; shirts_qty: number; pants_qty: number; blouses_qty: number; others_qty: number; notes?: string }) =>
      request<{ success: boolean; record: any }>('/tailors/production/record', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAttendance: (params?: { date?: string; tailor_id?: string }) =>
      request<{ attendance: any[] }>('/tailors/attendance/list', { params }),
    markAttendance: (data: { tailor_id: string; date: string; status: string; notes?: string }) =>
      request<{ success: boolean; record: any }>('/tailors/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getSalaryDashboard: () => request<any>('/tailors/salary/dashboard'),
    recordSalaryPayment: (data: { tailor_id: string; amount: number; payment_type: 'salary' | 'advance'; payment_method: string; notes?: string }) =>
      request<{ success: boolean; payment: any }>('/tailors/salary/payment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getWorkOrders: (params?: { tailor_id?: string; status?: string; item_type?: string }) =>
      request<{ work_orders: any[]; summary: any }>('/tailors/work-orders/list', { params }),
    createWorkOrder: (data: { tailor_id: string; shop_id?: string; item_type: string; given_qty: number; stitched_qty?: number; rate_per_piece?: number; due_date?: string; notes?: string }) =>
      request<{ success: boolean; message: string; order_id: string; order_number: string; total_amount?: number }>('/tailors/work-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateWorkOrder: (id: string, data: { given_qty?: number; stitched_qty?: number; rate_per_piece?: number; status?: string; due_date?: string; notes?: string }) =>
      request<{ success: boolean; message: string; order: any }>(`/tailors/work-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteWorkOrder: (id: string) =>
      request<{ success: boolean; message: string }>(`/tailors/work-orders/${id}`, {
        method: 'DELETE',
      }),
  },

  // Credit / Khata
  credit: {
    getDashboard: (params?: { shop_id?: string }) => request<any>('/credit/dashboard', { params }),
    getLedger: (params?: { shop_id?: string; status?: string; search?: string }) =>
      request<{ bills: any[]; total_receivable: number }>('/credit/list', { params }),
    collectPayment: (data: { bill_id: string; amount: number; payment_method: string; notes?: string }) =>
      request<{ success: boolean; payment: any; remaining_balance: number }>('/credit/payment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getPaymentsForBill: (billId: string) => request<{ payments: any[] }>('/credit/payments/' + billId),
  },

  // Customers
  customers: {
    getAll: (params?: { shop_id?: string; search?: string }) => request<{ customers: any[] }>('/customers', { params }),
    getById: (id: string) => request<{ customer: any; bills: any[]; pending_balance: number }>('/customers/' + id),
    createCustomer: (data: any) => request<{ success: boolean; customer: any }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomer: (id: string, data: any) => request<{ success: boolean; customer: any }>('/customers/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Expenses
  expenses: {
    getAll: (params?: { shop_id?: string; category?: string; from_date?: string; to_date?: string }) =>
      request<{ expenses: any[]; total_expense: number }>('/expenses', { params }),
    createExpense: (data: any) => request<{ success: boolean; expense: any }>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Suppliers
  suppliers: {
    getAll: () => request<{ suppliers: any[]; total_payable: number }>('/suppliers'),
    createSupplier: (data: any) => request<{ success: boolean; supplier: any }>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    recordPayment: (data: { supplier_id: string; amount: number; payment_method: string; notes?: string }) =>
      request<{ success: boolean; payment: any }>('/suppliers/payment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Reports
  reports: {
    getDashboard: (params?: { shop_id?: string }) => request<any>('/reports/dashboard', { params }),
    getBusinessOverview: (params?: { filter?: string; start_date?: string; end_date?: string }) =>
      request<any>('/reports/business-overview', { params }),
    getSalesReport: (params?: { shop_id?: string; from_date?: string; to_date?: string }) =>
      request<any>('/reports/sales', { params }),
    getProfitLoss: (params?: { shop_id?: string; from_date?: string; to_date?: string }) =>
      request<any>('/reports/profit-loss', { params }),
  },

  // Users & Staff
  users: {
    getAll: () => request<{ users: any[] }>('/users'),
    createUser: (data: any) => request<{ success: boolean; user: any }>('/users', { method: 'POST', body: JSON.stringify(data) }),
    updatePermissions: (userId: string, permissions: any) =>
      request<{ success: boolean }>('/users/' + userId + '/permissions', {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      }),
    toggleStatus: (userId: string) =>
      request<{ success: boolean; is_active: number }>('/users/' + userId + '/toggle-status', { method: 'POST' }),
    getAuditLogs: () => request<{ logs: any[] }>('/users/audit-logs'),
  },

  // Settings & Notifications
  settings: {
    getSettings: () => request<{ settings: Record<string, string> }>('/settings'),
    saveSettings: (settings: Record<string, string>) =>
      request<{ success: boolean; settings: Record<string, string> }>('/settings', {
        method: 'POST',
        body: JSON.stringify({ settings }),
      }),
    getBackupUrl: () => `${BASE_URL}/settings/backup`,
  },

  notifications: {
    getAll: (params?: { shop_id?: string }) => request<{ notifications: any[]; unread_count: number }>('/notifications', { params }),
    markRead: (id: string) => request<{ success: boolean }>('/notifications/' + id + '/read', { method: 'POST' }),
    triggerReminders: () => request<{ success: boolean; processed: number }>('/notifications/trigger-reminders', { method: 'POST' }),
  },
};
