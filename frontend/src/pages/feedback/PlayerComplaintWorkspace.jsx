import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { apiErrorMessage, getAllPages } from '../../api'
import { isLatePaymentEligible } from '../../api/bookingPaymentApi'
import { createComplaintWithEvidence } from '../../api/complaintEvidenceApi'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import { Button, EmptyState, ErrorState, FormField, ImageAttachmentField, LoadingState, Modal, Select, StatusBadge, Textarea, Timeline, Toast } from '../../components/common'
import { STATUS_CATALOG } from '../../components/common/statusCatalog'
import { dateTime, money, shortDate } from '../../utils/formatters'
import { useResource } from '../workspaceSupport'
import ComplaintEvidence from './ComplaintEvidence'
import styles from './PlayerComplaintsPage.module.css'

const latePaymentType = 'LATE_PAYMENT_CONFIRMATION'
const typeLabels = { COURT_SERVICE: 'Dịch vụ sân', PAYMENT_ISSUE: 'Vấn đề thanh toán', OTHER: 'Khác', LATE_PAYMENT_CONFIRMATION: 'Xác nhận thanh toán trễ' }
const loadPlayerCases = signal => getAllPages('/me/complaints', { signal })
const loadBookings = signal => getAllPages('/me/bookings', { signal })
const amount = value => money(value).replace(/\s/g, '').replace('₫', 'đ')

function Result({ item }) {
  if (!item.result) return null
  return <div className={styles.result}><StatusBadge status={item.result} category="complaint_result" />
    {item.result === 'POINTS' && item.compensationPoints > 0 && <strong>{Number(item.compensationPoints).toLocaleString('vi-VN')} điểm</strong>}
    {item.result === 'LATE_PAYMENT_CONFIRMED' && <p>Phiếu ưu đãi bồi thường {amount(10000)} được cấp khi chủ sân xác nhận.</p>}</div>
}

