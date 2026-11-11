import axios from 'axios'

/**
 * UC37 - Automated tasks and notifications
 * Hộp thư trong ứng dụng: mọi vai trò đã đăng nhập đều đọc được thông báo của chính mình.
 *
 * Backend không phân biệt địa điểm cho thông báo nên KHÔNG gửi X-Location-Id.
 */

const TOKEN_KEYS = ['token', 'bms_access_token']

function getToken() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key)
    if (value && value !== 'undefined' && value !== 'null') return value
  }
  return null
}

export function hasSession() {
  return Boolean(getToken())
}

function createClient() {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return axios.create({ baseURL: '/api', headers })
}

/** Đọc message lỗi theo đúng định dạng ApiResponse của backend. */
export function apiErrorMessage(error) {
  if (error?.response?.status === 401) return 'Please sign in again to see your notifications.'
  return error?.response?.data?.message || error?.message || 'Unexpected error.'
}

/** GET /api/notifications — trả về PageResponse<NotificationDto>. */
export async function getNotifications({ unreadOnly = false, page = 0, size = 20 } = {}) {
  const { data } = await createClient().get('/notifications', {
    params: { unreadOnly, page, size },
  })
  return data?.data ?? { content: [], totalElements: 0, totalPages: 0, last: true }
}

/** GET /api/notifications/unread-count -> { unread } */
export async function getUnreadCount() {
  const { data } = await createClient().get('/notifications/unread-count')
  return data?.data?.unread ?? 0
}

/** PATCH /api/notifications/{id}/read */
export async function markNotificationRead(notificationId) {
  const { data } = await createClient().patch(`/notifications/${notificationId}/read`)
  return data?.data
}

/**
 * PATCH /api/notifications/read-all
 * Backend trả về số dòng vừa cập nhật (không phải số chưa đọc còn lại), nên
 * không dùng giá trị đó làm số đếm: gọi xong thì số chưa đọc luôn là 0.
 */
export async function markAllNotificationsRead() {
  await createClient().patch('/notifications/read-all')
}
