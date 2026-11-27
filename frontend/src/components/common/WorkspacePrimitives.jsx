import { Button as UiButton, Input as UiInput, Select as UiSelect } from '../ui';
import { useId, useState } from 'react';
import { Modal as SharedModal, ConfirmDialog as SharedConfirmDialog } from './Modal';
import { LoadingState, ErrorState } from './States';
import { errorMessage, uiMessage } from '../../utils/formatters';

export function Feedback({ tone = 'info', children }) {
  return (
    <div className={'cw-feedback cw-feedback--' + tone} role={tone === 'error' ? 'alert' : 'status'}>
      {uiMessage(children)}
    </div>
  );
}

export function EmptyState({ children, action }) {
  return (
    <div className="cw-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function CheckoutProgress({ current, surcharge = false }) {
  const labels = [surcharge ? 'Đổi lịch' : 'Kiểm tra lịch', 'Chuyển khoản', 'Xác nhận'];
  return (
    <ol className="cw-checkout-progress" aria-label="Tiến trình thanh toán">
      {labels.map((label, index) => (
        <li
          key={label}
          aria-current={current === index ? 'step' : undefined}
          className={index < current ? 'cw-step-complete' : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

export function StatusPill({ children, tone = 'neutral' }) {
  return <span className={'cw-status cw-status--' + tone}>{uiMessage(children)}</span>;
}

export function Section({ title, resource, actions, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="cw-section">
      <header className="cw-section-head">
        <h2 id={id}>{title}</h2>
        {actions}
      </header>
      {resource?.loading && <LoadingState />}
      {resource?.error && <ErrorState message={resource.error} onRetry={resource.reload} />}
      {children}
    </section>
  );
}

export function Field({ label, options, hint, error, ...props }) {
  const id = useId();
  const describedBy = hint || error ? id + '-hint' : undefined;
  const control = {
    ...props,
    id: props.id || id,
    'aria-label': props['aria-label'] || label,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className="cw-field">
      <label htmlFor={control.id}><span>{label}</span></label>
      {options ? <UiSelect {...control} options={options} /> : <UiInput {...control} />}
      {describedBy && (
        <small id={describedBy} className={error ? 'cw-field-error' : undefined}>
          {uiMessage(error || hint)}
        </small>
      )}
    </div>
  );
}

export function Modal({ labelledBy, onDismiss, busy, className = '', children }) {
  return <SharedModal labelledBy={labelledBy} onDismiss={onDismiss} busy={busy} className={'cw-modal ' + className}>{children}</SharedModal>;
}

export function ConfirmDialog({ title, children, onCancel, onConfirm, tone = 'primary' }) {
  return <SharedConfirmDialog title={title} onCancel={onCancel} onConfirm={onConfirm} tone={tone}>{uiMessage(children)}</SharedConfirmDialog>;
}

export function ActionForm({
  action,
  label = 'Lưu',
  after,
  confirmation,
  children,
  tone = 'primary',
  preserve = false,
  successMessage,
  mapFieldErrors,
  errorSummaryLabels = {},
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldLabels, setFieldLabels] = useState({});
  const [pendingForm, setPendingForm] = useState(null);
  const usesFieldErrors = typeof children === 'function';

  function fieldLabel(form, name) {
    const named = form.elements.namedItem(name);
    const control = named?.nodeType ? named : named?.[0];
    const label = control?.labels?.[0];
    return errorSummaryLabels[name] || control?.dataset.fieldLabel || control?.getAttribute('aria-label')
      || label?.querySelector('span')?.textContent?.trim() || label?.textContent?.trim();
  }

  async function execute(form) {
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const result = await action(Object.fromEntries(new FormData(form)));
      if (!preserve) form.reset();
      if (successMessage !== false) setMessage({ text: successMessage || result?.data?.message || 'Đã lưu.' });
      after?.(result);
    } catch (error) {
      const errors = mapFieldErrors?.(error) ?? error.response?.data?.errors;
      if (errors && Object.keys(errors).length) {
        const entries = Object.entries(errors).map(([name, text]) => [name.split('.').at(-1), text]);
        setFieldErrors(Object.fromEntries(entries));
        setFieldLabels(Object.fromEntries(entries.map(([name]) => [name, fieldLabel(form, name)])));
      }
      else setMessage({ error: true, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (confirmation) setPendingForm(event.currentTarget);
    else execute(event.currentTarget);
  }

  function invalid(event) {
    event.preventDefault();
    const { name, validity } = event.target;
    const text = validity.valueMissing ? 'Vui lòng nhập thông tin. (MSG01)'
      : errorSummaryLabels && validity.rangeUnderflow ? `Giá trị phải từ ${event.target.min} trở lên.`
      : errorSummaryLabels && validity.rangeOverflow ? `Giá trị không được vượt quá ${event.target.max}.`
      : 'Giá trị không đúng định dạng. (MSG02)';
    setFieldErrors((current) => ({ ...current, [name]: text }));
    setFieldLabels((current) => ({ ...current, [name]: fieldLabel(event.target.form, name) }));
  }

  return (
    <>
      <form onSubmit={submit} onInvalid={invalid}
        onChange={() => { setFieldErrors({}); if (message?.error) setMessage(null); }} className="cw-form">
        <fieldset
          disabled={busy}
          className={children ? 'cw-form-fields' : 'cw-form-fields cw-form-fields--action'}
        >
          {usesFieldErrors ? children(fieldErrors) : children}
          {errorSummaryLabels ? <div className="cw-form-submit">
            <UiButton variant={tone === 'danger' ? 'danger' : 'primary'} type="submit">
              {busy ? 'Đang xử lý…' : label}
            </UiButton>
            {Object.keys(fieldErrors).length > 0 && <div className="cw-feedback cw-feedback--error" role="alert">
              <strong>Vui lòng sửa các lỗi sau:</strong>
              <ul>{Object.entries(fieldErrors).map(([name, text]) => <li key={name}>
                {fieldLabels[name] ? `${fieldLabels[name]}: ` : ''}{uiMessage(text)}
              </li>)}</ul>
            </div>}
            {message?.error && <Feedback tone="error">{message.text}</Feedback>}
          </div> : <UiButton variant={tone === 'danger' ? 'danger' : 'primary'} type="submit">
            {busy ? 'Đang xử lý…' : label}
          </UiButton>}
        </fieldset>
        {message && !(errorSummaryLabels && message.error) && (
          <Feedback tone={message.error ? 'error' : 'success'}>{message.text}</Feedback>
        )}
      </form>
      {pendingForm && (
        <ConfirmDialog
          title={label}
          tone={tone}
          onCancel={() => setPendingForm(null)}
          onConfirm={() => {
            setPendingForm(null);
            execute(pendingForm);
          }}
        >
          {typeof confirmation === 'function' ? confirmation(new FormData(pendingForm)) : confirmation}
        </ConfirmDialog>
      )}
    </>
  );
}
