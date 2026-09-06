import apiClient from './client';
import type { DiseaseHotspot, HotspotStatus } from '../types';

export type BroadcastScope = 'BARANGAY' | 'MUNICIPALITY' | 'ALL';

export const analyticsApi = {
  async getHotspots(): Promise<DiseaseHotspot[]> {
    const res = await apiClient.get<DiseaseHotspot[]>('/api/analytics/hotspots/');
    return res.data;
  },

  async getHotspotDetail(id: number): Promise<DiseaseHotspot> {
    const res = await apiClient.get<DiseaseHotspot>(`/api/analytics/hotspots/${id}/`);
    return res.data;
  },

  /** Report one of the farmer's own positive scans as an outbreak. */
  async reportScan(scanId: number): Promise<DiseaseHotspot> {
    const res = await apiClient.post<DiseaseHotspot>('/api/analytics/hotspots/', { scan: scanId });
    return res.data;
  },

  /** Kagawad/Admin: change a hotspot's status (e.g. mark Safe/Resolved). */
  async updateStatus(id: number, status: HotspotStatus): Promise<DiseaseHotspot> {
    const res = await apiClient.patch<DiseaseHotspot>(`/api/analytics/hotspots/${id}/`, { status });
    return res.data;
  },

  /** Kagawad/Admin: broadcast a confirmed outbreak alert to farmers. */
  async broadcast(id: number, scope: BroadcastScope): Promise<{ notified: number }> {
    const res = await apiClient.post<{ notified: number }>(`/api/analytics/hotspots/${id}/broadcast/`, { scope });
    return res.data;
  },

  /** Kagawad/Admin: "Heat Map Mode" - project the downwind spread cone and
   * notify in-range farms. Returns the cone polygon to draw on the map. */
  async predict(id: number): Promise<PredictionResult> {
    const res = await apiClient.post<PredictionResult>(`/api/analytics/hotspots/${id}/predict/`, {});
    return res.data;
  },
};

export interface PredictionResult {
  hotspot_latitude: number;
  hotspot_longitude: number;
  cone: [number, number][];
  reach_km: number;
  daily_reach_km: number[];
  search_radius_km: number;
  wind_direction_deg: number;
  wind_cardinal: string;
  wind_speed: number;
  farms_in_cone: number;
  farms_outside_cone: number;
  notified: number;
}
