import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';
import styles from './CommonUI.module.css';

export function Modal({
  open = true,
  title,
  labelledBy,
  onClose,
  onDismiss,
  busy = false,
  className = '',
  children,
}) {
  const ref = useRef(null);
  const autoTitleId = useId();
  const handleClose = onClose || onDismiss;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-label={title || undefined}
      aria-labelledby={!title && labelledBy ? labelledBy : title ? autoTitleId : undefined}
      className={[styles.dialogNative, className].filter(Boolean).join(' ')}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && handleClose) handleClose();
      }}
    >
      {title && (
        <h2 id={autoTitleId} className={styles.modalTitle}>
          {title}
        </h2>
      )}
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  open = true,
  title = 'Thông báo',
  message,
  children,
  confirmText = 'Xác nhận',
  cancelText,
  tone = 'primary',
  variant,
  busy = false,
  onConfirm,
  onClose,
  onCancel,
}) {
  const handleCancel = onClose || onCancel;
  const resolvedVariant = variant || (tone === 'danger' ? 'danger' : 'primary');
  const resolvedCancelLabel = cancelText || (onConfirm ? 'Quay lại' : 'Đã hiểu');

  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={handleCancel} busy={busy}>
      <div className={styles.modalBody}>{message || children}</div>
      <div className={styles.modalActions}>
        <Button variant={onConfirm ? 'secondary' : 'primary'} onClick={handleCancel} disabled={busy}>
          {resolvedCancelLabel}
        </Button>
        {onConfirm && (
          <Button variant={resolvedVariant} onClick={onConfirm} loading={busy}>
            {confirmText}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default Modal;
