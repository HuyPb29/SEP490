import { useEffect, useId, useRef, useState } from 'react';
import { parseDateTime } from '@internationalized/date';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { emitChange, setRef, useFormValue, useControlValidation } from './formState';
import styles from './Controls.module.css';

export function DateTimePicker({ value, defaultValue, onChange, name, disabled, readOnly, required, min, max, step = 60,
  id, ref, className = '', invalid, ...props }) {
  const autoId = useId();
  const [raw, setValue, bridge] = useFormValue(value, defaultValue);
  const validation = useControlValidation(bridge, raw);
  const validationId = `${id || autoId}-validation`;
  const [draft, setDraft] = useState(null);
  const group = useRef(null);
  const date = draft?.source === raw ? draft.date : raw.split('T')[0];
  const time = draft?.source === raw ? draft.time : raw.split('T')[1] || '';
  useEffect(() => {
    let message = '';
    if (raw) {
      try {
        const parsed = parseDateTime(raw);
        if (min && parsed.compare(parseDateTime(min)) < 0 || max && parsed.compare(parseDateTime(max)) > 0) message = 'Thời gian đã chọn không nằm trong phạm vi cho phép.';
        if (!message && step !== 'any') {
          const epoch = parsed.toDate('UTC').getTime() / 1000;
          const base = min ? parseDateTime(min).toDate('UTC').getTime() / 1000 : 0;
          if ((epoch - base) % Number(step)) message = 'Vui lòng chọn thời gian theo bước cho phép.';
        }
      } catch { message = 'Vui lòng chọn ngày và giờ hợp lệ.'; }
    } else if (date || time) message = 'Vui lòng chọn đủ ngày và giờ.';
    bridge.current?.setCustomValidity(message);
  });
  const update = (nextDate, nextTime) => {
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : '';
    setDraft({ source: next, date: nextDate, time: nextTime });
    setValue(next);
    validation.clearError();
    emitChange(onChange, bridge.current, next);
  };
  useEffect(() => {
    const form = bridge.current?.form;
    const reset = () => setDraft(null);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [bridge]);
  return <span ref={group} className={`${styles.dateTimeRoot} ${className}`} data-ui-control="datetime"
    role="group" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']}>
    <input ref={node => { setRef(bridge, node); setRef(ref, node); }} name={name} type="text" className={styles.srOnly}
      tabIndex={-1} aria-hidden="true" data-field-label={props['aria-label']} required={required} disabled={disabled} readOnly={readOnly} value={raw}
      onChange={event => { setValue(event.target.value); onChange?.(event); }}
      onInvalid={event => { validation.onInvalid(event); group.current?.querySelector('button')?.focus(); props.onInvalid?.(event); }} />
    <DatePicker {...props} aria-describedby={[props['aria-describedby'], validation.error ? validationId : ''].filter(Boolean).join(' ') || undefined}
      id={id || autoId} value={date} onChange={event => update(event.target.value, event.target.value ? time : '')}
      disabled={disabled} readOnly={readOnly} invalid={invalid} min={min?.split('T')[0]} max={max?.split('T')[0]} />
    <TimePicker {...props} aria-label={props['aria-label'] ? `${props['aria-label']} · giờ` : 'Giờ'} aria-labelledby={undefined} value={time} onChange={event => update(date, event.target.value)}
      disabled={disabled} readOnly={readOnly} invalid={invalid} step={step}
      min={date && date === min?.split('T')[0] ? min.split('T')[1] : undefined} max={date && date === max?.split('T')[0] ? max.split('T')[1] : undefined} />
    {validation.error && <span id={validationId} className={styles.fieldError} role="alert">{validation.error}</span>}
  </span>;
}
