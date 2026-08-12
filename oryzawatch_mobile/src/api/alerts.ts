import apiClient from './client';
import type { Alert } from '../types';

export const alertsApi = {
  async getAlerts(): Promise<Alert[]> {
    const res = await apiClient.get<Alert[]>('/api/alerts/');
    return res.data;
  },

  async markRead(alertId: number): Promise<void> {
    await apiClient.post(`/api/alerts/${alertId}/mark-read/`);
  },
};
