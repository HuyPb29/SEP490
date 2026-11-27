import { uiMessage } from '../../utils/formatters';

/**
 * Bảng ánh xạ trạng thái chuẩn từ sheet Trang_thai trong UC_FR_NFR_v19 (1).xlsx
 */
export const STATUS_CATALOG = {
  booking: {
    HOLDING: { label: 'Đang giữ chỗ', tone: 'warning' },
    AWAITING_CONFIRMATION: { label: 'Chờ xác nhận', tone: 'info' },
    RESUBMIT_REQUESTED: { label: 'Chờ bổ sung', tone: 'warning' },
    CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
    IN_USE: { label: 'Đang sử dụng', tone: 'info' },
    COMPLETED: { label: 'Hoàn thành', tone: 'success' },
    PAYMENT_REJECTED: { label: 'Bị từ chối thanh toán', tone: 'danger' },
    EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
    CANCELLED_BY_PLAYER: { label: 'Khách hủy', tone: 'danger' },
    CANCELLED_BY_FACILITY: { label: 'Sân hủy', tone: 'danger' },
  },
  reschedule: {
    PENDING_PAYMENT: { label: 'Chờ trả thêm', tone: 'warning' },
    AWAITING_CONFIRMATION: { label: 'Chờ xác nhận', tone: 'info' },
    APPROVED: { label: 'Thành công', tone: 'success' },
    REJECTED: { label: 'Bị từ chối', tone: 'danger' },
    EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  },
  refund: {
    PENDING_REFUND: { label: 'Chờ hoàn tiền', tone: 'warning' },
    REFUNDED: { label: 'Đã hoàn', tone: 'neutral' },
  },
  match: {
    OPEN: { label: 'Đang tuyển', tone: 'success' },
    CLOSED: { label: 'Đã đóng', tone: 'neutral' },
    CANCELLED: { label: 'Đã hủy', tone: 'danger' },
    EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  },
  join_request: {
    PENDING: { label: 'Đang chờ', tone: 'warning' },
    APPROVED: { label: 'Được duyệt', tone: 'success' },
    REJECTED: { label: 'Bị từ chối', tone: 'danger' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  },
  complaint: {
    SUBMITTED: { label: 'Mới gửi', tone: 'warning' },
    PENDING_OWNER: { label: "Chờ chủ sân quyết định", tone: 'warning' },
    RESOLVED: { label: 'Đã xử lý', tone: 'success' },
    REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  },
  service_request: {
    PENDING: { label: 'Chờ xử lý', tone: 'warning' },
    APPROVED: { label: 'Đã duyệt', tone: 'success' },
    REJECTED: { label: 'Bị từ chối', tone: 'danger' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  },
  location: {
    ACTIVE: { label: 'Đang hoạt động', tone: 'success' },
    LOCKED: { label: 'Đã khóa', tone: 'danger' },
  },
  voucher: {
    PUBLISHED: { label: 'Đã phát hành', tone: 'success' },
    DRAFT: { label: 'Bản nháp', tone: 'neutral' },
    EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
    DISABLED: { label: 'Đã vô hiệu hóa', tone: 'danger' },
    AVAILABLE: { label: 'Có thể sử dụng', tone: 'success' },
    USED: { label: 'Đã sử dụng', tone: 'neutral' },
    UNAVAILABLE: { label: 'Chưa khả dụng', tone: 'neutral' },
  },
  maintenance: {
    PENDING: { label: 'Chờ duyệt', tone: 'warning' },
    APPROVED: { label: 'Đã duyệt', tone: 'success' },
    REJECTED: { label: 'Bị từ chối', tone: 'danger' },
    COMPLETED: { label: 'Hoàn thành', tone: 'neutral' },
    CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  },
  slot: {
    FREE: { label: 'Trống', tone: 'success', slot: 'free' },
    SELECTED: { label: 'Đang chọn', tone: 'success', slot: 'selected' },
    HOLDING: { label: 'Đang giữ chỗ', tone: 'warning', slot: 'holding' },
    BOOKED: { label: 'Đã đặt', tone: 'neutral', slot: 'booked' },
    IN_USE: { label: 'Đang sử dụng', tone: 'neutral', slot: 'inuse' },
    MAINTENANCE: { label: 'Bảo trì', tone: 'danger', slot: 'maintenance' },
    CLOSED: { label: 'Ngoài giờ', tone: 'neutral', slot: 'closed' },
    PAST: { label: 'Đã qua', tone: 'neutral', slot: 'closed' },
  },
  complaint_result: {
    REFUND: { label: 'Đã tạo yêu cầu hoàn tiền', tone: 'info' },
    POINTS: { label: 'Cộng điểm bồi hoàn', tone: 'success' },
    NO_COMPENSATION: { label: 'Ghi nhận, không bồi thường', tone: 'neutral' },
    LATE_PAYMENT_CONFIRMED: { label: 'Đã xác nhận thanh toán trễ', tone: 'success' },
  },
  account: {
    ACTIVE: { label: 'Hoạt động', tone: 'success' },
    LOCKED: { label: 'Đã khóa', tone: 'danger' },
    DISABLED: { label: 'Đã vô hiệu hóa', tone: 'danger' },
  },
  // Giữ nhãn loại thông báo đang dùng ở NotificationBell; attention chỉ là điểm nhấn giao diện.
  notification: {
    READ: { label: 'Đã đọc', tone: 'neutral' },
    UNREAD: { label: 'Chưa đọc', tone: 'info' },
    BOOKING_HOLD_EXPIRED: { label: 'Hết hạn giữ chỗ', tone: 'warning' },
    BOOKING_STARTED: { label: 'Bắt đầu giờ chơi', tone: 'info' },
    BOOKING_COMPLETED: { label: 'Hoàn thành buổi chơi', tone: 'success' },
    BOOKING_AFFECTED: { label: 'Lịch đặt bị ảnh hưởng', tone: 'warning', attention: true },
    SERVICE_TERM_EXPIRED: { label: 'Hết hạn dịch vụ', tone: 'danger' },
    VOUCHER_EXPIRED: { label: 'Phiếu ưu đãi hết hạn', tone: 'warning' },
    LOYALTY_REWARD: { label: 'Thưởng mốc chi tiêu', tone: 'success' },
    REFUND_REQUEST: { label: 'Yêu cầu hoàn tiền', tone: 'warning', attention: true },
    COMPLAINT_SUBMITTED: { label: 'Khiếu nại mới', tone: 'warning', attention: true },
    COMPLAINT_FORWARDED: { label: 'Khiếu nại chờ xử lý', tone: 'warning', attention: true },
    SERVICE_REGISTRATION_SUBMITTED: { label: 'Đơn đăng ký dịch vụ', tone: 'info' },
    COMPLAINT_OVERDUE: { label: 'Khiếu nại quá hạn', tone: 'danger', attention: true },
    BOOKING_ENDING_SOON: { label: 'Sắp hết giờ chơi', tone: 'warning', attention: true },
    SERVICE_TERM_RENEWAL_REMINDER: { label: 'Sắp hết kỳ hạn', tone: 'warning' },
    SERVICE_TERM_OVERDUE: { label: 'Quá hạn dịch vụ', tone: 'danger', attention: true },
    RESCHEDULE_PROOF_SUBMITTED: { label: 'Chờ xác nhận phụ thu', tone: 'warning', tag: 'Phụ thu đổi lịch', attention: true },
    VENUE_RESCHEDULE_APPROVED: { label: 'Lịch sân đã đổi', tone: 'success' },
  },
};

export function resolveStatusMeta(status, category = 'booking') {
  if (!status) return { label: '—', tone: 'neutral' };
  const key = String(status).toUpperCase();
  const group = STATUS_CATALOG[category] || STATUS_CATALOG.booking;
  if (group?.[key]) return group[key];
  for (const cat of Object.values(STATUS_CATALOG)) {
    if (cat[key]) return cat[key];
  }
  return { label: uiMessage(String(status)), tone: 'neutral' };
}
