/**
 * authStorage.js — centralized auth storage management.
 * Pure utility functions with zero React or Context dependencies.
 */

const TOKEN_KEY = 'token'
const ACCESS_TOKEN_KEY = 'bms_access_token'
const REFRESH_TOKEN_KEY = 'bms_refresh_token'
const USER_INFO_KEY = 'bms_user_info'

/**
 * Returns current access token or null if not logged in.
 */
export function getAccessToken() {
  try {
    return (
      localStorage.getItem(ACCESS_TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Returns parsed user object or null if not found.
 */
export function getStoredUser() {
  try {
    const raw =
      localStorage.getItem(USER_INFO_KEY) ||
      sessionStorage.getItem(USER_INFO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Saves auth session tokens and user profile to storage.
 */
export function saveAuthSession(accessToken, user, refreshToken = null) {
  try {
    if (accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
      localStorage.setItem(TOKEN_KEY, accessToken)
    }
    if (user) {
      localStorage.setItem(USER_INFO_KEY, typeof user === 'string' ? user : JSON.stringify(user))
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  } catch (err) {
    console.error('Failed to save auth session:', err)
  } finally {
    window.dispatchEvent(new Event('bms-auth-change'))
  }
}

/**
 * Completely clears all auth tokens and session details from localStorage & sessionStorage.
 */
export function clearAuthStorage() {
  const keys = [TOKEN_KEY, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_INFO_KEY]
  keys.forEach((k) => {
    try {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    } catch {
      // Ignore storage errors on clear
    }
  })
  window.dispatchEvent(new Event('bms-auth-change'))
}
