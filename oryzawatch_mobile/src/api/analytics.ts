import apiClient from './client';
import type { DiseaseHotspot } from '../types';

export const analyticsApi = {
  async getHotspots(): Promise<DiseaseHotspot[]> {
    const res = await apiClient.get<DiseaseHotspot[]>('/api/analytics/hotspots/');
    return res.data;
  },

  async getHotspotDetail(id: number): Promise<DiseaseHotspot> {
    const res = await apiClient.get<DiseaseHotspot>(`/api/analytics/hotspots/${id}/`);
    return res.data;
  },
};
