import { useEffect, useRef } from 'react';
import styles from './common/CommonUI.module.css';

export function F1Dialog({ message, onClose, onConfirm, title, confirmLabel = 'Xác nhận' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title || 'Thông báo'}
      className={styles.dialogNative}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {title && <h2 className={styles.modalTitle}>{title}</h2>}
      <p className={styles.modalBody}>{message}</p>
      <div className={styles.modalActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnMd} ${onConfirm ? styles.btnSecondary : styles.btnPrimary}`}
          onClick={onClose}
        >
          {onConfirm ? 'Hủy' : 'Đã hiểu'}
        </button>
        {onConfirm && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnMd} ${styles.btnDanger}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </dialog>
  );
}

export function F1Toast({ children }) {
  if (!children) return null;
  return (
    <p role="status" className={`${styles.toast} ${styles.toastSuccess}`}>
      {children}
    </p>
  );
}
