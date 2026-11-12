import { createContext } from 'react';
import {
  forgotPasswordApi,
  loginApi,
  logoutApi,
  registerPlayerApi,
  resendOtpApi,
  resetPasswordApi,
  verifyOtpApi,
} from '../api/authApi';
import {
  clearSession,
  getSavedUser,
  getSelectedLocation,
  getToken,
  roleHome,
  saveSession,
  selectLocation,
} from '../api/session';

export const AuthContext = createContext(null);

export function subscribeToAuth(listener) {
  window.addEventListener('bms-auth-change', listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('bms-auth-change', listener);
    window.removeEventListener('storage', listener);
  };
}

let cachedSnapshotKey = '';
let cachedSnapshot = {
  token: null,
  user: null,
  selectedLocationId: null,
  isAuthenticated: false,
  role: null,
};

export function getAuthSnapshot() {
  const token = getToken();
  const user = getSavedUser();
  const selectedLocationId = getSelectedLocation();
  const key = `${token ?? ''}|${user ? JSON.stringify(user) : ''}|${selectedLocationId ?? ''}`;
  if (key !== cachedSnapshotKey) {
    cachedSnapshotKey = key;
    cachedSnapshot = {
      token,
      user,
      selectedLocationId,
      isAuthenticated: Boolean(token && user),
      role: user?.role_code ?? null,
    };
  }
  return cachedSnapshot;
}

export const AUTH_ACTIONS = {
  roleHome,
  login: loginApi,
  logout: logoutApi,
  registerPlayer: registerPlayerApi,
  verifyOtp: verifyOtpApi,
  resendOtp: resendOtpApi,
  forgotPassword: forgotPasswordApi,
  resetPassword: resetPasswordApi,
  saveSession,
  clearSession,
  setSelectedVenue: selectLocation,
};
