import { useId } from 'react';
import styles from './CommonUI.module.css';

export function Input({ invalid = false, className = '', ...props }) {
  const classes = [styles.inputControl, invalid ? styles.controlInvalid : '', className]
    .filter(Boolean)
    .join(' ');
  return <input className={classes} aria-invalid={invalid || undefined} {...props} />;
}

export function Select({ invalid = false, options, children, className = '', ...props }) {
  const classes = [styles.selectControl, invalid ? styles.controlInvalid : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <select className={classes} aria-invalid={invalid || undefined} {...props}>
      {options
        ? options.map((opt) => {
            const [val, label] = Array.isArray(opt) ? opt : [opt.value, opt.label];
            return (
              <option key={val} value={val}>
                {label}
              </option>
            );
          })
        : children}
    </select>
  );
}

export function Textarea({ invalid = false, className = '', ...props }) {
  const classes = [styles.textareaControl, invalid ? styles.controlInvalid : '', className]
    .filter(Boolean)
    .join(' ');
  return <textarea className={classes} aria-invalid={invalid || undefined} {...props} />;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  action,
  className = '',
  children,
}) {
  const autoId = useId();
  const fieldId = htmlFor || autoId;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={[styles.formField, className].filter(Boolean).join(' ')}>
      {(label || action) && (
        <div className={styles.fieldLabelRow}>
          {label && (
            <label htmlFor={htmlFor} className={styles.fieldLabel}>
              {label}
              {required && <span className={styles.requiredMark} aria-hidden="true">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className={styles.fieldError}>
          {error}
        </p>
      )}
      {!error && hint && <p className={styles.fieldHint}>{hint}</p>}
    </div>
  );
}

export default FormField;
