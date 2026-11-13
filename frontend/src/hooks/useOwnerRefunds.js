import { useCallback } from 'react'
import { loadOwnerRefund, loadOwnerRefunds, recordOwnerRefund } from '../api/ownerApi'
import { useResource } from './useResource'

export function useOwnerRefunds() {
  return useResource(loadOwnerRefunds)
}

export function useOwnerRefund(id) {
  const load = useCallback((signal) => loadOwnerRefund(id, signal), [id])
  const refund = useResource(load, id)
  return { ...refund, record: (form) => recordOwnerRefund(id, form) }
}
