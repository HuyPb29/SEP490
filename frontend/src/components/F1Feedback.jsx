import { Button as UiButton } from './ui';
import { Modal } from './common/Modal';
import { uiMessage } from '../utils/formatters';
import styles from './common/CommonUI.module.css';

export function F1Dialog({ message, onClose, onConfirm, title, confirmLabel = 'Xác nhận' }) {

  return (
    <Modal title={title || 'Thông báo'} onClose={onClose}>
      <p className={styles.modalBody}>{uiMessage(message)}</p>
      <div className={styles.modalActions}>
        <UiButton variant={onConfirm ? 'secondary' : 'primary'}
          type="button"
          onClick={onClose}
        >
          {onConfirm ? 'Hủy' : 'Đã hiểu'}
        </UiButton>
        {onConfirm && (
          <UiButton variant="danger"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </UiButton>
        )}
      </div>
    </Modal>
  );
}

export function F1Toast({ children }) {
  if (!children) return null;
  return (
    <p role="status" className={`${styles.toast} ${styles.toastSuccess}`}>
      {uiMessage(children)}
    </p>
  );
}
