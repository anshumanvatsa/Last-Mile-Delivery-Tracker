import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send cookies (refresh token)
  headers: { 'Content-Type': 'application/json' },
});

// ─────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR — Attach access token
// ─────────────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR — Auto-refresh on 401
// ─────────────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─────────────────────────────────────────────────────────────
// API HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; phone?: string; role: string }) =>
    api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

export const ordersApi = {
  calculateCharge: (params: Record<string, unknown>) =>
    api.post('/api/orders/calculate-charge', params),
  create: (data: Record<string, unknown>) => api.post('/api/orders', data),
  list: (params?: Record<string, string | number>) =>
    api.get('/api/orders', { params }),
  getById: (id: string) => api.get(`/api/orders/${id}`),
  track: (trackingNumber: string) =>
    api.get(`/api/orders/track/${trackingNumber}`),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch(`/api/orders/${id}/status`, { status, note }),
  autoAssign: (id: string) => api.post(`/api/orders/${id}/auto-assign`),
  assign: (id: string, agentId: string) =>
    api.post(`/api/orders/${id}/assign`, { agentId }),
  reschedule: (id: string, newDate: string, reason: string) =>
    api.post(`/api/orders/${id}/reschedule`, { newDate, reason }),
};

export const zonesApi = {
  list: () => api.get('/api/zones'),
  getById: (id: string) => api.get(`/api/zones/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/zones', data),
  detect: (area: string) => api.get('/api/zones/detect', { params: { area } }),
  addArea: (zoneId: string, areaName: string) =>
    api.post(`/api/zones/${zoneId}/areas`, { areaName }),
};

export const rateCardsApi = {
  list: (orderType?: string) =>
    api.get('/api/rate-cards', { params: orderType ? { orderType } : {} }),
  create: (data: Record<string, unknown>) => api.post('/api/rate-cards', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/rate-cards/${id}`, data),
};

export const agentsApi = {
  list: () => api.get('/api/agents'),
  create: (data: Record<string, unknown>) => api.post('/api/agents', data),
  updateAvailability: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/agents/${id}/availability`, data),
};

export const adminApi = {
  stats: () => api.get('/api/admin/stats'),
  mapData: () => api.get('/api/admin/map-data'),
};
