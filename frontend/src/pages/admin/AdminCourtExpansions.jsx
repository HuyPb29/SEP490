import { Button as UiButton, Checkbox as UiCheckbox, Input as UiInput, NumberInput as UiNumberInput } from '../../components/ui';
import { useEffect, useState } from 'react'
import { adminExpansions, decideExpansion, expansionProof } from '../../api/courtExpansionApi'
import { apiErrorMessage } from '../../api/locationApi'
import { formatVnd } from '../location/serviceRegistrationTerms'
import styles from './AdminCourtExpansions.module.css'

function RequestRow({ item, reload, onBusyChange }) {
  const [received, setReceived] = useState(String(item.quotedAmount))
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [proofUrl, setProofUrl] = useState(null)
  const quote = item.approvalQuote
  const excess = Math.max(0, Number(received) - Number(quote?.amount || 0))
  useEffect(() => () => { if (proofUrl) URL.revokeObjectURL(proofUrl) }, [proofUrl])
  const decide = async (approve) => {
    if (!checked) { setError('Hãy xác nhận đã đối chiếu tiền và hoàn tiền trước khi xử lý.'); return }
    if (received === '' || !Number.isSafeInteger(Number(received)) || Number(received) < 0) { setError('Nhập số tiền thực nhận hợp lệ.'); return }
    const refund = approve ? excess : Number(received)
    if (approve && (!quote || Number(received) < Number(quote.amount))) { setError('Chưa nhận đủ tiền hoặc hợp đồng đã hết hạn.'); return }
    if (!approve && !reason.trim()) { setError('Nhập lý do từ chối.'); return }
    if (refund > 0 && !note.trim()) { setError('Ghi thời gian và mã giao dịch hoàn tiền đã thực hiện.'); return }
    setBusy(true)
    onBusyChange(true)
    try {
      await decideExpansion(item.id, approve, { receivedAmount: Number(received), refundedAmount: refund,
        settlementNote: note.trim(), reason: reason.trim(), effectiveStart: quote?.startDate, finalAmount: quote?.amount })
      await reload()
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { setBusy(false); onBusyChange(false) }
  }
  const showProof = async () => {
    try { setProofUrl(URL.createObjectURL(await expansionProof(item.id, true))) }
    catch (err) { setError(apiErrorMessage(err)) }
  }
  return <article className="my-3 rounded-xl border border-slate-200 p-4">
    <h3 className="font-bold">#{item.id} · {item.locationName} · Thêm {item.courtCount} sân</h3>
    <p>Gửi lúc {item.createdAt?.replace('T', ' ').slice(0, 19)} · {item.status === 'PENDING' ? 'Chờ duyệt' : item.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}</p>
    <p>Tiền đã báo chuyển: {formatVnd(item.quotedAmount)} · Hạn hợp đồng: {item.contractEnd}</p>
    <UiButton variant="custom" type="button" className="my-2 underline" onClick={showProof}>Xem chứng từ</UiButton>
    {proofUrl && <img src={proofUrl} alt={`Chứng từ đơn thêm sân ${item.id}`} className="max-h-96 max-w-full object-contain" />}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {item.status === 'PENDING' ? <div className="grid gap-3">
      {quote && <p><strong>Phí đã chốt khi gửi: {formatVnd(quote.amount)}</strong> · Tính {quote.months} tháng ({quote.startDate} → {quote.endDate})</p>}
      <label>Số tiền thực tế đã nhận (đối chiếu ngân hàng)
        <UiNumberInput className="ml-2 rounded border p-2" min="0" step="1" value={received} onChange={(event) => { setReceived(event.target.value); setChecked(false) }} /></label>
      <p>Nếu duyệt: cần hoàn {formatVnd(excess)}. Nếu từ chối: cần hoàn toàn bộ {formatVnd(Number(received))} đã thực nhận.</p>
      <label>Thời gian, mã giao dịch hoàn tiền / ghi chú đối soát
        <UiInput className="block w-full rounded border p-2" value={note} maxLength={500} onChange={(event) => { setNote(event.target.value); setChecked(false) }} /></label>
      <label>Lý do từ chối (bắt buộc khi từ chối)
        <UiInput className="block w-full rounded border p-2" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>
      <label><UiCheckbox checked={checked} onChange={(event) => setChecked(event.target.checked)} /> Tôi đã kiểm tra tiền thực nhận và đã hoàn khoản cần hoàn cho thao tác đã chọn. Hệ thống chỉ lưu ghi nhận, không tự chuyển tiền.</label>
      <div className="flex gap-3">
        <UiButton variant="custom" type="button" className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !quote} onClick={() => decide(true)}>Duyệt và tạo sân</UiButton>
        <UiButton variant="custom" type="button" className="rounded border border-red-600 px-4 py-2 text-red-700" disabled={busy} onClick={() => decide(false)}>Từ chối</UiButton>
      </div>
    </div> : <div>
      <p>Phí cuối: {formatVnd(item.finalAmount)} · Thực nhận: {formatVnd(item.receivedAmount)} · Đã hoàn: {formatVnd(item.refundedAmount)}</p>
      <p>{item.settlementNote}</p><p>{item.rejectReason}</p>
    </div>}
  </article>
}

/** UC06 #9, FR128: danh sách yêu cầu mua thêm sân, hiện ngay trong tab "Mua thêm sân" của trang Admin. */
export default function AdminCourtExpansions({ onChanged }) {
  const [processing, setProcessing] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const reload = async () => {
    try { setItems(await adminExpansions()); setError(''); onChanged?.() }
    catch (err) { setError(apiErrorMessage(err)) }
  }
  useEffect(() => {
    let active = true
    adminExpansions().then((rows) => { if (active) { setItems(rows); setLoaded(true) } })
      .catch((err) => { if (active) { setError(apiErrorMessage(err)); setLoaded(true) } })
    return () => { active = false }
  }, [])
  const pending = items.filter((item) => item.status === 'PENDING')
  const done = items.filter((item) => item.status !== 'PENDING')
  return <div className={styles.inline} id="court-expansions">
    <p className={styles.hint}>Phí tính theo số tháng còn lại của thời hạn sử dụng dịch vụ, chốt lúc chủ sân gửi đơn; duyệt muộn không tính lại. Đối chiếu số tiền thực nhận và ghi nhận hoàn đủ tiền thừa trước khi xác nhận; thời hạn đã hết thì chỉ từ chối và hoàn tiền được.</p>
    <div className={styles.toolbar}>
      <strong>{pending.length} yêu cầu chờ duyệt</strong>
      <UiButton variant="secondary" type="button" disabled={processing} onClick={reload}>Làm mới</UiButton>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loaded && !items.length && !error && <p className={styles.empty}>Chưa có yêu cầu mua thêm sân.</p>}
    {pending.map((item) => <RequestRow key={`${item.id}-${item.status}-${item.approvalQuote?.startDate}`} item={item} reload={reload} onBusyChange={setProcessing} />)}
    {done.length > 0 && <details className={styles.history}>
      <summary>Đã xử lý ({done.length})</summary>
      {done.map((item) => <RequestRow key={`${item.id}-${item.status}`} item={item} reload={reload} onBusyChange={setProcessing} />)}
    </details>}
  </div>
}
