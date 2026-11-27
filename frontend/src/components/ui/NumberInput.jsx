import styles from './Controls.module.css';

/** Native numeric semantics, including empty/intermediate input and step validation. */
export function NumberInput({ invalid = false, className = '', ...props }) {
  return <input {...props} type="number" aria-invalid={invalid || props['aria-invalid'] || undefined}
    className={`${styles.input} ${styles.number} ${className}`} />;
}
