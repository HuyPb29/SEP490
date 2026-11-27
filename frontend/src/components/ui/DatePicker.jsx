import { useEffect, useId, useRef, useState } from 'react';
import { Calendar, CalendarGrid, CalendarGridHeader, CalendarGridBody, CalendarHeaderCell, CalendarCell,
  Button as AriaButton, Heading, Dialog, DialogTrigger, Popover, I18nProvider } from 'react-aria-components';
import { parseDate, today, getLocalTimeZone } from '@internationalized/date';
import { Button } from './Button';
import { useControlLabel } from './useControlLabel';
import { emitChange, setRef, useFormValue, useControlValidation } from './formState';
import styles from './Controls.module.css';

function safeDate(value) {
  try { return value ? parseDate(String(value)) : null; } catch { return null; }
}

export function DatePicker({ value, defaultValue, onChange, name, disabled, readOnly, required,
  min, max, minDate = min, maxDate = max, disabledDates, invalid = false, placeholder = 'Chọn ngày',
  className = '', id, ref, onBlur, onFocus, onInvalid, onKeyDown, style, ...props }) {
  const autoId = useId();
  const controlId = id || autoId;
  const [raw, setValue, bridge] = useFormValue(value, defaultValue);
  const validation = useControlValidation(bridge, raw);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(null);
  const [portalContainer, setPortalContainer] = useState(undefined);
  const trigger = useRef(null);
  const { label, labelledBy } = useControlLabel(trigger, props['aria-label'], props['aria-labelledby']);
  const selected = safeDate(raw);
  const lower = safeDate(minDate);
  const upper = safeDate(maxDate);
  const now = today(getLocalTimeZone());
  const unavailable = date => typeof disabledDates === 'function' ? disabledDates(date.toString())
    : disabledDates?.some(item => String(item) === date.toString()) || false;
  const allowed = date => date && (!lower || date.compare(lower) >= 0) && (!upper || date.compare(upper) <= 0) && !unavailable(date);
  useEffect(() => {
    const node = bridge.current;
    if (!node) return;
    node.setCustomValidity(raw && !allowed(safeDate(raw)) ? 'Ngày đã chọn không nằm trong phạm vi cho phép.' : '');
  });
  const choose = date => {
    const next = date?.toString() || '';
    setValue(next);
    validation.clearError();
    bridge.current?.setCustomValidity('');
    emitChange(onChange, bridge.current, next);
    setOpen(false);
  };
  const initialFocus = allowed(selected) ? selected : lower && now.compare(lower) < 0 ? lower : upper && now.compare(upper) > 0 ? upper : now;
  return <span className={styles.dateRoot} data-ui-control="date" style={style}>
    <input ref={node => { setRef(bridge, node); setRef(ref, node); }} id={`${controlId}-value`} name={name} type="text"
      className={styles.srOnly} tabIndex={-1} aria-hidden="true" data-field-label={props['aria-label'] || label} value={raw} required={required} disabled={disabled} readOnly={readOnly} min={minDate} max={maxDate}
      onChange={event => { setValue(event.target.value); onChange?.(event); }}
      onInvalid={event => { validation.onInvalid(event); trigger.current?.focus(); setPortalContainer(trigger.current?.closest('dialog') || undefined); setOpen(true); onInvalid?.(event); }} />
    <I18nProvider locale="vi-VN">
      <DialogTrigger isOpen={open} onOpenChange={next => { setOpen(next); if (next) { setFocused(initialFocus); setPortalContainer(trigger.current?.closest('dialog') || undefined); } }}>
        <AriaButton ref={trigger} id={controlId} isDisabled={disabled || readOnly} className={`${styles.dateTrigger} ${className}`}
          aria-label={label} aria-labelledby={labelledBy} aria-describedby={[props['aria-describedby'], validation.error ? `${controlId}-validation` : ''].filter(Boolean).join(' ') || undefined}
          aria-invalid={invalid || props['aria-invalid'] || Boolean(validation.error) || undefined} aria-required={required || props['aria-required'] || undefined}
          onBlur={onBlur} onFocus={onFocus} onKeyDown={onKeyDown}>
          <span className={!selected ? styles.placeholder : undefined}>{selected ? `${String(selected.day).padStart(2, '0')}/${String(selected.month).padStart(2, '0')}/${selected.year}` : placeholder}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
        </AriaButton>
        <Popover className={`${styles.popover} ${styles.datePopover}`} placement="bottom start" offset={6}
          UNSTABLE_portalContainer={portalContainer}>
          <Dialog className={styles.calendarDialog} aria-label={label || 'Chọn ngày'}>
            <Calendar aria-label="Lịch chọn ngày" className={styles.calendar} firstDayOfWeek="mon" value={selected}
              focusedValue={focused || initialFocus} onFocusChange={setFocused} onChange={choose}
              minValue={lower || undefined} maxValue={upper || undefined} isDateUnavailable={unavailable}>
              <header className={styles.calendarHeader}>
                <AriaButton slot="previous" aria-label="Tháng trước" className={styles.calendarNav}>‹</AriaButton>
                <Heading>{`Tháng ${(focused || initialFocus).month} ${(focused || initialFocus).year}`}</Heading>
                <AriaButton slot="next" aria-label="Tháng sau" className={styles.calendarNav}>›</AriaButton>
              </header>
              <CalendarGrid className={styles.calendarGrid} weekdayStyle="short">
                <CalendarGridHeader>{day => <CalendarHeaderCell className={styles.weekday}>{day.replace(/^Th(?:ứ)?\s*/i, 'T')}</CalendarHeaderCell>}</CalendarGridHeader>
                <CalendarGridBody>{date => <CalendarCell date={date} className={styles.day} data-today={date.compare(now) === 0 || undefined} />}</CalendarGridBody>
              </CalendarGrid>
            </Calendar>
            <footer className={styles.calendarFooter}>
              <Button variant="ghost" size="sm" disabled={!allowed(now)} onClick={() => choose(now)}>Hôm nay</Button>
              <Button variant="ghost" size="sm" disabled={!raw} onClick={() => choose(null)}>Xoá</Button>
            </footer>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </I18nProvider>
    {validation.error && <span id={`${controlId}-validation`} className={styles.fieldError} role="alert">{validation.error}</span>}
  </span>;
}
