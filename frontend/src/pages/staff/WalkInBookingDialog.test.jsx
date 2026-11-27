import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../../api'
import WalkInBookingDialog from './WalkInBookingDialog'

// UC16 đặt sân tại quầy: Staff chọn một hoặc nhiều slot liền nhau trên một sân (D183), nhập khách, giữ chỗ 10 phút
// (D170), xác nhận khi đã nhận đủ tiền.
const TODAY = '2026-11-25'
const schedule = {
  date: TODAY, maxDate: '2026-12-25',
  courts: [{ courtId: 5, name: 'Sân 1', slots: [
    { startMinute: 600, time: '10:00', status: 'AVAILABLE', price: 60000 },
    { startMinute: 630, time: '10:30', status: 'AVAILABLE', price: 60000 },
    { startMinute: 660, time: '11:00', status: 'BOOKED', price: 60000 },
    { startMinute: 690, time: '11:30', status: 'AVAILABLE', price: 80000 },
  ] }],
}

function serverHas({ locationId = 1, scheduleResponse = schedule } = {}) {
  vi.mocked(api.get).mockImplementation(async (path) => {
    if (path === '/staff/dashboards/me') return { data: { data: { locationId } } }
    if (path === '/locations/1/schedules') return { data: { data: scheduleResponse } }
    throw new Error('Không mong đợi gọi ' + path)
  })
}

function httpError(status, message, errors) {
  const error = new Error('Request failed with status code ' + status)
  error.response = { status, data: { message, errors } }
  return error
}

const grid = () => within(screen.getByRole('grid', { name: 'Lịch sân theo khung 30 phút' }))
const slot = (time) => grid().getByRole('button', { name: new RegExp(`^Sân 1, ${time} đến`) })
const inFiveMinutes = () => new Date(Date.now() + 5 * 60 * 1000).toISOString()

async function openDialog(props = {}) {
  const user = userEvent.setup()
  const onChanged = vi.fn()
  const onClose = vi.fn()
  render(<WalkInBookingDialog onChanged={onChanged} onClose={onClose} {...props} />)
  await screen.findByRole('grid', { name: 'Lịch sân theo khung 30 phút' })
  return { user, onChanged, onClose }
}

async function fillCustomer(user, name = '  Nguyễn   Văn An ', phone = '0912345678') {
  await user.type(screen.getByLabelText('Tên khách hàng'), name)
  await user.type(screen.getByLabelText('Số điện thoại'), phone)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T08:00:00+07:00'))
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  serverHas()
})

describe('chọn khung giờ', () => {
  it('bấm ô đầu rồi ô cuối liền nhau thì chọn cả dải và hiện tổng tiền', async () => {
    const { user } = await openDialog()

    await user.click(slot('10:00'))
    await user.click(slot('10:30'))

    expect(screen.getByText(/Đã chọn/).textContent).toMatch(/Sân 1 · 10:00–11:00 \(1 giờ\) · 120\.000\s₫/)
  })

  it('giữa hai ô có ô đã đặt thì không nối được, chọn lại từ ô vừa bấm', async () => {
    const { user } = await openDialog()

    await user.click(slot('10:00'))
    await user.click(slot('11:30'))

    expect(screen.getByText(/Đã chọn/).textContent).toMatch(/11:30–12:00 \(30 phút\) · 80\.000\s₫/)
  })

  it('mở từ lịch sân với dải chọn sẵn', async () => {
    await openDialog({ initialCourt: 5, initialDate: TODAY, initialStart: 600, initialEnd: 660 })

    expect(slot('10:00')).toHaveAttribute('aria-pressed', 'true')
    expect(slot('10:30')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('giữ chỗ', () => {
  it('thiếu tên, số điện thoại và khung giờ thì báo từng chỗ, không gửi', async () => {
    const { user } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))

    expect(screen.getByText('Vui lòng nhập tên khách hàng.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập số điện thoại khách.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng bấm chọn khung giờ còn trống trên bảng.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('số điện thoại sai định dạng thì không gửi', async () => {
    const { user } = await openDialog()
    await fillCustomer(user, 'Nguyễn An', '912345678')
    await user.click(slot('10:00'))

    await user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))

    expect(screen.getByText('Số điện thoại khách phải gồm đúng 10 chữ số và bắt đầu bằng 0.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('đủ thông tin thì giữ chỗ, chuẩn hóa tên và hiện đồng hồ 10 phút', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: {
      id: 31, bookingCode: 'BK261125-ABCDEF', finalAmount: 120000, status: 'HOLDING', holdExpiresAt: inFiveMinutes(),
    } } })
    const { user, onChanged } = await openDialog()
    await fillCustomer(user)
    await user.click(slot('10:00'))
    await user.click(slot('10:30'))

    await user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))

    expect(api.post).toHaveBeenCalledWith('/staff/bookings', {
      courtId: 5, date: TODAY, startMinute: 600, endMinute: 660, customerName: 'Nguyễn Văn An', customerPhone: '0912345678',
    })
    expect(await screen.findByText(/Đơn BK261125-ABCDEF/)).toBeInTheDocument()
    expect(screen.getByText(/Đang giữ chỗ · [45]:\d\d/)).toBeInTheDocument()
    expect(screen.getByText('Đã giữ chỗ tại quầy trong 10 phút.')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('slot vừa bị người khác đặt (MSG28) thì báo ở bảng và tải lại lịch', async () => {
    vi.mocked(api.post).mockRejectedValue(httpError(409, 'Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)'))
    const { user } = await openDialog()
    await fillCustomer(user)
    await user.click(slot('10:00'))
    const loadsBefore = api.get.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))

    expect(await screen.findByText('Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)')).toBeInTheDocument()
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(loadsBefore))
  })

  it('lỗi kiểm tra của backend hiện đúng ô', async () => {
    vi.mocked(api.post).mockRejectedValue(httpError(400, 'Dữ liệu không hợp lệ',
      { customerName: 'Tên khách chỉ được chứa chữ và khoảng trắng', validSlot: 'Slot phải theo bước 30 phút' }))
    const { user } = await openDialog()
    await fillCustomer(user)
    await user.click(slot('10:00'))

    await user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))

    expect(await screen.findByText('Tên khách chỉ được chứa chữ và khoảng trắng')).toBeInTheDocument()
    expect(screen.getByText('Slot phải theo bước 30 phút')).toBeInTheDocument()
  })
})

