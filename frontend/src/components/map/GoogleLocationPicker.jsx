import { useEffect, useRef, useState } from 'react'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
export const hasGoogleMapsKey = Boolean(API_KEY)
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
const DEFAULT_CENTER = { lat: 21.028511, lng: 105.854444 }
let loadingMaps

export function loadMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  if (!loadingMaps) {
    loadingMaps = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      const callback = 'courtlyGoogleMapsReady'
      const previousAuthFailure = window.gm_authFailure
      const cleanup = () => {
        clearTimeout(timeout)
        delete window[callback]
        window.gm_authFailure = previousAuthFailure
      }
      const fail = () => {
        cleanup()
        script.remove()
        reject(new Error("Không tải được Google Maps"))
      }
      const timeout = setTimeout(fail, 15000)
      window[callback] = () => {
        cleanup()
        resolve(window.google.maps)
      }
      window.gm_authFailure = fail
      script.async = true
      script.onerror = fail
      const params = new URLSearchParams({ key: API_KEY, loading: 'async', callback, v: 'quarterly', language: 'vi', region: 'VN' })
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`
      document.head.append(script)
    }).catch((error) => {
      loadingMaps = undefined
      throw error
    })
  }
  return loadingMaps
}

export default function GoogleLocationPicker({ point, onPick, disabled, fallback }) {
  const container = useRef(null)
  const selection = useRef({ point, onPick, disabled })
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    selection.current = { point, onPick, disabled }
    if (mapRef.current && markerRef.current) {
      markerRef.current.position = point
      markerRef.current.map = point ? mapRef.current : null
      if (point) {
        mapRef.current.panTo(point)
        if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15)
      }
    }
  }, [point, onPick, disabled])

  useEffect(() => {
    if (!API_KEY) return undefined
    let active = true
    let listener
    const previousAuthFailure = window.gm_authFailure
    const onAuthFailure = () => {
      if (active) setState('error')
    }
    loadMaps()
      .then(async (maps) => {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
        ])
        if (!active) return
        window.gm_authFailure = onAuthFailure
        const center = selection.current.point
        const map = new Map(container.current, {
          center: center ?? DEFAULT_CENTER,
          zoom: center ? 15 : 11,
          mapId: MAP_ID,
          streetViewControl: false,
          mapTypeControl: false,
        })
        mapRef.current = map
        markerRef.current = new AdvancedMarkerElement({
          map: center ? map : null,
          position: center,
          title: 'Vị trí địa điểm',
        })
        listener = map.addListener('click', ({ latLng }) => {
          if (latLng && !selection.current.disabled) selection.current.onPick?.(latLng.lat(), latLng.lng())
        })
        setState('ready')
      })
      .catch(onAuthFailure)

    return () => {
      active = false
      listener?.remove()
      if (markerRef.current) markerRef.current.map = null
      markerRef.current = null
      mapRef.current = null
      if (window.gm_authFailure === onAuthFailure) window.gm_authFailure = previousAuthFailure
    }
  }, [])

  if (!API_KEY) return fallback
  if (state === 'error') {
    return <>
      <p role="status">Google Maps chưa tải được. Bạn vẫn có thể ghim vị trí trên bản đồ bên dưới.</p>
      {fallback}
    </>
  }
  return <>
    {state === 'loading' && <p role="status">Đang tải Google Maps…</p>}
    <div ref={container} className="aspect-square w-full rounded-xl" aria-label="Google Maps chọn vị trí" />
  </>
}
