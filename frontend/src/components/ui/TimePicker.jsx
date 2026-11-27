import { useEffect, useId, useRef } from 'react';
import { TimeField, DateInput, DateSegment, I18nProvider } from 'react-aria-components';
import { parseTime } from '@internationalized/date';
import { emitChange, setRef, useFormValue, useControlValidation } from './formState';
import styles from './Controls.module.css';

function safeTime(value) { try { return value ? parseTime(String(value)) : null; } catch { return null; } }

export function TimePicker({ value, defaultValue, onChange, name, disabled, readOnly, required, min, max, step = 60,
  id, ref, className = '', invalid = false, ...props }) {
  const autoId = useId();
  const [raw, setValue, bridge] = useFormValue(value, defaultValue);
  const validation = useControlValidation(bridge, raw);
  const validationId = `${id || autoId}-validation`;
  const field = useRef(null);
  const parsed = safeTime(raw);
  useEffect(() => {
    let message = '';
    if (raw) {
      if (!parsed || min && raw < min || max && raw > max) message = 'Giờ đã chọn không nằm trong phạm vi cho phép.';
      else if (step !== 'any') {
        const seconds = time => time.hour * 3600 + time.minute * 60 + time.second;
        if ((seconds(parsed) - (seconds(safeTime(min) || { hour: 0, minute: 0, second: 0 }))) % Number(step)) message = 'Vui lòng chọn giờ theo bước cho phép.';
      }
    }
    bridge.current?.setCustomValidity(message);
  });
  return <span className={styles.timeRoot} data-ui-control="time">
    <input ref={node => { setRef(bridge, node); setRef(ref, node); }} type="text" className={styles.srOnly}
      tabIndex={-1} aria-hidden="true" data-field-label={props['aria-label']} name={name} value={raw} required={required} disabled={disabled} readOnly={readOnly}
      onChange={event => { setValue(event.target.value); onChange?.(event); }}
      onInvalid={event => { validation.onInvalid(event); field.current?.querySelector('[role="spinbutton"]')?.focus(); props.onInvalid?.(event); }} />
    <I18nProvider locale="vi-VN">
      <TimeField ref={field} id={id || autoId} value={parsed} isDisabled={disabled} isReadOnly={readOnly}
        aria-label={props['aria-labelledby'] ? undefined : props['aria-label'] || 'Giờ'} aria-labelledby={props['aria-labelledby']}
        aria-describedby={[props['aria-describedby'], validation.error ? validationId : ''].filter(Boolean).join(' ') || undefined}
        isInvalid={invalid || props['aria-invalid']} hourCycle={24} granularity={Number(step) < 60 ? 'second' : 'minute'}
        onBlur={props.onBlur} onFocus={props.onFocus} onKeyDown={props.onKeyDown}
        onChange={next => { const text = next ? next.toString().slice(0, Number(step) < 60 ? 8 : 5) : ''; setValue(text); validation.clearError(); emitChange(onChange, bridge.current, text); }}>
        <DateInput className={`${styles.timeInput} ${className}`}>{segment => <DateSegment segment={segment} className={styles.timeSegment} />}</DateInput>
      </TimeField>
    </I18nProvider>
    {validation.error && <span id={validationId} className={styles.fieldError} role="alert">{validation.error}</span>}
  </span>;
}
