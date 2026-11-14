const tokenKey = 'bms_access_token'
const userKey = 'bms_user_info'
const locationKey = 'bms_selected_location'
const legacyLocationKey = 'bms_selected_location_id'

export const roleHome = {
  player: '/my-bookings',
  owner: '/owner/workspace',
  staff: '/staff/dashboard',
  admin: '/admin/workspace',
}

export function getSelectedLocation() {
  const fromSession = sessionStorage.getItem(locationKey)
  if (fromSession && fromSession !== 'undefined' && fromSession !== 'null') {
    return fromSession
  }
  const fromLocal = localStorage.getItem(legacyLocationKey)
  if (fromLocal && fromLocal !== 'undefined' && fromLocal !== 'null') {
    sessionStorage.setItem(locationKey, fromLocal)
    return fromLocal
  }
  return null
}

export function selectLocation(id) {
  if (id !== null && id !== undefined && id !== '') {
    const normalized = String(id)
    sessionStorage.setItem(locationKey, normalized)
    localStorage.setItem(legacyLocationKey, normalized)
  } else {
    sessionStorage.removeItem(locationKey)
    localStorage.removeItem(legacyLocationKey)
  }
  window.dispatchEvent(new Event('bms-auth-change'))
}

export function getToken() {
  for (const key of [tokenKey, 'token']) {
    const token = localStorage.getItem(key)
    if (token && token !== 'undefined' && token !== 'null' && !token.startsWith('mock_')) {
      return token
    }
  }
  return null
}

export function getSavedUser() {
  if (!getToken()) return null
  try {
    const raw = localStorage.getItem(userKey)
    if (raw) return JSON.parse(raw)
    const legacy = localStorage.getItem('user')
    if (legacy) {
      const parsed = JSON.parse(legacy)
      return {
        user_id: parsed.id ?? parsed.user_id,
        username: parsed.username,
        full_name: parsed.fullName ?? parsed.full_name,
        email: parsed.email,
        phone_number: parsed.phone ?? parsed.phone_number,
        role_code: String(parsed.role ?? parsed.role_code ?? '').toLowerCase(),
        facility_id: parsed.locationId ?? parsed.facility_id,
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveSession({ token, user }) {
  if (getSavedUser()?.user_id !== user.id) {
    sessionStorage.removeItem('active_holding_booking')
    selectLocation(null)
  }
  localStorage.removeItem('token')
  localStorage.removeItem('user')
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
  for (const key of [tokenKey, userKey, 'token', 'user', 'bms_refresh_token', legacyLocationKey]) {
    localStorage.removeItem(key)
  }
  sessionStorage.removeItem('active_holding_booking')
  sessionStorage.removeItem('pending_booking_selection')
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
