import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Ảnh bản đồ mặc định lấy từ OpenStreetMap (miễn phí, không cần API key).
// Muốn đổi nguồn ảnh thì đặt VITE_LOCATION_MAP_TILE_URL và VITE_LOCATION_MAP_ATTRIBUTION.
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
const PIN_ZOOM = 16

// Dùng divIcon thay ảnh marker mặc định của Leaflet (ảnh mặc định bị lỗi đường dẫn khi build bằng Vite).
const pinIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#065f46;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

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
    else map.fitBounds(positions, { padding: [24, 24], maxZoom: PIN_ZOOM })
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Chế độ chọn: bấm vào bản đồ để đặt ghim; ghim đổi từ bên ngoài (GPS, dán tọa độ) thì đưa bản đồ tới đó. */
function PickHandler({ pin, onPick, disabled }) {
  const map = useMapEvents({
    click(event) {
      // wrap(): bản đồ lặp theo chiều ngang, đưa kinh độ về khoảng -180..180 trước khi lưu.
      if (!disabled) { const { lat, lng } = event.latlng.wrap(); onPick(lat, lng) }
    },
  })
  const key = pin ? pin.join(',') : ''
  useEffect(() => {
    if (pin && !map.getBounds().contains(pin)) map.setView(pin, Math.max(map.getZoom(), PIN_ZOOM))
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LocationMap({ venues, onSelect, onPick, initialCenter, pickDisabled = false }) {
  const [selectedId, setSelectedId] = useState(null)
  const points = useMemo(() => venues.filter(validPoint), [venues])
  const positions = useMemo(() => points.map((venue) => [Number(venue.latitude), Number(venue.longitude)]), [points])
  const selected = points.find((venue) => venue.facility_id === selectedId)
  const picking = Boolean(onPick)

  if (!picking && !positions.length) return <p>Chưa có địa điểm có tọa độ để hiển thị.</p>

  const configuredTemplate = import.meta.env.VITE_LOCATION_MAP_TILE_URL
  const tileUrl = configuredTemplate || OSM_TILE_URL
  const attribution = configuredTemplate ? (import.meta.env.VITE_LOCATION_MAP_ATTRIBUTION || '') : OSM_ATTRIBUTION
  const start = positions[0] ?? [Number(initialCenter?.latitude ?? 21.028511), Number(initialCenter?.longitude ?? 105.854444)]
  const pin = picking ? positions[0] ?? null : null

  return <section aria-label="Bản đồ địa điểm" className="relative">
    <MapContainer center={start} zoom={positions.length ? PIN_ZOOM : 12} scrollWheelZoom
      style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 12, cursor: picking && !pickDisabled ? 'crosshair' : undefined }}>
      <TileLayer url={tileUrl} attribution={attribution} />
      {picking
        ? <>
          <PickHandler pin={pin} onPick={onPick} disabled={pickDisabled} />
          {pin && <Marker position={pin} icon={pinIcon} draggable={!pickDisabled} title="Vị trí địa điểm" alt="Vị trí địa điểm"
            eventHandlers={{ dragend: (event) => { const { lat, lng } = event.target.getLatLng().wrap(); onPick(lat, lng) } }} />}
        </>
        : <>
          <FitToVenues positions={positions} />
          {points.map((venue, index) =>
            <Marker key={venue.facility_id} position={positions[index]} icon={pinIcon}
              title={'Ghim ' + (venue.facility_name ?? '')} alt={'Ghim ' + (venue.facility_name ?? '')}
              eventHandlers={{ click: () => setSelectedId(venue.facility_id) }} />)}
        </>}
    </MapContainer>
    {selected && <div className="mt-2 rounded-lg border border-emerald-200 p-3">
      <strong>{selected.facility_name}</strong>
      <p>{selected.address}</p>
      <button type="button" className="underline" onClick={() => onSelect(selected)}>Xem địa điểm</button>
    </div>}
  </section>
}
