import { Button as UiButton, Checkbox as UiCheckbox, NumberInput as UiNumberInput } from '../ui';
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api, { apiErrorMessage } from '../../api'
import { getServiceRegistrationPaymentInfo, operatorQrUrl } from '../../api/locationApi'
import { Modal } from '../common/Modal'
import { FileInput } from '../common/FileInput'
import { formatVnd, SERVICE_TERMS } from '../../pages/location/serviceRegistrationTerms'

// Dùng chung: modal gia hạn của Owner/Admin và tab Yêu cầu gia hạn ở trang Admin.
export function RenewalDecision({ row, refresh, onBusy }) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proof, setProof] = useState('')
  const lock = useRef(false)
  useEffect(() => () => { if (proof) URL.revokeObjectURL(proof) }, [proof])
  const decide = async (approve) => {
    if (lock.current) return
    if (approve && !confirmed) { setError('Hãy đối chiếu ngân hàng và xác nhận đã nhận đủ tiền.'); return }
    if (!approve && !reason.trim()) { setError('Nhập lý do từ chối.'); return }
    if (!window.confirm(approve ? 'Duyệt gia hạn và mở lại địa điểm nếu đang khóa?' : 'Từ chối yêu cầu? Bên vận hành phải liên hệ hoàn tiền ngoài hệ thống.')) return
    lock.current = true; setBusy(true); onBusy(true); setError('')
    try {
      await api.post(`/admin/service-renewals/${row.id}/${approve ? 'approve' : 'reject'}`, { paymentConfirmed: confirmed, reason: reason.trim() })
      await refresh()
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { lock.current = false; setBusy(false); onBusy(false) }
  }
  return <article className="cw-section">
    <strong>#{row.id} · {row.locationName} · {row.courtCount} sân · {row.rentalYears} năm</strong>
    <p>{row.startDate} → {row.endDate} · {formatVnd(row.amount)}</p>
    <UiButton variant="secondary" type="button" className="cw-secondary" disabled={busy} onClick={async () => {
      try { const { data } = await api.get(`/admin/service-renewals/${row.id}/proof`, { responseType: 'blob' }); setProof(URL.createObjectURL(data)) }
      catch (err) { setError(apiErrorMessage(err)) }
    }}>Xem chứng từ gia hạn</UiButton>
    {proof && <img src={proof} alt="Chứng từ gia hạn" style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }} />}
    <label><UiCheckbox checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> Tôi đã kiểm tra và nhận đủ tiền gia hạn.</label>
    <label>Lý do từ chối<textarea maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <p>Gia hạn còn hiệu lực nối tiếp kỳ cũ; đã hết hạn tính từ ngày duyệt. Từ chối: liên hệ hoàn tiền ngoài hệ thống.</p>
    {error && <p role="alert">{error}</p>}
    <div className="cw-modal-actions"><UiButton variant="secondary" type="button" className="cw-secondary" disabled={busy} onClick={() => decide(false)}>Từ chối gia hạn</UiButton>
      <UiButton variant="secondary" type="button" className="cw-secondary" disabled={busy} onClick={() => decide(true)}>Duyệt gia hạn</UiButton></div>
  </article>
}

