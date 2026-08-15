import {
  SCAN_START,
  SCAN_PROGRESS,
  SCAN_SUCCESS,
  SCAN_FAILURE,
  SCAN_RESET,
} from '../actions/types';
import type { PostState, Action } from './types';

const initialState: PostState = {
  scanning: false,
  scanStage: '',
  scanPercent: 0,
  result: null,
  error: null,
};

export const postReducer = (state = initialState, action: Action): PostState => {
  switch (action.type) {
    case SCAN_START:
      return {
        ...state,
        scanning: true,
        scanStage: 'Initializing optical leaf extraction...',
        scanPercent: 15,
        result: null,
        error: null,
      };
    case SCAN_PROGRESS:
      return {
        ...state,
        scanStage: action.payload.stage,
        scanPercent: action.payload.percent,
      };
    case SCAN_SUCCESS:
      return {
        ...state,
        scanning: false,
        scanStage: 'Classification complete',
        scanPercent: 100,
        result: action.payload,
        error: null,
      };
    case SCAN_FAILURE:
      return {
        ...state,
        scanning: false,
        scanStage: '',
        scanPercent: 0,
        error: action.payload,
      };
    case SCAN_RESET:
      return initialState;
    default:
      return state;
  }
};

export default postReducer;
