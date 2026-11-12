import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../../utils/formatters';

export function Feedback({ tone = 'info', children }) {
  return (
    <div className={'cw-feedback cw-feedback--' + tone} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
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
  return <span className={'cw-status cw-status--' + tone}>{children}</span>;
}

export function Section({ title, resource, actions, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="cw-section">
      <header className="cw-section-head">
        <h2 id={id}>{title}</h2>
        {actions}
      </header>
      {resource?.loading && <Feedback>Đang tải…</Feedback>}
      {resource?.error && (
        <Feedback tone="error">
          <span>{resource.error}</span>
          <button className="cw-secondary" type="button" onClick={resource.reload}>
            Thử lại
          </button>
        </Feedback>
      )}
      {children}
    </section>
  );
}

export function Field({ label, options, hint, error, ...props }) {
  const id = useId();
  const describedBy = hint || error ? id + '-hint' : undefined;
  const control = {
    ...props,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  };
  return (
    <label className="cw-field">
      <span>{label}</span>
      {options ? (
        <select {...control}>
          {options.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <input {...control} />
      )}
      {describedBy && (
        <small id={describedBy} className={error ? 'cw-field-error' : undefined}>
          {error || hint}
        </small>
      )}
    </label>
  );
}

export function Modal({ labelledBy, onDismiss, busy, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={'cw-modal ' + className}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}

export function ConfirmDialog({ title, children, onCancel, onConfirm, tone = 'primary' }) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onDismiss={onCancel}>
      <div className="cw-modal-content">
        <h2 id={titleId}>{title}</h2>
        <p>{children}</p>
        <div className="cw-modal-actions">
          <button type="button" className="cw-secondary" onClick={onCancel}>
            Quay lại
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'cw-danger' : 'action'}
            onClick={onConfirm}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </Modal>
  );
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
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingForm, setPendingForm] = useState(null);
  const usesFieldErrors = typeof children === 'function';

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
      if (usesFieldErrors && errors && Object.keys(errors).length) {
        setFieldErrors(Object.fromEntries(Object.entries(errors).map(([name, text]) => [name.split('.').at(-1), text])));
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
    if (!usesFieldErrors) return;
    event.preventDefault();
    const { name, validity } = event.target;
    const text = validity.valueMissing ? 'Vui lòng nhập thông tin. (MSG01)' : 'Giá trị không đúng định dạng. (MSG02)';
    setFieldErrors((current) => ({ ...current, [name]: text }));
  }

  return (
    <>
      <form onSubmit={submit} onInvalid={invalid}
        onChange={usesFieldErrors ? () => setFieldErrors({}) : undefined} className="cw-form">
        <fieldset
          disabled={busy}
          className={children ? 'cw-form-fields' : 'cw-form-fields cw-form-fields--action'}
        >
          {usesFieldErrors ? children(fieldErrors) : children}
          <button className={tone === 'danger' ? 'cw-danger' : 'action'} type="submit">
            {busy ? 'Đang xử lý…' : label}
          </button>
        </fieldset>
        {message && (
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
          {confirmation}
        </ConfirmDialog>
      )}
    </>
  );
}
