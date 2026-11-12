import api from './index'

const adjustmentsPath = '/owner/loyalty-adjustments'

export async function findPointGrantPlayers(locationId, params, signal) {
  const { data } = await api.get(adjustmentsPath + '/players', { locationId, params, signal })
  return data.data
}

export async function findPointGrantBookings(locationId, playerId, params, signal) {
  const { data } = await api.get(`${adjustmentsPath}/players/${playerId}/bookings`, { locationId, params, signal })
  return data.data
}

export function grantPoints(locationId, payload) {
  return api.post(adjustmentsPath, payload, { locationId })
}
