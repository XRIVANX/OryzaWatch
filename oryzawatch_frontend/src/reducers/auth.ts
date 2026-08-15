import {
  AUTH_LOGIN_SUCCESS,
  AUTH_LOGOUT,
  AUTH_USER_LOADED,
} from '../actions/types';
import type { AuthState, Action } from './types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

export const authReducer = (state = initialState, action: Action): AuthState => {
  switch (action.type) {
    case AUTH_USER_LOADED:
    case AUTH_LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
        error: null,
      };
    case AUTH_LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      };
    default:
      return state;
  }
};

export default authReducer;
