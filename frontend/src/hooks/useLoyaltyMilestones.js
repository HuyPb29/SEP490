import { useCallback } from 'react'
import { getPersonalLoyaltyProgress, listLoyaltyMilestones, saveLoyaltyMilestone } from '../api/loyaltyApi'
import { useResource } from './useResource'

export function useLoyaltyMilestones(locationId) {
  const load = useCallback((signal) => listLoyaltyMilestones(locationId, signal), [locationId])
  const milestones = useResource(load, locationId)
  return { milestones, save: (milestone, settings, active) => saveLoyaltyMilestone(locationId, milestone, settings, active) }
}

export function usePersonalLoyaltyProgress(locationId) {
  const load = useCallback((signal) => getPersonalLoyaltyProgress(locationId, signal), [locationId])
  return useResource(load, locationId)
}
