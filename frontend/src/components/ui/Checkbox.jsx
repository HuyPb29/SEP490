import { useLayoutEffect, useRef } from 'react';
import { setRef } from './formState';
import styles from './Controls.module.css';

export function Checkbox({ indeterminate = false, className = '', ref, label, invalid, ...props }) {
  const input = useRef(null);
  useLayoutEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  const control = <input {...props} ref={node => { input.current = node; setRef(ref, node); }} type="checkbox"
    aria-checked={indeterminate ? 'mixed' : props['aria-checked']} aria-invalid={invalid || props['aria-invalid'] || undefined}
    className={`${styles.choice} ${styles.checkbox} ${className}`} />;
  return label ? <label className={styles.choiceLabel}>{control}<span>{label}</span></label> : control;
}
