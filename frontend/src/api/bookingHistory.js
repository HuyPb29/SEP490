import api from './index'

export const bookingStatusLabels = {
  holding: 'Đang giữ chỗ',
  awaiting_confirmation: 'Chờ xác nhận',
  resubmit_requested: 'Chờ bổ sung chứng từ',
  confirmed: 'Đã xác nhận',
  in_use: 'Đang chơi',
  completed: 'Đã hoàn tất',
  expired: 'Hết hạn',
  payment_rejected: 'Thanh toán bị từ chối',
  cancelled_by_player: 'Người chơi đã hủy',
  cancelled_by_facility: 'Sân hủy',
}

const hasOffset = (value) => /Z$|[+-]\d{2}:\d{2}$/.test(value)

export function bookingTimestamp(value) {
  return value ? Date.parse(hasOffset(value) ? value : value + '+07:00') : NaN
}

function deadlineOnClientClock(value, serverTime, receivedAt) {
  const deadline = bookingTimestamp(value)
  if (!serverTime || hasOffset(value) !== hasOffset(serverTime)) return deadline
  const serverNow = bookingTimestamp(serverTime)
  // An offset-free deadline and the response timestamp share the same server clock.
  return Number.isFinite(serverNow) ? receivedAt + (deadline - serverNow) : deadline
}

export function withBookingDeadlines(item, serverTime, receivedAt = Date.now()) {
  return {
    ...item,
    holdDeadlineMs: deadlineOnClientClock(item.holdExpiresAt, serverTime, receivedAt),
    resubmitDeadlineMs: deadlineOnClientClock(item.resubmitDeadline, serverTime, receivedAt),
  }
}

export function canRescheduleBooking(reschedule, now) {
  return reschedule?.canReschedule === true && bookingTimestamp(reschedule.deadline) > now
}

export function bookingStartsAfter(playDate, startTime, now) {
  return Boolean(playDate && startTime) && bookingTimestamp(playDate + 'T' + startTime) > now
}

export const affectedBookingActions = [
  ['RESCHEDULE', 'Đổi slot miễn phí'],
  ['REFUND', 'Nhận hoàn tiền'],
  ['POINTS', 'Nhận điểm bồi hoàn'],
]

export function blocksNormalBookingActions(affected) {
  return affected?.status === 'PENDING' || (affected?.status === 'RESOLVED' && affected.choice !== 'RESCHEDULE')
}

export async function getHistoryDetail(item, signal) {
  const path = item.booking_type === 'package' ? '/booking-packages/' : '/bookings/'
  const { data } = await api.get(path + item.booking_id, { signal })
  return withBookingDeadlines(data.data, data.timestamp)
}

export async function enrichHistoryEntry(item) {
  if (item.status !== 'resubmit_requested') return item
  try {
    const detail = await getHistoryDetail(item)
    const status = detail.status.toLowerCase()
    return {
      ...item, status, status_name: bookingStatusLabels[status] || detail.status,
      payment_id: detail.paymentId, resubmit_deadline_ms: detail.resubmitDeadlineMs,
    }
  } catch {
    return item
  }
}

export function canPayHistoryEntry(item, now) {
  if (!item || item.booking_type === 'session') return false
  if (item.status === 'holding') return item.hold_deadline_ms > now
  return item.status === 'resubmit_requested' && Boolean(item.payment_id) && item.resubmit_deadline_ms > now
}
