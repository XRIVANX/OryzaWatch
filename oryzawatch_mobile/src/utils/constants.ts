import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Private LAN IPv4 (10.x, 172.16-31.x, 192.168.x). Metro's host is only trusted
// as the backend address when it is one of these; a tunnel domain or localhost
// (adb reverse) says nothing about where Django is running.
const isPrivateLanIp = (host: string): boolean =>
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);

const getBaseUrl = (): string => {
  // 1. Explicit override: EXPO_PUBLIC_API_URL from oryzawatch_mobile/.env when
  //    developing, or from eas.json `env` for EAS builds. Inlined at bundle time.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Running from Metro (Expo Go / dev client): Django runs on the same PC as
  //    Metro, so use the LAN IP the phone already reached Metro on. This follows
  //    whichever Wi-Fi you are on, with no config edit when the PC's IP changes.
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).experienceUrl;
  if (hostUri) {
    const host = String(hostUri).replace(/^[a-z]+:\/\//i, '').split(/[:/]/)[0];
    if (isPrivateLanIp(host)) {
      return `http://${host}:8000`;
    }
  }

  // 3. Standalone APK/IPA without EXPO_PUBLIC_API_URL: the fixed address in
  //    app.json `extra.apiUrl`. Only valid on the network it was set for.
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  // 4. Android Emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  // 5. iOS Simulator / Web fallback
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
