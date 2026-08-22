// ─── Auth & User ─────────────────────────────────────────────────────────────
// Role values MUST match Django's ROLE_CHOICES exactly:
//   ('FARMER', 'Farmer') | ('KAGAWAD', 'SK / Agri-Kagawad') | ('MAO_ADMIN', '...')

export type UserRole = 'FARMER' | 'KAGAWAD' | 'MAO_ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  municipality: string;
  barangay: string;
  phone_number?: string;
}

export interface UserListItem {
  id: number;
  user_code: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  role_display: string;
  municipality: string;
  barangay: string;
  phone_number: string;
  date_joined: string;
  total_scans: number;
  status: 'Critical' | 'At Risk' | 'Monitoring' | 'Safe' | string;
  disease: string;
  last_report: string;
  latest_scan?: {
    id: number;
    detected_disease: string;
    detected_disease_display: string;
    confidence_score: number;
    created_at: string;
  } | null;
}

export interface UserListResponse {
  total: number;
  limit: number;
  offset: number;
  results: UserListItem[];
}

// ─── Registration ─────────────────────────────────────────────────────────────

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  municipality: string;
  barangay: string;
  phone_number?: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

export interface AlertAction {
  label: string;
  style: 'primary' | 'outline';
}

export interface Alert {
  id: number;
  type: AlertSeverity;
  icon: string;
  title: string;
  time: string;
  message: string;
  actions: AlertAction[];
  read: boolean;
}

// ─── Disease / AI Scan ───────────────────────────────────────────────────────

export type DiseaseStatus = 'healthy' | 'at_risk' | 'infected' | 'critical';

export interface DiseaseDetection {
  id: number;
  farmId: string;
  disease: string;
  confidence: number;
  detectedAt: string;
  status: DiseaseStatus;
  location: { barangay: string; lat: number; lng: number };
}

// ─── Farm / Map ──────────────────────────────────────────────────────────────

export interface Farm {
  id: string;
  name: string;
  barangay: string;
  area: number;
  status: DiseaseStatus;
  lat: number;
  lng: number;
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  rainfall: number;
  forecast: 'sunny' | 'cloudy' | 'rainy' | 'storm';
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalFarms: number;
  infectedFarms: number;
  activeCases: number;
  pendingScans: number;
  weatherData: WeatherData;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  non_field_errors?: string[];
  [key: string]: unknown;
}