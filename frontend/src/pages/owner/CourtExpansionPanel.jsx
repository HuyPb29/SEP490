import { useEffect, useRef, useState } from 'react'
import { expansionQuote, ownerExpansions, submitExpansion } from '../../api/courtExpansionApi'
import { apiErrorMessage, getServiceRegistrationPaymentInfo, operatorQrUrl } from '../../api/locationApi'
import { formatVnd } from '../location/serviceRegistrationTerms'
import { Modal } from '../../components/common/Modal'
import styles from './CourtExpansionPanel.module.css'

const statuses = { PENDING: "Chờ quản trị viên duyệt", APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' }

export default function CourtExpansionPanel({ locationId, locked, onClose }) {
  const fileInput = useRef(null)
  const [count, setCount] = useState('1')
  const [quote, setQuote] = useState(null)
  const [payment, setPayment] = useState(null)
  const [requests, setRequests] = useState([])
  const [proof, setProof] = useState(null)
  const [proofUrl, setProofUrl] = useState(null)
  const [proofError, setProofError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => () => { if (proofUrl) URL.revokeObjectURL(proofUrl) }, [proofUrl])

  const clearProof = () => {
    setProof(null)
    setProofUrl(null)
    setProofError('')
    setPreviewOpen(false)
    if (fileInput.current) fileInput.current.value = ''
  }
  const chooseProof = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(file.type)) {
      clearProof()
      setProofError('Chỉ nhận ảnh JPG/PNG tối đa 5 MB.')
      return
    }
    setProof(file)
    setProofUrl(URL.createObjectURL(file))
    setProofError('')
  }

  useEffect(() => {
    let active = true
    if (!locationId || locked) return
    Promise.all([ownerExpansions(locationId), getServiceRegistrationPaymentInfo()])
      .then(([rows, info]) => { if (active) { setRequests(rows); setPayment(info) } })
      .catch((err) => { if (active) setError(apiErrorMessage(err)) })
    return () => { active = false }
  }, [locationId, locked, refresh])

  useEffect(() => {
    let active = true
    if (!locationId || locked || !Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 100) return
    expansionQuote(locationId, Number(count)).then((value) => {
      if (active) { setQuote(value); setError('') }
    }).catch((err) => { if (active) { setQuote(null); setError(apiErrorMessage(err)) } })
    return () => { active = false }
  }, [locationId, count, locked, refresh])

  const pending = requests.some((item) => item.status === 'PENDING')
  const submit = async (event) => {
    event.preventDefault()
    if (!quote || quote.courtCount !== Number(count)) { setError('Hãy lấy báo giá trước khi gửi đơn.'); return }
    if (!proof) { setProofError('Vui lòng chọn ảnh chứng từ chuyển khoản.'); return }
    setSaving(true)
    try {
      await submitExpansion(locationId, quote, proof)
      setMessage("Đã gửi yêu cầu. quản trị viên kiểm tra tiền và xét duyệt; sân chỉ có hiệu lực từ ngày sau khi duyệt.")
      clearProof()
      event.target.reset()
      setRefresh((value) => value + 1)
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return <Modal labelledBy="court-expansion-title" className={styles.dialog} onClose={onClose} busy={saving}>
    <section id="court-expansion">
    <header className={styles.header}>
      <div><h2 id="court-expansion-title" className="text-lg font-bold">Đăng ký thêm sân con</h2>
        <p className={styles.subtitle}>Thông tin đăng ký, thanh toán và lịch sử yêu cầu</p></div>
      <button type="button" className={styles.close} aria-label="Đóng đăng ký thêm sân" disabled={saving} onClick={onClose}>×</button>
    </header>
    <p>Phí tính theo số tháng còn lại đến hết thời hạn sử dụng dịch vụ, đếm từ hôm nay: phần lẻ đến 15 ngày không tính, từ 16 ngày tính thêm một tháng. Đơn giá như đăng ký ban đầu (10.000.000 đồng cho 9 sân trong 1 năm), làm tròn tổng lên nghìn đồng.</p>
    <p>Chuyển khoản ngay khi gửi yêu cầu. Số tiền được chốt lúc gửi, quản trị viên duyệt muộn cũng không tính lại; sân nhận lịch từ ngày sau khi được duyệt.</p>
    {error && <p role="alert" className="my-2 text-red-700">{error}</p>}
    {message && <p role="status" className="my-2 text-emerald-700">{message}</p>}
    {!locked && !pending && <form onSubmit={submit} className="my-4 grid gap-3">
      <label>Số sân muốn thêm <input className="rounded border p-2" type="number" min="1" max="100" required
        value={count} disabled={saving} onChange={(event) => { setCount(event.target.value); setQuote(null); setMessage('') }} /></label>
      {quote && quote.courtCount === Number(count) && <div className="rounded bg-emerald-50 p-3">
        <p>Thời gian tính phí: {quote.startDate} → {quote.endDate}, tính {quote.months} tháng.</p>
        <p>Đơn giá tham chiếu: {formatVnd(quote.referenceFee)} / 9 sân / năm.</p>
        <strong>Số tiền chuyển khoản: {formatVnd(quote.amount)}</strong>
        <p>Nội dung chuyển khoản: THEM SAN {locationId} - {count} SAN</p>
      </div>}
      {payment && <div className="flex flex-wrap items-start gap-4">
        <img src={operatorQrUrl(payment.updatedAt)} alt="QR nhận phí thêm sân của bên vận hành" className="h-48 w-48 object-contain" />
        <div><p>{payment.bankName}</p><p>{payment.bankAccountNo}</p><p>{payment.bankAccountHolder}</p></div>
      </div>}
      <div className={styles.upload}>
        <p id="proof-label" className="font-bold">Ảnh chứng từ chuyển khoản</p>
        <p id="proof-hint" className={styles.subtitle}>JPG hoặc PNG, tối đa 5 MB. Chọn ảnh rõ số tiền và mã giao dịch.</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png" hidden disabled={saving} onChange={chooseProof}
          aria-labelledby="proof-label" aria-describedby="proof-hint proof-error" />
        {proofUrl ? <>
          <button type="button" className={styles.preview} onClick={() => setPreviewOpen(true)} aria-label="Phóng to ảnh chứng từ">
            <img src={proofUrl} alt="Ảnh chứng từ chuyển khoản đã chọn" />
            <span>Bấm vào ảnh để phóng to</span>
          </button>
          <div className={styles.fileDetails}>
            <span title={proof?.name}>{proof?.name}</span>
            <div><button type="button" disabled={saving} onClick={() => fileInput.current?.click()}>Đổi ảnh</button>
              <button type="button" disabled={saving} onClick={clearProof}>Xóa ảnh</button></div>
          </div>
        </> : <button type="button" className={styles.chooseFile} disabled={saving} onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true" className={styles.uploadIcon}>↑</span>
          <strong>Bấm để chọn ảnh chứng từ</strong>
          <span>Ảnh được hiển thị tại đây sau khi chọn</span>
        </button>}
        <p id="proof-error" role={proofError ? 'alert' : undefined} className="text-red-700">{proofError}</p>
      </div>
      <button className="rounded bg-emerald-700 p-3 font-bold text-white disabled:opacity-50" disabled={saving || !quote || quote.courtCount !== Number(count)}>
        {saving ? 'Đang gửi…' : 'Gửi yêu cầu thêm sân'}
      </button>
    </form>}
    {pending && <p className="my-3 text-amber-700">Đã có đơn chờ duyệt. Vui lòng chờ quản trị viên xử lý trước khi gửi đơn mới.</p>}
    <button type="button" className="my-2 underline" onClick={() => setRefresh((value) => value + 1)}>Làm mới đơn và báo giá</button>
    <ul className="grid gap-3">{requests.map((item) => <li key={item.id} className="rounded border p-3">
      <strong>Đơn #{item.id}: thêm {item.courtCount} sân — {statuses[item.status]}</strong>
      <p>Đã báo chuyển: {formatVnd(item.quotedAmount)} · Hết hạn: {item.contractEnd}</p>
      {item.status === 'APPROVED' && <p>Hiệu lực từ {item.effectiveStart} · Phí cuối: {formatVnd(item.finalAmount)} · Đã hoàn: {formatVnd(item.refundedAmount)}</p>}
      {item.rejectReason && <p>Lý do: {item.rejectReason} · Đã hoàn: {formatVnd(item.refundedAmount)}</p>}
      {item.settlementNote && <p>Ghi nhận hoàn tiền: {item.settlementNote}</p>}
    </li>)}</ul>
    <div className={styles.footer}><button type="button" disabled={saving} onClick={onClose}>Đóng</button></div>
  </section>
    {previewOpen && proofUrl && <Modal title="Xem ảnh chứng từ" className={styles.imageDialog} onClose={() => setPreviewOpen(false)}>
      <button type="button" className={styles.imageClose} onClick={() => setPreviewOpen(false)}>Đóng ảnh phóng to</button>
      <img src={proofUrl} alt="Chứng từ chuyển khoản phóng to" className={styles.fullImage} />
    </Modal>}
  </Modal>
}
