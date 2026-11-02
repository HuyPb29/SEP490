import axios from 'axios';

/**
 * Client gọi backend thật (/api/*), tự gắn JWT và địa điểm đang chọn.
 * Owner chọn địa điểm bằng header X-Location-Id (lưu ở bms_location_id).
 */
const http = axios.create({ baseURL: '/api' });

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('bms_user_info') || 'null');
  } catch {
    return null;
  }
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('bms_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const locationId = localStorage.getItem('bms_location_id');
  if (locationId) config.headers['X-Location-Id'] = locationId;
  return config;
});

/** Lấy phần data của ApiResponse { success, message, data }. */
export const unwrap = (res) => res.data?.data;

/** Thông điệp lỗi hiển thị cho người dùng, ưu tiên message của backend. */
export function errorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (error?.response?.status === 401) return 'Vui lòng đăng nhập để tiếp tục';
  if (error?.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này';
  return 'Không kết nối được máy chủ';
}

export default http;
