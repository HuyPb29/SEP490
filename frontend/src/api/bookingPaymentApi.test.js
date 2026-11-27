import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index', () => ({ default: { get: vi.fn(), post: vi.fn() }, getAllPages: vi.fn() }))

import api, { getAllPages } from './index'
import {
  decideStaffBookingPayment,
  getStaffBookingPaymentDetails,
  getStaffBookingProofImage,
  listPendingStaffBookingPayments,
  loadPayment,
  loadPaymentImage,
  submitPaymentProof,
} from './bookingPaymentApi'

// F4: màn thanh toán của Player (UC18) và các API Staff/Owner xác nhận (UC19).
const SERVER_TIME = '2026-11-30T10:00:00'
const ok = (data) => ({ data: { data, timestamp: SERVER_TIME } })

function routes(table) {
  vi.mocked(api.get).mockImplementation(async (path) => {
    const value = table[path]
    if (value === undefined) throw new Error('Không mong đợi gọi ' + path)
    if (value instanceof Error) throw value
    return typeof value === 'function' ? value() : ok(value)
  })
}

function httpError(status, message) {
  const error = new Error('Request failed with status code ' + status)
  error.response = { status, data: { message } }
  return error
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(getAllPages).mockReset()
})

describe('loadPayment: booking lẻ', () => {
  it('đang giữ chỗ thì lấy hướng dẫn chuyển khoản và số tiền phải trả', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK261130-7KQ2MX', status: 'HOLDING', finalAmount: 120000, holdExpiresAt: '2026-11-30T10:08:00' },
      '/bookings/11/payment-instructions': { amountDue: 120000, holdExpiresAt: '2026-11-30T10:08:00', bankName: 'MB' },
    })

    const payment = await loadPayment({ kind: 'booking', id: 11 })

    expect(payment).toMatchObject({
      code: 'BK261130-7KQ2MX', bookingId: 11, status: 'HOLDING', amount: 120000,
      canPay: true, awaiting: false, resubmitting: false,
    })
    expect(payment.instructions.bankName).toBe('MB')
    expect(Number.isFinite(payment.deadlineMs)).toBe(true)
  })

  it('đã gửi chứng từ thì chỉ hiện trạng thái chờ, không lấy hướng dẫn', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK1', status: 'AWAITING_CONFIRMATION', finalAmount: 120000, paymentId: 51 },
      '/payments/51': { id: 51, status: 'AWAITING_CONFIRMATION', submittedAt: '2026-11-30T09:59:00' },
    })

    const payment = await loadPayment({ kind: 'booking', id: 11 })

    expect(payment).toMatchObject({ awaiting: true, canPay: false, paymentId: 51, submittedAt: '2026-11-30T09:59:00' })
    expect(api.get).not.toHaveBeenCalledWith('/bookings/11/payment-instructions', expect.anything())
  })

  it('Staff yêu cầu bổ sung thì được gửi lại, hạn là hạn gửi lại', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK1', status: 'RESUBMIT_REQUESTED', finalAmount: 120000, paymentId: 51 },
      '/payments/51': { id: 51, status: 'RESUBMIT_REQUESTED', resubmitReason: 'Ảnh mờ', resubmitsLeft: 1,
        resubmitDeadline: '2026-11-30T10:30:00' },
      '/bookings/11/payment-instructions': { amountDue: 120000 },
    })

    const before = Date.now()
    const payment = await loadPayment({ kind: 'booking', id: 11 })
    const after = Date.now()

    expect(payment).toMatchObject({ resubmitting: true, canPay: true, awaiting: false, reason: 'Ảnh mờ', resubmitsLeft: 1 })
    // Hạn gửi lại cách giờ máy chủ 30 phút, quy sang đồng hồ máy người dùng; không lấy hạn giữ chỗ của hướng dẫn.
    expect(payment.deadlineMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
    expect(payment.deadlineMs).toBeLessThanOrEqual(after + 30 * 60 * 1000)
  })

  it('đã xác nhận thì có biên nhận và không cho thanh toán nữa', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK1', status: 'CONFIRMED', finalAmount: 120000, paymentId: 51 },
      '/payments/51': { id: 51, status: 'CONFIRMED', receiptNo: 'RC-51', receivedAmount: 150000 },
    })

    expect(await loadPayment({ kind: 'booking', id: 11 }))
      .toMatchObject({ canPay: false, awaiting: false, receiptNo: 'RC-51', receivedAmount: 150000 })
  })
})

describe('loadPayment: gói và đơn đặt lẻ', () => {
  it('gói không có mã booking thì hiện Gói #id, đơn đặt lẻ hiện Đơn #id', async () => {
    routes({
      '/booking-packages/7': { packageType: 'CUSTOM', status: 'CONFIRMED', finalAmount: 360000, sessions: [{ id: 71 }] },
      '/booking-packages/8': { packageType: 'DAY', status: 'CONFIRMED', finalAmount: 200000, sessions: [{ id: 81 }] },
    })

    expect(await loadPayment({ kind: 'package', id: 7 })).toMatchObject({ code: 'Gói #7', bookingId: 71, amount: 360000 })
    expect(await loadPayment({ kind: 'package', id: 8 })).toMatchObject({ code: 'Đơn #8', bookingId: 81 })
  })
})

