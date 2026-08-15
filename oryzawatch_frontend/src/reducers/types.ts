import type { User } from '../types';
import type { ScanResultPayload } from '../actions/post';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface PostState {
  scanning: boolean;
  scanStage: string;
  scanPercent: number;
  result: ScanResultPayload | null;
  error: string | null;
}

export interface RootState {
  auth: AuthState;
  post: PostState;
}

export interface Action<T = any> {
  type: string;
  payload?: T;
}
