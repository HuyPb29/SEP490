import { Button as UiButton } from '../ui';
import { useEffect, useRef, useState } from 'react'
import { hasGoogleMapsKey, loadMaps } from './GoogleLocationPicker'

export default function GoogleAddressInput({ address, onSelect, onClear, disabled, fallback }) {
  const host = useRef(null)
  const handlers = useRef({ onSelect, disabled })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    handlers.current = { onSelect, disabled }
  }, [onSelect, disabled])

  useEffect(() => {
    if (!hasGoogleMapsKey || address) return undefined
    let active = true
    let widget
    let selection = 0
    setStatus('loading')
    setError('')

    async function selectAddress({ placePrediction }) {
      if (handlers.current.disabled) return
      const request = ++selection
      setError('')
      try {
        const place = placePrediction.toPlace()
        await place.fetchFields({ fields: ['formattedAddress', 'location'] })
        if (!active || request !== selection || handlers.current.disabled) return
        if (!place.formattedAddress || !place.location) {
          setError('Địa điểm này chưa có địa chỉ đầy đủ. Hãy chọn gợi ý khác.')
          return
        }
        handlers.current.onSelect(place.formattedAddress, place.location.lat(), place.location.lng())
      } catch {
        if (active && request === selection) setError('Không lấy được địa chỉ từ Google Maps. Hãy chọn lại.')
      }
    }

    function showFallback() {
      if (active) setStatus('error')
    }

    loadMaps()
      .then((maps) => maps.importLibrary('places'))
      .then(({ PlaceAutocompleteElement }) => {
        if (!active) return
        widget = new PlaceAutocompleteElement({ includedRegionCodes: ['vn'] })
        widget.placeholder = 'Nhập địa chỉ và chọn một gợi ý'
        widget.setAttribute('aria-label', 'Tìm địa chỉ trên Google Maps')
        widget.style.width = '100%'
        widget.addEventListener('gmp-select', selectAddress)
        widget.addEventListener('gmp-error', showFallback)
        host.current.append(widget)
        setStatus('ready')
      })
      .catch(showFallback)

    return () => {
      active = false
      widget?.removeEventListener('gmp-select', selectAddress)
      widget?.removeEventListener('gmp-error', showFallback)
      widget?.remove()
    }
  }, [address])

  if (!hasGoogleMapsKey || status === 'error') {
    return <>
      {hasGoogleMapsKey && <p role="status">Không tải được gợi ý Google Maps. Hãy nhập địa chỉ và ghim trên bản đồ.</p>}
      {fallback}
    </>
  }
  if (address) {
    return <div>
      <p>{address}</p>
      <UiButton variant="custom" type="button" disabled={disabled} onClick={onClear} className="underline">Đổi địa chỉ</UiButton>
    </div>
  }
  return <>
    {status === 'loading' && <p role="status">Đang tải tìm kiếm địa chỉ…</p>}
    <div ref={host} inert={disabled} />
    {error && <p role="alert">{error}</p>}
  </>
}
