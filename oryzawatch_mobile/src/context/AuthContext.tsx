// ─────────────────────────────────────────────────────────────────────────────
// OryzaWatch Mobile — Auth Context
// Provides user state, login, and logout across the entire app.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { storage } from '../utils/storage';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: string;
  municipality: string;
  barangay: string;
  phone_number?: string;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app launch: check if a valid token exists and restore session
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getAccessToken();
        if (token) {
          const profile = await authApi.getProfile();
          setUser(profile);
        }
      } catch {
        // Token expired or invalid — clear it silently
        await storage.clearAll();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: profile } = await authApi.login(username, password);
    setUser(profile);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    // After registering, log the user in automatically
    await login(payload.username, payload.password);
  }, [login]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
