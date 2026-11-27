import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index', () => ({ default: { get: vi.fn() } }))

import api from './index'
import {
  bookingStartsAfter,
  bookingTimestamp,
  canPayHistoryEntry,
  enrichHistoryEntry,
  getHistoryDetail,
  withBookingDeadlines,
} from './bookingHistory'

// UC17 lịch sử booking: đồng hồ đếm ngược giữ chỗ, nút Tiếp tục thanh toán, Gửi lại chứng từ (D132).
beforeEach(() => { vi.mocked(api.get).mockReset() })

describe('bookingTimestamp', () => {
  it('giờ không có múi giờ là giờ Việt Nam', () => {
    expect(bookingTimestamp('2026-11-30T10:00:00')).toBe(Date.parse('2026-11-30T03:00:00Z'))
  })

  it('giờ có múi giờ thì giữ nguyên', () => {
    expect(bookingTimestamp('2026-11-30T10:00:00Z')).toBe(Date.parse('2026-11-30T10:00:00Z'))
  })

  it('không có giá trị thì NaN', () => {
    expect(bookingTimestamp(null)).toBeNaN()
  })
})

describe('withBookingDeadlines', () => {
  it('tính hạn theo đồng hồ máy người dùng: còn bao lâu so với giờ máy chủ', () => {
    const receivedAt = Date.parse('2026-11-30T01:00:00Z')
    const item = withBookingDeadlines(
      { id: 1, holdExpiresAt: '2026-11-30T10:10:00', resubmitDeadline: null },
      '2026-11-30T10:00:00', receivedAt)

    expect(item.holdDeadlineMs).toBe(receivedAt + 10 * 60 * 1000)
    expect(item.resubmitDeadlineMs).toBeNaN()
    expect(item.id).toBe(1)
  })

  it('không có giờ máy chủ thì dùng mốc tuyệt đối', () => {
    expect(withBookingDeadlines({ holdExpiresAt: '2026-11-30T10:10:00' }).holdDeadlineMs)
      .toBe(Date.parse('2026-11-30T03:10:00Z'))
  })
})

describe('canPayHistoryEntry', () => {
  const now = 1_000_000

  it('đang giữ chỗ còn hạn thì được tiếp tục thanh toán', () => {
    expect(canPayHistoryEntry({ booking_type: 'single', status: 'holding', hold_deadline_ms: now + 1 }, now)).toBe(true)
    expect(canPayHistoryEntry({ booking_type: 'single', status: 'holding', hold_deadline_ms: now }, now)).toBe(false)
  })

  it('chờ bổ sung cần có giao dịch và còn hạn gửi lại', () => {
    const item = { booking_type: 'package', status: 'resubmit_requested', payment_id: 51, resubmit_deadline_ms: now + 1 }
    expect(canPayHistoryEntry(item, now)).toBe(true)
    expect(canPayHistoryEntry({ ...item, payment_id: null }, now)).toBe(false)
    expect(canPayHistoryEntry({ ...item, resubmit_deadline_ms: now - 1 }, now)).toBe(false)
  })

  it('buổi trong gói, trạng thái khác hoặc không có booking thì không thanh toán', () => {
    expect(canPayHistoryEntry({ booking_type: 'session', status: 'holding', hold_deadline_ms: now + 1 }, now)).toBe(false)
    expect(canPayHistoryEntry({ booking_type: 'single', status: 'confirmed' }, now)).toBe(false)
    expect(canPayHistoryEntry(null, now)).toBe(false)
  })
})

describe('bookingStartsAfter', () => {
  it('so giờ bắt đầu của booking với hiện tại', () => {
    const start = Date.parse('2026-11-30T03:00:00Z')
    expect(bookingStartsAfter('2026-11-30', '10:00', start - 1)).toBe(true)
    expect(bookingStartsAfter('2026-11-30', '10:00', start)).toBe(false)
    expect(bookingStartsAfter(null, '10:00', 0)).toBe(false)
  })
})

describe('chi tiết booking cho lịch sử', () => {
  it('booking lẻ và gói đọc ở hai đường khác nhau', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { status: 'HOLDING' }, timestamp: '2026-11-30T10:00:00' } })

    await getHistoryDetail({ booking_type: 'single', booking_id: 11 })
    await getHistoryDetail({ booking_type: 'package', booking_id: 7 })

    expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/bookings/11', '/booking-packages/7'])
  })

  it('chỉ đọc lại chi tiết khi đang chờ bổ sung chứng từ', async () => {
    const item = { booking_type: 'single', booking_id: 11, status: 'confirmed' }

    expect(await enrichHistoryEntry(item)).toBe(item)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('chờ bổ sung thì lấy trạng thái mới nhất, giao dịch và hạn gửi lại', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {
      timestamp: '2026-11-30T10:00:00',
      data: { status: 'AWAITING_CONFIRMATION', paymentId: 51, resubmitDeadline: '2026-11-30T10:30:00' },
    } })

    const item = await enrichHistoryEntry({ booking_type: 'single', booking_id: 11, status: 'resubmit_requested' })

    expect(item).toMatchObject({ status: 'awaiting_confirmation', status_name: 'Chờ xác nhận', payment_id: 51 })
    expect(Number.isFinite(item.resubmit_deadline_ms)).toBe(true)
  })

  it('đọc lại lỗi thì giữ dòng cũ', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'))
    const item = { booking_type: 'single', booking_id: 11, status: 'resubmit_requested' }

    expect(await enrichHistoryEntry(item)).toBe(item)
  })
})
