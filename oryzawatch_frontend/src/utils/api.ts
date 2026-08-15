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
  baseURL: import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api/',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to attach JWT Access Token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to auto refresh expired JWT
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
        const baseURL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api/';
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          `${baseURL}auth/token/refresh/`,
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
    API.post('diagnostics/upload/', formData, {
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
