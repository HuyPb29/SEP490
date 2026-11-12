import { useMemo, useSyncExternalStore } from 'react';
import {
  AUTH_ACTIONS,
  AuthContext,
  getAuthSnapshot,
  subscribeToAuth,
} from './authContextStore';

export function AuthProvider({ children }) {
  const snapshot = useSyncExternalStore(subscribeToAuth, getAuthSnapshot);

  const value = useMemo(
    () => ({
      ...snapshot,
      ...AUTH_ACTIONS,
    }),
    [snapshot]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
