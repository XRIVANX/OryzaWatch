// ─────────────────────────────────────────────────────────────────────────────
// OryzaWatch Mobile — Axios API Client
// Auto-attaches JWT Bearer token to every request, and transparently refreshes
// an expired access token (15 min lifetime — see config/settings.py SIMPLE_JWT)
// using the 7-day refresh token before giving up, mirroring the web app's
// existing refresh interceptor (utils/api.ts).
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Called when a refresh attempt itself fails (refresh token expired/blacklisted)
// so the app can drop back to the login screen. Registered by AuthContext -
// kept as a plain callback (not a React import) to avoid a circular dependency.
let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// Concurrent requests that all 401 at once must share a single refresh call -
// SIMPLE_JWT rotates and blacklists the refresh token on every use, so a
// second concurrent refresh with the now-stale token would fail outright.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token stored.');
      const { data } = await axios.post<{ access: string; refresh?: string }>(
        `${API_BASE_URL}/api/auth/token/refresh/`,
        { refresh: refreshToken }
      );
      await storage.saveTokens(data.access, data.refresh ?? refreshToken);
      return data.access;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Request Interceptor: attach JWT ──────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: refresh expired tokens, then surface errors cleanly ──
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newAccess}` };
        return apiClient(originalRequest);
      } catch {
        await storage.clearAll();
        onSessionExpired?.();
        return Promise.reject(new Error('Your session has expired. Please log in again.'));
      }
    }

    if (error.response) {
      // Server responded with an error status
      const msg =
        error.response.data?.detail ||
        error.response.data?.message ||
        JSON.stringify(error.response.data) ||
        'Server error';
      const wrapped = new Error(msg) as Error & { status?: number };
      wrapped.status = error.response.status;
      return Promise.reject(wrapped);
    }
    if (error.request) {
      return Promise.reject(
        new Error(`No response from server at ${API_BASE_URL}. Ensure Django is running on 0.0.0.0:8000 and your phone is on the same Wi-Fi.`)
      );
    }
    return Promise.reject(error);
  }
);

export default apiClient;
