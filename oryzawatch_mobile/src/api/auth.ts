import apiClient from './client';
import { storage } from '../utils/storage';
import type { User, LoginResponse } from '../types';

export const authApi = {
  async login(username: string, password: string): Promise<{ tokens: LoginResponse; user: User }> {
    const loginRes = await apiClient.post<LoginResponse>('/api/auth/login/', {
      username,
      password,
    });
    await storage.saveTokens(loginRes.data.access, loginRes.data.refresh);

    const profileRes = await apiClient.get<User>('/api/auth/profile/');
    return { tokens: loginRes.data, user: profileRes.data };
  },

  async register(payload: {
    username: string;
    email: string;
    password: string;
    role: string;
    municipality: string;
    barangay: string;
    phone_number?: string;
  }): Promise<User> {
    const res = await apiClient.post<User>('/api/auth/register/', payload);
    return res.data;
  },

  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/api/auth/profile/');
    return res.data;
  },

  async logout(): Promise<void> {
    await storage.clearAll();
  },
};
