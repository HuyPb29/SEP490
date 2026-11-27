import { useEffect, useRef, useState } from 'react';

/** Preserve the DOM form contract used by ActionForm and existing event handlers. */
export function useFormValue(value, defaultValue, initial = '') {
  const [local, setLocal] = useState(defaultValue ?? initial);
  const node = useRef(null);
  const [, refresh] = useState(0);
  const controlled = value !== undefined;
  useEffect(() => {
    const form = node.current?.form;
    // The browser resets DOM values after dispatching reset. Synchronize after that
    // default action so a controlled bridge cannot be reset to its first option.
    const reset = event => setTimeout(() => {
      if (event.defaultPrevented) return;
      const next = controlled ? value ?? '' : defaultValue ?? initial;
      if (!controlled) setLocal(next);
      if (node.current) { node.current.value = next; node.current.setCustomValidity(''); }
      refresh(version => version + 1);
    }, 0);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [controlled, value, defaultValue, initial]);
  return [controlled ? value ?? '' : local, (next) => { if (!controlled) setLocal(next); }, node];
}

export function changeEvent(node, value, originalEvent) {
  if (node) node.value = value;
  return { target: node || { value }, currentTarget: node || { value }, nativeEvent: originalEvent,
    preventDefault() {}, stopPropagation() {} };
}

/** Restore the bridge until React commits the accepted controlled value. */
export function emitChange(onChange, node, value) {
  const previous = node?.value;
  try { onChange?.(changeEvent(node, value)); }
  finally { if (node) node.value = previous; }
}

export function setRef(ref, value) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function useControlValidation(inputRef, value) {
  const [validation, setValidation] = useState(null);
  useEffect(() => {
    const form = inputRef.current?.form;
    const clear = () => setValidation(null);
    form?.addEventListener('reset', clear);
    return () => form?.removeEventListener('reset', clear);
  }, [inputRef]);
  return {
    error: validation?.value === value ? validation.message : '',
    clearError: () => setValidation(null),
    onInvalid: event => {
      event.preventDefault();
      setValidation({ value, message: event.currentTarget.validity.valueMissing
        ? 'Vui lòng chọn thông tin bắt buộc.' : event.currentTarget.validationMessage || 'Thông tin chưa hợp lệ.' });
    },
  };
}
