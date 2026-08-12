// ─────────────────────────────────────────────────────────────────────────────
// OryzaWatch Mobile — Axios API Client
// Auto-attaches JWT Bearer token to every request.
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

// ── Response Interceptor: surface error messages cleanly ─────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with an error status
      const msg =
        error.response.data?.detail ||
        error.response.data?.message ||
        JSON.stringify(error.response.data) ||
        'Server error';
      return Promise.reject(new Error(msg));
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
