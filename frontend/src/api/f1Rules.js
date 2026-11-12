export const messages = {
  permission: 'Bạn không có quyền thực hiện thao tác này.',
  expiredSession: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  verified: 'Xác minh email thành công. Bạn có thể đăng nhập.',
  forgot: 'Nếu email đã được đăng ký, mã đặt lại mật khẩu đã được gửi tới email này.',
  reset: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.',
  changed: 'Đã đổi mật khẩu.',
  saved: 'Đã lưu thay đổi.',
}

export const required = (label) => 'Vui lòng nhập ' + label + '.'
export const invalid = (label) => label[0].toUpperCase() + label.slice(1) + ' không đúng định dạng.'
export const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export const validUsername = (value) => /^[a-z][a-z0-9._]{5,31}$/.test(value.trim())
export const validPhone = (value) => /^0\d{9}$/.test(value.trim())
export const validPassword = (value) => /^(?=.*[A-Za-z])(?=.*[0-9])\S{8,32}$/.test(value)
export const normalizeName = (value) => value.trim().replace(/\s+/g, ' ').normalize('NFC')
export const validName = (value) => /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(normalizeName(value))
  && normalizeName(value).length >= 2 && normalizeName(value).length <= 50

export function fieldError(value, label, validate) {
  if (!value.trim()) return required(label)
  if (validate && !validate(value)) return invalid(label)
  return undefined
}

export function otpSent(email) {
  return 'Mã xác minh đã được gửi tới ' + email + '. Vui lòng nhập mã trong 10 phút.'
}

export function otpSendError(error) {
  const response = error.response
  if (response?.status === 429) {
    return response.data?.message || 'Bạn đã gửi mã quá số lần cho phép. Vui lòng thử lại sau.'
  }
  return response?.data?.message || 'Chưa gửi được mã xác minh. Vui lòng thử lại.'
}
