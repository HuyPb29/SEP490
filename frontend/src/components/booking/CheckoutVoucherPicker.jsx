import { formatVnd, uiMessage } from '../../utils/formatters';
import styles from './CheckoutVoucherPicker.module.css';

function voucherDescription({ voucher, expiresAt, discountAmount }, showName = true) {
  const discount = voucher.discountType === 'PERCENT' ? `${voucher.discountValue}%` : formatVnd(discountAmount);
  const expiry = [voucher.validTo, expiresAt?.slice(0, 10)].filter(Boolean).sort()[0];
  return [
    showName && voucher.name,
    `giảm ${discount}`,
    voucher.minOrderAmount > 0 && `đơn từ ${formatVnd(voucher.minOrderAmount)}`,
    voucher.targetGroup === 'NEW_PLAYERS' && 'khách mới tại địa điểm',
    expiry && `hạn ${expiry.split('-').reverse().join('/')}`,
  ].filter(Boolean).join(' · ');
}

export default function CheckoutVoucherPicker({ vouchers, orderAmount, code, onCode, onApply, onRemove,
  applied, checking, disabled, error }) {
  const appliedItem = applied && vouchers.items.find((item) =>
    item.selection.grantId ? item.selection.grantId === applied.selection.grantId
      : item.selection.code === applied.selection.code);
  const groups = [
    { id: 'checkout-voucher-grant', title: 'Voucher của tôi', items: vouchers.items.filter((item) => item.selection.grantId) },
    { id: 'checkout-voucher-facility', title: 'Voucher của sân', items: vouchers.items.filter((item) => item.selection.code) },
  ];
  const blocked = disabled || checking || !(orderAmount > 0);
  return (
    <div className={styles.picker}>
      {groups.map(({ id, title, items }) => (
        <div className={styles.group} key={id}>
          <label htmlFor={id}>{title}</label>
          <select id={id} className={styles.input} value={items.includes(appliedItem) ? appliedItem.key : ''}
            disabled={blocked || items.length === 0} aria-describedby={error ? 'checkout-voucher-error' : undefined}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              const item = items.find((option) => option.key === event.target.value);
              if (item) onApply(item.selection, item.voucher.name);
            }}>
            <option value="">{vouchers.loading ? 'Đang kiểm tra voucher…' : items.length ? 'Chọn voucher' : 'Không có voucher dùng được cho đơn này'}</option>
            {items.map((item) => <option key={item.key} value={item.key}>{voucherDescription(item)}</option>)}
          </select>
        </div>
      ))}
      <div className={styles.group}>
        <label htmlFor="checkout-voucher-code">Nhập mã voucher của sân</label>
        <div className={styles.actions}>
          <input id="checkout-voucher-code" className={styles.input} value={code} maxLength={20} disabled={blocked || Boolean(applied)}
            placeholder="Nhập mã giảm giá"
            aria-describedby={error ? 'checkout-voucher-error' : undefined}
            aria-invalid={Boolean(error)} onChange={(event) => onCode(event.target.value.toUpperCase())} />
          {applied
            ? <button type="button" className="cw-secondary" onClick={onRemove} disabled={disabled}>Bỏ voucher</button>
            : <button type="button" className="cw-secondary" disabled={blocked}
                onClick={() => onApply({ code: code.trim() }, code.trim())}>{checking ? 'Đang kiểm tra…' : 'Áp dụng'}</button>}
        </div>
      </div>
      {vouchers.error && <small role="status">{vouchers.error}</small>}
      {error && <small id="checkout-voucher-error" className="cw-field-error" role="alert">{uiMessage(error)}</small>}
      {applied && <p className={styles.success} role="status">
        Đã áp dụng {applied.label}, giảm {formatVnd(applied.discountAmount)}.
      </p>}
      {appliedItem && <small>{voucherDescription(appliedItem, false)}</small>}
    </div>
  );
}
