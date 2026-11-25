import { Button } from '../common'
import styles from './BookingSummaryBar.module.css'

// Existing callers keep their inline summary. The daily schedule opts into sticky/expandable presentation.
export default function BookingSummaryBar({ title, hint, children, actionLabel = 'Tiếp tục đặt sân', disabled, onContinue, sticky = false, expandable = false, onClear, note, loading = false }) {
  return <div className={sticky ? styles.reserve : undefined}>
    <div className={`${styles.bar} ${sticky ? styles.sticky : ''}`} aria-label="Tóm tắt lựa chọn đặt sân">
      <div className={styles.content}>
        <div className={styles.title} role="status" aria-live="polite">{title}</div>
        {hint && <p className={styles.hint}>{hint}</p>}
        {expandable && children ? <details className={styles.details}><summary>Xem chi tiết các khung giờ đã chọn</summary><div className={styles.ranges}>{children}</div></details> : children}
        {note && <p className={styles.note}>{note}</p>}
      </div>
      <div className={styles.actions}>
        {onClear && <Button variant="secondary" disabled={disabled || loading} onClick={onClear}>Xóa chọn</Button>}
        <Button loading={loading} disabled={disabled} onClick={onContinue}>{actionLabel}</Button>
      </div>
    </div>
  </div>
}
