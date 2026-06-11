const API_BASE = '/api';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.details || 'Request failed');
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

  // Dashboard
  getDashboardStats: () => fetchApi('/dashboard/stats'),
  getDashboardInstitutions: () => fetchApi('/dashboard/institutions'),
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
  { value: 'hospital', label: 'Hospital / Healthcare', icon: '🏥' },
  { value: 'school', label: 'School / Educational', icon: '🏫' },
  { value: 'hotel', label: 'Hotel / Hospitality', icon: '🏨' },
  { value: 'office', label: 'Office / Corporate', icon: '🏢' },
  { value: 'restaurant', label: 'Restaurant / Food Service', icon: '🍽️' },
  { value: 'factory', label: 'Factory / Industrial', icon: '🏭' },
  { value: 'warehouse', label: 'Warehouse / Storage', icon: '📦' },
  { value: 'retail', label: 'Retail / Store', icon: '🛍️' }
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
