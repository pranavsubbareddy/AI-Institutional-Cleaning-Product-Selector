// In development, Vite proxies /api to the backend (see vite.config.js)
// In production, set VITE_API_URL to your deployed backend URL (e.g., https://your-app.railway.app)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  };
  
  try {
    const response = await fetch(url, config);
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const message = response.ok
          ? 'Server returned an invalid response. Please try again.'
          : `Server returned ${response.status} ${response.statusText || 'error'} instead of JSON.`;
        throw new Error(message);
      }
    }
    
    if (!response.ok) {
      const details = Array.isArray(data?.details) ? data.details.join(', ') : data?.details;
      throw new Error(data?.error || details || `Request failed (${response.status})`);
    }
    
    if (!data) {
      throw new Error('Server returned an empty response. Please try again.');
    }

    return data;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please ensure the backend is running.');
    }
    throw error;
  }
}

export const api = {
  // Health
  health: () => fetchApi('/health'),

  // Products
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/products${query ? `?${query}` : ''}`);
  },
  getProduct: (id) => fetchApi(`/products/${id}`),

  // Institutions
  createInstitution: (data) => fetchApi('/institutions', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getInstitutions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/institutions${query ? `?${query}` : ''}`);
  },
  getInstitution: (id) => fetchApi(`/institutions/${id}`),
  updateInstitution: (id, data) => fetchApi(`/institutions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteInstitution: (id) => fetchApi(`/institutions/${id}`, {
    method: 'DELETE'
  }),

  // Recommendations
  processRecommendation: (institutionId) => fetchApi('/recommendations/process', {
    method: 'POST',
    body: JSON.stringify({ institutionId })
  }),
  getRecommendations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/recommendations${query ? `?${query}` : ''}`);
  },
  getRecommendation: (id) => fetchApi(`/recommendations/${id}`),
  updateRecommendationStatus: (id, status) => fetchApi(`/recommendations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Auth
  signup: (data) => fetchApi('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchApi('/auth/logout', { method: 'POST' }),
  getMe: () => fetchApi('/auth/me'),
  deleteAccount: () => fetchApi('/auth/account', { method: 'DELETE' }),
  resendVerification: () => fetchApi('/auth/resend-verification', { method: 'POST' }),
  verifyEmail: (token, email) => fetchApi('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token, email }) }),
  forgotPassword: (email) => fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyResetOTP: (email, otp, otpToken) => fetchApi('/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify({ email, otp, otpToken }) }),
  validateResetToken: (token) => fetchApi(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`),
  resetPassword: (token, email, newPassword) => fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, email, newPassword }) }),
  updateProfile: (data) => fetchApi('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  googleSignIn: (idToken) => fetchApi('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  googleConfig: () => fetchApi('/auth/google-config'),

  // Dashboard
  getDashboardStats: () => fetchApi('/dashboard/stats'),
  getDashboardInstitutions: () => fetchApi('/dashboard/institutions'),
  getDashboardSummary: () => fetchApi('/dashboard/summary'),

  // Admin Dashboard
  getAdminDashboard: () => fetchApi('/admin/dashboard'),

  // Admin Activity Logs
  getAdminActivityLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/admin/activity-logs${query ? `?${query}` : ''}`);
  },

  // Admin Audit Logs (dedicated endpoint)
  getAdminAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },

  // Admin User Management
  getAdminUsers: () => fetchApi('/admin/users'),
  updateUserRole: (uid, role) => fetchApi(`/admin/users/${uid}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // Warehouse & Stock
  getWarehouses: () => fetchApi('/warehouses'),
  getWarehouse: (id) => fetchApi(`/warehouses/${id}`),
  createWarehouse: (data) => fetchApi('/warehouses', { method: 'POST', body: JSON.stringify(data) }),
  updateWarehouse: (id, data) => fetchApi(`/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWarehouse: (id) => fetchApi(`/warehouses/${id}`, { method: 'DELETE' }),
  getAllStockBatches: () => fetchApi('/warehouses/all/batches'),
  getWarehouseBatches: (id) => fetchApi(`/warehouses/${id}/batches`),
  createStockBatch: (warehouseId, data) => fetchApi(`/warehouses/${warehouseId}/batches`, { method: 'POST', body: JSON.stringify(data) }),
  updateStockBatch: (warehouseId, batchId, data) => fetchApi(`/warehouses/${warehouseId}/batches/${batchId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStockBatch: (warehouseId, batchId) => fetchApi(`/warehouses/${warehouseId}/batches/${batchId}`, { method: 'DELETE' }),

  // Deliveries
  getDeliveries: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/deliveries${query ? `?${query}` : ''}`);
  },
  getDelivery: (id) => fetchApi(`/deliveries/${id}`),
  createDelivery: (data) => fetchApi('/deliveries', { method: 'POST', body: JSON.stringify(data) }),
  updateDelivery: (id, data) => fetchApi(`/deliveries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDelivery: (id) => fetchApi(`/deliveries/${id}`, { method: 'DELETE' }),

  // Salesman Visits
  getSalesmanVisits: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/salesman${query ? `?${query}` : ''}`);
  },
  getSalesmanVisit: (id) => fetchApi(`/salesman/${id}`),
  createSalesmanVisit: (data) => fetchApi('/salesman', { method: 'POST', body: JSON.stringify(data) }),
  updateSalesmanVisit: (id, data) => fetchApi(`/salesman/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSalesmanVisit: (id) => fetchApi(`/salesman/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/orders${query ? '?' + query : ''}`);
  },
  getOrder: (id) => fetchApi(`/orders/${id}`),
  createOrder: (data) => fetchApi('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id, data) => fetchApi(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id) => fetchApi(`/orders/${id}`, { method: 'DELETE' }),
  advanceOrderWorkflow: (id, data) => fetchApi(`/orders/${id}/workflow`, { method: 'POST', body: JSON.stringify(data) }),
  getOrderInvoice: (id) => fetchApi(`/orders/${id}/invoice`),
  getOrderStats: () => fetchApi('/orders/stats'),

  // Compliance
  getComplianceDocs: () => fetchApi('/compliance'),
  getComplianceDoc: (id) => fetchApi(`/compliance/${id}`),
  createComplianceDoc: (data) => fetchApi('/compliance', { method: 'POST', body: JSON.stringify(data) }),
  updateComplianceDoc: (id, data) => fetchApi(`/compliance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComplianceDoc: (id) => fetchApi(`/compliance/${id}`, { method: 'DELETE' }),
  acknowledgeComplianceDoc: (data) => fetchApi('/compliance/acknowledge', { method: 'POST', body: JSON.stringify(data) }),
  getComplianceAcknowledgements: (institutionId) => fetchApi(`/compliance/acknowledgements/${institutionId}`),
};

// Helper to format currency
export function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A';
  return 'Rs ' + Number(amount).toLocaleString('en-IN');
}

// Helper to get status badge color
export function getStatusColor(status) {
  const colors = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    scheduled: 'bg-purple-100 text-purple-800',
    basic: 'bg-gray-100 text-gray-800',
    standard: 'bg-blue-100 text-blue-800',
    high: 'bg-yellow-100 text-yellow-800',
    medical_grade: 'bg-red-100 text-red-800',
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high_budget: 'bg-purple-100 text-purple-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Institution type labels
export const INSTITUTION_TYPES = [
  { value: 'hospital', label: 'Hospital / Healthcare', color: 'red' },
  { value: 'school', label: 'School / Educational', color: 'blue' },
  { value: 'hotel', label: 'Hotel / Hospitality', color: 'amber' },
  { value: 'office', label: 'Office / Corporate', color: 'slate' },
  { value: 'restaurant', label: 'Restaurant / Food Service', color: 'orange' },
  { value: 'factory', label: 'Factory / Industrial', color: 'yellow' },
  { value: 'warehouse', label: 'Warehouse / Storage', color: 'stone' },
  { value: 'retail', label: 'Retail / Store', color: 'pink' },
  { value: 'gym', label: 'Gym / Fitness Center', color: 'lime' },
  { value: 'laboratory', label: 'Laboratory / Research', color: 'violet' },
  { value: 'pharmacy', label: 'Pharmacy / Medical Store', color: 'emerald' },
  { value: 'airport', label: 'Airport / Transportation', color: 'cyan' },
  { value: 'shopping_mall', label: 'Shopping Mall / Complex', color: 'rose' },
  { value: 'cinema', label: 'Cinema / Theater', color: 'purple' },
  { value: 'library', label: 'Library / Study Center', color: 'indigo' },
  { value: 'community_center', label: 'Community Center / Hall', color: 'teal' },
  { value: 'custom', label: 'Custom (type your own)', color: 'gray' }
];

export const SURFACE_TYPES = [
  { value: 'hard_floor', label: 'Hard Floor' },
  { value: 'carpet', label: 'Carpet' },
  { value: 'glass', label: 'Glass / Windows' },
  { value: 'tile', label: 'Tile' },
  { value: 'stainless_steel', label: 'Stainless Steel' },
  { value: 'wood', label: 'Wood' },
  { value: 'marble', label: 'Marble' },
  { value: 'countertop', label: 'Countertop' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'mirror', label: 'Mirror' }
];

export const HYGIENE_LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'medical_grade', label: 'Medical Grade' }
];

export const BUDGET_LEVELS = [
  { value: 'low', label: 'Low (Economy)', icon: '💰' },
  { value: 'medium', label: 'Medium (Standard)', icon: '💵' },
  { value: 'high', label: 'High (Premium)', icon: '💎' }
];
