import api from './index'

const adjustmentsPath = '/owner/loyalty-adjustments'
const milestonesPath = '/owner/loyalty-milestones'

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

export async function listLoyaltyMilestones(locationId, signal) {
  const { data } = await api.get(milestonesPath, { locationId, signal })
  return data.data
}

export function saveLoyaltyMilestone(locationId, milestone, settings, active) {
  if (!milestone) return api.post(milestonesPath, settings, { locationId })
  return api.patch(`${milestonesPath}/${milestone.id}`, {
    version: milestone.version, active, settings,
  }, { locationId })
}
