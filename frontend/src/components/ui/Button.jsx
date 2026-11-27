import styles from './Controls.module.css';

export function Button({ variant = 'primary', size = 'md', loading = false, loadingText,
  disabled = false, type = 'button', className = '', children, ...props }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || props['aria-busy'] || undefined}
    className={`${variant === 'custom' ? styles.customButton : styles.button} ${styles[variant] || ''} ${variant === 'custom' ? '' : styles[size]} ${className}`}>
    {loading && <span className={styles.spinner} aria-hidden="true" />}
    {loading ? loadingText || 'Đang xử lý…' : children}
  </button>;
}
export default Button;
