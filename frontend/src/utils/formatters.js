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
    return '0 VND';
  }
  return `${vndNumberFormatter.format(Math.round(Number(amount)))} VND`;
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

export const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Không thể hoàn thành thao tác. Vui lòng thử lại.';

const technicalCode = '(?:MSG|BR|DR|FR|NFR|UC|P)\\d+';
const standaloneCode = new RegExp(`^${technicalCode}$`);
const technicalSuffix = new RegExp(`\\s*\\(\\s*${technicalCode}(?:\\s*[,/]\\s*${technicalCode})*\\s*\\)`, 'g');

export function uiMessage(value) {
  if (typeof value !== 'string') return value;
  const message = value.replace(technicalSuffix, '').trim();
  return standaloneCode.test(message) ? 'Không thể hoàn thành thao tác. Vui lòng kiểm tra lại.' : message;
}

const notificationStatusLabels = {
  CONFIRMED: 'đã xác nhận',
  REJECTED: 'bị từ chối',
  EXPIRED: 'đã hết hạn',
  HOLDING: 'đang giữ chỗ',
  APPROVED: 'đã duyệt',
  AWAITING_CONFIRMATION: 'đang chờ xác nhận',
  RESUBMIT_REQUESTED: 'cần gửi lại chứng từ',
};

export function notificationMessage(value) {
  return uiMessage(value)?.replace(/\b(?:CONFIRMED|REJECTED|EXPIRED|HOLDING|APPROVED|AWAITING_CONFIRMATION|RESUBMIT_REQUESTED)\b/g,
    (status) => notificationStatusLabels[status]);
}

export function formatSlotTime(min) {
  if (min === null || min === undefined || Number.isNaN(Number(min))) return '--:--';
  const total = Number(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const minuteLabel = formatSlotTime;
