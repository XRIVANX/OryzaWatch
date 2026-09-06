import apiClient from './client';
import type { Alert } from '../types';

export const alertsApi = {
  async getAlerts(): Promise<Alert[]> {
    const res = await apiClient.get<Alert[]>('/api/alerts/');
    return res.data;
  },

  async markRead(alertId: number): Promise<void> {
    // The backend view only accepts PUT/PATCH (UpdateAPIView) - is_read is
    // the only field the serializer allows a recipient to write.
    await apiClient.patch(`/api/alerts/${alertId}/mark-read/`, { is_read: true });
  },
};
