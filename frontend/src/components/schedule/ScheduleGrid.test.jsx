import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ScheduleGrid from './ScheduleGrid'
import SelectedRanges from './SelectedRanges'
import BookingSummaryBar from '../booking/BookingSummaryBar'

// Bảng lịch sân UC13 dùng cho đặt lẻ (UC14), gói (UC15), đặt tại quầy (UC16): trạng thái ô, chọn ô,
// chỉ Owner/Staff xem người đặt (FR34, BR57), bộ lọc, và các phần tóm tắt lựa chọn.
const schedule = {
  play_date: '2020-01-01',
  time_headers: ['10:00', '10:30', '11:00', '18:00'],
  courts: [
    { court_id: 1, court_name: 'Sân 1', slots: [
      { time: '10:00', status: 'available', price: 60000 },
      { time: '10:30', status: 'booked', price: 60000, bookingInfo: { name: 'Nguyễn An', phone: '0912345678', note: 'Mang cầu' } },
      { time: '11:00', status: 'maintenance', price: null },
      { time: '18:00', status: 'available', price: 90000 },
    ] },
    { court_id: 2, court_name: 'Sân 2', slots: [
      { time: '10:00', status: 'holding', price: 60000 },
      { time: '10:30', status: 'closed', price: null },
      { time: '11:00', status: 'past', price: 60000 },
      { time: '18:00', status: 'booked', price: 90000 },
    ] },
  ],
}

const desktop = () => within(screen.getByRole('grid', { name: 'Lịch sân theo khung 30 phút' }))
const cell = (court, time) => desktop().getByRole('button', { name: new RegExp(`^${court}, ${time} đến`) })

describe('ScheduleGrid: chọn ô', () => {
  it('ô trống có giá thì bấm được, các trạng thái khác thì khóa', async () => {
    const onSlot = vi.fn()
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={onSlot} role="player" />)

    expect(cell('Sân 1', '10:00')).toBeEnabled()
    expect(cell('Sân 1', '10:00')).toHaveAccessibleName('Sân 1, 10:00 đến 10:30, 60.000 đồng, Trống')
    for (const [court, time] of [['Sân 1', '10:30'], ['Sân 1', '11:00'], ['Sân 2', '10:00'], ['Sân 2', '10:30'], ['Sân 2', '11:00']]) {
      expect(cell(court, time)).toBeDisabled()
    }

    await userEvent.click(cell('Sân 1', '10:00'))
    expect(onSlot).toHaveBeenCalledWith(schedule.courts[0], schedule.courts[0].slots[0], 0)
  })

  it('ô đã chọn hiện "Đang chọn" và bấm lại được để bỏ', () => {
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={vi.fn()}
      selected={[{ courtId: 1, time: '18:00' }]} />)

    expect(cell('Sân 1', '18:00')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('Sân 1', '18:00')).toHaveAccessibleName(/Đang chọn/)
    expect(cell('Sân 1', '10:00')).toHaveAttribute('aria-pressed', 'false')
  })

  it('chỉ xem lịch (không cho đặt) thì mọi ô đều khóa', () => {
    render(<ScheduleGrid schedule={schedule} onSlot={vi.fn()} />)

    expect(cell('Sân 1', '10:00')).toBeDisabled()
    expect(screen.getByText(/Bấm ô có thông tin để xem chi tiết/)).toBeInTheDocument()
  })

  it('buổi bị trùng của gói được đánh dấu và không chọn được', () => {
    const mark = (court, slot) => (court.court_id === 1 && slot.time === '10:00' ? 'conflict' : null)
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={vi.fn()} mark={mark} markLegend={['conflict']} />)

    expect(cell('Sân 1', '10:00')).toHaveAccessibleName(/Buổi bị trùng/)
    expect(cell('Sân 1', '10:00')).toBeDisabled()
    expect(screen.getAllByText('Buổi bị trùng').length).toBeGreaterThan(0)
  })

  it('phím mũi tên chuyển tới ô bấm được kế tiếp', () => {
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={vi.fn()} />)
    const first = cell('Sân 1', '10:00')
    first.focus()

    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(cell('Sân 1', '18:00')).toHaveFocus()
    fireEvent.keyDown(cell('Sân 1', '18:00'), { key: 'Home' })
    expect(first).toHaveFocus()
  })
})

describe('ScheduleGrid: thông tin người đặt (FR34, BR57)', () => {
  it('Staff bấm ô đã đặt thì xem tên, số điện thoại, ghi chú', async () => {
    const onInspect = vi.fn()
    const onSlot = vi.fn()
    render(<ScheduleGrid schedule={schedule} role="staff" showBooker onSlot={onSlot} onInspect={onInspect} />)

    const booked = cell('Sân 1', '10:30')
    expect(booked).toHaveAccessibleName(/Nguyễn An · 0912345678 · Mang cầu/)
    await userEvent.click(booked)

    expect(onInspect).toHaveBeenCalledWith({ name: 'Nguyễn An', phone: '0912345678', note: 'Mang cầu',
      time: '10:30', status: 'booked', courtName: 'Sân 1' })
    expect(onSlot).not.toHaveBeenCalled()
  })

  it('Player không thấy người đặt dù màn hình bật showBooker', () => {
    render(<ScheduleGrid schedule={schedule} role="player" showBooker onSlot={vi.fn()} />)

    expect(cell('Sân 1', '10:30')).not.toHaveAccessibleName(/Nguyễn An/)
    expect(cell('Sân 1', '10:30')).toBeDisabled()
    expect(screen.queryByText('0912345678')).not.toBeInTheDocument()
  })
})

