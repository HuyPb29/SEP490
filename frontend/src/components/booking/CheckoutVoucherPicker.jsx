import { useRef } from 'react';
import { money, shortDate, uiMessage } from '../../utils/formatters';
import { Button, FormField, Input, Select, LoadingState, ErrorState } from '../common';
import styles from './CheckoutVoucherPicker.module.css';

const formatVnd = value => money(value).replace(/\s*₫/, 'đ');
function voucherDescription({ voucher, expiresAt, discountAmount }, showName = true) {
  const discount = voucher.discountType === 'PERCENT' ? `${voucher.discountValue}%` : formatVnd(discountAmount);
  const expiry = [voucher.validTo, expiresAt?.slice(0, 10)].filter(Boolean).sort()[0];
  return [showName && voucher.name, `giảm ${discount}`, voucher.minOrderAmount > 0 && `đơn từ ${formatVnd(voucher.minOrderAmount)}`,
    voucher.targetGroup === 'NEW_PLAYERS' && 'khách mới tại địa điểm', expiry && `hạn ${shortDate(expiry)}`].filter(Boolean).join(' · ');
}
export default function CheckoutVoucherPicker({ vouchers, orderAmount, code, onCode, onApply, onRemove, applied, checking, disabled, error }) {
  const codeRef = useRef(null);
  const appliedItem = applied && vouchers.items.find(item => item.selection.grantId ? item.selection.grantId === applied.selection.grantId : item.selection.code === applied.selection.code);
  const groups = [
    { id: 'checkout-voucher-grant', title: 'Voucher của tôi', items: vouchers.items.filter(item => item.selection.grantId) },
    { id: 'checkout-voucher-facility', title: 'Voucher của sân', items: vouchers.items.filter(item => item.selection.code) },
  ];
  const blocked = disabled || checking || !(orderAmount > 0);
  return <div className={styles.picker}>
    {vouchers.loading && <LoadingState message="Đang tìm voucher phù hợp…" />}
    {groups.filter(group => group.items.length || vouchers.loading).map(({ id, title, items }) => <FormField key={id} label={title} htmlFor={id}>
      <Select id={id} value={items.includes(appliedItem) ? appliedItem.key : ''} disabled={blocked || items.length === 0}
        aria-describedby={error ? 'checkout-voucher-error' : undefined} aria-invalid={Boolean(error)}
        onChange={event => { const item = items.find(option => option.key === event.target.value); if (item) onApply(item.selection, item.voucher.name); }}>
        <option value="">{vouchers.loading ? 'Đang kiểm tra voucher…' : items.length ? 'Chọn voucher' : 'Chưa có voucher phù hợp'}</option>
        {items.map(item => <option key={item.key} value={item.key}>{voucherDescription(item)}</option>)}
      </Select>
    </FormField>)}
    {!vouchers.loading && !vouchers.error && !vouchers.items.length && <div className={styles.empty}><p>Chưa có voucher phù hợp trong danh sách. Bạn có thể nhập mã đã biết hoặc tiếp tục không dùng voucher.</p><Button variant="ghost" disabled={blocked || Boolean(applied)} onClick={() => codeRef.current?.focus()}>Nhập mã voucher</Button></div>}
    <FormField label="Nhập mã voucher của sân" htmlFor="checkout-voucher-code">
      <div className={styles.actions}><Input ref={codeRef} id="checkout-voucher-code" value={code} maxLength={20} disabled={blocked || Boolean(applied)} placeholder="Nhập mã giảm giá" aria-describedby={error ? 'checkout-voucher-error' : undefined} aria-invalid={Boolean(error)} onChange={event => onCode(event.target.value.toUpperCase())} />
        {applied ? <Button variant="secondary" onClick={onRemove} disabled={disabled || checking}>Bỏ voucher</Button> : <Button variant="secondary" loading={checking} disabled={blocked} onClick={() => onApply({ code: code.trim() }, code.trim())}>Áp dụng</Button>}
      </div>
    </FormField>
    {vouchers.error && <ErrorState message={vouchers.error} onRetry={vouchers.reload} />}
    {error && <p id="checkout-voucher-error" role="alert" className={styles.error}>{uiMessage(error)}</p>}
    {applied && <p role="status" className={styles.success}>✓ Đã áp dụng {applied.label}, giảm {formatVnd(applied.discountAmount)}.</p>}
    {appliedItem && <p className={styles.hint}>{voucherDescription(appliedItem, false)}</p>}
  </div>;
}
