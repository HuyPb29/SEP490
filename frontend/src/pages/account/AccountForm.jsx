import { useId, useState } from 'react'
import { fieldError } from '../../api/f1Rules'
import { F1Dialog, F1Toast } from '../../components/F1Feedback'

export default function AccountForm({ fields = [], label, submit, confirmation, success, after }) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState('')
  const [pending, setPending] = useState(null)

  async function execute(form, values) {
    setPending(null)
    setBusy(true)
    setToast('')
    try {
      const result = await submit(values)
      if (!fields.some((field) => field.initial !== undefined)) form.reset()
      setToast(success?.(result) || '')
      after?.(result)
    } catch (error) {
      const response = error.response?.data
      const message = response?.message || 'Không thể hoàn thành thao tác. Vui lòng thử lại.'
      const byField = Object.fromEntries(fields
        .filter(({ name }) => response?.errors?.[name])
        .map(({ name }) => [name, response.errors[name]]))
      if (message.includes('MSG113')) byField.currentPassword = 'Mật khẩu hiện tại không đúng.'
      setErrors(Object.keys(byField).length ? byField : { form: message })
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    const validation = Object.fromEntries(fields.map(({ name, label, required, validate, normalize }) => {
      const value = values[name]
      const error = required ? fieldError(value, label.toLowerCase(), validate) : undefined
      if (normalize) values[name] = normalize(value)
      return [name, error]
    }))
    if ('confirmation' in values) {
      if (!validation.confirmation && values.confirmation !== values.newPassword) {
        validation.confirmation = 'Xác nhận mật khẩu mới không khớp.'
      }
      delete values.confirmation
    }
    setErrors(validation)
    setToast('')
    if (Object.values(validation).some(Boolean)) return
    if (confirmation) setPending({ form, values })
    else execute(form, values)
  }

  return <form noValidate onSubmit={handleSubmit} className="space-y-3">
    <fieldset disabled={busy} className="flex flex-wrap items-start gap-3">
      {fields.map(({ name, label, type = 'text', autoComplete, initial, options, maxLength, required }) => {
        const errorId = id + '-' + name + '-error'
        const props = {
          name, defaultValue: initial, required,
          'aria-invalid': Boolean(errors[name]),
          'aria-describedby': errors[name] ? errorId : undefined,
          className: 'rounded border border-slate-300 bg-white px-3 py-2',
        }
        return <label key={name} className="grid gap-1 text-sm">
          <span>{label}</span>
          {options ? <select {...props}>{options.map((option) => <option key={option} value={option}>{option || 'Chưa chọn'}</option>)}</select>
            : <input {...props} type={type} autoComplete={autoComplete} maxLength={maxLength} />}
          {errors[name] && <small id={errorId} role="alert" className="text-red-700">{errors[name]}</small>}
        </label>
      })}
    </fieldset>
    <button className="action rounded bg-emerald-800 px-3 py-2 text-white" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : label}</button>
    {errors.form && <p role="alert" className="text-red-700">{errors.form}</p>}
    <F1Toast>{toast}</F1Toast>
    {pending && <F1Dialog message={confirmation} title={label} onClose={() => setPending(null)}
      onConfirm={() => execute(pending.form, pending.values)} />}
  </form>
}