describe('ScheduleGrid: bộ lọc', () => {
  it('lọc buổi tối và chỉ hiện sân còn trống', async () => {
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={vi.fn()} filters />)

    await userEvent.click(screen.getByRole('button', { name: 'Tối' }))
    expect(desktop().queryByRole('button', { name: /10:00 đến/ })).not.toBeInTheDocument()
    expect(desktop().getAllByRole('button', { name: /18:00 đến/ })).toHaveLength(2)

    await userEvent.click(screen.getByLabelText('Chỉ hiện sân còn trống'))
    expect(desktop().getAllByRole('button', { name: /18:00 đến/ })).toHaveLength(1)
    expect(desktop().queryByRole('rowheader', { name: 'Sân 2' })).not.toBeInTheDocument()
  })

  it('lọc hết thì báo không có sân phù hợp và bỏ lọc được', async () => {
    render(<ScheduleGrid schedule={schedule} allowBooking onSlot={vi.fn()} filters />)

    await userEvent.selectOptions(screen.getByLabelText(/Lọc sân/), '2')
    await userEvent.click(screen.getByLabelText('Chỉ hiện sân còn trống'))
    expect(screen.getByText('Không có sân phù hợp bộ lọc')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ bộ lọc' }))
    expect(desktop().getAllByRole('row').length).toBeGreaterThan(2)
  })
})

describe('ScheduleGrid: bảng dọc (đổi lịch)', () => {
  it('mỗi cột một sân, bấm ô trống gọi onSlot với chỉ số ô', async () => {
    const onSlot = vi.fn()
    render(<ScheduleGrid courtsAsColumns schedule={schedule} allowBooking onSlot={onSlot}
      isOriginalSlot={(court, slot) => court.court_id === 1 && slot.time === '18:00'} />)

    expect(screen.getByRole('columnheader', { name: 'Sân 2' })).toBeInTheDocument()
    expect(screen.getByText('Lịch cũ của bạn')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Sân 1, 18:00, Lịch cũ của bạn/ }))

    expect(onSlot).toHaveBeenCalledWith(schedule.courts[0], schedule.courts[0].slots[3], 3)
  })
})

describe('SelectedRanges', () => {
  const range = { date: '2026-12-05', courtId: 1, courtName: 'Sân 1', startMinute: 600, startTime: '10:00',
    endTime: '11:00', items: [{}, {}], amount: 120000 }

  it('hiện ngày, sân, giờ, số slot, tiền và bấm × để bỏ cả dải', async () => {
    const onRemove = vi.fn()
    render(<SelectedRanges ranges={[range]} onRemove={onRemove} showDate />)

    expect(screen.getByText('T7 05/12 · Sân 1 · 10:00–11:00 · 2 slot · 120.000đ')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Bỏ T7 05\/12/ }))
    expect(onRemove).toHaveBeenCalledWith(range)
  })

  it('ẩn tiền khi không cần và không vẽ gì khi chưa chọn', () => {
    const { container, rerender } = render(<SelectedRanges ranges={[range]} showPrice={false} />)
    expect(screen.getByText('Sân 1 · 10:00–11:00 · 2 slot')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    rerender(<SelectedRanges ranges={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BookingSummaryBar', () => {
  it('bấm Tiếp tục và Xóa chọn', async () => {
    const onContinue = vi.fn()
    const onClear = vi.fn()
    render(<BookingSummaryBar title="2 slot · 120.000đ" onContinue={onContinue} onClear={onClear} hint="Giữ chỗ 10 phút" />)

    expect(screen.getByRole('status')).toHaveTextContent('2 slot · 120.000đ')
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục đặt sân' }))
    await userEvent.click(screen.getByRole('button', { name: 'Xóa chọn' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('chưa chọn thì khóa nút, đang gửi thì khóa cả Xóa chọn', () => {
    const { rerender } = render(<BookingSummaryBar title="Chưa chọn" disabled onContinue={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Tiếp tục đặt sân' })).toBeDisabled()

    rerender(<BookingSummaryBar title="2 slot" loading onContinue={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Xóa chọn' })).toBeDisabled()
  })

  it('dạng thu gọn có phần xem chi tiết các khung giờ', () => {
    render(<BookingSummaryBar title="2 slot" expandable onContinue={vi.fn()}><span>Sân 1 · 10:00–11:00</span></BookingSummaryBar>)

    expect(screen.getByText('Xem chi tiết các khung giờ đã chọn')).toBeInTheDocument()
    expect(screen.getByText('Sân 1 · 10:00–11:00')).toBeInTheDocument()
  })
})
