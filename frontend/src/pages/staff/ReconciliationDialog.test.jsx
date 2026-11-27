import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../../api'
import ReconciliationDialog from './ReconciliationDialog'

// UC20 đối soát cuối ngày (D29, FR61): Staff nhập tiền ngân hàng + tiền mặt, lệch phải ghi lý do (MSG59), mỗi ngày một lần.
const TODAY = '2026-11-25'
const summary = (extra = {}) => ({ date: TODAY, confirmedCount: 3, systemAmount: 540000, overpaidAmount: 0, reconciliation: null, ...extra })

function httpError(status, message, errors) {
  const error = new Error('Request failed with status code ' + status)
  error.response = { status, data: { message, errors } }
  return error
}

async function openDialog(data = summary()) {
  vi.mocked(api.get).mockResolvedValue({ data: { data } })
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<ReconciliationDialog onClose={onClose} />)
  await screen.findByText('Giao dịch đã xác nhận')
  return { user, onClose }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T21:00:00+07:00'))
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
})

describe('xem số liệu', () => {
  it('mặc định là hôm nay, hiện số giao dịch và tiền hệ thống', async () => {
    await openDialog()

    expect(api.get).toHaveBeenCalledWith('/staff/reconciliations', { params: { date: TODAY }, signal: expect.any(AbortSignal) })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/540\.000\s₫/)).toBeInTheDocument()
  })

  it('ngày đã đối soát thì chỉ xem kết quả, không nhập lại được', async () => {
    await openDialog(summary({ reconciliation: { systemAmount: 540000, actualAmount: 500000, difference: -40000,
      reason: 'Khách chuyển nhầm', staffName: 'Lê Thu' } }))

    expect(screen.getByText('Khách chuyển nhầm')).toBeInTheDocument()
    expect(screen.getByText('Lê Thu')).toBeInTheDocument()
    expect(screen.queryByLabelText('Thực nhận qua ngân hàng')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu kết quả đối soát' })).not.toBeInTheDocument()
  })

  it('backend trả nhầm ngày thì báo lỗi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: summary({ date: '2026-11-24' }) } })
    render(<ReconciliationDialog onClose={vi.fn()} />)

    expect(await screen.findByText(/Dữ liệu trả về không khớp ngày đối soát\./)).toBeInTheDocument()
  })

  it('tải lỗi thì có nút Thử lại', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(httpError(500, 'Đã xảy ra lỗi hệ thống'))
      .mockResolvedValueOnce({ data: { data: summary() } })
    render(<ReconciliationDialog onClose={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Giao dịch đã xác nhận')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('chọn ngày tương lai thì không tải', async () => {
    await openDialog()
    vi.mocked(api.get).mockClear()

    // Lịch tùy chỉnh chặn ngày tương lai; bridge vẫn phải bảo vệ khi nhận giá trị ngoài UI.
    fireEvent.change(screen.getByLabelText('Ngày đối soát', { selector: 'input' }), { target: { value: '2026-11-30' } })

    expect(screen.getByText('Vui lòng chọn ngày đối soát hợp lệ.')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})

describe('lưu kết quả', () => {
  it('khớp số thì lưu không cần lý do, cộng tiền ngân hàng và tiền mặt', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Đã lưu kết quả đối soát ngày 25/11/2026.',
      data: { systemAmount: 540000, actualAmount: 540000, difference: 0 } } })
    const { user } = await openDialog()

    await user.type(screen.getByLabelText('Thực nhận qua ngân hàng'), '500000')
    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '40000')
    expect(screen.getByText(/Tổng thực nhận 540\.000\s₫ · Chênh lệch 0\s₫/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(api.post).toHaveBeenCalledWith('/staff/reconciliations', { date: TODAY, actualAmount: 540000, reason: null })
    expect(await screen.findByText('Đã lưu kết quả đối soát ngày 25/11/2026. (MSG60)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu kết quả đối soát' })).not.toBeInTheDocument()
  })

  it('lệch mà chưa ghi lý do thì báo MSG59, không gửi', async () => {
    const { user } = await openDialog()

    await user.type(screen.getByLabelText('Thực nhận qua ngân hàng'), '500000')
    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '0')
    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(screen.getByText(/^Chênh lệch -40\.000\s₫\. Vui lòng nhập lý do\. \(MSG59\)$/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('lệch có lý do thì gửi kèm lý do', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { actualAmount: 560000, difference: 20000 } } })
    const { user } = await openDialog()

    await user.type(screen.getByLabelText('Thực nhận qua ngân hàng'), '560000')
    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '0')
    await user.type(screen.getByLabelText('Lý do chênh lệch'), '  Khách chuyển thừa  ')
    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(api.post).toHaveBeenCalledWith('/staff/reconciliations', { date: TODAY, actualAmount: 560000, reason: 'Khách chuyển thừa' })
  })

  it('để trống hoặc nhập không phải số nguyên thì báo MSG01, MSG02', async () => {
    const { user } = await openDialog()

    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '12.5')
    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(screen.getByText('Vui lòng nhập số tiền. (MSG01)')).toBeInTheDocument()
    expect(screen.getByText('Nhập số nguyên không âm, tối đa 12 chữ số. (MSG02)')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('ngày đã có người đối soát (409) thì báo và tải lại', async () => {
    vi.mocked(api.post).mockRejectedValue(httpError(409, 'Ngày 25/11/2026 đã được đối soát.'))
    const { user } = await openDialog()
    await user.type(screen.getByLabelText('Thực nhận qua ngân hàng'), '540000')
    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '0')

    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(await screen.findByText('Ngày 25/11/2026 đã được đối soát.')).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })

  it('lỗi kiểm tra của backend hiện dưới ô tương ứng', async () => {
    vi.mocked(api.post).mockRejectedValue(httpError(400, 'Dữ liệu không hợp lệ', { actualAmount: 'Số tiền thực nhận không được âm' }))
    const { user } = await openDialog()
    await user.type(screen.getByLabelText('Thực nhận qua ngân hàng'), '540000')
    await user.type(screen.getByLabelText('Thực nhận tiền mặt'), '0')

    await user.click(screen.getByRole('button', { name: 'Lưu kết quả đối soát' }))

    expect(await screen.findByText('Số tiền thực nhận không được âm')).toBeInTheDocument()
  })

  it('nút Đóng gọi onClose', async () => {
    const { user, onClose } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Đóng' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
