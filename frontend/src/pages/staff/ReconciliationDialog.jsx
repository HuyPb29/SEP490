import { useEffect, useRef, useState } from 'react'
import api, { apiErrorMessage } from '../../api'
import styles from './StaffDashboardPage.module.css'

const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
const moneyError = (value) => !value.trim() ? 'Vui lòng nhập số tiền. (MSG01)'
  : !/^\d{1,12}$/.test(value.trim()) ? 'Nhập số nguyên không âm, tối đa 12 chữ số. (MSG02)' : ''

export default function ReconciliationDialog({ onClose }) {
  const dialogRef = useRef(null)
  const [today] = useState(() => vietnamDate.format(new Date()))
  const [date, setDate] = useState(today)
  const [result, setResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [bank, setBank] = useState('')
  const [cash, setCash] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const validDate = Boolean(date && date <= today)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  useEffect(() => {
    if (!validDate) return undefined
    const controller = new AbortController()
    api.get('/staff/reconciliations', { params: { date }, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      if (data.data.date !== date) {
        setLoadError('Dữ liệu trả về không khớp ngày đối soát.')
        return
      }
      setResult({ revision, data: data.data })
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(apiErrorMessage(error, 'Không tải được dữ liệu đối soát.'))
    })
    return () => controller.abort()
  }, [date, revision, validDate])

  const summary = result?.revision === revision && result?.data.date === date ? result.data : null
  const saved = summary?.reconciliation
  const actualAmount = Number(bank) + Number(cash)
  const difference = summary && actualAmount - Number(summary.systemAmount)
  const amountsValid = !moneyError(bank) && !moneyError(cash) && actualAmount <= 999_999_999_999

  const refresh = () => {
    setLoadError('')
    setRevision((value) => value + 1)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!summary || saved || submitting) return
    const fields = { bank: moneyError(bank), cash: moneyError(cash) }
    if (!fields.bank && !fields.cash && !amountsValid) fields.cash = 'Tổng thực nhận tối đa 12 chữ số. (MSG02)'
    if (amountsValid && difference !== 0 && !reason.trim()) {
      fields.reason = 'Chênh lệch ' + (difference > 0 ? '+' : '') + currency.format(difference) + '. Vui lòng nhập lý do. (MSG59)'
    }
    setErrors(fields)
    if (Object.values(fields).some(Boolean)) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/staff/reconciliations', { date, actualAmount, reason: reason.trim() || null })
      setResult({ revision, data: { ...summary, reconciliation: data.data } })
      setSuccess((data.message || 'Đã lưu kết quả đối soát.') + ' (MSG60)')
    } catch (error) {
      const message = apiErrorMessage(error, 'Không thể lưu đối soát.')
      const validation = error.response?.data?.errors
      if (validation) setErrors({ cash: validation.actualAmount, reason: validation.reason, date: validation.date })
      else if (message.includes('MSG59')) {
        setErrors({ reason: message })
        refresh()
      } else {
        setErrors({ form: message })
        if (error.response?.status === 409) refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key) => errors[key] && <span role="alert" className={styles.errorMessage}>{errors[key]}</span>

  return (
    <dialog ref={dialogRef} aria-labelledby="recon-title"
      className="m-auto max-h-[85dvh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose() }}>
      <h2 id="recon-title" className={styles.modalTitle}>Đối soát doanh thu cuối ngày</h2>
      <form className={styles.bookingForm} onSubmit={submit} noValidate>
        <label className={styles.formField}>
          Ngày đối soát
          <input type="date" max={today} value={date} disabled={submitting} onChange={(event) => {
            setDate(event.target.value)
            setBank('')
            setCash('')
            setReason('')
            setSuccess('')
            setErrors({})
            refresh()
          }} />
          {!validDate && <span role="alert">Vui lòng chọn ngày đối soát hợp lệ.</span>}
          {fieldError('date')}
        </label>
        {validDate && !summary && !loadError && <p role="status">Đang tải số liệu đối soát…</p>}
        {loadError && <p role="alert">{loadError} <button type="button" onClick={refresh}>Thử lại</button></p>}
        {summary && (
          <dl>
            <div><dt>Giao dịch đã xác nhận</dt><dd>{summary.confirmedCount}</dd></div>
            <div><dt>Số tiền hệ thống{saved ? ' lúc lưu' : ''}</dt><dd>{currency.format(saved?.systemAmount ?? summary.systemAmount)}</dd></div>
            <div><dt>Tiền chuyển thừa trong ngày</dt><dd>{currency.format(summary.overpaidAmount)}</dd></div>
            {summary.confirmedCount === 0 && <p>Ngày này chưa có giao dịch được xác nhận.</p>}
            {saved && <>
              <div><dt>Tổng thực nhận đã lưu</dt><dd>{currency.format(saved.actualAmount)}</dd></div>
              <div><dt>Chênh lệch</dt><dd>{currency.format(saved.difference)}</dd></div>
              {saved.reason && <div><dt>Lý do</dt><dd>{saved.reason}</dd></div>}
              {saved.staffName && <div><dt>Nhân viên</dt><dd>{saved.staffName}</dd></div>}
            </>}
          </dl>
        )}
        {summary && !saved && (
          <>
            <div className={styles.formRow}>
              <label className={styles.formField}>Thực nhận qua ngân hàng
                <input inputMode="numeric" placeholder="0" value={bank} onChange={(event) => setBank(event.target.value)} disabled={submitting} />
                {fieldError('bank')}
              </label>
              <label className={styles.formField}>Thực nhận tiền mặt
                <input inputMode="numeric" placeholder="0" value={cash} onChange={(event) => setCash(event.target.value)} disabled={submitting} />
                {fieldError('cash')}
              </label>
            </div>
            {amountsValid && <p>Tổng thực nhận {currency.format(actualAmount)} · Chênh lệch {currency.format(difference)}</p>}
            <label className={styles.formField}>Lý do chênh lệch
              <textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} />
              {fieldError('reason')}
            </label>
          </>
        )}
        {fieldError('form')}
        {success && <p className={styles.successMessage} role="status">{success}</p>}
        <div className={styles.modalActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={submitting}>Đóng</button>
          {summary && !saved && <button className={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Lưu kết quả đối soát'}
          </button>}
        </div>
      </form>
    </dialog>
  )
}
