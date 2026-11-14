import { useCallback, useEffect, useRef, useState } from 'react'
import { searchFacilities } from '../api/facilityApi'

export function useFacilitySearch() {
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const request = useRef(null)

  const fetchFacilities = useCallback(async (keyword) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setLoadError(false)
    try {
      const result = await searchFacilities({ keyword, signal: controller.signal })
      if (!Array.isArray(result?.data?.items)) throw new Error('Danh sách địa điểm không hợp lệ.')
      if (!controller.signal.aborted) setFacilities(result.data.items)
    } catch {
      if (!controller.signal.aborted) setLoadError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => () => request.current?.abort(), [])
  return { facilities, loading, loadError, fetchFacilities }
}
