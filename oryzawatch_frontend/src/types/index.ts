// ─── Auth & User ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'agronomist' | 'farmer';
  barangay?: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

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
  confidence: number;        // 0–100
  detectedAt: string;        // ISO date string
  status: DiseaseStatus;
  location: {
    barangay: string;
    lat: number;
    lng: number;
  };
}

// ─── Farm / Map ───────────────────────────────────────────────────────────────

export interface Farm {
  id: string;
  name: string;
  barangay: string;
  area: number;              // hectares
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
