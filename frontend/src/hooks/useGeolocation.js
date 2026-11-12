import { useState } from 'react'

export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  function requestLocation() {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ lấy vị trí. Bạn vẫn có thể tìm theo tên hoặc địa chỉ.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition({ lat: coords.latitude, lng: coords.longitude })
      setLocating(false)
    }, () => {
      setPosition(null)
      setLocating(false)
      setLocationError('Không lấy được vị trí. Bạn vẫn có thể tìm theo tên hoặc địa chỉ.')
    }, { timeout: 10_000 })
  }

  return { position, locating, locationError, requestLocation }
}
