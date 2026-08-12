// ─────────────────────────────────────────────────────────────────────────────
// OryzaWatch Mobile — App-Wide Constants
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️  IMPORTANT: Change this to your PC's local IP address when testing on Expo Go.
//    Run `ipconfig` in PowerShell to find it (look for IPv4 Address).
//    Example: 'http://192.168.1.105:8000'
export const API_BASE_URL = 'http://192.168.1.100:8000';

// Brand Colors
export const COLORS = {
  // Primary greens (brand)
  primary: '#2d6a4f',
  primaryDark: '#1b4332',
  primaryLight: '#52b788',
  primaryBg: '#f0fdf4',

  // Secondary
  accent: '#40916c',
  accentLight: '#95d5b2',

  // Semantic
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',

  warning: '#d97706',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',

  success: '#16a34a',
  successLight: '#f0fdf4',

  info: '#2563eb',
  infoLight: '#eff6ff',
  infoBorder: '#bfdbfe',

  // Neutrals
  white: '#ffffff',
  background: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',

  // Tab bar
  tabActive: '#2d6a4f',
  tabInactive: '#94a3b8',
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