describe('loadPayment: lấy hướng dẫn bị lỗi', () => {
  it('hết thời gian giữ chỗ (MSG33) thì hiện Hết hạn', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK1', status: 'HOLDING', finalAmount: 120000 },
      '/bookings/11/payment-instructions': httpError(400, 'Đã hết thời gian giữ chỗ. (MSG33)'),
    })

    expect(await loadPayment({ kind: 'booking', id: 11 })).toMatchObject({ status: 'EXPIRED', canPay: false })
  })

  it('409 vì trạng thái vừa đổi thì đọc lại và hiện trạng thái mới', async () => {
    let reads = 0
    routes({
      '/bookings/11': () => ok(++reads === 1
        ? { bookingCode: 'BK1', status: 'HOLDING', finalAmount: 120000 }
        : { bookingCode: 'BK1', status: 'AWAITING_CONFIRMATION', paymentId: 51, receiptNo: null }),
      '/bookings/11/payment-instructions': httpError(409, 'Booking không còn chờ thanh toán'),
      '/payments/51': { id: 51, status: 'AWAITING_CONFIRMATION' },
    })

    expect(await loadPayment({ kind: 'booking', id: 11 }))
      .toMatchObject({ status: 'AWAITING_CONFIRMATION', canPay: false, awaiting: true, paymentId: 51 })
    expect(api.get).toHaveBeenCalledWith('/payments/51', { signal: undefined })
  })

  it('lỗi khác thì báo lên cho màn hình', async () => {
    routes({
      '/bookings/11': { bookingCode: 'BK1', status: 'HOLDING', finalAmount: 120000 },
      '/bookings/11/payment-instructions': httpError(500, 'Đã xảy ra lỗi hệ thống'),
    })

    await expect(loadPayment({ kind: 'booking', id: 11 })).rejects.toThrow('Request failed with status code 500')
  })
})

describe('submitPaymentProof', () => {
  const proof = new File([new Uint8Array([1])], 'ck.png', { type: 'image/png' })

  it('lần đầu gửi theo booking hoặc gói', async () => {
    vi.mocked(api.post).mockResolvedValue(ok({ id: 51 }))

    await submitPaymentProof({ kind: 'booking', id: 11 }, { resubmitting: false }, proof)
    await submitPaymentProof({ kind: 'package', id: 7 }, { resubmitting: false }, proof)

    expect(api.post.mock.calls.map(([path]) => path)).toEqual(['/bookings/11/payments', '/booking-packages/7/payments'])
    expect(api.post.mock.calls[0][1].get('proof')).toBe(proof)
  })

  it('gửi lại thì theo giao dịch', async () => {
    vi.mocked(api.post).mockResolvedValue(ok({ id: 51 }))

    await submitPaymentProof({ kind: 'booking', id: 11 }, { resubmitting: true, paymentId: 51 }, proof)

    expect(api.post.mock.calls[0][0]).toBe('/payments/51/resubmit')
  })
})

describe('ảnh chứng từ (A03: chỉ qua API có kiểm tra quyền)', () => {
  it('chặn đường dẫn ngoài /api hoặc có dấu \\', async () => {
    await expect(loadPaymentImage('https://evil.example/x.png')).rejects.toThrow('Đường dẫn ảnh không hợp lệ.')
    await expect(loadPaymentImage('/api/..\\uploads\\x.png')).rejects.toThrow('Đường dẫn ảnh không hợp lệ.')
    await expect(loadPaymentImage(undefined)).rejects.toThrow('Đường dẫn ảnh không hợp lệ.')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('tải ảnh dạng blob qua API', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    vi.mocked(api.get).mockResolvedValue({ data: blob })

    expect(await getStaffBookingProofImage(51, 3)).toBe(blob)
    expect(api.get).toHaveBeenCalledWith('/payments/51/proofs/3/image', { responseType: 'blob', signal: undefined })
  })
})

describe('API Staff/Owner (UC19)', () => {
  it('danh sách chờ xác nhận đọc hết các trang', async () => {
    vi.mocked(getAllPages).mockResolvedValue([{ id: 51 }])

    expect(await listPendingStaffBookingPayments()).toEqual([{ id: 51 }])
    expect(getAllPages).toHaveBeenCalledWith('/staff/payments', { signal: undefined })
  })

  it('chi tiết và quyết định đi đúng đường', async () => {
    vi.mocked(api.get).mockResolvedValue(ok({ payment: { id: 51 } }))
    vi.mocked(api.post).mockResolvedValue(ok({ id: 51, status: 'CONFIRMED' }))

    expect(await getStaffBookingPaymentDetails(51)).toEqual({ payment: { id: 51 } })
    expect(await decideStaffBookingPayment(51, 'confirm', { receivedAmount: 150000 })).toEqual({ id: 51, status: 'CONFIRMED' })
    await decideStaffBookingPayment(51, 'request-resubmission', { reason: 'Ảnh mờ', playerAtFault: true })

    expect(api.get).toHaveBeenCalledWith('/staff/payments/51', { signal: undefined })
    expect(api.post.mock.calls).toEqual([
      ['/staff/payments/51/confirm', { receivedAmount: 150000 }],
      ['/staff/payments/51/request-resubmission', { reason: 'Ảnh mờ', playerAtFault: true }],
    ])
  })
})
