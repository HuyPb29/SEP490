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

export function bookingTimestamp(value) {
  return value ? Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+07:00') : NaN
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
  return data.data
}

export async function enrichHistoryEntry(item) {
  if (item.status !== 'resubmit_requested') return item
  try {
    const detail = await getHistoryDetail(item)
    const status = detail.status.toLowerCase()
    return {
      ...item, status, status_name: bookingStatusLabels[status] || detail.status,
      payment_id: detail.paymentId, resubmit_deadline: detail.resubmitDeadline,
    }
  } catch {
    return item
  }
}

export function canPayHistoryEntry(item, now) {
  if (!item || item.booking_type === 'session') return false
  if (item.status === 'holding') return bookingTimestamp(item.hold_expires_at) > now
  return item.status === 'resubmit_requested' && Boolean(item.payment_id) && bookingTimestamp(item.resubmit_deadline) > now
}
