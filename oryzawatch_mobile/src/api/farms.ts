import apiClient from './client';
import type { Farm, FarmUpsertPayload } from '../types';

export const farmsApi = {
  /** The logged-in farmer's own farm, or `null` if they haven't set one up yet. */
  async getMine(): Promise<Farm | null> {
    try {
      const res = await apiClient.get<Farm>('/api/farms/me/');
      return res.data;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  /** Create or update the logged-in farmer's own farm in one call. */
  async upsertMine(payload: FarmUpsertPayload): Promise<Farm> {
    const res = await apiClient.put<Farm>('/api/farms/me/', payload);
    return res.data;
  },

  /** All registered farms — Kagawad/Admin only, feeds the MAO dashboard map. */
  async getAll(): Promise<Farm[]> {
    const res = await apiClient.get<Farm[]>('/api/farms/');
    return res.data;
  },

  /** Kagawad/Admin viewing or correcting a specific farmer's farm. */
  async update(id: number, payload: Partial<FarmUpsertPayload>): Promise<Farm> {
    const res = await apiClient.patch<Farm>(`/api/farms/${id}/`, payload);
    return res.data;
  },
};
