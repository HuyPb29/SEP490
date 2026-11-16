import styles from './BookingSummaryBar.module.css'

// Thanh tóm tắt dưới bảng slot, dùng chung cho đặt lẻ và đặt nhiều buổi:
// dòng chính (số khung giờ/buổi · tổng tiền), danh sách đã chọn (children) hoặc gợi ý, nút đi tiếp
export default function BookingSummaryBar({ title, hint, children, actionLabel = 'Tiếp tục đặt sân', disabled, onContinue }) {
  return <div className={styles.bar}>
    <div className={styles.content} aria-live="polite">
      <div className={styles.title}>{title}</div>
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
    <button type="button" className={styles.continueBtn} disabled={disabled} onClick={onContinue}>{actionLabel}</button>
  </div>
}
