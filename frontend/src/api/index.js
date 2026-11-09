import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

/** Token lưu khi đăng nhập thật (authApi lưu 'token', AuthPage lưu 'bms_access_token'). */
export function getAccessToken() {
  return localStorage.getItem('token') || localStorage.getItem('bms_access_token')
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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
 * url là đường dẫn backend trả về, dạng "/api/...".
 */
export async function fetchProtectedImage(url) {
  const res = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}

export default api
