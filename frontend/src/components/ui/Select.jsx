import { Children, Fragment, isValidElement, useId, useRef, useState } from 'react';
import { Select as AriaSelect, Button as AriaButton, SelectValue, Popover, ListBox, ListBoxItem,
  ComboBox, Input as AriaInput, Group, I18nProvider } from 'react-aria-components';
import { emitChange, setRef, useFormValue, useControlValidation } from './formState';
import { useControlLabel } from './useControlLabel';
import styles from './Controls.module.css';

function textContent(value) {
  return Children.toArray(value).map(child => isValidElement(child) ? textContent(child.props.children) : String(child)).join('');
}

function childOptions(children) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment || child.type === 'optgroup') return childOptions(child.props.children)
      .map(option => ({ ...option, disabled: option.disabled || child.props.disabled }));
    if (child.type !== 'option') return [];
    const label = textContent(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
  });
}

/** Custom listbox UI, with a visually hidden native form bridge for existing forms. */
export function Select({ options, children, value, defaultValue, onChange, name, disabled = false,
  required, invalid = false, placeholder, searchable = false, className = '', id, ref,
  onBlur, onFocus, onKeyDown, onInvalid, style, ...props }) {
  const autoId = useId();
  const controlId = id || autoId;
  const items = options ? options.map(option => {
    const item = Array.isArray(option) ? { value: option[0], label: option[1] } : option;
    return { ...item, value: String(item.value), label: textContent(item.label) };
  }) : childOptions(children);
  const [raw, setValue, bridge] = useFormValue(value, defaultValue, placeholder ? '' : items[0]?.value || '');
  const validation = useControlValidation(bridge, raw);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState(undefined);
  const [query, setQuery] = useState(null);
  const selected = items.find(item => item.value === String(raw)) || (value === undefined && !placeholder ? items[0] : undefined);
  const { label, labelledBy } = useControlLabel(trigger, props['aria-label'], props['aria-labelledby']);
  const choose = key => {
    if (key == null) return;
    const next = String(key).slice(7);
    setValue(next);
    validation.clearError();
    setQuery(null);
    bridge.current?.setCustomValidity('');
    emitChange(onChange, bridge.current, next);
  };
  const a11y = { 'aria-label': label, 'aria-labelledby': labelledBy,
    'aria-describedby': [props['aria-describedby'], validation.error ? `${controlId}-validation` : ''].filter(Boolean).join(' ') || undefined, 'aria-invalid': invalid || props['aria-invalid'] || Boolean(validation.error) || undefined,
    'aria-required': required || props['aria-required'] || undefined };
  const itemNodes = list => list.map(item => <ListBoxItem key={`option:${item.value}`} id={`option:${item.value}`} textValue={item.label}
    className={styles.option}>{item.label}<span className={styles.optionCheck} aria-hidden="true">✓</span></ListBoxItem>);
  const panel = <Popover className={styles.popover} placement="bottom start" offset={6}
    UNSTABLE_portalContainer={portalContainer}>
    <ListBox className={styles.listbox} aria-label={label || 'Các lựa chọn'}
      renderEmptyState={() => <span className={styles.empty}>Không tìm thấy lựa chọn</span>}>
      {itemNodes(searchable && query != null ? items.filter(item => item.label.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))) : items)}
    </ListBox>
  </Popover>;
  const common = { isDisabled: disabled, selectedKey: selected ? `option:${selected.value}` : null,
    onSelectionChange: choose, disabledKeys: items.filter(item => item.disabled).map(item => `option:${item.value}`),
    isOpen: open, onOpenChange: next => { setPortalContainer(trigger.current?.closest('dialog') || undefined); setOpen(next); if (!next) setQuery(null); }, ...a11y };
  return <span className={styles.selectRoot} data-ui-control="select" style={style}>
    <select {...props} ref={node => { setRef(bridge, node); setRef(ref, node); }} tabIndex={-1} aria-hidden="true"
      id={`${controlId}-value`} name={name} disabled={disabled} required={required} className={styles.srOnly}
      aria-label={undefined} aria-labelledby={undefined} data-field-label={props['aria-label'] || label}
      value={selected?.value ?? ''} onChange={event => { setValue(event.target.value); onChange?.(event); }}
      onInvalid={event => { validation.onInvalid(event); trigger.current?.focus(); setPortalContainer(trigger.current?.closest('dialog') || undefined); setOpen(true); onInvalid?.(event); }}>
      {!selected && <option value="">{placeholder || 'Chọn giá trị'}</option>}
      {items.map(item => <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>)}
    </select>
    <I18nProvider locale="vi-VN">
      {searchable ? <ComboBox {...common} inputValue={query ?? selected?.label ?? ''} onInputChange={setQuery} allowsEmptyCollection menuTrigger="focus">
        <Group className={`${styles.comboGroup} ${className}`} data-invalid={a11y['aria-invalid'] || undefined}>
          <AriaInput id={controlId} ref={trigger} className={styles.comboInput} placeholder={placeholder || 'Tìm và chọn…'}
            onBlur={onBlur} onFocus={onFocus} onKeyDown={onKeyDown} />
          <AriaButton className={styles.chevronButton} aria-label="Mở danh sách"><span aria-hidden="true">⌄</span></AriaButton>
        </Group>{panel}
      </ComboBox> : <AriaSelect {...common} placeholder={placeholder}>
        <AriaButton id={controlId} ref={trigger} aria-label={label} className={`${styles.selectTrigger} ${className}`} onBlur={onBlur} onFocus={onFocus} onKeyDown={onKeyDown}>
          <SelectValue className={styles.selectValue}>{() => selected?.label || placeholder || 'Chọn giá trị'}</SelectValue><span className={styles.chevron} aria-hidden="true">⌄</span>
        </AriaButton>{panel}
      </AriaSelect>}
    </I18nProvider>
    {validation.error && <span id={`${controlId}-validation`} className={styles.fieldError} role="alert">{validation.error}</span>}
  </span>;
}
