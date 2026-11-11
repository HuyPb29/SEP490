import axios from 'axios'
import { clearSession, getSavedUser, getToken, getSelectedLocation } from './session'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((request) => {
  const token = request.skipAuth ? null : getToken()
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
    const selectedLocation = getSelectedLocation()
    if (getSavedUser()?.role_code === 'owner' && selectedLocation && !request.headers.has('X-Location-Id')) {
      request.headers.set('X-Location-Id', selectedLocation)
    }
  }
  return request
})

api.interceptors.response.use((response) => response, (error) => {
  const token = getToken()
  if (token && error.response?.status === 401 &&
      error.config?.headers?.get?.('Authorization') === `Bearer ${token}`) {
    clearSession()
  }
  return Promise.reject(error)
})

export async function getAllPages(path, config = {}) {
  const entries = []
  let page = 0
  let totalPages
  do {
    const { data } = await api.get(path, { ...config, params: { ...config.params, page, size: 50 } })
    entries.push(...data.data.content)
    totalPages = data.data.totalPages
    page += 1
  } while (page < totalPages)
  return entries
}

/** Token của phiên đăng nhập hiện tại (xem session.js). */
export function getAccessToken() {
  return getToken()
}

/** Câu báo lỗi để hiện cho người dùng: ưu tiên message của backend (ApiResponse.message). */
export function apiErrorMessage(err, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0]
    if (first) return String(first)
  }
  if (data?.message && data.message !== 'No message available') return data.message
  if (err?.response?.status === 401) return 'Vui lòng đăng nhập lại.'
  if (err?.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  return err?.message || fallback
}

/**
 * Ảnh cần đăng nhập (QR thanh toán, ảnh chứng từ) không mở được bằng <img src> vì thiếu header
 * Authorization: tải bằng axios rồi trả object URL để gắn vào <img>. Bên gọi tự revoke khi không dùng.
 */
export async function fetchProtectedImage(url) {
  const res = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}

export default api
