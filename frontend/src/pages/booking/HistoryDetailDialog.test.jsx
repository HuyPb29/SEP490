import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { getHistoryDetail } from '../../api/bookingHistory'
import HistoryDetailDialog from './HistoryDetailDialog'

vi.mock('../../api/bookingHistory', async (importOriginal) => ({
  ...(await importOriginal()),
  getHistoryDetail: vi.fn(),
}))

it.each([null, 51])('gói bị sân hủy có thể gửi khiếu nại với paymentId=%s', async (paymentId) => {
  vi.mocked(getHistoryDetail).mockResolvedValue({
    id: 31,
    status: 'CANCELLED_BY_FACILITY',
    paymentId,
    sessions: [{ id: 11, playDate: '2026-11-30', startTime: '12:00', endTime: '13:00' }],
  })

  render(
    <MemoryRouter>
      <HistoryDetailDialog
        presentation="panel"
        item={{ booking_type: 'package', booking_id: 31, booking_code: 'PK31' }}
        now={Date.parse('2026-11-27T10:00:00+07:00')}
      />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('link', { name: 'Gửi khiếu nại' }))
    .toHaveAttribute('href', '/my-complaints?bookingId=11')
  if (paymentId) {
    expect(screen.getByRole('button', { name: 'Xem thanh toán' })).toBeVisible()
  } else {
    expect(screen.queryByRole('button', { name: 'Xem thanh toán' })).toBeNull()
  }
})
