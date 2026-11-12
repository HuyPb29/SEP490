import { useContext } from 'react';
import { AUTH_ACTIONS, AuthContext, getAuthSnapshot } from '../contexts/authContextStore';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      ...getAuthSnapshot(),
      ...AUTH_ACTIONS,
    };
  }
  return ctx;
}

export default useAuth;
