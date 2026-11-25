import { Modal } from './Modal';
import { Button } from './Button';
import styles from './Drawer.module.css';

export function Drawer({ title, onClose, busy = false, children, footer, ...props }) {
  return <Modal {...props} title={title} onClose={onClose} busy={busy} className={styles.drawer}
    footer={footer}>
    <Button variant="ghost" className={styles.close} aria-label="Đóng chi tiết" disabled={busy} onClick={onClose}>×</Button>
    <div className={styles.body}>{children}</div>
  </Modal>;
}
export default Drawer;
