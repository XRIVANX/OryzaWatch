// ─────────────────────────────────────────────────────────────────────────────
// OryzaWatch Mobile — Shared TypeScript Types
// Mirrors the Django backend models exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'FARMER' | 'KAGAWAD' | 'MAO_ADMIN';
export type Municipality = 'ASUNCION' | 'CARMEN';

// From: users/serializers.py → UserSerializer
export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  municipality: Municipality;
  barangay: string;
  phone_number: string | null;
}

// From: diagnostics/models.py → LeafScan
export type DiseaseType = 'HEALTHY' | 'BLB' | 'BLAST' | 'BROWN_SPOT';

export interface LesionBox {
  class: string;
  confidence: number;
  x: number;                   // normalised 0-1, top-left origin
  y: number;
  w: number;
  h: number;
}

export interface LeafScan {
  id: number;
  reporter: number;            // user ID
  image: string;               // URL to uploaded image
  detected_disease: DiseaseType;
  confidence_score: number;    // 0.0 – 1.0
  probabilities?: Record<string, number> | null;   // only present right after upload
  heatmap?: string | null;              // Grad-CAM overlay URL, once the classifier is trained
  segmentation_mask?: string | null;    // lesion overlay URL, once train_leaf_segmentation is trained
  affected_area_ratio?: number | null;  // 0.0 - 1.0, once train_leaf_segmentation is trained
  lesion_boxes?: LesionBox[] | null;    // once build_yolo_dataset + train_leaf_yolo are trained
  latitude: string;
  longitude: string;
  created_at: string;          // ISO 8601
}

// From: analytics/models.py → DiseaseHotspot
export type HotspotStatus = 'CRITICAL' | 'AT_RISK' | 'MONITORING' | 'RESOLVED';

export interface DiseaseHotspot {
  id: number;
  scan: LeafScan;
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

// From: alerts/models.py → Alert
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: number;
  hotspot: number | null;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_read: boolean;
  created_at: string;
}

// Auth API responses
export interface LoginResponse {
  access: string;
  refresh: string;
}

// Upload scan request body
export interface ScanUploadPayload {
  image: {
    uri: string;
    name: string;
    type: string;
  };
  latitude: number;
  longitude: number;
}
