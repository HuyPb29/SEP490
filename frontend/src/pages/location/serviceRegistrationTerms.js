/**
 * Feature: F2 - Quản lý địa điểm
 * BR65: 8 điều khoản sử dụng dịch vụ hiện trên form đăng ký (UC05). Chép nguyên văn từ BR65 trong UC_FR_NFR_v20.xlsx;
 * sửa BR65 thì sửa ở đây.
 */
export const SERVICE_TERMS = [
  'Tiền thuê tính theo số sân con và số năm thuê (P35); thời gian thuê tối thiểu 1 năm (DR29). Chủ sân chuyển khoản đủ tiền thuê vào tài khoản của bên vận hành; bên vận hành chỉ duyệt khi đã nhận đủ tiền.',
  'Tiền thuê đã trả không hoàn lại khi chủ sân ngừng dùng trước khi hết thời hạn sử dụng dịch vụ. Nếu yêu cầu bị từ chối, bên vận hành liên hệ và hoàn lại toàn bộ tiền đã chuyển.',
  'Số sân con không vượt số đã đăng ký. Muốn thêm sân, chủ sân gửi yêu cầu, chuyển khoản và đính kèm chứng từ; phí theo số sân và số tháng còn lại. Phần lẻ đến 15 ngày bỏ, từ 16 ngày tính thêm một tháng; phí chốt khi gửi đơn.',
  "Hệ thống báo trước khi hết hạn; quá hạn không gia hạn thì địa điểm bị khóa, không hiển thị và không nhận đặt sân mới, dữ liệu không bị xóa, chủ sân còn tải được dữ liệu quản lý trong thời hạn P29 (BR62).",
  "Tiền khách đặt sân chuyển thẳng vào tài khoản của chủ sân; chủ sân tự chịu trách nhiệm về thông tin địa điểm, giá, giờ mở cửa, xác nhận thanh toán, hoàn tiền và giải quyết với khách, kể cả các đặt sân chưa chơi khi địa điểm bị khóa.",
  'Chủ sân chỉ dùng thông tin khách (họ tên, số điện thoại) để phục vụ việc đặt sân và tự chịu trách nhiệm bảo mật dữ liệu trong file tải về (FR122).',
  'Bên vận hành không xem doanh thu, giao dịch và khoản hoàn của địa điểm (BR63).',
  'Chủ sân giữ bí mật tên đăng nhập, mật khẩu nhận qua email; bên vận hành được khóa địa điểm khi chủ sân vi phạm các điều khoản này.',
]

/** P35 mặc định, dùng khi chưa tải được từ backend. */
export const DEFAULT_REFERENCE_FEE = 10_000_000
export const DEFAULT_REFERENCE_COURTS = 9

/**
 * P35: 10.000.000 × số sân con ÷ 9 × số năm thuê, làm tròn lên đến nghìn đồng (4 sân, 1 năm = 4.445.000).
 * Chỉ để hiện trên form; backend tính lại khi lưu (DR19).
 */
export function rentalAmount(courtCount, rentalYears, fee = DEFAULT_REFERENCE_FEE, referenceCourts = DEFAULT_REFERENCE_COURTS) {
  const courts = Number(courtCount)
  const years = Number(rentalYears)
  if (!Number.isInteger(courts) || courts < 1 || !Number.isInteger(years) || years < 1) return null
  return Math.ceil((fee * courts * years) / (referenceCourts * 1000)) * 1000
}

export function formatVnd(amount) {
  if (amount == null) return '—'
  return `${Number(amount).toLocaleString('vi-VN')} đồng`
}
