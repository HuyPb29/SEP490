import { useEffect, useMemo, useRef, useState } from 'react'
import { hasGoogleMapsKey, loadMaps, MAP_ID } from './GoogleLocationPicker'
import LocationMap from './LocationMap'

function venuePoints(venues) {
  return venues.flatMap((venue) => {
    if (venue.latitude == null || venue.longitude == null ||
        String(venue.latitude).trim() === '' || String(venue.longitude).trim() === '') return []
    const lat = Number(venue.latitude)
    const lng = Number(venue.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    return [{ venue, position: { lat, lng } }]
  })
}

function VenueMarkers({ points, onSelect, fallback }) {
  const container = useRef(null)
  const [map, setMap] = useState(null)
  const [failed, setFailed] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const selected = points.find(({ venue }) => venue.facility_id === selectedId)?.venue

  useEffect(() => {
    let active = true
    const previousAuthFailure = window.gm_authFailure
    const onError = () => { if (active) setFailed(true) }
    loadMaps()
      .then(async (maps) => {
        const [{ Map }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
          maps.importLibrary('core'),
        ])
        if (!active) return
        window.gm_authFailure = onError
        const instance = new Map(container.current, {
          mapId: MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        })
        setMap({ instance, AdvancedMarkerElement, LatLngBounds })
      })
      .catch(onError)
    return () => {
      active = false
      if (window.gm_authFailure === onError) window.gm_authFailure = previousAuthFailure
    }
  }, [])

  useEffect(() => {
    if (!map || failed) return undefined
    const { instance, AdvancedMarkerElement, LatLngBounds } = map
    const bounds = new LatLngBounds()
    const markers = points.map(({ venue, position }) => {
      bounds.extend(position)
      const marker = new AdvancedMarkerElement({ map: instance, position, title: venue.facility_name })
      const listener = marker.addListener('click', () => setSelectedId(venue.facility_id))
      return { marker, listener }
    })
    if (points.length === 1 || bounds.getNorthEast().equals(bounds.getSouthWest())) {
      instance.setCenter(points[0].position)
      instance.setZoom(15)
    } else {
      instance.fitBounds(bounds, 44)
    }
    return () => {
      for (const { marker, listener } of markers) {
        listener.remove()
        marker.map = null
      }
    }
  }, [map, points, failed])

  if (failed) return <>
    <p role="status">Google Maps không tải được. Bạn vẫn có thể mở địa điểm từ danh sách.</p>
    {fallback}
  </>

  return <section aria-label="Bản đồ sân cầu lông">
    {!map && <p role="status">Đang tải bản đồ…</p>}
    <div ref={container} className="aspect-square w-full rounded-xl" />
    {selected && <div className="mt-2 rounded-lg border border-emerald-200 p-3">
      <strong>{selected.facility_name}</strong>
      <p>{selected.address}</p>
      <button type="button" className="underline" onClick={() => onSelect(selected)}>Xem lịch sân</button>
    </div>}
  </section>
}

export default function GoogleVenueMap({ venues, onSelect }) {
  const points = useMemo(() => venuePoints(venues), [venues])
  if (!points.length) return <p>Chưa có địa điểm có tọa độ trong kết quả tìm kiếm.</p>

  const fallback = <LocationMap venues={points.map(({ venue }) => venue)} onSelect={onSelect} />
  if (!hasGoogleMapsKey) return fallback
  return <VenueMarkers points={points} onSelect={onSelect} fallback={fallback} />
}
