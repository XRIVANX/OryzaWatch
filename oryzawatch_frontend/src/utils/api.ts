import axios, { AxiosResponse } from 'axios';
import type {
  User,
  UserListItem,
  UserListResponse,
  Alert,
  DiseaseDetection,
  Farm,
  DiseaseHotspot,
  HotspotStatus,
  DashboardStatsSummary,
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

// Backend list endpoints have no pagination configured — they return plain
// arrays, not { count, next, previous, results }.
export const alertsApi = {
  list: (): Promise<AxiosResponse<Alert[]>> =>
    API.get('alerts/'),
  markRead: (id: number): Promise<AxiosResponse<Alert>> =>
    API.patch(`alerts/${id}/mark-read/`, { is_read: true }),
};

export const diseaseApi = {
  list: (): Promise<AxiosResponse<PaginatedResponse<DiseaseDetection>>> =>
    API.get('diseases/'),
  detect: (formData: FormData): Promise<AxiosResponse<DiseaseDetection>> =>
    API.post('diagnostics/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Backend list endpoints have no pagination configured — they return plain
// arrays, not { count, next, previous, results }.
export const farmApi = {
  list: (): Promise<AxiosResponse<Farm[]>> =>
    API.get('farms/'),
  update: (id: number, data: Partial<Pick<Farm, 'latitude' | 'longitude' | 'boundary' | 'size_hectares'>>): Promise<AxiosResponse<Farm>> =>
    API.patch(`farms/${id}/`, data),
};

export const analyticsApi = {
  getHotspots: (): Promise<AxiosResponse<DiseaseHotspot[]>> =>
    API.get('analytics/hotspots/'),
  updateStatus: (id: number, statusValue: HotspotStatus): Promise<AxiosResponse<DiseaseHotspot>> =>
    API.patch(`analytics/hotspots/${id}/`, { status: statusValue }),
  broadcast: (id: number, scope: 'BARANGAY' | 'MUNICIPALITY' | 'ALL'): Promise<AxiosResponse<{ notified: number }>> =>
    API.post(`analytics/hotspots/${id}/broadcast/`, { scope }),
  predict: (id: number): Promise<AxiosResponse<PredictionResult>> =>
    API.post(`analytics/hotspots/${id}/predict/`, {}),
};

export interface PredictionResult {
  hotspot_latitude: number;
  hotspot_longitude: number;
  cone: [number, number][];
  reach_km: number;
  daily_reach_km: number[];
  search_radius_km: number;
  wind_direction_deg: number;
  wind_cardinal: string;
  wind_speed: number;
  farms_in_cone: number;
  farms_outside_cone: number;
  notified: number;
}

export const usersApi = {
  list: (params?: { role?: string; search?: string; limit?: number; offset?: number }): Promise<AxiosResponse<UserListResponse>> =>
    API.get('users/', { params }),
};

export const dashboardApi = {
  stats: (): Promise<AxiosResponse<DashboardStatsSummary>> =>
    API.get('dashboard/stats/'),
};

export default API;
