import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index', () => ({ default: { get: vi.fn() } }))

import api from './index'
import { getFacilityDetailAndSchedule, getPublicVenue, getVenueSchedule, mapSchedule, searchFacilities } from './facilityApi'

// API công khai F3: tìm địa điểm (UC11), thông tin địa điểm và bảng giá (UC12), lịch sân (UC13).
const ok = (data) => ({ data: { data } })

function routes(table) {
  vi.mocked(api.get).mockImplementation(async (path) => {
    const value = table[path]
    if (value === undefined) throw new Error('Không mong đợi gọi ' + path)
    if (value instanceof Error) throw value
    return ok(value)
  })
}

beforeEach(() => { vi.mocked(api.get).mockReset() })

describe('searchFacilities (UC11)', () => {
  it('cắt khoảng trắng của từ khóa, thêm tên trường cũ cho màn hình', async () => {
    vi.mocked(api.get).mockResolvedValue(ok([{ id: 1, name: 'Sân Linh Đàm' }]))

    const result = await searchFacilities({ keyword: '  linh dam ' })

    expect(api.get).toHaveBeenCalledWith('/locations', { params: { q: 'linh dam' }, signal: undefined })
    expect(result).toEqual({ success: true, data: { items: [
      { id: 1, name: 'Sân Linh Đàm', facility_id: 1, facility_name: 'Sân Linh Đàm' },
    ] } })
  })

  it('không nhập từ khóa thì không gửi q', async () => {
    vi.mocked(api.get).mockResolvedValue(ok([]))

    await searchFacilities()

    expect(api.get).toHaveBeenCalledWith('/locations', { params: {}, signal: undefined })
  })
})

describe('getPublicVenue (UC12)', () => {
  const detail = {
    id: 1, name: 'Sân Linh Đàm', contactPhone: '0912345678',
    openingHours: [{ dayOfWeek: 1, openTime: '06:00', closeTime: '22:00' }, { dayOfWeek: 7, openTime: '05:00', closeTime: '23:00' }],
  }

  it('ghép thông tin, danh sách sân, bảng giá và điểm đánh giá', async () => {
    routes({
      '/locations/1': detail,
      '/locations/1/courts': [{ id: 5, name: 'Sân 1' }],
      '/locations/1/review-summary': { averageRating: 4.5, reviewCount: 12 },
      '/courts/5': { id: 5, name: 'Sân 1', priceRules: [
        { id: 9, applyDays: [7, 1], startTime: '06:00', endTime: '17:00', pricePerSlot: 60000, validFrom: '2026-11-01' },
        { id: 10, applyDays: [], startTime: '17:00', endTime: '22:00', pricePerSlot: 90000 },
      ] },
    })

    const venue = await getPublicVenue(1)

    expect(venue).toMatchObject({
      facility_id: 1, facility_name: 'Sân Linh Đàm', contact_phone: '0912345678',
      open_hours: 'Thứ 2: 06:00–22:00 · Chủ nhật: 05:00–23:00',
      courts_count: 1, courts_error: false, price_error: false, rating: 4.5, review_count: 12,
    })
    expect(venue.price_table).toEqual([
      { id: '5:9', court_name: 'Sân 1', days_label: 'Thứ 2, Chủ nhật', time_range: '06:00 – 17:00',
        price_label: '60.000 đ / 30 phút', valid_from: '2026-11-01', valid_to: undefined },
      { id: '5:10', court_name: 'Sân 1', days_label: 'Hằng ngày', time_range: '17:00 – 22:00',
        price_label: '90.000 đ / 30 phút', valid_from: undefined, valid_to: undefined },
    ])
  })

  it('không tải được địa điểm thì báo lỗi', async () => {
    const missing = new Error('404')
    routes({ '/locations/1': missing, '/locations/1/courts': [], '/locations/1/review-summary': {} })

    await expect(getPublicVenue(1)).rejects.toBe(missing)
  })

  it('không tải được danh sách sân hoặc một bảng giá thì vẫn hiện phần còn lại', async () => {
    routes({ '/locations/1': { ...detail, openingHours: [] }, '/locations/1/courts': new Error('500'),
      '/locations/1/review-summary': new Error('500') })

    const noCourts = await getPublicVenue(1)
    expect(noCourts).toMatchObject({ courts_list: [], courts_error: true, price_error: true, rating: null,
      review_count: 0, open_hours: 'Chưa cập nhật' })

    routes({ '/locations/1': detail, '/locations/1/courts': [{ id: 5, name: 'Sân 1' }, { id: 6, name: 'Sân 2' }],
      '/locations/1/review-summary': {}, '/courts/5': new Error('500'),
      '/courts/6': { id: 6, name: 'Sân 2', priceRules: [{ id: 1, startTime: '06:00', endTime: '22:00', pricePerSlot: 50000 }] } })

    const onePriceMissing = await getPublicVenue(1)
    expect(onePriceMissing.price_error).toBe(true)
    expect(onePriceMissing.price_table.map((row) => row.court_name)).toEqual(['Sân 2'])
  })
})

