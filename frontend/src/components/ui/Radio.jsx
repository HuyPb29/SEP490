import styles from './Controls.module.css';

export function Radio({ className = '', label, invalid, ...props }) {
  const control = <input {...props} type="radio" aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${styles.choice} ${styles.radio} ${className}`} />;
  return label ? <label className={styles.choiceLabel}>{control}<span>{label}</span></label> : control;
}
