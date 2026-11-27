import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';
import styles from './CommonUI.module.css';
import { trapDialogFocus } from './dialogFocus';

export function Modal({
  open = true,
  title,
  labelledBy,
  onClose,
  onDismiss,
  busy = false,
  footer,
  className = '',
  children,
}) {
  const ref = useRef(null);
  const backdropPress = useRef(false);
  const autoTitleId = useId();
  const handleClose = onClose || onDismiss;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      const trigger = document.activeElement;
      dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
        if (trigger?.isConnected) trigger.focus();
      };
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
      tabIndex={-1}
      onKeyDown={trapDialogFocus}
      aria-label={title || undefined}
      aria-labelledby={!title && labelledBy ? labelledBy : title ? autoTitleId : undefined}
      className={[styles.dialogNative, className].filter(Boolean).join(' ')}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        backdropPress.current = event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (backdropPress.current && outside && !busy) handleClose?.();
        backdropPress.current = false;
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy && handleClose) handleClose();
      }}
    >
      {title && (
        <h2 id={autoTitleId} className={styles.modalTitle}>
          {title}
        </h2>
      )}
      {children}
      {footer && <footer className={styles.modalFooter}>{footer}</footer>}
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
