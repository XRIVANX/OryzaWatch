import axios, { AxiosResponse } from 'axios';
import type {
  User,
  Alert,
  DiseaseDetection,
  Farm,
  DashboardStats,
  PaginatedResponse,
} from '../types';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          'http://127.0.0.1:8000/api/auth/token/refresh/',
          { refresh: refreshToken }
        );
        localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return API(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Typed endpoint functions ─────────────────────────────────────────────────

export const authApi = {
  getProfile: (): Promise<AxiosResponse<User>> =>
    API.get('auth/profile/'),
};

export const alertsApi = {
  list: (): Promise<AxiosResponse<PaginatedResponse<Alert>>> =>
    API.get('alerts/'),
  markRead: (id: number): Promise<AxiosResponse<Alert>> =>
    API.patch(`alerts/${id}/`, { read: true }),
};

export const diseaseApi = {
  list: (): Promise<AxiosResponse<PaginatedResponse<DiseaseDetection>>> =>
    API.get('diseases/'),
  detect: (formData: FormData): Promise<AxiosResponse<DiseaseDetection>> =>
    API.post('diseases/detect/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const farmApi = {
  list: (): Promise<AxiosResponse<PaginatedResponse<Farm>>> =>
    API.get('farms/'),
};

export const dashboardApi = {
  stats: (): Promise<AxiosResponse<DashboardStats>> =>
    API.get('dashboard/stats/'),
};

export default API;
