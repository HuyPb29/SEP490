import styles from './CommonUI.module.css';

const VARIANT_CLASSES = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  danger: styles.btnDanger,
  ghost: styles.btnGhost,
};

const SIZE_CLASSES = {
  sm: styles.btnSm,
  md: styles.btnMd,
  lg: styles.btnLg,
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const variantClass = VARIANT_CLASSES[variant] || styles.btnPrimary;
  const sizeClass = SIZE_CLASSES[size] || styles.btnMd;
  const classes = [styles.btn, variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? loadingText || 'Đang xử lý…' : children}
    </button>
  );
}

export default Button;
