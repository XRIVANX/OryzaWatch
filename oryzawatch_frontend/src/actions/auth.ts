import API from '../utils/api';
import type { User } from '../types';
import {
  AUTH_LOGIN_SUCCESS,
  AUTH_LOGOUT,
  AUTH_USER_LOADED,
} from './types';

export const loginSuccess = (user: User) => ({
  type: AUTH_LOGIN_SUCCESS,
  payload: user,
});

export const userLoaded = (user: User) => ({
  type: AUTH_USER_LOADED,
  payload: user,
});

export const logout = () => {
  localStorage.clear();
  return {
    type: AUTH_LOGOUT,
  };
};

export const fetchUserProfile = async () => {
  const response = await API.get<User>('auth/profile/');
  return response.data;
};