function PlayerCaseDetails({ id, onClose }) {
  const load = useCallback(signal => api.get('/complaints/' + id, { signal }).then(response => response.data.data), [id])
  const detail = useResource(load, id)
  const item = detail.data
  const container = useRef(null)
  useEffect(() => { container.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  const events = item ? [{ id: 'created', title: 'Gửi khiếu nại', time: item.createdAt, content: typeLabels[item.complaintType], tone: 'neutral' }] : []
  if (item && (item.status !== 'SUBMITTED' || item.staffNote || item.handledBy)) events.push({ id: 'owner', title: STATUS_CATALOG.complaint.PENDING_OWNER.label,
    content: item.complaintType === latePaymentType ? 'Khiếu nại thanh toán chậm được gửi thẳng tới chủ sân.' : item.staffNote || 'Khiếu nại đã được chuyển tới chủ sân.', tone: 'warning' })
  if (item && ['RESOLVED', 'REJECTED'].includes(item.status)) events.push({ id: 'decision', title: STATUS_CATALOG.complaint[item.status].label, time: item.decidedAt,
    content: item.rejectReason || (item.result ? <Result item={item} /> : 'Chủ sân đã ghi nhận kết quả xử lý.'), tone: STATUS_CATALOG.complaint[item.status].tone })
  return <section ref={container} className={styles.detail} aria-label={'Chi tiết khiếu nại #' + id}>
    <header className={styles.detailHeader}><h2>Chi tiết khiếu nại #{id}</h2><Button variant="ghost" aria-label="Đóng chi tiết khiếu nại" onClick={onClose}>Đóng</Button></header>
    {detail.loading ? <LoadingState message="Đang tải chi tiết khiếu nại…" /> : detail.error ? <ErrorState message={detail.error} onRetry={detail.reload} /> : !item ?
      <EmptyState title="Chưa có chi tiết khiếu nại" description="Tải lại để cập nhật nội dung xử lý." action={<Button variant="secondary" onClick={detail.reload}>Tải lại chi tiết</Button>} /> : <>
        <div className={styles.detailMeta}><StatusBadge status={item.status} category="complaint" /><span>{typeLabels[item.complaintType] ?? item.complaintType}</span></div>
        <dl className={styles.facts}><div><dt>Lịch đặt sân</dt><dd>{item.bookingCode || '#' + item.bookingId}</dd></div>
          {item.locationName && <div><dt>Địa điểm</dt><dd>{item.locationName}</dd></div>}
          {item.paymentId && <div><dt>Giao dịch</dt><dd>#{item.paymentId}</dd></div>}
          <div><dt>Ngày gửi</dt><dd>{dateTime(item.createdAt)}</dd></div></dl>
        <div><h3>Nội dung khiếu nại</h3><p className={styles.content}>{item.content}</p></div>
        <ComplaintEvidence complaintId={id} />
        <div className={styles.timeline}><h3>Tiến trình xử lý</h3><Timeline items={events} /></div>
      </>}
  </section>
}

function PlayerCaseList({ revision, onCreate }) {
  const cases = useResource(loadPlayerCases, revision)
  const [params] = useSearchParams()
  const requestedId = params.get('complaintId')
  const requestedCase = /^[1-9]\d*$/.test(requestedId || '') ? requestedId : ''
  const [selection, setSelection] = useState({ request: requestedCase, id: requestedCase })
  const id = selection.request === requestedCase ? selection.id : requestedCase
  const setId = value => setSelection({ request: requestedCase, id: value })
  const [status, setStatus] = useState('')
  const listRef = useRef(null)
  const detailId = useId()
  const visible = cases.data?.filter(item => !status || item.status === status).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return <div className={styles.workspace}>
    <section ref={listRef} className={styles.listPanel} tabIndex={-1} aria-label="Khiếu nại của tôi">
      <div className={styles.listHeader}><div><h2>Khiếu nại của tôi</h2><p>Theo dõi phản hồi và kết quả xử lý.</p></div>{!cases.loading && !cases.error && <span className={styles.count}>{visible?.length ?? 0} khiếu nại</span>}</div>
      <FormField label="Trạng thái"><Select value={status} options={[['', 'Tất cả trạng thái'], ...Object.entries(STATUS_CATALOG.complaint).map(([key, meta]) => [key, meta.label])]}
        onChange={event => { setStatus(event.target.value); setId('') }} /></FormField>
      {cases.loading ? <LoadingState message="Đang tải khiếu nại…" /> : cases.error ? <ErrorState message={cases.error} onRetry={cases.reload} /> : !visible?.length ?
        <EmptyState title={status ? 'Không có khiếu nại phù hợp' : 'Bạn chưa gửi khiếu nại nào'} description={status ? 'Chọn trạng thái khác để xem các khiếu nại của bạn.' : 'Nếu có vấn đề với lịch đặt hoặc thanh toán, hãy gửi nội dung để địa điểm hỗ trợ.'}
          action={status ? <Button variant="secondary" onClick={() => setStatus('')}>Xem tất cả trạng thái</Button> : <Button onClick={onCreate}>Gửi khiếu nại</Button>} /> :
        <div className={styles.cards}>{visible.map(item => <article key={item.id} className={styles.card} data-selected={String(id) === String(item.id) || undefined}>
          <div className={styles.cardTop}><strong>#{item.id} · {item.bookingCode || 'Lịch đặt #' + item.bookingId}</strong><StatusBadge status={item.status} category="complaint" /></div>
          <h3>{typeLabels[item.complaintType] ?? item.complaintType}</h3><p className={styles.summary}>{item.content}</p>
          {item.result && <Result item={item} />}
          <div className={styles.cardFooter}><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time><Button variant="secondary" aria-expanded={String(id) === String(item.id)} aria-controls={detailId}
            onClick={() => setId(String(id) === String(item.id) ? '' : String(item.id))}>{String(id) === String(item.id) ? 'Đóng chi tiết' : 'Xem chi tiết'}</Button></div>
        </article>)}</div>}
    </section>
    <div id={detailId} className={styles.detailColumn}>{id ? <PlayerCaseDetails key={id} id={id} onClose={() => { setId(''); listRef.current?.focus({ preventScroll: true }) }} /> :
      <div className={styles.detailPlaceholder}><EmptyState title="Tiến trình xử lý của bạn" description="Mở một khiếu nại để xem nội dung, ảnh đính kèm và các bước xử lý."
        action={visible?.length ? <Button variant="secondary" onClick={() => setId(String(visible[0].id))}>Xem khiếu nại mới nhất</Button> : <Button variant="secondary" onClick={onCreate}>Gửi khiếu nại</Button>} /></div>}</div>
  </div>
}

function PlayerComplaintForm({ bookingId, paymentId, refresh, onClose, onSent }) {
  const loadBooking = useCallback(signal => api.get('/bookings/' + bookingId, { signal }).then(response => response.data.data), [bookingId])
  const booking = useResource(loadBooking, bookingId)
  const item = booking.data
  const [submittedType, setSubmittedType] = useState(null)
  const latePaymentOnly = Boolean(paymentId)
  const types = [['COURT_SERVICE', 'Dịch vụ sân'], ['PAYMENT_ISSUE', 'Vấn đề thanh toán'], ['OTHER', 'Khác']]
  const targetPaymentId = paymentId || item?.paymentId
  const loadEligibility = useCallback(async signal => {
    if (!targetPaymentId) return false
    return isLatePaymentEligible(bookingId, targetPaymentId, signal)
  }, [bookingId, targetPaymentId])
  const eligibility = useResource(loadEligibility, targetPaymentId)
  const canReportLatePayment = !eligibility.loading && eligibility.data === true
  if (canReportLatePayment) types.push([latePaymentType, 'Xác nhận thanh toán chậm · chủ sân xác nhận thì nhận phiếu ưu đãi ' + amount(10000)])
  const [type, setType] = useState('COURT_SERVICE')
  const selectedType = types.some(([value]) => value === type) ? type : 'COURT_SERVICE'
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [imageError, setImageError] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const imageInput = useRef(null)
  function chooseFile(next) {
    setImageError('')
    if (!next) { setFile(null); return }
    if (!['image/jpeg', 'image/png'].includes(next.type)) { setImageError('Chỉ nhận ảnh JPG hoặc PNG.'); return }
    if (next.size === 0 || next.size > 5 * 1024 * 1024) { setImageError('Ảnh phải có nội dung và không vượt quá 5 MB.'); return }
    setFile(next)
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setErrors({})
    setSubmittedType(null)
    const complaintType = latePaymentOnly ? latePaymentType : selectedType
    const payload = { content, complaintType, bookingId: item.id ?? Number(bookingId), paymentId: complaintType === latePaymentType ? targetPaymentId : null }
    try {
      const response = file ? await createComplaintWithEvidence(payload, file) : await api.post('/complaints', payload)
      setSubmittedType(response.data.data.complaintType)
      eligibility.reload()
      refresh()
      onSent(response.data.data)
    } catch (error) {
      const fieldErrors = error.response?.data?.errors
      setErrors(fieldErrors && Object.keys(fieldErrors).length ? {
        ...fieldErrors,
        ...(Object.keys(fieldErrors).some(key => !['content', 'complaintType'].includes(key)) ? { form: apiErrorMessage(error) } : {}),
      } : { form: apiErrorMessage(error) })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal title={latePaymentOnly ? 'Khiếu nại xác nhận thanh toán chậm' : 'Gửi khiếu nại'} onClose={onClose} busy={busy} className={styles.composeModal}>
    <Button variant="ghost" className={styles.composeClose} aria-label="Đóng cửa sổ gửi khiếu nại" disabled={busy} onClick={onClose}>×</Button>
    {booking.loading ? <LoadingState message="Đang tải lịch đặt sân…" /> : booking.error ? <ErrorState message={booking.error} onRetry={booking.reload} /> : !item ?
      <EmptyState title="Chưa có thông tin lịch đặt" description="Tải lại lịch đặt sân để gửi khiếu nại." action={<Button variant="secondary" onClick={booking.reload}>Tải lại lịch đặt</Button>} /> : <>
      <div className={styles.bookingContext}><strong>{item.bookingCode || 'Lịch đặt #' + item.id}</strong><span>{shortDate(item.playDate)}{item.courtName && ' · ' + item.courtName}</span>{targetPaymentId && <span>Giao dịch #{targetPaymentId}</span>}</div>
      <p className={styles.guidance}>{latePaymentOnly ? 'Khiếu nại này được gửi thẳng tới chủ sân. Phiếu ưu đãi chỉ được cấp khi chủ sân xác nhận thanh toán bị chậm.' : 'Khiếu nại thông thường gửi trong 24 giờ sau giờ chơi và do nhân viên tiếp nhận. Khiếu nại thanh toán chậm được gửi thẳng tới chủ sân.'}</p>
      {eligibility.loading && <LoadingState message="Đang kiểm tra giao dịch…" />}
      {eligibility.error && <ErrorState message={eligibility.error} onRetry={eligibility.reload} />}
      {latePaymentOnly && !eligibility.loading && !eligibility.error && !canReportLatePayment && !submittedType && <div className={styles.unavailable}><p>Giao dịch này hiện không thể gửi khiếu nại xác nhận thanh toán chậm.</p><Button variant="secondary" onClick={eligibility.reload}>Kiểm tra lại giao dịch</Button></div>}
      {(!latePaymentOnly || (canReportLatePayment && !submittedType)) && <form className={styles.form} onSubmit={submit} onInvalid={event => {
        event.preventDefault()
        setErrors(current => ({ ...current, [event.target.name]: event.target.validity.valueMissing ? 'Vui lòng nhập thông tin.' : 'Giá trị không đúng định dạng.' }))
      }}>
        <fieldset className={styles.fields} disabled={busy}>
          {!latePaymentOnly && <FormField label="Loại khiếu nại" required error={errors.complaintType}><Select name="complaintType" value={selectedType} options={types} required onChange={event => { setType(event.target.value); setErrors({}) }} /></FormField>}
          <FormField label="Nội dung" required error={errors.content} hint={content.length + '/1.000 ký tự'}><Textarea name="content" value={content} maxLength={1000} rows={5} required
            placeholder="Mô tả vấn đề, thời gian và hỗ trợ bạn mong muốn…" onChange={event => { setContent(event.target.value); setErrors({}) }} /></FormField>
          <ImageAttachmentField id="complaint-image" label="Ảnh đính kèm (không bắt buộc)" chooseText="Kéo thả hoặc chọn ảnh đính kèm" hint="Một ảnh JPG hoặc PNG, tối đa 5 MB, giúp địa điểm xác minh nội dung khiếu nại."
            required={false} previewAlt="Xem trước ảnh khiếu nại" inputRef={imageInput} file={file} error={imageError} disabled={busy}
            onChange={event => chooseFile(event.target.files?.[0])} onDropFile={chooseFile} onClear={() => { setFile(null); setImageError(''); if (imageInput.current) imageInput.current.value = '' }} />
        </fieldset>
        {errors.form && <Toast tone="danger">{errors.form}</Toast>}
        <div className={styles.composeActions}><Button variant="secondary" disabled={busy} onClick={onClose}>Quay lại</Button><Button type="submit" loading={busy} disabled={!!imageError || (latePaymentOnly && !canReportLatePayment)}>{latePaymentOnly ? 'Gửi cho chủ sân' : 'Gửi khiếu nại'}</Button></div>
      </form>}
    </>}
  </Modal>
}

function BookingPicker({ onSelect, onClose }) {
  const bookings = useResource(loadBookings)
  const [id, setId] = useState('')
  return <Modal title="Chọn lịch đặt sân" onClose={onClose} className={styles.composeModal}>
    <Button variant="ghost" className={styles.composeClose} aria-label="Đóng chọn lịch đặt sân" onClick={onClose}>×</Button>
    <p className={styles.guidance}>Chọn lịch đặt liên quan để gửi khiếu nại tới đúng địa điểm.</p>
    {bookings.loading ? <LoadingState message="Đang tải lịch đặt sân…" /> : bookings.error ? <ErrorState message={bookings.error} onRetry={bookings.reload} /> : !bookings.data?.length ?
      <EmptyState title="Bạn chưa có lịch đặt sân" description="Khiếu nại cần gắn với một lịch đặt hoặc giao dịch của bạn." action={<Link className={styles.linkAction} to="/my-bookings">Xem lịch đặt sân</Link>} /> : <>
      <FormField label="Lịch đặt sân"><Select value={id} onChange={event => setId(event.target.value)} options={[
        ['', 'Chọn lịch đặt sân'], ...bookings.data.map(item => [item.id, (item.bookingCode || '#' + item.id) + ' · ' + shortDate(item.playDate) + (item.locationName ? ' · ' + item.locationName : '')]),
      ]} /></FormField>
      <div className={styles.composeActions}><Button variant="secondary" onClick={onClose}>Quay lại</Button><Button disabled={!id} onClick={() => onSelect(id)}>Tiếp tục</Button></div>
    </>}
  </Modal>
}

export default function PlayerComplaintWorkspace() {
  const [params] = useSearchParams()
  const bookingId = /^[1-9]\d*$/.test(params.get('bookingId') || '') ? params.get('bookingId') : null
  const paymentId = /^[1-9]\d*$/.test(params.get('paymentId') || '') ? params.get('paymentId') : null
  const request = bookingId ? bookingId + ':' + paymentId : ''
  const [composer, setComposer] = useState({ request, open: !!bookingId, bookingId, paymentId })
  const current = composer.request === request ? composer : { request, open: !!bookingId, bookingId, paymentId }
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const close = () => setComposer({ ...current, open: false })
  const create = () => setComposer({ request, open: true, bookingId, paymentId })
  return <WorkspaceLayout role="player" title="Khiếu nại" subtitle="Gửi phản ánh và theo dõi hỗ trợ từ địa điểm." actions={<Button onClick={create}>Gửi khiếu nại</Button>}>
    {notice && <Toast onClose={() => setNotice('')}>{notice}</Toast>}
    <PlayerCaseList revision={revision} onCreate={create} />
    <Link className={styles.historyLink} to="/my-bookings">Chọn lịch đặt sân để gửi khiếu nại</Link>
    {current.open && (current.bookingId ? <PlayerComplaintForm key={current.bookingId + ':' + current.paymentId} bookingId={current.bookingId} paymentId={current.paymentId}
      refresh={() => setRevision(value => value + 1)} onClose={close} onSent={item => { setNotice(item.complaintType === latePaymentType ? 'Đã gửi khiếu nại và thông báo cho chủ sân.' : 'Đã gửi khiếu nại.'); close() }} /> :
      <BookingPicker onClose={close} onSelect={id => setComposer({ request, open: true, bookingId: id, paymentId: null })} />)}
  </WorkspaceLayout>
}