export default function ServiceRenewals({ locationId, admin = false, onRefresh }) {
  const route = useLocation(), navigate = useNavigate()
  const open = route.hash === '#service-renewal'
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [years, setYears] = useState(1), [quote, setQuote] = useState(null), [payment, setPayment] = useState(null)
  const [proof, setProof] = useState(null), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const path = admin ? '/admin/service-renewals' : `/owner/locations/${locationId}/service-renewals`
  const reload = async () => {
    try { const { data } = await api.get(path); setRows(data.data); setError(''); await onRefresh?.() }
    catch (err) { setError(apiErrorMessage(err)) }
  }
  useEffect(() => {
    if (!admin && !locationId) return
    let active = true
    api.get(path).then(({ data }) => { if (active) setRows(data.data) }).catch(err => { if (active) setError(apiErrorMessage(err)) })
    return () => { active = false }
  }, [path, locationId, admin])
  useEffect(() => {
    if (!open || admin || !locationId) return
    let active = true
    setQuote(null)
    Promise.all([api.get(path + '/quote', { params: { years } }), getServiceRegistrationPaymentInfo()])
      .then(([response, info]) => { if (active) { setQuote(response.data.data); setPayment(info); setError('') } })
      .catch(err => { if (active) setError(apiErrorMessage(err)) })
    return () => { active = false }
  }, [open, admin, locationId, years, path])
  const close = () => { if (!lock.current && !busy) navigate({ pathname: route.pathname, search: route.search, hash: '' }, { replace: true }) }
  const submit = async e => {
    e.preventDefault()
    if (lock.current) return
    if (!quote || !proof || !accepted) { setError('Hãy tải báo giá, chọn chứng từ và đồng ý điều khoản.'); return }
    if (!['image/png', 'image/jpeg'].includes(proof.type) || !proof.size || proof.size > 5 * 1024 * 1024) { setError('Chứng từ phải là ảnh JPG/PNG, tối đa 5 MB.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('data', new Blob([JSON.stringify({ rentalYears: Number(years), quotedStart: quote.startDate, quotedEnd: quote.endDate, quotedAmount: quote.amount, termsAccepted: accepted })], { type: 'application/json' }))
      form.append('proof', proof)
      await api.post(path, form)
      setProof(null); setAccepted(false); setMessage('Đã gửi yêu cầu gia hạn. Quản trị viên sẽ kiểm tra thanh toán.'); await reload()
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="cw-section" style={{ marginBottom: 16 }}>
    <div className="cw-section-head"><h2>Gia hạn dịch vụ</h2>
      <UiButton variant="secondary" className="cw-secondary" type="button" disabled={!admin && !locationId} onClick={() => navigate({ pathname: route.pathname, search: route.search, hash: '#service-renewal' })}>
        {admin ? `Xét yêu cầu gia hạn (${rows.filter(r => r.status === 'PENDING').length})` : 'Yêu cầu gia hạn'}</UiButton></div>
    <UiButton variant="secondary" type="button" className="cw-secondary" onClick={reload} disabled={busy}>Làm mới kỳ hạn và yêu cầu</UiButton>
    {!open && error && <p role="alert">{error}</p>}
    {open && <Modal title={admin ? 'Xét yêu cầu gia hạn dịch vụ' : 'Yêu cầu gia hạn dịch vụ'} busy={busy} onClose={close}>
      <div className="cw-modal-content">
        {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
        {admin ? rows.filter(r => r.status === 'PENDING').map(row => <RenewalDecision key={row.id} row={row} refresh={reload} onBusy={setBusy} />) : <>
          <form onSubmit={submit} className="cw-stack">
            <label>Số năm gia hạn<UiNumberInput min={1} max={10} value={years} disabled={busy} onChange={e => setYears(e.target.value)} /></label>
            {quote && <p>{quote.courtCount} sân · {quote.startDate} → {quote.endDate} · <strong>{formatVnd(quote.amount)}</strong></p>}
            <p>Còn hạn: nối tiếp hạn xa nhất. Đã hết hạn: bắt đầu từ ngày được duyệt. Phí tính trên toàn bộ số sân đã đăng ký.</p>
            {payment && <><img width={180} height={180} src={operatorQrUrl(payment.updatedAt)} alt="QR gia hạn dịch vụ" />
              <p>{payment.bankName} · {payment.bankAccountNo} · {payment.bankAccountHolder}</p></>}
            <label>Chứng từ chuyển khoản (JPG/PNG, tối đa 5 MB)<FileInput accept="image/png,image/jpeg" disabled={busy} onChange={e => { if (e.target.files?.[0]) setProof(e.target.files[0]) }} /></label>
            <details><summary>Điều khoản sử dụng dịch vụ</summary><ol>{SERVICE_TERMS.map(term => <li key={term}>{term}</li>)}</ol></details>
            <label><UiCheckbox checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} /> Tôi đồng ý điều khoản sử dụng dịch vụ.</label>
            <UiButton variant="secondary" type="submit" className="cw-secondary" disabled={busy || rows.some(r => r.status === 'PENDING')}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu gia hạn'}</UiButton>
          </form>
          {rows.map(r => <p key={r.id}>#{r.id} · {r.startDate} → {r.endDate} · {r.status === 'PENDING' ? 'Chờ duyệt' : r.status === 'APPROVED' ? 'Đã duyệt' : `Bị từ chối: ${r.rejectReason}`}</p>)}
        </>}
        <UiButton variant="secondary" type="button" className="cw-secondary" onClick={close} disabled={busy}>Đóng gia hạn</UiButton>
      </div>
    </Modal>}
  </section>
}
