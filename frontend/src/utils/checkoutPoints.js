export const defaultPointPercent = 50;

export function checkoutPointLimit(afterVoucher, balance, percent) {
  const discountLimit = Math.min(afterVoucher * percent / 100, afterVoucher - 1);
  return Math.max(0, Math.min(balance, Math.floor(discountLimit / 500)));
}

export function pointInputError(points, balance, limit, percent) {
  if (points === 0) return '';
  if (percent === 0) return 'Voucher này không dùng cùng điểm. (MSG40)';
  if (!Number.isInteger(points) || points < 2 || points > balance) {
    return 'Mỗi lần dùng điểm phải giảm ít nhất 1.000 đồng và không vượt số dư. (MSG37)';
  }
  return points > limit ? `Bạn được dùng tối đa ${limit} điểm cho khoản thanh toán này. (MSG38)` : '';
}

export function checkoutRewardErrorField(message) {
  if (!message) return null;
  if (/MSG3[45]|^Mã giảm giá.*MSG108/.test(message)) return 'voucher';
  if (/MSG3[78]|MSG40|^Số điểm.*MSG108/.test(message)) return 'points';
  return null;
}
