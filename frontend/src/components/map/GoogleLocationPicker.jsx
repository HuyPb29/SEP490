import { useEffect, useRef, useState } from 'react'
import { Button, LoadingState } from '../common'
import styles from './GoogleLocationPicker.module.css'

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

export default function GoogleLocationPicker({ point, onPick, disabled, fallback, className = '' }) {
  const container = useRef(null)
  const selection = useRef({ point, onPick, disabled })
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const userPick = useRef('')
  const [state, setState] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    selection.current = { point, onPick, disabled }
    if (markerRef.current) markerRef.current.gmpDraggable = !disabled
  }, [point, onPick, disabled])

  const latitude = point?.lat
  const longitude = point?.lng
  useEffect(() => {
    const point = latitude == null || longitude == null ? null : { lat: latitude, lng: longitude }
    if (mapRef.current && markerRef.current) {
      markerRef.current.position = point
      markerRef.current.map = point ? mapRef.current : null
      if (point && `${point.lat.toFixed(6)},${point.lng.toFixed(6)}` !== userPick.current) {
        mapRef.current.panTo(point)
        if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15)
      }
    }
  }, [latitude, longitude])

  useEffect(() => {
    if (!API_KEY) return undefined
    let active = true
    const listeners = []
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
          gmpDraggable: !selection.current.disabled,
        })
        const pick = (latLng) => {
          if (!latLng || selection.current.disabled) return
          const lat = latLng.lat()
          const lng = ((latLng.lng() + 180) % 360 + 360) % 360 - 180
          userPick.current = `${lat.toFixed(6)},${lng.toFixed(6)}`
          selection.current.onPick?.(lat, lng)
        }
        listeners.push(map.addListener('click', ({ latLng }) => pick(latLng)))
        listeners.push(markerRef.current.addListener('dragend', ({ latLng }) => pick(latLng)))
        setState('ready')
      })
      .catch(onAuthFailure)

    return () => {
      active = false
      listeners.forEach((listener) => listener.remove())
      if (markerRef.current) markerRef.current.map = null
      markerRef.current = null
      mapRef.current = null
      if (window.gm_authFailure === onAuthFailure) window.gm_authFailure = previousAuthFailure
    }
  }, [attempt])

  if (!API_KEY) return fallback
  if (state === 'error') {
    return <>
      <div className={styles.notice}><p role="status">Google Maps chưa tải được. Bạn vẫn có thể ghim vị trí trên bản đồ bên dưới.</p><Button variant="secondary" disabled={disabled} onClick={() => { setState('loading'); setAttempt(value => value + 1) }}>Thử lại Google Maps</Button></div>
      {fallback}
    </>
  }
  return <>
    {state === 'loading' && <LoadingState message="Đang tải bản đồ chọn vị trí…" />}
    <div ref={container} tabIndex={0} onKeyDown={(event) => {
      if (event.key !== 'Enter' || event.target !== event.currentTarget || selection.current.disabled) return
      const center = mapRef.current?.getCenter()
      if (!center) return
      event.preventDefault()
      const lat = center.lat()
      const lng = ((center.lng() + 180) % 360 + 360) % 360 - 180
      userPick.current = `${lat.toFixed(6)},${lng.toFixed(6)}`
      selection.current.onPick?.(lat, lng)
    }} className={className || styles.canvas} aria-label="Google Maps chọn vị trí" />
  </>
}
