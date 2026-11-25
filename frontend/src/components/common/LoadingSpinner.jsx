import styles from './CommonUI.module.css';

export default function LoadingSpinner({ message = 'Đang tải…' }) {
  return <div role="status" className={styles.spinnerState}>
    <span className={styles.spinner} aria-hidden="true" />
    <span>{message || 'Đang tải…'}</span>
  </div>;
}
