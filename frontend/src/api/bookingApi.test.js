import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index', () => ({ default: { get: vi.fn(), post: vi.fn() }, getAllPages: vi.fn() }))

import api, { getAllPages } from './index'
import {
  createBookingApi,
  createBookingPackageApi,
  createDayOrderApi,
  getMyBookingsApi,
  getMyOwnedTeams,
  getMyPointsAtFacility,
  getPackageDetailApi,
  getPackageSessionsApi,
  previewBookingApi,
  previewBookingPackageApi,
  previewDayOrderApi,
  toMinutes,
  toTimeLabel,
  uploadPaymentProofApi,
} from './bookingApi'

// API F3: tóm tắt và tạo booking lẻ (UC14), đơn đặt lẻ (D164), gói (UC15), lịch sử (UC17), gửi chứng từ (UC18).
beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(getAllPages).mockReset()
})

const ok = (data) => ({ data: { data, timestamp: '2026-11-30T10:00:00' } })

describe('giờ dạng HH:mm', () => {
  it('đổi qua lại với số phút', () => {
    expect(toMinutes('10:30')).toBe(630)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('')).toBe(0)
    expect(toTimeLabel(630)).toBe('10:30')
    expect(toTimeLabel(0)).toBe('00:00')
  })
})

describe('đặt sân', () => {
  it.each([
    ['previewBookingApi', previewBookingApi, '/bookings/summary', true],
    ['createBookingApi', createBookingApi, '/bookings', false],
    ['previewDayOrderApi', previewDayOrderApi, '/booking-orders/preview', true],
    ['createDayOrderApi', createDayOrderApi, '/booking-orders', false],
    ['previewBookingPackageApi', previewBookingPackageApi, '/booking-packages/preview', true],
    ['createBookingPackageApi', createBookingPackageApi, '/booking-packages', false],
  ])('%s gửi đúng đường và trả phần data', async (_, call, path, cancellable) => {
    const payload = { courtId: 5, date: '2026-11-30', startMinute: 600, endMinute: 660 }
    const signal = new AbortController().signal
    vi.mocked(api.post).mockResolvedValue(ok({ id: 11 }))

    expect(await call(payload, signal)).toEqual({ id: 11 })
    expect(api.post).toHaveBeenCalledWith(path, payload, ...(cancellable ? [{ signal }] : []))
  })
})

