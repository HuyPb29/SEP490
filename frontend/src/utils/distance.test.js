import { describe, expect, it } from 'vitest'
import { distanceKm } from './distance'

// UC11, FR29: cho phép lấy vị trí thì xếp địa điểm gần → xa theo khoảng cách đường thẳng.
describe('distanceKm', () => {
  const hoanKiem = { lat: 21.0285, lng: 105.8542 }

  it('cùng một điểm thì 0 km', () => {
    expect(distanceKm(hoanKiem, { latitude: 21.0285, longitude: 105.8542 })).toBeCloseTo(0, 6)
  })

  it('Hà Nội đến TP.HCM khoảng 1.140 km đường thẳng', () => {
    const km = distanceKm(hoanKiem, { latitude: 10.7769, longitude: 106.7009 })
    expect(km).toBeGreaterThan(1130)
    expect(km).toBeLessThan(1145)
  })

  it('tọa độ dạng chuỗi từ API vẫn tính được', () => {
    expect(distanceKm(hoanKiem, { latitude: '21.0285', longitude: '105.8642' })).toBeCloseTo(1.04, 1)
  })

  it('chưa có vị trí người dùng hoặc địa điểm chưa ghim thì không tính', () => {
    expect(distanceKm(null, { latitude: 21, longitude: 105 })).toBeNull()
    expect(distanceKm(hoanKiem, { latitude: null, longitude: 105 })).toBeNull()
    expect(distanceKm(hoanKiem, {})).toBeNull()
  })

  it('tọa độ sai thì không tính', () => {
    expect(distanceKm(hoanKiem, { latitude: 95, longitude: 105 })).toBeNull()
    expect(distanceKm(hoanKiem, { latitude: 21, longitude: 190 })).toBeNull()
    expect(distanceKm(hoanKiem, { latitude: 'abc', longitude: 105 })).toBeNull()
  })
})
