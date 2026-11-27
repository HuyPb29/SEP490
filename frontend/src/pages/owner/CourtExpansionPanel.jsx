import { NumberInput as UiNumberInput } from '../../components/ui';
import { useEffect, useRef, useState } from 'react'
import { expansionQuote, ownerExpansions, submitExpansion } from '../../api/courtExpansionApi'
import { apiErrorMessage, getServiceRegistrationPaymentInfo, operatorQrUrl } from '../../api/locationApi'
import { formatVnd } from '../location/serviceRegistrationTerms'
import { Button, EmptyState, FormField, LoadingState, Modal, StatusBadge, Toast } from '../../components/common'
import ImageProofUpload from '../../components/upload/ImageProofUpload'
import { shortDate } from '../../utils/formatters'
import styles from './CourtExpansionPanel.module.css'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png']
const MAX_PROOF_SIZE = 5 * 1024 * 1024

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={styles.copyRow}>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={`Sao chép ${label.toLowerCase()}`}>
          {copied ? 'Đã chép' : 'Sao chép'}
        </Button>
      </dd>
    </div>
  )
}

export default function CourtExpansionPanel({ locationId, locked, onClose }) {
  const fileInput = useRef(null)
  const [count, setCount] = useState('1')
  const [quote, setQuote] = useState(null)
  const [payment, setPayment] = useState(null)
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const clearProof = () => {
    setProof(null)
    setProofError('')
    if (fileInput.current) fileInput.current.value = ''
  }
  const acceptProof = (file) => {
    if (!file) return
    if (file.size > MAX_PROOF_SIZE || !ACCEPTED_TYPES.includes(file.type)) {
      clearProof()
      setProofError('Chỉ nhận ảnh JPG/PNG tối đa 5 MB.')
      return
    }
    setProof(file)
    setProofError('')
  }

  useEffect(() => {
    let active = true
    if (!locationId || locked) return undefined
    Promise.all([ownerExpansions(locationId), getServiceRegistrationPaymentInfo()])
      .then(([rows, info]) => { if (active) { setRequests(rows); setPayment(info) } })
      .catch((err) => { if (active) setError(apiErrorMessage(err)) })
      .finally(() => { if (active) setRequestsLoading(false) })
    return () => { active = false }
  }, [locationId, locked, refresh])

  const countValid = Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 100

  useEffect(() => {
    let active = true
    if (!locationId || locked || !countValid) return undefined
    expansionQuote(locationId, Number(count)).then((value) => {
      if (active) { setQuote(value); setError('') }
    }).catch((err) => { if (active) { setQuote(null); setError(apiErrorMessage(err)) } })
    return () => { active = false }
  }, [locationId, count, countValid, locked, refresh])

  const pending = requests.some((item) => item.status === 'PENDING')
  const quoteReady = Boolean(quote) && quote.courtCount === Number(count)
  // Báo giá được gọi lại mỗi khi đổi số sân; chưa có kết quả và chưa lỗi thì coi là đang tính.
  const quoteLoading = !locked && countValid && !quoteReady && !error
  const submit = async (event) => {
    event.preventDefault()
    if (!quoteReady) { setError('Hãy chờ báo giá cho số sân đã nhập trước khi gửi.'); return }
    if (!proof) { setProofError('Vui lòng chọn ảnh chứng từ chuyển khoản.'); return }
    setSaving(true)
    try {
      await submitExpansion(locationId, quote, proof)
      setMessage('Đã gửi yêu cầu. Quản trị viên kiểm tra tiền và duyệt; sân chỉ nhận lịch từ ngày sau khi duyệt.')
      clearProof()
      setRefresh((value) => value + 1)
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Đăng ký thêm sân" className={styles.dialog} onClose={onClose} busy={saving}>
      <Button variant="ghost" className={styles.close} aria-label="Đóng đăng ký thêm sân" disabled={saving} onClick={onClose}>×</Button>
      <div id="court-expansion" className={styles.body}>
        <p className={styles.lead}>
          Phí tính theo số tháng còn lại đến hết thời hạn sử dụng dịch vụ (phần lẻ đến 15 ngày không tính, từ 16 ngày tính
          thêm một tháng), đơn giá 10.000.000đ cho 9 sân trong 1 năm, làm tròn lên nghìn đồng. Số tiền chốt lúc gửi; sân nhận
          lịch từ ngày sau khi được duyệt.
        </p>

        {error && <Toast tone="danger" onClose={() => setError('')}>{error}</Toast>}
        {message && <Toast tone="success" onClose={() => setMessage('')}>{message}</Toast>}

        {locked && <p className={styles.notice}>Địa điểm đang bị khóa nên không đăng ký thêm sân được.</p>}
        {!locked && pending && (
          <p className={styles.notice}>Đã có yêu cầu chờ duyệt. Vui lòng chờ quản trị viên xử lý trước khi gửi yêu cầu mới.</p>
        )}

        {!locked && !pending && (
          <form onSubmit={submit} className={styles.form}>
            <section className={styles.step} aria-labelledby="expansion-step-1">
              <h3 id="expansion-step-1"><span className={styles.stepNumber}>1</span>Số sân và số tiền</h3>
              <FormField label="Số sân muốn thêm" required
                error={!countValid ? 'Nhập số nguyên từ 1 đến 100.' : undefined}>
                <UiNumberInput min="1" max="100" required inputMode="numeric" className={styles.countInput}
                  value={count} disabled={saving}
                  onChange={(event) => { setCount(event.target.value); setQuote(null); setMessage('') }} />
              </FormField>
              {quoteLoading && <LoadingState message="Đang tính số tiền…" />}
              {!quoteLoading && quoteReady && (
                <div className={styles.quote}>
                  <p className={styles.amount}>{formatVnd(quote.amount)}</p>
                  <p>
                    {quote.courtCount} sân · tính {quote.months} tháng ({shortDate(quote.startDate)} → {shortDate(quote.endDate)})
                  </p>
                  <p className={styles.muted}>Đơn giá tham chiếu {formatVnd(quote.referenceFee)} / 9 sân / năm.</p>
                </div>
              )}
            </section>

            <section className={styles.step} aria-labelledby="expansion-step-2">
              <h3 id="expansion-step-2"><span className={styles.stepNumber}>2</span>Chuyển khoản cho bên vận hành</h3>
              {payment ? (
                <div className={styles.payment}>
                  <img src={operatorQrUrl(payment.updatedAt)} alt="Mã QR nhận phí thêm sân của bên vận hành" className={styles.qr} />
                  <dl className={styles.bank}>
                    <CopyRow label="Ngân hàng" value={payment.bankName} />
                    <CopyRow label="Số tài khoản" value={payment.bankAccountNo} />
                    <CopyRow label="Chủ tài khoản" value={payment.bankAccountHolder} />
                    {quoteReady && <CopyRow label="Số tiền" value={quote.amount} />}
                    <CopyRow label="Nội dung" value={`THEM SAN ${locationId} - ${count} SAN`} />
                  </dl>
                </div>
              ) : requestsLoading ? <LoadingState message="Đang tải thông tin chuyển khoản…" /> : (
                <p className={styles.muted}>Chưa tải được thông tin chuyển khoản của bên vận hành.</p>
              )}
            </section>

            <section className={styles.step} aria-labelledby="expansion-step-3">
              <h3 id="expansion-step-3"><span className={styles.stepNumber}>3</span>Ảnh chứng từ</h3>
              <ImageProofUpload
                id="court-expansion-proof"
                file={proof}
                inputRef={fileInput}
                disabled={saving}
                error={proofError || undefined}
                onChange={(event) => acceptProof(event.target.files?.[0])}
                onDropFile={acceptProof}
                onClear={clearProof}
              />
            </section>

            <div className={styles.submitRow}>
              <Button type="submit" loading={saving} loadingText="Đang gửi…" disabled={!quoteReady}>
                Gửi yêu cầu thêm sân
              </Button>
            </div>
          </form>
        )}

        <section className={styles.history} aria-labelledby="expansion-history">
          <div className={styles.historyHead}>
            <h3 id="expansion-history">Yêu cầu đã gửi</h3>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setRefresh((value) => value + 1)}>Làm mới</Button>
          </div>
          {requestsLoading && <LoadingState message="Đang tải yêu cầu…" />}
          {!requestsLoading && requests.length === 0 && (
            <EmptyState title="Chưa có yêu cầu" description="Các yêu cầu thêm sân và kết quả duyệt sẽ hiện ở đây." />
          )}
          <ul className={styles.requestList}>
            {requests.map((item) => (
              <li key={item.id} className={styles.request}>
                <div className={styles.requestHead}>
                  <strong>Yêu cầu #{item.id} · thêm {item.courtCount} sân</strong>
                  <StatusBadge category="service_request" status={item.status} />
                </div>
                <p>Đã báo chuyển {formatVnd(item.quotedAmount)} · Hết hạn dịch vụ {shortDate(item.contractEnd)}</p>
                {item.status === 'APPROVED' && (
                  <p>Hiệu lực từ {shortDate(item.effectiveStart)} · Phí cuối {formatVnd(item.finalAmount)} · Đã hoàn {formatVnd(item.refundedAmount)}</p>
                )}
                {item.rejectReason && <p>Lý do từ chối: {item.rejectReason} · Đã hoàn {formatVnd(item.refundedAmount)}</p>}
                {item.settlementNote && <p>Ghi nhận hoàn tiền: {item.settlementNote}</p>}
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.footer}>
          <Button variant="secondary" disabled={saving} onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  )
}
