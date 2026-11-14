import { Button } from './Button';
import styles from './CommonUI.module.css';

export function LoadingState({ message = 'Đang tải dữ liệu…', className = '' }) {
  return (
    <div role="status" className={[styles.stateBox, className].filter(Boolean).join(' ')}>
      <p className={styles.stateDesc}>{message}</p>
    </div>
  );
}

export function EmptyState({ title, description, children, action, className = '' }) {
  return (
    <div className={[styles.stateBox, className].filter(Boolean).join(' ')}>
      {title && <p className={styles.stateTitle}>{title}</p>}
      {(description || children) && <p className={styles.stateDesc}>{description || children}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Đã xảy ra lỗi khi tải dữ liệu.', onRetry, className = '' }) {
  return (
    <div role="alert" className={[styles.errorBanner, className].filter(Boolean).join(' ')}>
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

const TOAST_TONES = {
  success: styles.toastSuccess,
  danger: styles.toastDanger,
  error: styles.toastDanger,
  info: styles.toastInfo,
};

export function Toast({ tone = 'success', onClose, children }) {
  if (!children) return null;
  const toneClass = TOAST_TONES[tone] || styles.toastSuccess;
  return (
    <div
      role={tone === 'danger' || tone === 'error' ? 'alert' : 'status'}
      className={[styles.toast, toneClass].join(' ')}
    >
      <span>{children}</span>
      {onClose && (
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng thông báo">
          ✕
        </Button>
      )}
    </div>
  );
}

export function Pagination({ page = 1, totalPages = 1, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className={styles.pagination} aria-label="Phân trang">
      <button
        type="button"
        className={styles.pageBtn}
        disabled={page <= 1}
        onClick={() => onPageChange?.(page - 1)}
      >
        ‹ Trước
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={[styles.pageBtn, p === page ? styles.pageBtnActive : ''].filter(Boolean).join(' ')}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPageChange?.(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageBtn}
        disabled={page >= totalPages}
        onClick={() => onPageChange?.(page + 1)}
      >
        Sau ›
      </button>
    </nav>
  );
}