describe('lịch sân (UC13)', () => {
  const schedule = {
    date: '2026-11-30', maxDate: '2026-12-30',
    courts: [{ courtId: 5, name: 'Sân 1', slots: [
      { time: '10:00', status: 'AVAILABLE', price: 60000 },
      { time: '10:30', status: 'BOOKED', price: 60000, bookerName: 'An', bookerPhone: '0912345678', note: 'Mang cầu' },
    ] }],
  }

  it('mapSchedule đổi sang dạng bảng, chỉ có thông tin người đặt khi backend gửi', () => {
    expect(mapSchedule(schedule)).toEqual({
      play_date: '2026-11-30', max_date: '2026-12-30', time_headers: ['10:00', '10:30'],
      courts: [{ court_id: 5, court_name: 'Sân 1', slots: [
        { time: '10:00', status: 'available', price: 60000, bookingInfo: null },
        { time: '10:30', status: 'booked', price: 60000, bookingInfo: { name: 'An', phone: '0912345678', note: 'Mang cầu' } },
      ] }],
    })
  })

  it('không có sân thì không có cột giờ', () => {
    expect(mapSchedule({ date: '2026-11-30', courts: [] }).time_headers).toEqual([])
  })

  it('getVenueSchedule chỉ gửi forPackage khi chọn buổi cho gói', async () => {
    vi.mocked(api.get).mockResolvedValue(ok(schedule))

    await getVenueSchedule(1, '2026-11-30')
    await getVenueSchedule(1, '2026-11-30', undefined, 11)
    await getVenueSchedule(1, '2026-11-30', undefined, undefined, { forPackage: true })

    expect(api.get.mock.calls.map(([, config]) => config.params)).toEqual([
      { date: '2026-11-30', bookingId: undefined },
      { date: '2026-11-30', bookingId: 11 },
      { date: '2026-11-30', bookingId: undefined, forPackage: true },
    ])
  })

  it('getFacilityDetailAndSchedule: lịch lỗi vẫn hiện thông tin địa điểm', async () => {
    const scheduleError = new Error('500')
    scheduleError.response = { data: { message: 'Ngày xem nằm ngoài giới hạn đặt trước' } }
    routes({ '/locations/1': { id: 1, name: 'Sân Linh Đàm' }, '/locations/1/courts': [], '/locations/1/review-summary': {},
      '/locations/1/schedules': scheduleError })

    const result = await getFacilityDetailAndSchedule(1, '2027-01-30')

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ scheduleError: 'Ngày xem nằm ngoài giới hạn đặt trước', play_date: '2027-01-30', courts: [] })
    expect(result.data.facility.facility_name).toBe('Sân Linh Đàm')
  })

  it('getFacilityDetailAndSchedule: địa điểm lỗi thì báo không thành công', async () => {
    const error = new Error('404')
    error.response = { data: { message: 'Không tìm thấy địa điểm' } }
    routes({ '/locations/1': error, '/locations/1/courts': [], '/locations/1/review-summary': {}, '/locations/1/schedules': schedule })

    expect(await getFacilityDetailAndSchedule(1, '2026-11-30')).toEqual({ success: false, error: 'Không tìm thấy địa điểm' })
  })
})
