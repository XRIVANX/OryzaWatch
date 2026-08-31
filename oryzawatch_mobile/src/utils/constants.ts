import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = (): string => {
  // 1. Auto-detect PC IP address from Expo Go bundler URI
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).experienceUrl;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }
  // 2. Android Emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  // 3. iOS Simulator / Web fallback
  return 'http://127.0.0.1:8000';
};

export const API_BASE_URL = getBaseUrl();


// Brand Colors — Botanical Theme matching Web Portal
export const COLORS = {
  // Primary greens (brand)
  primary: '#237e46',         // leaf-primary
  primaryDark: '#165233',     // leaf-forest
  primaryVibrant: '#2e9e59',  // leaf-vibrant
  primaryBright: '#34b765',   // leaf-bright
  primaryLight: '#6ee79f',    // leaf-sprout
  primaryPastel: '#dcf5e5',   // leaf-pastel
  primaryBg: '#edf9f1',       // leaf-soft

  // Harvest Gold Accents
  gold: '#ca8a04',
  goldLight: '#eab308',
  goldAmber: '#f59e0b',
  goldSoft: '#fef9c3',

  // Secondary
  accent: '#2e9e59',
  accentLight: '#dcf5e5',

  // Semantic Status Colors
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerText: '#991b1b',

  warning: '#d97706',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#92400e',

  success: '#16a34a',
  successLight: '#f0fdf4',
  successBorder: '#bbf7d0',
  successText: '#15803d',

  info: '#0284c7',
  infoLight: '#f0f9ff',
  infoBorder: '#bae6fd',
  infoText: '#075985',

  // Ambient Botanical Neutrals
  white: '#ffffff',
  background: '#f5f8f5',       // Ambient light botanical background
  cardBg: '#ffffff',
  border: '#e1eae3',           // Soft sage border
  borderLight: '#edf3ee',
  borderBright: '#86d8a3',

  // Typography (Comforting readable dark slate-greens)
  textPrimary: '#14261c',
  textSecondary: '#4a6152',
  textMuted: '#7a9182',
  textInverse: '#ffffff',

  // Tab bar
  tabActive: '#237e46',
  tabInactive: '#7a9182',
};

// User Roles (must match backend exactly)
export const ROLES = {
  FARMER: 'FARMER',
  KAGAWAD: 'KAGAWAD',
  MAO_ADMIN: 'MAO_ADMIN',
} as const;

// Disease labels
export const DISEASE_LABELS: Record<string, string> = {
  HEALTHY: 'Healthy',
  BLB: 'Bacterial Leaf Blight',
  BLAST: 'Rice Blast',
  BROWN_SPOT: 'Brown Spot',
};

// Hotspot status
export const HOTSPOT_STATUS: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical Outbreak', color: '#dc2626' },
  AT_RISK: { label: 'At Risk Zone', color: '#f97316' },
  MONITORING: { label: 'Monitoring', color: '#2563eb' },
  RESOLVED: { label: 'Resolved', color: '#16a34a' },
};
