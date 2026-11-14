import { useId, useState } from 'react';
import { fieldError } from '../../api/f1Rules';
import { Button, FormField, Input, Select } from '../../components/common';
import { F1Dialog, F1Toast } from '../../components/F1Feedback';

export default function AccountForm({ fields = [], label, submit, confirmation, success, after }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState(null);

  async function execute(form, values) {
    setPending(null);
    setBusy(true);
    setToast('');
    try {
      const result = await submit(values);
      if (!fields.some((field) => field.initial !== undefined)) form.reset();
      setToast(success?.(result) || '');
      after?.(result);
    } catch (error) {
      const response = error.response?.data;
      const message = response?.message || 'Không thể hoàn thành thao tác. Vui lòng thử lại.';
      const byField = Object.fromEntries(
        fields
          .filter(({ name }) => response?.errors?.[name])
          .map(({ name }) => [name, response.errors[name]])
      );
      if (message.includes('MSG113')) byField.currentPassword = 'Mật khẩu hiện tại không đúng.';
      setErrors(Object.keys(byField).length ? byField : { form: message });
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const validation = Object.fromEntries(
      fields.map(({ name, label: fieldLabel, required, validate, normalize }) => {
        const value = values[name];
        const error = required ? fieldError(value, fieldLabel.toLowerCase(), validate) : undefined;
        if (normalize) values[name] = normalize(value);
        return [name, error];
      })
    );
    if ('confirmation' in values) {
      if (!validation.confirmation && values.confirmation !== values.newPassword) {
        validation.confirmation = 'Xác nhận mật khẩu mới không khớp.';
      }
      delete values.confirmation;
    }
    setErrors(validation);
    setToast('');
    if (Object.values(validation).some(Boolean)) return;
    if (confirmation) setPending({ form, values });
    else execute(form, values);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="cw-form">
      <fieldset disabled={busy} className="cw-form-fields">
        {fields.map(
          ({ name, label: fieldLabel, type = 'text', autoComplete, initial, options, maxLength, required }) => {
            const controlId = `${id}-${name}`;
            const errorId = `${controlId}-error`;
            const hasError = Boolean(errors[name]);
            const controlProps = {
              id: controlId,
              name,
              defaultValue: initial,
              required,
              invalid: hasError,
              'aria-describedby': hasError ? errorId : undefined,
            };

            return (
              <FormField
                key={name}
                htmlFor={controlId}
                label={fieldLabel}
                required={required}
                error={errors[name]}
              >
                {options ? (
                  <Select {...controlProps}>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option || 'Chưa chọn'}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...controlProps}
                    type={type}
                    autoComplete={autoComplete}
                    maxLength={maxLength}
                  />
                )}
              </FormField>
            );
          }
        )}
      </fieldset>
      <div>
        <Button type="submit" variant="primary" loading={busy} loadingText="Đang xử lý…">
          {label}
        </Button>
      </div>
      {errors.form && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
          {errors.form}
        </p>
      )}
      <F1Toast>{toast}</F1Toast>
      {pending && (
        <F1Dialog
          message={confirmation}
          title={label}
          onClose={() => setPending(null)}
          onConfirm={() => execute(pending.form, pending.values)}
        />
      )}
    </form>
  );
}
