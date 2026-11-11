const tokenKey = 'bms_access_token'
const userKey = 'bms_user_info'
const locationKey = 'bms_selected_location'

export const roleHome = {
  player: '/',
  owner: '/owner/workspace',
  staff: '/staff/confirm-payments',
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
