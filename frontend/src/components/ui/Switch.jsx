import styles from './Controls.module.css';

export function Switch({ className = '', label, invalid, ...props }) {
  const control = <input {...props} type="checkbox" role="switch" aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${styles.choice} ${styles.switch} ${className}`} />;
  return label ? <label className={styles.choiceLabel}>{control}<span>{label}</span></label> : control;
}
