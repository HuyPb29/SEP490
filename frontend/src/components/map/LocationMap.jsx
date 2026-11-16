import { useState } from 'react'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function mercator(lat, lng) {
  const sin = Math.sin(clamp(lat, -85, 85) * Math.PI / 180)
  return { x: (lng + 180) / 360, y: .5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) }
}

function mapView(venues, fixedZoom) {
  const points = venues.map((venue) => mercator(Number(venue.latitude), Number(venue.longitude)))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  const zoom = fixedZoom ?? clamp(Math.floor(Math.log2(.6 / Math.max(width, height, .00001))), 1, 16)
  const tiles = 2 ** zoom
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2 * tiles
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2 * tiles
  return { zoom, tiles, left: centerX - 1, top: centerY - 1 }
}

export default function LocationMap({ venues, onSelect, onPick, initialCenter, pickDisabled = false }) {
  const [pin, setPin] = useState(null)
  const [pickerZoom, setPickerZoom] = useState(11)
  const points = venues.filter((venue) => venue.latitude != null && venue.longitude != null &&
    Number.isFinite(Number(venue.latitude)) && Math.abs(Number(venue.latitude)) <= 90 &&
    Number.isFinite(Number(venue.longitude)) && Math.abs(Number(venue.longitude)) <= 180)
  const selected = points.find((venue) => venue.facility_id === pin)
  const center = points.length ? points : initialCenter ? [initialCenter] : []
  if (!center.length) return <p>Chưa có địa điểm có tọa độ để hiển thị.</p>

  const { zoom, tiles, left, top } = mapView(center, initialCenter ? pickerZoom : undefined)
  const configuredTemplate = import.meta.env.VITE_LOCATION_MAP_TILE_URL
  const template = configuredTemplate || (initialCenter ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : '')
  function pickPoint(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = left + (event.clientX - bounds.left) / bounds.width * 2
    const y = top + (event.clientY - bounds.top) / bounds.height * 2
    const longitude = ((x / tiles * 360 % 360) + 360) % 360 - 180
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / tiles))) * 180 / Math.PI
    onPick(Number(latitude.toFixed(6)), Number(longitude.toFixed(6)))
  }
  const mapTiles = Array.from({ length: 9 }, (_, index) => {
    const x = Math.floor(left) + index % 3
    const y = Math.floor(top) + Math.floor(index / 3)
    return { x, y, url: template?.replace('{z}', zoom).replace('{x}', (x + tiles) % tiles).replace('{y}', y) }
  })
  return <section aria-label="Bản đồ địa điểm" className="relative">
    <div className="relative aspect-square overflow-hidden rounded-xl bg-emerald-50">
      {template && mapTiles.filter(({ y }) => y >= 0 && y < tiles).map(({ x, y, url }) =>
        <img key={x + ':' + y} src={url} alt="" draggable="false"
          className="pointer-events-none absolute !max-w-none" style={{ width: '50%', height: '50%', left: (x - left) * 50 + '%', top: (y - top) * 50 + '%' }} />)}
      {onPick && !pickDisabled && <div className="absolute inset-0 cursor-crosshair" onClick={pickPoint} />}
      {points.map((venue) => {
        const point = mercator(Number(venue.latitude), Number(venue.longitude))
        if (onPick) return <span key={venue.facility_id} aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800 px-2 py-1 text-white shadow"
          style={{ left: (point.x * tiles - left) * 50 + '%', top: (point.y * tiles - top) * 50 + '%' }}>●</span>
        return <button key={venue.facility_id} type="button" aria-label={'Ghim ' + venue.facility_name}
          aria-pressed={selected?.facility_id === venue.facility_id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800 px-2 py-1 text-white shadow"
          style={{ left: (point.x * tiles - left) * 50 + '%', top: (point.y * tiles - top) * 50 + '%' }}
          onClick={() => setPin(venue.facility_id)}>●</button>
      })}
    </div>
    {initialCenter && <div className="absolute left-2 top-2 flex gap-1">
      <button type="button" className="rounded bg-white px-2" aria-label="Thu nhỏ bản đồ"
        disabled={pickerZoom <= 4 || pickDisabled} onClick={() => setPickerZoom((value) => value - 1)}>−</button>
      <button type="button" className="rounded bg-white px-2" aria-label="Phóng to bản đồ"
        disabled={pickerZoom >= 18 || pickDisabled} onClick={() => setPickerZoom((value) => value + 1)}>+</button>
    </div>}
    {template && <small>{configuredTemplate ? import.meta.env.VITE_LOCATION_MAP_ATTRIBUTION
      : <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}</small>}
    {selected && <div className="mt-2 rounded-lg border border-emerald-200 p-3">
      <strong>{selected.facility_name}</strong>
      <p>{selected.address}</p>
      <button type="button" className="underline" onClick={() => onSelect(selected)}>Xem địa điểm</button>
    </div>}
  </section>
}