describe('xác nhận đã nhận tiền', () => {
  async function holdBooking(holdExpiresAt = inFiveMinutes()) {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: {
      id: 31, bookingCode: 'BK261125-ABCDEF', finalAmount: 120000, status: 'HOLDING', holdExpiresAt,
    } } })
    const opened = await openDialog()
    await fillCustomer(opened.user)
    await opened.user.click(slot('10:00'))
    await opened.user.click(screen.getByRole('button', { name: 'Giữ chỗ 10 phút' }))
    await screen.findByText(/Đơn BK261125-ABCDEF/)
    return opened
  }

  it('hỏi lại rồi xác nhận, hiện biên nhận', async () => {
    const { user, onChanged } = await holdBooking()
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: {
      id: 31, bookingCode: 'BK261125-ABCDEF', finalAmount: 120000, status: 'CONFIRMED', receiptNo: 'RC-31',
    } } })

    await user.click(screen.getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
    expect(screen.getByText(/Xác nhận đã nhận đủ 120\.000\s₫ cho đơn BK261125-ABCDEF\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(api.post).toHaveBeenLastCalledWith('/staff/bookings/31/confirm')
    expect(await screen.findByText('Đã xác nhận thanh toán. Biên nhận RC-31')).toBeInTheDocument()
    expect(screen.getByText('Đã xác nhận thanh toán.')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('giữ chỗ đã hết thì báo MSG33, không còn nút xác nhận', async () => {
    await holdBooking(new Date(Date.now() - 1000).toISOString())

    expect(screen.getByText('Đã hết thời gian giữ chỗ. khung giờ đã được nhả. (MSG33)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xác nhận đã nhận tiền' })).not.toBeInTheDocument()
  })

  it('backend báo hết hạn khi xác nhận thì chuyển sang Hết hạn', async () => {
    const { user } = await holdBooking()
    vi.mocked(api.post).mockRejectedValueOnce(httpError(409, 'Đã hết thời gian giữ chỗ. (MSG33)'))

    await user.click(screen.getByRole('button', { name: 'Xác nhận đã nhận tiền' }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(await screen.findByText('Đã hết thời gian giữ chỗ. khung giờ đã được nhả. (MSG33)')).toBeInTheDocument()
  })
})

describe('tải lịch', () => {
  it('Staff chưa được phân công địa điểm thì báo lỗi', async () => {
    serverHas({ locationId: null })
    render(<WalkInBookingDialog onClose={vi.fn()} />)

    expect(await screen.findByText(/Bạn chưa được phân công địa điểm\./)).toBeInTheDocument()
  })

  it('ngày mở sẵn nằm ngoài giới hạn đặt trước thì báo', async () => {
    render(<WalkInBookingDialog onClose={vi.fn()} initialDate="2027-03-01" />)

    expect(await screen.findByText(/Ngày chơi nằm ngoài giới hạn đặt trước\./)).toBeInTheDocument()
  })

  it('ngày không mở cửa thì báo, không vẽ bảng', async () => {
    serverHas({ scheduleResponse: { date: TODAY, maxDate: '2026-12-25', courts: [{ courtId: 5, name: 'Sân 1', slots: [] }] } })
    render(<WalkInBookingDialog onClose={vi.fn()} />)

    expect(await screen.findByText('Ngày này địa điểm không mở cửa.')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('nút Đóng gọi onClose', async () => {
    const { user, onClose } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Đóng' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
