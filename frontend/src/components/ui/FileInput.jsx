import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';
import { setRef, useControlValidation } from './formState';
import styles from './Controls.module.css';

export function FileInput({ onChange, disabled, selectedFileName, inputRef, ref, className = '', chooseText = 'Chọn tệp', emptyText = 'Chưa chọn tệp', invalid, style, ...props }) {
  const input = useRef(null);
  const [filename, setFilename] = useState('');
  const validation = useControlValidation(input, selectedFileName ?? filename);
  const autoId = useId();
  const validationId = `${props.id || autoId}-validation`;
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setFilename('');
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);
  const display = selectedFileName ?? filename;
  return <span className={`${styles.filePicker} ${className}`} style={style}>
    <input {...props} ref={node => { input.current = node; setRef(inputRef, node); setRef(ref, node); }} type="file" disabled={disabled}
      className={styles.srOnly} tabIndex={-1} aria-hidden="true" aria-invalid={invalid || props['aria-invalid'] || undefined} onInvalid={event => { validation.onInvalid(event); event.currentTarget.nextElementSibling?.focus(); props.onInvalid?.(event); }}
      onChange={event => { setFilename(Array.from(event.target.files || []).map(file => file.name).join(', ')); validation.clearError(); onChange?.(event); }} />
    <Button variant="outline" disabled={disabled} aria-describedby={[props['aria-describedby'], validation.error ? validationId : ''].filter(Boolean).join(' ') || undefined}
      aria-invalid={invalid || props['aria-invalid'] || Boolean(validation.error) || undefined}
      aria-label={props['aria-label'] ? `${chooseText}: ${props['aria-label']}` : chooseText}
      onClick={() => input.current?.click()}>{chooseText}</Button>
    <span className={styles.filename} title={display}>{display || emptyText}</span>
    {validation.error && <span id={validationId} className={styles.fieldError} role="alert">{validation.error}</span>}
  </span>;
}
