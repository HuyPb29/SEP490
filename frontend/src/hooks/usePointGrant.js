import { useCallback } from 'react'
import { findPointGrantBookings, findPointGrantPlayers, grantPoints } from '../api/loyaltyApi'
import { useResource } from './useResource'

export function usePointGrant(locationId, playerId, playerSearch, bookingSearch) {
  const loadPlayers = useCallback(
    (signal) => findPointGrantPlayers(locationId, playerSearch, signal),
    [locationId, playerSearch],
  )
  const loadBookings = useCallback(
    (signal) => playerId ? findPointGrantBookings(locationId, playerId, bookingSearch, signal) : Promise.resolve(null),
    [locationId, playerId, bookingSearch],
  )
  const players = useResource(loadPlayers, loadPlayers)
  const bookings = useResource(loadBookings, loadBookings)
  return { players, bookings, grant: (payload) => grantPoints(locationId, payload) }
}
