import API from '../utils/api';
import {
  SCAN_START,
  SCAN_PROGRESS,
  SCAN_SUCCESS,
  SCAN_FAILURE,
  SCAN_RESET,
} from './types';

export interface ScanResultPayload {
  detected_disease: string;
  confidence_score: number;
  latitude?: string;
  longitude?: string;
  scan_id?: string | number;
}

export const startScan = () => ({
  type: SCAN_START,
});

export const updateScanProgress = (stage: string, percent: number) => ({
  type: SCAN_PROGRESS,
  payload: { stage, percent },
});

export const scanSuccess = (result: ScanResultPayload) => ({
  type: SCAN_SUCCESS,
  payload: result,
});

export const scanFailure = (error: string) => ({
  type: SCAN_FAILURE,
  payload: error,
});

export const resetScan = () => ({
  type: SCAN_RESET,
});

export const uploadDiagnosticImage = async (
  image: File,
  latitude: string,
  longitude: string
) => {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);

  const response = await API.post<ScanResultPayload>('diagnostics/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
