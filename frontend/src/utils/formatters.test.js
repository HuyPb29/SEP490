import { describe, expect, it, vi } from 'vitest'
import { errorMessage, formatSlotTime, formatVnd, minuteLabel, money, shortDate, today, uiMessage } from './formatters'
import { isBookable } from './venueSchedule'

// Cách hiện tiền, ngày, giờ và câu báo lỗi trên các màn đặt sân, thanh toán.
describe('tiền', () => {
  it('formatVnd làm tròn và ghi "đồng"', () => {
    expect(formatVnd(180000)).toBe('180.000 đồng')
    expect(formatVnd('1234.6')).toBe('1.235 đồng')
  })

  it('formatVnd thiếu số hoặc sai số thì hiện 0 đồng', () => {
    expect(formatVnd(null)).toBe('0 đồng')
    expect(formatVnd(undefined)).toBe('0 đồng')
    expect(formatVnd('abc')).toBe('0 đồng')
  })

  it('money hiện theo đơn vị ₫', () => {
    expect(money(180000)).toMatch(/^180\.000\s₫$/)
    expect(money(null)).toMatch(/^0\s₫$/)
  })
})

describe('ngày giờ', () => {
  it('shortDate đổi yyyy-MM-dd thành dd/MM/yyyy', () => {
    expect(shortDate('2026-11-30')).toBe('30/11/2026')
  })

  it('shortDate không có giá trị thì hiện gạch, sai định dạng thì giữ nguyên', () => {
    expect(shortDate(null)).toBe('—')
    expect(shortDate('không phải ngày')).toBe('không phải ngày')
  })

  it('formatSlotTime đổi số phút thành HH:mm', () => {
    expect(formatSlotTime(0)).toBe('00:00')
    expect(formatSlotTime(630)).toBe('10:30')
    expect(formatSlotTime(1410)).toBe('23:30')
    expect(formatSlotTime(null)).toBe('--:--')
    expect(minuteLabel(1080)).toBe('18:00')
  })

  it('today lấy ngày theo giờ Việt Nam, kể cả khi giờ UTC còn ở hôm trước', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-30T17:30:00Z'))

    expect(today()).toBe('2026-12-01')
  })
})

describe('câu báo lỗi', () => {
  it('bỏ mã kỹ thuật trong ngoặc ở cuối câu', () => {
    expect(uiMessage('Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)'))
      .toBe('Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác.')
    expect(uiMessage('Không hợp lệ (BR35, MSG29)')).toBe('Không hợp lệ')
  })

  it('đổi câu lỗi tiếng Anh của trình duyệt sang tiếng Việt', () => {
    expect(uiMessage('Network Error')).toBe('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.')
    expect(uiMessage('Request failed with status code 500')).toBe('Không thể hoàn thành thao tác. Vui lòng thử lại.')
    expect(uiMessage('MSG12')).toBe('Không thể hoàn thành thao tác. Vui lòng kiểm tra lại.')
  })

  it('mã trạng thái đứng một mình thì hiện tên tiếng Việt', () => {
    expect(uiMessage('HOLDING')).toBe('đang giữ chỗ')
    expect(uiMessage('RESUBMIT_REQUESTED')).toBe('cần gửi lại chứng từ')
  })

  it('giá trị không phải chuỗi thì để nguyên', () => {
    expect(uiMessage(null)).toBeNull()
  })

  it('errorMessage ưu tiên message của backend', () => {
    expect(errorMessage({ response: { data: { message: 'Đã hết thời gian giữ chỗ. (MSG33)' } }, message: 'x' }))
      .toBe('Đã hết thời gian giữ chỗ.')
    expect(errorMessage(new Error('Network Error'))).toBe('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.')
    expect(errorMessage(undefined)).toBe('Không thể hoàn thành thao tác. Vui lòng thử lại.')
  })
})

describe('isBookable', () => {
  it('chỉ ô trống và có giá mới đặt được', () => {
    expect(isBookable({ status: 'available', price: 60000 })).toBe(true)
    expect(isBookable({ status: 'available', price: '60000' })).toBe(true)
    expect(isBookable({ status: 'available', price: null })).toBe(false)
    expect(isBookable({ status: 'holding', price: 60000 })).toBe(false)
    expect(isBookable({ status: 'available', price: 'abc' })).toBe(false)
  })
})
