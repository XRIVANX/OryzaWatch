import apiClient from './client';
import type { LeafScan } from '../types';

export const diagnosticsApi = {
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
  }): Promise<LeafScan> {
    const formData = new FormData();
    formData.append('image', {
      uri: payload.imageUri,
      name: payload.imageName,
      type: payload.imageType,
    } as any);
    formData.append('latitude', payload.latitude.toString());
    formData.append('longitude', payload.longitude.toString());

    const res = await apiClient.post<LeafScan>('/api/diagnostics/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
