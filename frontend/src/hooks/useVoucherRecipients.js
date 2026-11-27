import { useCallback, useEffect, useState } from 'react'
import { findVoucherRecipients, listVoucherRecipients, grantVoucherRecipients } from '../api/voucherRecipientApi'
import { useResource } from './useResource'

export function useVoucherRecipients(locationId, voucherId, query, searchPage, grantPage) {
  const term = query.trim()
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300)
    return () => clearTimeout(timer)
  }, [term])
  const ready = term.length >= 2 && term === debounced
  const loadPlayers = useCallback(signal => ready
    ? findVoucherRecipients(locationId, { q: term, page: searchPage, size: 20 }, signal)
    : Promise.resolve(null), [locationId, term, ready, searchPage])
  const loadGrants = useCallback(signal => listVoucherRecipients(locationId, voucherId, grantPage, signal), [locationId, voucherId, grantPage])
  const players = useResource(loadPlayers, loadPlayers)
  const grants = useResource(loadGrants, loadGrants)
  return { players: { ...players, data: ready ? players.data : null, loading: term.length >= 2 && (!ready || players.loading) }, grants,
    grant: ids => grantVoucherRecipients(locationId, voucherId, ids) }
}
