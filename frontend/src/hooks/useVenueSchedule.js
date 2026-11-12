import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSavedUser, getToken } from '../api/session'
import { getVenueSchedule } from '../api/facilityApi'

function subscribe(listener) {
  window.addEventListener('bms-auth-change', listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener('bms-auth-change', listener)
    window.removeEventListener('storage', listener)
  }
}

export function useVenueSession() {
  const token = useSyncExternalStore(subscribe, getToken)
  return { token, user: token ? getSavedUser() : null }
}

export function useVenueSchedule(id, requestedDate, today, token, revision) {
  const [result, setResult] = useState(null)
  const sameViewer = result?.id === id && result.token === token
  const maxDate = sameViewer ? result.maxDate : null
  const date = maxDate && requestedDate >= today && requestedDate <= maxDate ? requestedDate : today
  useEffect(() => {
    const controller = new AbortController()
    getVenueSchedule(id, date, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ id, token, date, revision, maxDate: data.max_date, data })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult((previous) => ({
        id, token, date, revision,
        maxDate: previous?.id === id && previous.token === token ? previous.maxDate : null,
        error: error.response?.data?.message || 'Không tải được lịch sân.',
      }))
    })
    return () => controller.abort()
  }, [id, date, token, revision])
  const current = sameViewer && result.date === date && result.revision === revision ? result : null
  return { date, maxDate, current }
}
