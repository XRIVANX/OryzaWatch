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
  active_hotspot_id: number | null;
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
// Mirrors alerts/models.py -> Alert exactly.

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

export interface Alert {
  id: number;
  hotspot: number | null;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_read: boolean;
  created_at: string;
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
// Mirrors farms/models.py -> Farm exactly.

export interface Farm {
  id: number;
  farmer: number;
  farmer_username: string;
  barangay: string;
  municipality: string;
  latitude: string;
  longitude: string;
  boundary: [number, number][] | null;  // [lat, lng] points, closed ring
  size_hectares: number;
  created_at: string;
  updated_at: string;
}

// From: diagnostics/models.py -> LeafScan (subset returned nested in a hotspot)
export interface LeafScan {
  id: number;
  reporter_username: string;
  image: string;
  detected_disease: string;
  confidence_score: number;
  latitude: string;
  longitude: string;
  created_at: string;
}

// From: analytics/models.py -> DiseaseHotspot
export type HotspotStatus = 'CRITICAL' | 'AT_RISK' | 'MONITORING' | 'RESOLVED';

export interface DiseaseHotspot {
  id: number;
  scan: LeafScan;
  // The map pin - the farmer's registered farm location, not the scan's own
  // GPS reading (which can drift from where the photo was actually taken).
  latitude: string;
  longitude: string;
  status: HotspotStatus;
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction_deg: number;
  wind_cardinal: string;
  spread_velocity: number;
  is_active: boolean;
  updated_at: string;
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

export interface DashboardStatsSummary {
  forecast_accuracy: number | null;
  verified_forecasts: number;
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
