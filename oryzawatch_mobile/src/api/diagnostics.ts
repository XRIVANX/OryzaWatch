import apiClient from './client';
import type { LeafScan, RiceVariety } from '../types';

export const diagnosticsApi = {
  async getVarieties(): Promise<RiceVariety[]> {
    const res = await apiClient.get<RiceVariety[]>('/api/diagnostics/varieties/');
    return res.data;
  },
  async getScanHistory(): Promise<LeafScan[]> {
    const res = await apiClient.get<LeafScan[]>('/api/diagnostics/history/');
    return res.data;
  },

  /**
   * Upload a leaf image for AI diagnosis.
   * Uses multipart/form-data — do NOT use apiClient's default JSON header here.
   */
  async uploadScan(payload: {
    imageUri: string;
    imageName: string;
    imageType: string;
    latitude: number;
    longitude: number;
    variety?: number | null;
    growthStage?: string;
    symptomNotes?: string;
    observedOn?: string;
  }): Promise<LeafScan> {
    const formData = new FormData();
    formData.append('image', {
      uri: payload.imageUri,
      name: payload.imageName,
      type: payload.imageType,
    } as any);
    formData.append('latitude', payload.latitude.toString());
    formData.append('longitude', payload.longitude.toString());
    if (payload.variety != null) formData.append('variety', payload.variety.toString());
    if (payload.growthStage) formData.append('growth_stage', payload.growthStage);
    if (payload.symptomNotes) formData.append('symptom_notes', payload.symptomNotes);
    if (payload.observedOn) formData.append('observed_on', payload.observedOn);

    const res = await apiClient.post<LeafScan>('/api/diagnostics/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Upload over field mobile data plus server analysis (classifier,
      // heatmap, lesion mask, lesion boxes) can outlast the client's default
      // 15 s, especially on the first scan after the server starts.
      timeout: 60000,
    });
    return res.data;
  },
};
