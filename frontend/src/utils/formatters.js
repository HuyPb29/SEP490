const vndCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const vndNumberFormatter = new Intl.NumberFormat('vi-VN');

const vnDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh',
});

export const money = (amount) =>
  vndCurrencyFormatter.format(Number(amount || 0));

export const formatVnd = (amount) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '0 đồng';
  }
  return `${vndNumberFormatter.format(Math.round(Number(amount)))} đồng`;
};

export const formatMoney = formatVnd;

export const today = () => vnDateFormatter.format(new Date());

export const shortDate = (value) => {
  if (!value) return '—';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const dateTime = (value) => {
  if (!value) return '—';
  const str = String(value);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str.replace('T', ' ');
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const errorMessage = (error) => uiMessage(
  error?.response?.data?.message ||
  error?.message ||
  'Không thể hoàn thành thao tác. Vui lòng thử lại.');

const technicalCode = '(?:MSG|BR|DR|FR|NFR|UC|P)\\d+';
const standaloneCode = new RegExp(`^${technicalCode}$`);
const technicalSuffix = new RegExp(`\\s*\\(\\s*${technicalCode}(?:\\s*[,/]\\s*${technicalCode})*\\s*\\)`, 'g');

export function uiMessage(value) {
  if (typeof value !== 'string') return value;
  const message = value.replace(technicalSuffix, '').trim();
  if (/^(Network Error|Failed to fetch|Load failed)$/i.test(message)) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
  if (/^Request failed with status code \d+$/i.test(message)) return 'Không thể hoàn thành thao tác. Vui lòng thử lại.';
  if (message === 'No message available') return 'Không có nội dung thông báo.';
  if (message === 'Bad credentials') return 'Email hoặc mật khẩu không chính xác.';
  if (/^must not be (null|blank|empty)$/i.test(message)) return 'Vui lòng điền thông tin bắt buộc.';
  if (/^must be (true|false)$/i.test(message)) return 'Vui lòng kiểm tra lựa chọn xác nhận.';
  if (/^must be a well-formed email address$/i.test(message)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  const translated = message.replace(notificationStatusPattern, (status) => notificationStatusLabels[status])
    .replace(/\b(?:bookings?|slots?|vouchers?|owner|staff|admin|player)\b/gi, (word) => {
      const text = notificationTerms[word.toLowerCase()];
      return /^[A-Z]/.test(word) ? text.charAt(0).toUpperCase() + text.slice(1) : text;
    });
  return standaloneCode.test(message) ? 'Không thể hoàn thành thao tác. Vui lòng kiểm tra lại.' : translated;
}

const notificationStatusLabels = {
  CONFIRMED: 'đã xác nhận',
  REJECTED: 'bị từ chối',
  EXPIRED: 'đã hết hạn',
  HOLDING: 'đang giữ chỗ',
  APPROVED: 'đã duyệt',
  AWAITING_CONFIRMATION: 'đang chờ xác nhận',
  RESUBMIT_REQUESTED: 'cần gửi lại chứng từ',
  IN_USE: 'đang sử dụng',
  COMPLETED: 'đã hoàn thành',
  CANCELLED_BY_PLAYER: 'người chơi đã hủy',
  CANCELLED_BY_FACILITY: 'sân đã hủy',
  PAYMENT_REJECTED: 'thanh toán bị từ chối',
  PENDING: 'đang chờ xử lý',
  OPEN: 'đang mở',
  CLOSED: 'đã đóng',
  CANCELLED: 'đã hủy',
  ACTIVE: 'đang hoạt động',
  LOCKED: 'đã khóa',
  DISABLED: 'đã tạm ngừng',
  DRAFT: 'bản nháp',
  PUBLISHED: 'đã phát hành',
  STOPPED: 'đã dừng',
  SUBMITTED: 'đã gửi',
  PENDING_OWNER: 'đang chờ chủ sân xử lý',
  RESOLVED: 'đã xử lý',
  REFUNDED: 'đã hoàn tiền',
  PAID: 'đã thanh toán',
  UNVERIFIED: 'chưa xác thực',
  AVAILABLE: 'có thể sử dụng',
  USED: 'đã sử dụng',
  UNAVAILABLE: 'chưa khả dụng',
  PENDING_REFUND: 'chờ hoàn tiền',
  SINGLE: 'đặt sân lẻ',
  SESSION: 'buổi trong gói',
  WALK_IN: 'đặt tại quầy',
  DAY: 'đặt theo ngày',
  CUSTOM: 'nhiều buổi tự chọn',
  RECURRING: 'đặt định kỳ',
  CAMPAIGN: 'chương trình ưu đãi',
  LOYALTY: 'ưu đãi tích lũy',
};

const notificationStatusPattern = new RegExp(`\\b(?:${Object.keys(notificationStatusLabels).join('|')})\\b`, 'g');
const notificationTerms = {
  booking: 'đơn đặt sân', bookings: 'đơn đặt sân',
  slot: 'khung giờ', slots: 'khung giờ',
  voucher: 'phiếu ưu đãi', vouchers: 'phiếu ưu đãi',
  owner: 'chủ sân', staff: 'nhân viên', admin: 'quản trị viên', player: 'người chơi',
};

export function notificationMessage(value) {
  if (typeof value !== 'string') return value;
  return uiMessage(value).normalize('NFC')
    .replace(notificationStatusPattern, (status) => notificationStatusLabels[status])
    .replace(/\b(?:bookings?|slots?|vouchers?|owner|staff|admin|player)\b/gi, (word) => {
      const translated = notificationTerms[word.toLowerCase()];
      return /^[A-Z]/.test(word) ? translated.charAt(0).toUpperCase() + translated.slice(1) : translated;
    });
}

export function formatSlotTime(min) {
  if (min === null || min === undefined || Number.isNaN(Number(min))) return '--:--';
  const total = Number(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const minuteLabel = formatSlotTime;
