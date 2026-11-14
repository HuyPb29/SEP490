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
    PENDING_OWNER: { label: 'Chờ Owner quyết định', tone: 'warning' },
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
};

export function resolveStatusMeta(status, category = 'booking') {
  if (!status) return { label: '—', tone: 'neutral' };
  const key = String(status).toUpperCase();
  const group = STATUS_CATALOG[category] || STATUS_CATALOG.booking;
  if (group?.[key]) return group[key];
  for (const cat of Object.values(STATUS_CATALOG)) {
    if (cat[key]) return cat[key];
  }
  return { label: String(status), tone: 'neutral' };
}
