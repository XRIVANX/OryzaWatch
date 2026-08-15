import type { User, UserRole } from '../types';

export const getStoredTokens = () => ({
  access: localStorage.getItem('access_token'),
  refresh: localStorage.getItem('refresh_token'),
});

export const setStoredTokens = (access: string, refresh?: string) => {
  localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
};

export const clearAuthSession = () => {
  localStorage.clear();
};

export const ROLE_LABELS: Record<UserRole, string> = {
  FARMER: 'Farmer',
  KAGAWAD: 'Agri-Kagawad',
  MAO_ADMIN: 'MAO · Admin',
};

export const getRoleLabel = (role: UserRole | string): string => {
  return ROLE_LABELS[role as UserRole] || role;
};
