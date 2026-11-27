import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api, { apiErrorMessage, getAllPages } from './index'

// Lớp gọi API dùng chung cho các màn đặt sân, thanh toán: gắn token, gắn địa điểm Owner đang chọn (BR58 Owner xử lý
// thay Staff), đọc hết các trang, chọn câu báo lỗi.
const originalAdapter = api.defaults.adapter
let sent

function respond(data) {
  sent = []
  api.defaults.adapter = vi.fn(async (config) => {
    sent.push(config)
    return { data: typeof data === 'function' ? data(config) : data, status: 200, statusText: 'OK', headers: {}, config }
  })
}

function loginAs(role) {
  localStorage.setItem('bms_access_token', 'jwt-' + role)
  localStorage.setItem('bms_user_info', JSON.stringify({ user_id: 7, role_code: role }))
}

beforeEach(() => { respond({ data: {} }) })
afterEach(() => { api.defaults.adapter = originalAdapter })

describe('gắn header', () => {
  it('đã đăng nhập thì gửi Bearer token', async () => {
    loginAs('player')

    await api.get('/me/bookings')

    expect(sent[0].headers.get('Authorization')).toBe('Bearer jwt-player')
    expect(sent[0].headers.has('X-Location-Id')).toBe(false)
  })

  it('Owner gửi kèm địa điểm đang chọn', async () => {
    loginAs('owner')
    sessionStorage.setItem('bms_selected_location', '3')

    await api.get('/staff/payments')

    expect(sent[0].headers.get('X-Location-Id')).toBe('3')
  })

  it('route Admin không gắn địa điểm', async () => {
    loginAs('owner')
    sessionStorage.setItem('bms_selected_location', '3')

    await api.get('/admin/locations')

    expect(sent[0].headers.has('X-Location-Id')).toBe(false)
  })

  it('skipAuth thì không gửi token (lịch sân công khai)', async () => {
    loginAs('staff')

    await api.get('/locations/1/schedules', { skipAuth: true })

    expect(sent[0].headers.has('Authorization')).toBe(false)
  })

  it('token 401 thì xóa phiên và báo hết hạn', async () => {
    loginAs('player')
    const expired = vi.fn()
    window.addEventListener('bms-session-expired', expired)
    api.defaults.adapter = async (config) => {
      const error = new Error('Request failed with status code 401')
      error.config = config
      error.response = { status: 401, data: {} }
      throw error
    }

    await expect(api.get('/me/bookings')).rejects.toThrow()

    expect(localStorage.getItem('bms_access_token')).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener('bms-session-expired', expired)
  })
})

describe('getAllPages', () => {
  it('đọc lần lượt mọi trang, mỗi trang 50 dòng', async () => {
    respond((config) => ({
      timestamp: '2026-11-26T10:00:00',
      data: { content: [{ id: config.params.page + 1 }], totalPages: 3 },
    }))

    const items = await getAllPages('/me/bookings', { params: { status: 'HOLDING' } })

    expect(items.map((item) => item.id)).toEqual([1, 2, 3])
    expect(sent.map((config) => config.params)).toEqual([
      { status: 'HOLDING', page: 0, size: 50 },
      { status: 'HOLDING', page: 1, size: 50 },
      { status: 'HOLDING', page: 2, size: 50 },
    ])
  })

  it('mapItem nhận thêm giờ máy chủ để tính đồng hồ đếm ngược', async () => {
    respond({ timestamp: '2026-11-26T10:00:00', data: { content: [{ id: 1 }], totalPages: 1 } })

    const items = await getAllPages('/me/bookings', {}, (item, serverTime) => ({ ...item, serverTime }))

    expect(items).toEqual([{ id: 1, serverTime: '2026-11-26T10:00:00' }])
  })

  it('không có dòng nào vẫn trả mảng rỗng', async () => {
    respond({ data: { content: [], totalPages: 0 } })

    expect(await getAllPages('/staff/payments')).toEqual([])
    expect(sent).toHaveLength(1)
  })
})

describe('apiErrorMessage', () => {
  it('lỗi từng trường thì lấy câu của trường đầu tiên', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Dữ liệu không hợp lệ', errors: { customerPhone: 'Số điện thoại sai' } } } }))
      .toBe('Số điện thoại sai')
  })

  it('không có lỗi trường thì lấy message của backend', () => {
    expect(apiErrorMessage({ response: { status: 409, data: { message: 'Slot vừa có người giữ hoặc đặt. (MSG28)' } } }))
      .toBe('Slot vừa có người giữ hoặc đặt. (MSG28)')
  })

  it('401, 403 không có message thì có câu riêng', () => {
    expect(apiErrorMessage({ response: { status: 401, data: {} } })).toBe('Vui lòng đăng nhập lại.')
    expect(apiErrorMessage({ response: { status: 403, data: {} } })).toBe('Bạn không có quyền thực hiện thao tác này.')
  })

  it('không có gì thì dùng câu mặc định', () => {
    expect(apiErrorMessage(undefined, 'Không tải được lịch sân.')).toBe('Không tải được lịch sân.')
    expect(apiErrorMessage({ message: 'timeout' })).toBe('timeout')
  })
})
