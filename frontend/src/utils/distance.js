export function distanceKm(position, venue) {
  if (!position || venue.latitude == null || venue.longitude == null) return null
  const lat = Number(venue.latitude)
  const lng = Number(venue.longitude)
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) return null
  const radians = Math.PI / 180
  const halfLat = (lat - position.lat) * radians / 2
  const halfLng = (lng - position.lng) * radians / 2
  const a = Math.sin(halfLat) ** 2
    + Math.cos(position.lat * radians) * Math.cos(lat * radians) * Math.sin(halfLng) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}
