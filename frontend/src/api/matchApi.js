import api from './index'

/**
 * API kèo (F7 – UC28, UC29, UC30).
 * Mọi thao tác ghi đều gọi backend; màn hình phải tải lại dữ liệu sau khi gọi thành công,
 * không tự cộng trừ số liệu ở state (D60, D61, D62, D79, D83).
 */

/** Danh sách kèo đang mở, Guest cũng xem được (D64). Giờ tính theo phút trong ngày. */
export async function getOpenMatches({ playDate, fromMinute, toMinute, page = 0, size = 50 } = {}) {
  const { data } = await api.get('/matches', {
    params: { status: 'OPEN', playDate, fromMinute, toMinute, page, size },
  })
  return data.data
}

/** Kèo của tôi: role = HOSTED | JOINED, bỏ trống = cả hai. */
export async function getMyMatches({ role, status, page = 0, size = 50 } = {}) {
  const { data } = await api.get('/me/matches', { params: { role, status, page, size } })
  return data.data
}

export async function getMatch(id) {
  const { data } = await api.get(`/matches/${id}`)
  return data.data
}

/** Mở kèo từ booking đã xác nhận đặt dưới tên đội (BR55, D112). Tổng người tối đa 8 (D60). */
export async function createMatch({ bookingId, currentPlayers, neededPlayers }) {
  const { data } = await api.post('/matches', { bookingId, currentPlayers, neededPlayers })
  return data.data
}

export async function updateMatch(id, { currentPlayers, neededPlayers }) {
  const { data } = await api.patch(`/matches/${id}`, { currentPlayers, neededPlayers })
  return data.data
}

export async function closeMatch(id) {
  const { data } = await api.post(`/matches/${id}/close`)
  return data.data
}

export async function cancelMatch(id) {
  const { data } = await api.post(`/matches/${id}/cancel`)
  return data.data
}

/** Yêu cầu tham gia của một kèo (chỉ chủ kèo xem). status ví dụ 'PENDING'. */
export async function getJoinRequests(matchId, status) {
  const { data } = await api.get(`/matches/${matchId}/join-requests`, { params: { status } })
  return data.data
}

/** Gửi yêu cầu xin vào kèo; bắt buộc đồng ý chia sẻ số điện thoại (D79). */
export async function sendJoinRequest(matchId, phoneConsent) {
  const { data } = await api.post(`/matches/${matchId}/join-requests`, { phoneConsent })
  return data.data
}

export async function cancelJoinRequest(requestId) {
  const { data } = await api.post(`/match-join-requests/${requestId}/cancel`)
  return data.data
}

export async function approveJoinRequest(requestId) {
  const { data } = await api.post(`/match-join-requests/${requestId}/approve`)
  return data.data
}

export async function rejectJoinRequest(requestId) {
  const { data } = await api.post(`/match-join-requests/${requestId}/reject`)
  return data.data
}

/** Đổi phút trong ngày thành 'HH:MM' để hiển thị. */
export function formatMinute(minute) {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0')
  const minutes = String(minute % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}
