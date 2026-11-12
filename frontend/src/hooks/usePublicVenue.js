import { useCallback, useEffect, useState } from 'react'
import { getPublicVenue, getVenueReviews } from '../api/facilityApi'

export function useVenueReviews(id, page) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((current) => current + 1), [])
  const key = id + ':' + page + ':' + revision
  useEffect(() => {
    const controller = new AbortController()
    getVenueReviews(id, page, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, error: true })
    })
    return () => controller.abort()
  }, [id, key, page])
  return { current: result?.key === key ? result : null, retry }
}

export function usePublicVenue(id, revision) {
  const [result, setResult] = useState(null)
  const key = id + ':' + revision
  useEffect(() => {
    const controller = new AbortController()
    getPublicVenue(id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ key, error: error.response?.data?.message || 'Không tải được địa điểm.' })
    })
    return () => controller.abort()
  }, [id, key])
  return result?.key === key ? result : null
}
