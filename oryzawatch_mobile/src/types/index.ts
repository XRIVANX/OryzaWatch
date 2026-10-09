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
export type DiseaseType = 'HEALTHY' | 'BLB' | 'BLAST';

export interface RiceVariety {
  id: number;
  name: string;
  alternate_names: string;
  description: string;
  maturity_days: number | null;
  source: string;
  disease_evidence: {
    id: number;
    disease: 'BLB' | 'BLAST';
    response: string;
    response_label: string;
    source: string;
    notes: string;
  }[];
}

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
  reporter_username: string;
  image: string;               // URL to uploaded image
  detected_disease: DiseaseType;
  confidence_score: number;    // 0.0 – 1.0
  probabilities?: Record<string, number> | null;
  variety?: number | null;
  variety_name?: string | null;
  growth_stage?: string;
  symptom_notes?: string;
  observed_on?: string | null;
  verification_status?: 'UNREVIEWED' | 'VERIFIED' | 'INCONCLUSIVE';
  verified_disease?: DiseaseType | null;
  verification_method?: string;
  verification_notes?: string;
  verified_by_username?: string | null;
  verified_at?: string | null;
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

// From: farms/models.py → Farm
export interface Farm {
  id: number;
  farmer: number;               // user ID
  farmer_username: string;
  barangay: string;
  municipality: Municipality;
  latitude: string;
  longitude: string;
  boundary: [number, number][] | null;  // [lat, lng] points, closed ring
  size_hectares: number;
  created_at: string;
  updated_at: string;
}

export interface FarmUpsertPayload {
  latitude: number;
  longitude: number;
  boundary?: [number, number][] | null;
  size_hectares: number;
}

// From: alerts/models.py → Alert
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

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
