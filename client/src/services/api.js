export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, payload = {}) {
    super(message || 'Request failed');
    this.status = status;
    this.code = code || 'API_ERROR';
    this.payload = payload;
  }
}

function getAuthToken() {
  try {
    return window.sessionStorage.getItem('sqms_auth_token') || null;
  } catch {
    return null;
  }
}

async function request(endpoint, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to connect to the salon server.');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'REQUEST_FAILED',
      data.message || `HTTP ${response.status}`,
      data
    );
  }
  return data;
}

export const api = {
  // Public & Customer
  getState: () => request('/api/state'),
  getQueueEntry: (id) => request(`/api/queue/${encodeURIComponent(id)}`),
  lookupByPhone: (phone) => request(`/api/queue/lookup/${encodeURIComponent(phone)}`),
  joinQueue: (payload) => request('/api/queue/join', { method: 'POST', body: payload }),
  cancelCustomerSpot: (id) => request(`/api/queue/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),

  // Auth
  loginPin: (pin, role) => request('/api/auth/login', { method: 'POST', body: { pin, role } }),
  verifySession: () => request('/api/auth/verify', { auth: true }),

  // Reception
  addWalkIn: (payload) =>
    request('/api/reception/walkin', { method: 'POST', body: payload, auth: true }),
  callNext: (barberId, entryId = null) =>
    request('/api/reception/call-next', {
      method: 'POST',
      body: { barberId, entryId },
      auth: true,
    }),
  markNoShow: (entryId) =>
    request(`/api/reception/entries/${encodeURIComponent(entryId)}/no-show`, {
      method: 'POST',
      auth: true,
    }),
  receptionCancel: (entryId) =>
    request(`/api/reception/entries/${encodeURIComponent(entryId)}/cancel`, {
      method: 'POST',
      auth: true,
    }),

  // Barber
  barberStart: (barberId, entryId = null) =>
    request(`/api/barber/${encodeURIComponent(barberId)}/start`, {
      method: 'POST',
      body: { entryId },
      auth: true,
    }),
  barberDone: (barberId, entryId = null) =>
    request(`/api/barber/${encodeURIComponent(barberId)}/done`, {
      method: 'POST',
      body: { entryId },
      auth: true,
    }),
  barberSetStatus: (barberId, status) =>
    request(`/api/barber/${encodeURIComponent(barberId)}/status`, {
      method: 'PATCH',
      body: { status },
      auth: true,
    }),

  // Admin / Owner
  getAdminStats: (date) =>
    request(`/api/admin/stats${date ? `?date=${encodeURIComponent(date)}` : ''}`, { auth: true }),
  createService: (payload) =>
    request('/api/admin/services', { method: 'POST', body: payload, auth: true }),
  updateService: (id, payload) =>
    request(`/api/admin/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
      auth: true,
    }),
  deleteService: (id) =>
    request(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  createBarber: (payload) =>
    request('/api/admin/barbers', { method: 'POST', body: payload, auth: true }),
  updateBarber: (id, payload) =>
    request(`/api/admin/barbers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
      auth: true,
    }),
  deleteBarber: (id) =>
    request(`/api/admin/barbers/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  updateSettings: (payload) =>
    request('/api/admin/settings', { method: 'PATCH', body: payload, auth: true }),
};
