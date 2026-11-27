import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './LocationMap.css'
import { EmptyState, ErrorState, LoadingState } from '../common'
import VenueMapDetails from './VenueMapDetails'
import styles from './VenueMap.module.css'

// Ảnh bản đồ mặc định lấy từ Esri World Street Map, không cần API key.
// Muốn đổi nguồn ảnh thì đặt VITE_LOCATION_MAP_TILE_URL và VITE_LOCATION_MAP_ATTRIBUTION.
// const DEFAULT_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
// const DEFAULT_ATTRIBUTION = 'Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; OpenStreetMap contributors và cộng đồng GIS'
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const PIN_ZOOM = 16

// Dùng divIcon thay ảnh marker mặc định của Leaflet (ảnh mặc định bị lỗi đường dẫn khi build bằng Vite).
const venueIcon = (active = false) => L.divIcon({
  className: `bms-map-marker ${active ? 'bms-map-marker-active' : ''}`,
  html: '<span class="bms-map-pin" aria-hidden="true"></span>',
  iconSize: [44, 44],
  iconAnchor: [22, 44],
})
const pinIcon = venueIcon()

function validPoint(venue) {
  const lat = Number(venue?.latitude)
  const lng = Number(venue?.longitude)
  return venue?.latitude != null && venue?.longitude != null && venue.latitude !== '' && venue.longitude !== '' &&
    Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
}

/** Chế độ xem: căn bản đồ cho vừa mọi địa điểm mỗi khi danh sách thay đổi. */
function FitToVenues({ positions }) {
  const map = useMap()
  const key = positions.map((position) => position.join(',')).join(';')
  useEffect(() => {
    if (!positions.length) return
    if (positions.length === 1) map.setView(positions[0], PIN_ZOOM)
    else {
      const attributionHeight = map.getContainer().querySelector('.leaflet-control-attribution')?.offsetHeight || 40
      map.fitBounds(positions, { paddingTopLeft: [36, 48], paddingBottomRight: [36, attributionHeight + 44], maxZoom: PIN_ZOOM })
    }
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const pinKey = (lat, lng) => `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`

function ResizeMap() {
  const map = useMap()
  useEffect(() => {
    let frame
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }))
    })
    observer.observe(map.getContainer())
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [map])
  return null
}

/**
 * Chế độ chọn: bấm vào bản đồ để đặt ghim. Ghim do người dùng bấm hoặc kéo thì giữ nguyên khung nhìn;
 * ghim đặt từ bên ngoài (dữ liệu đã lưu tải về, GPS) thì đưa bản đồ tới ghim và phóng to.
 */
function PickHandler({ pin, onPick, disabled, userPickRef }) {
  const map = useMapEvents({
    keypress(event) {
      if (disabled || event.originalEvent.key !== 'Enter') return
      const { lat, lng } = map.getCenter().wrap()
      userPickRef.current = pinKey(lat, lng)
      onPick(lat, lng)
    },
    click(event) {
      if (disabled) return
      // wrap(): bản đồ lặp theo chiều ngang, đưa kinh độ về khoảng -180..180 trước khi lưu.
      const { lat, lng } = event.latlng.wrap()
      userPickRef.current = pinKey(lat, lng)
      onPick(lat, lng)
    },
  })
  const key = pin ? pinKey(pin[0], pin[1]) : ''
  useEffect(() => {
    if (!pin || key === userPickRef.current) return
    map.setView(pin, Math.max(map.getZoom(), PIN_ZOOM))
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LocationMap({ venues, onSelect, onPick, initialCenter, pickDisabled = false, activeVenueId }) {
  const [selectedId, setSelectedId] = useState(null)
  const [tileStatus, setTileStatus] = useState('loading')
  const [tileAttempt, setTileAttempt] = useState(0)
  const markerRefs = useRef({})
  const userPickRef = useRef('')
  const points = useMemo(() => venues.filter(validPoint), [venues])
  const positions = useMemo(() => points.map((venue) => [Number(venue.latitude), Number(venue.longitude)]), [points])
  const selected = points.find((venue) => venue.facility_id === selectedId)
  const picking = Boolean(onPick)

  if (!picking && !positions.length) return <EmptyState title="Địa điểm chưa có tọa độ" description="Chọn địa điểm trong danh sách để tiếp tục xem lịch sân." />

  const configuredTemplate = import.meta.env.VITE_LOCATION_MAP_TILE_URL
  const tileUrl = configuredTemplate || DEFAULT_TILE_URL
  const attribution = configuredTemplate ? (import.meta.env.VITE_LOCATION_MAP_ATTRIBUTION || '') : DEFAULT_ATTRIBUTION
  const start = positions[0] ?? [Number(initialCenter?.latitude ?? 21.028511), Number(initialCenter?.longitude ?? 105.854444)]
  const pin = picking ? positions[0] ?? null : null

  return <section aria-label="Bản đồ địa điểm" className={styles.frame}>
    {tileStatus === 'error' && <div className={styles.notice}><ErrorState message="Không tải được nền bản đồ. Các ghim và danh sách địa điểm vẫn dùng được." onRetry={() => { setTileStatus('loading'); setTileAttempt((value) => value + 1) }} /></div>}
    {tileStatus === 'loading' && <div className={styles.loading}><LoadingState message="Đang tải nền bản đồ…" /></div>}
    <MapContainer center={start} zoom={positions.length ? PIN_ZOOM : 12} scrollWheelZoom
      className={styles.canvas} style={{ cursor: picking && !pickDisabled ? 'crosshair' : undefined }}>
      <ResizeMap />
      <TileLayer key={tileAttempt} url={tileUrl} attribution={attribution} eventHandlers={{ load: () => setTileStatus((value) => value === 'error' ? value : 'ready'), tileerror: () => setTileStatus('error') }} />
      {picking
        ? <>
          <PickHandler pin={pin} onPick={onPick} disabled={pickDisabled} userPickRef={userPickRef} />
          {pin && <Marker position={pin} icon={pinIcon} draggable={!pickDisabled} title="Vị trí địa điểm" alt="Vị trí địa điểm"
            eventHandlers={{ dragend: (event) => {
              const { lat, lng } = event.target.getLatLng().wrap()
              userPickRef.current = pinKey(lat, lng)
              onPick(lat, lng)
            } }} />}
        </>
        : <>
          <FitToVenues positions={positions} />
          {points.map((venue, index) =>
            <Marker key={venue.facility_id} position={positions[index]}
              ref={(marker) => { if (marker) markerRefs.current[venue.facility_id] = marker; else delete markerRefs.current[venue.facility_id] }}
              icon={venueIcon(String(venue.facility_id) === String(activeVenueId) || venue.facility_id === selectedId)}
              zIndexOffset={String(venue.facility_id) === String(activeVenueId) || venue.facility_id === selectedId ? 1000 : 0}
              title={venue.facility_name ?? 'Vị trí địa điểm'} alt={venue.facility_name ?? 'Vị trí địa điểm'}
              eventHandlers={{
                click: () => setSelectedId(venue.facility_id),
                keydown: (event) => {
                  if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') {
                    event.originalEvent.preventDefault()
                    setSelectedId(venue.facility_id)
                  }
                },
              }} />)}
        </>}
    </MapContainer>
    {selected && <VenueMapDetails venue={selected} onSelect={onSelect} onClose={() => {
      const marker = markerRefs.current[selectedId]
      setSelectedId(null)
      requestAnimationFrame(() => marker?.getElement()?.focus())
    }} />}
  </section>
}
