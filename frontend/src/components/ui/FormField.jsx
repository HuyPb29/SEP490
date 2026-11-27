import { Children, cloneElement, isValidElement, useId } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { DateTimePicker } from './DateTimePicker';
import { TimePicker } from './TimePicker';
import { MonthPicker } from './MonthPicker';
import { NumberInput } from './NumberInput';
import { FileInput } from './FileInput';
import { Checkbox } from './Checkbox';
import { Radio } from './Radio';
import { Switch } from './Switch';
import { Slider } from './Slider';
import styles from '../common/CommonUI.module.css';

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
  const controls = Children.toArray(children);
  const control = controls.find((child) => isValidElement(child) &&
    (['input', 'select', 'textarea'].includes(child.type) || [Input, Select, Textarea, DatePicker, DateTimePicker, TimePicker, MonthPicker, NumberInput, FileInput, Checkbox, Radio, Switch, Slider].includes(child.type)));
  const fieldId = htmlFor || control?.props.id || autoId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = !error && hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={[styles.formField, className].filter(Boolean).join(' ')}>
      {(label || action) && (
        <div className={styles.fieldLabelRow}>
          {label && (
            <label id={`${fieldId}-label`} htmlFor={fieldId} className={styles.fieldLabel}>
              {label}
              {required && <span className={styles.requiredMark} aria-hidden="true" />}
            </label>
          )}
          {action}
        </div>
      )}
      {controls.map((child) => child === control ? cloneElement(child, {
        id: fieldId,
        'aria-label': child.props['aria-label'] || (typeof label === 'string' ? label : undefined),
        'aria-labelledby': child.props['aria-labelledby'] || (label ? `${fieldId}-label` : undefined),
        'aria-invalid': error ? true : child.props['aria-invalid'] ?? (child.props.invalid || undefined),
        'aria-required': required || child.props['aria-required'],
        'aria-describedby': [...new Set([child.props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ').split(' '))].filter(Boolean).join(' ') || undefined,
      }) : child)}
      {error && (
        <p id={errorId} role="alert" className={styles.fieldError}>
          {error}
        </p>
      )}
      {!error && hint && <p id={hintId} className={styles.fieldHint}>{hint}</p>}
    </div>
  );
}

export default FormField;
