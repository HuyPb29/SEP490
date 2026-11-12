import { useState } from 'react'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function mercator(lat, lng) {
  const sin = Math.sin(clamp(lat, -85, 85) * Math.PI / 180)
  return { x: (lng + 180) / 360, y: .5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) }
}

function mapView(venues) {
  const points = venues.map((venue) => mercator(Number(venue.latitude), Number(venue.longitude)))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  const zoom = clamp(Math.floor(Math.log2(.6 / Math.max(width, height, .00001))), 1, 16)
  const tiles = 2 ** zoom
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2 * tiles
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2 * tiles
  return { zoom, tiles, left: centerX - 1, top: centerY - 1 }
}

export default function LocationMap({ venues, onSelect }) {
  const [pin, setPin] = useState(null)
  const points = venues.filter((venue) => venue.latitude != null && venue.longitude != null &&
    Number.isFinite(Number(venue.latitude)) && Math.abs(Number(venue.latitude)) <= 90 &&
    Number.isFinite(Number(venue.longitude)) && Math.abs(Number(venue.longitude)) <= 180)
  const selected = points.find((venue) => venue.facility_id === pin)
  if (!points.length) return <p>Chưa có địa điểm có tọa độ để hiển thị.</p>

  const { zoom, tiles, left, top } = mapView(points)
  const template = import.meta.env.VITE_LOCATION_MAP_TILE_URL
  const mapTiles = Array.from({ length: 9 }, (_, index) => {
    const x = Math.floor(left) + index % 3
    const y = Math.floor(top) + Math.floor(index / 3)
    return { x, y, url: template?.replace('{z}', zoom).replace('{x}', (x + tiles) % tiles).replace('{y}', y) }
  })
  return <section aria-label="Bản đồ địa điểm" className="relative">
    <div className="relative aspect-square overflow-hidden rounded-xl bg-emerald-50">
      {template && mapTiles.filter(({ y }) => y >= 0 && y < tiles).map(({ x, y, url }) =>
        <img key={x + ':' + y} src={url} alt="" referrerPolicy="no-referrer" draggable="false"
          className="pointer-events-none absolute !max-w-none" style={{ width: '50%', height: '50%', left: (x - left) * 50 + '%', top: (y - top) * 50 + '%' }} />)}
      {points.map((venue) => {
        const point = mercator(Number(venue.latitude), Number(venue.longitude))
        return <button key={venue.facility_id} type="button" aria-label={'Ghim ' + venue.facility_name}
          aria-pressed={selected?.facility_id === venue.facility_id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800 px-2 py-1 text-white shadow"
          style={{ left: (point.x * tiles - left) * 50 + '%', top: (point.y * tiles - top) * 50 + '%' }}
          onClick={() => setPin(venue.facility_id)}>●</button>
      })}
    </div>
    {template && <small>{import.meta.env.VITE_LOCATION_MAP_ATTRIBUTION}</small>}
    {selected && <div className="mt-2 rounded-lg border border-emerald-200 p-3">
      <strong>{selected.facility_name}</strong>
      <p>{selected.address}</p>
      <button type="button" className="underline" onClick={() => onSelect(selected)}>Xem địa điểm</button>
    </div>}
  </section>
}
