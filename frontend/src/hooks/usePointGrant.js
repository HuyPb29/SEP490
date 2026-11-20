import { useCallback, useEffect, useState } from 'react'
import { findPointGrantBookings, findPointGrantPlayers, grantPoints } from '../api/loyaltyApi'
import { useResource } from './useResource'

export function usePointGrant(locationId, playerId, playerSearch, bookingSearch) {
  const query = playerSearch.q.trim()
  const page = playerSearch.page
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  const ready = Boolean(query) && query === debouncedQuery
  const loadPlayers = useCallback(
    (signal) => ready ? findPointGrantPlayers(locationId, { q: query, page }, signal) : Promise.resolve(null),
    [locationId, page, query, ready],
  )
  const loadBookings = useCallback(
    (signal) => playerId ? findPointGrantBookings(locationId, playerId, bookingSearch, signal) : Promise.resolve(null),
    [locationId, playerId, bookingSearch],
  )
  const players = useResource(loadPlayers, loadPlayers)
  const bookings = useResource(loadBookings, loadBookings)
  return {
    players: query ? { ...players, loading: !ready || players.loading } : undefined,
    bookings,
    grant: (payload) => grantPoints(locationId, payload),
  }
}
