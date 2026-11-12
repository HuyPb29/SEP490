import api, { apiErrorMessage as formatApiError } from './index'
import { getToken } from './session'

/**
 * UC37 - Automated tasks and notifications
 * Hộp thư trong ứng dụng: mọi vai trò đã đăng nhập đều đọc được thông báo của chính mình.
 */

export function hasSession() {
  return Boolean(getToken())
}

export function apiErrorMessage(error) {
  return formatApiError(error, 'Không tải được thông báo. Vui lòng thử lại.')
}

/** GET /api/notifications — trả về PageResponse<NotificationDto>. */
export async function getNotifications({ unreadOnly = false, page = 0, size = 20 } = {}) {
  const { data } = await api.get('/notifications', {
    params: { unreadOnly, page, size },
  })
  return data?.data ?? { content: [], totalElements: 0, totalPages: 0, last: true }
}

/** GET /api/notifications/unread-count -> { unread } */
export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count')
  return data?.data?.unread ?? 0
}

/** PATCH /api/notifications/{id}/read */
export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(`/notifications/${notificationId}/read`)
  return data?.data
}

/** PATCH /api/notifications/read-all */
export async function markAllNotificationsRead() {
  await api.patch('/notifications/read-all')
}
