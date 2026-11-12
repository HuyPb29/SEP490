const tokenKey = 'bms_access_token'
const userKey = 'bms_user_info'
const locationKey = 'bms_selected_location'

export const roleHome = {
  player: '/',
  owner: '/owner/workspace',
  staff: '/staff/dashboard',
  admin: '/admin/workspace',
}

export function getSelectedLocation() {
  return sessionStorage.getItem(locationKey)
}

export function selectLocation(id) {
  if (id) sessionStorage.setItem(locationKey, String(id))
  else sessionStorage.removeItem(locationKey)
}

export function getToken() {
  const token = localStorage.getItem(tokenKey)
  return token && !token.startsWith('mock_') ? token : null
}

export function getSavedUser() {
  if (!getToken()) return null
  try {
    return JSON.parse(localStorage.getItem(userKey))
  } catch {
    return null
  }
}

export function saveSession({ token, user }) {
  if (getSavedUser()?.user_id !== user.id) {
    sessionStorage.removeItem('active_holding_booking')
    selectLocation(null)
  }
  localStorage.setItem(tokenKey, token)
  localStorage.setItem(userKey, JSON.stringify({
    user_id: user.id,
    username: user.username,
    full_name: user.fullName,
    email: user.email,
    phone_number: user.phone,
    role_code: user.role.toLowerCase(),
    facility_id: user.locationId,
  }))
  window.dispatchEvent(new Event('bms-auth-change'))
}

export function clearSession() {
  selectLocation(null)
  for (const key of [tokenKey, userKey, 'token', 'user', 'bms_refresh_token']) {
    localStorage.removeItem(key)
  }
  sessionStorage.removeItem('active_holding_booking')
  window.dispatchEvent(new Event('bms-auth-change'))
}

export function watchSessionExpiry(expired) {
  let timer
  let expiredToken
  function schedule() {
    clearTimeout(timer)
    const token = getToken()
    if (!token || token === expiredToken) return
    let expiresAt
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const { exp } = JSON.parse(atob(payload))
      if (!Number.isFinite(exp)) return
      expiresAt = exp * 1000
    } catch {
      return
    }
    const remaining = expiresAt - Date.now()
    if (remaining > 0) {
      timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647))
      return
    }
    expiredToken = token
    expired()
  }
  window.addEventListener('bms-auth-change', schedule)
  window.addEventListener('storage', schedule)
  document.addEventListener('visibilitychange', schedule)
  schedule()
  return () => {
    clearTimeout(timer)
    window.removeEventListener('bms-auth-change', schedule)
    window.removeEventListener('storage', schedule)
    document.removeEventListener('visibilitychange', schedule)
  }
}
