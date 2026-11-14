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

export function formatSlotTime(min) {
  if (min === null || min === undefined || Number.isNaN(Number(min))) return '--:--';
  const total = Number(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const minuteLabel = formatSlotTime;