describe('uploadPaymentProofApi (UC18)', () => {
  it('chưa chọn ảnh thì báo MSG106, không gọi API', async () => {
    await expect(uploadPaymentProofApi({ bookingId: 11 })).rejects.toMatchObject({
      message: 'Vui lòng đính kèm ảnh chứng từ thanh toán. (MSG106)',
      response: { data: { code: 'MSG106' } },
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('gửi ảnh ở phần "proof" của form', async () => {
    const file = new File([new Uint8Array([1])], 'ck.png', { type: 'image/png' })
    vi.mocked(api.post).mockResolvedValue(ok({ id: 51, status: 'AWAITING_CONFIRMATION' }))

    expect(await uploadPaymentProofApi({ bookingId: 11, file })).toEqual({ id: 51, status: 'AWAITING_CONFIRMATION' })
    const [path, body] = api.post.mock.calls[0]
    expect(path).toBe('/bookings/11/payments')
    expect(body.get('proof')).toBe(file)
  })
})

describe('getMyBookingsApi (UC17)', () => {
  it('gộp booking lẻ và gói, đổi sang dạng thẻ lịch sử', async () => {
    vi.mocked(getAllPages).mockImplementation(async (path) => path === '/me/bookings'
      ? [{
          id: 11, bookingCode: 'BK261130-7KQ2MX', locationId: 1, locationName: 'Sân Linh Đàm', courtId: 5,
          courtName: 'Sân 1', playDate: '2026-11-30', startTime: '10:00', endTime: '11:00', status: 'HOLDING',
          holdDeadlineMs: 123, finalAmount: 120000, canReview: false,
        }]
      : [
          { id: 7, packageType: 'CUSTOM', locationName: 'Sân Linh Đàm', sessionCount: 3, startDate: '2026-12-01',
            endDate: '2026-12-20', status: 'CONFIRMED', finalAmount: 360000 },
          { id: 8, packageType: 'DAY', locationName: 'Sân Linh Đàm', sessionCount: 2, startDate: '2026-12-02',
            endDate: '2026-12-02', status: 'AWAITING_CONFIRMATION', finalAmount: 200000,
            daySessions: [{ id: 81, bookingCode: 'BK1', courtName: 'Sân 1', startTime: '10:00', endTime: '11:00', status: 'AWAITING_CONFIRMATION' }] },
        ])

    const [single, pkg, dayOrder] = await getMyBookingsApi()

    expect(getAllPages.mock.calls.map(([path]) => path)).toEqual(['/me/bookings', '/me/booking-packages'])
    expect(single).toMatchObject({
      booking_id: 11, booking_code: 'BK261130-7KQ2MX', booking_type: 'single', status: 'holding',
      status_name: 'Đang giữ chỗ', time_range: '10:00 – 11:00', hold_deadline_ms: 123, can_review: false,
    })
    expect(pkg).toMatchObject({
      booking_code: 'Gói #7', booking_type: 'package', single_order: false, court_name: '3 buổi',
      time_range: '2026-12-01 – 2026-12-20', status_name: 'Đã xác nhận', day_sessions: [],
    })
    expect(dayOrder).toMatchObject({
      booking_code: 'Đơn #8', single_order: true, court_name: '2 sân/khung giờ', time_range: '2026-12-02',
      status: 'awaiting_confirmation',
    })
    expect(dayOrder.day_sessions[0]).toMatchObject({ booking_id: 81, booking_type: 'session', package_id: 8 })
  })

  it('dòng chờ bổ sung được đọc lại chi tiết để lấy giao dịch', async () => {
    vi.mocked(getAllPages).mockImplementation(async (path) => path === '/me/bookings'
      ? [{ id: 11, startTime: '10:00', endTime: '11:00', status: 'RESUBMIT_REQUESTED' }]
      : [])
    vi.mocked(api.get).mockResolvedValue(ok({ status: 'RESUBMIT_REQUESTED', paymentId: 51 }))

    const [single] = await getMyBookingsApi()

    expect(api.get).toHaveBeenCalledWith('/bookings/11', { signal: undefined })
    expect(single).toMatchObject({ status: 'resubmit_requested', payment_id: 51 })
  })
})

describe('chi tiết gói', () => {
  it('mỗi buổi có hạn giữ chỗ tính theo đồng hồ máy', async () => {
    vi.mocked(api.get).mockResolvedValue(ok({
      id: 7, packageType: 'DAY',
      sessions: [{ id: 71, bookingCode: 'BK71', startTime: '10:00', endTime: '11:00', status: 'HOLDING', holdExpiresAt: '2026-11-30T10:10:00' }],
    }))

    const detail = await getPackageDetailApi(7)
    const sessions = await getPackageSessionsApi(7)

    expect(api.get).toHaveBeenCalledWith('/booking-packages/7')
    expect(Number.isFinite(detail.sessions[0].holdDeadlineMs)).toBe(true)
    expect(sessions[0]).toMatchObject({ booking_id: 71, booking_type: 'session', package_id: 7, single_order: true })
  })
})

describe('màn tóm tắt', () => {
  it('điểm hiện có ở đúng địa điểm, không có thì 0', async () => {
    vi.mocked(getAllPages).mockResolvedValue([{ locationId: 1, pointBalance: 40 }, { locationId: 2, pointBalance: 9 }])

    expect(await getMyPointsAtFacility('2')).toBe(9)
    expect(await getMyPointsAtFacility(3)).toBe(0)
    expect(getAllPages).toHaveBeenCalledWith('/me/loyalty-balances')
  })

  it('chỉ đội mình làm chủ mới chọn được khi đặt (D112)', async () => {
    vi.mocked(api.get).mockResolvedValue(ok([{ id: 1, name: 'Cầu Lông Sáng', captain: true }, { id: 2, name: 'Đội B', captain: false }]))

    expect(await getMyOwnedTeams()).toEqual([{ id: 1, name: 'Cầu Lông Sáng', captain: true, team_id: 1, team_name: 'Cầu Lông Sáng' }])
  })
})
