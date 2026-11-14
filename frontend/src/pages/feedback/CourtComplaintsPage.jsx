import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getAllPages } from '../../api'
import { isLatePaymentEligible } from '../../api/bookingPaymentApi'
import WorkspaceLayout, { ActionForm, EmptyState, Field, Section, StatusPill } from '../WorkspaceLayout'
import { today, useResource } from '../workspaceSupport'

const staffPath = '/staff/complaints'
const ownerPath = '/owner/complaints'
const labels = { SUBMITTED: 'Chờ Staff chuyển', PENDING_OWNER: 'Chờ Owner xử lý', RESOLVED: 'Đã xử lý', REJECTED: 'Đã từ chối' }
const resultLabels = {
  REFUND: 'Đã tạo yêu cầu hoàn tiền',
  POINTS: 'Cộng điểm bồi hoàn',
  NO_COMPENSATION: 'Ghi nhận, không bồi thường',
  LATE_PAYMENT_CONFIRMED: 'Đã xác nhận thanh toán trễ',
}
const loadStaffCases = (signal) => getAllPages(staffPath, { signal })
const loadOwnerCases = (signal) => getAllPages(ownerPath, { signal })
const loadPlayerCases = (signal) => getAllPages('/me/complaints', { signal })

function WalkInComplaintForm({ refresh }) {
  const [date, setDate] = useState(today)
  const loadWalkIns = useCallback((signal) => date
    ? getAllPages('/staff/bookings', { signal, params: { date, status: 'CANCELLED_BY_FACILITY' } })
    : Promise.resolve([]), [date])
  const bookings = useResource(loadWalkIns, date)
  return <Section title="Lập khiếu nại cho khách tại quầy bị sân hủy" resource={bookings}>
    <Field label="Ngày đặt sân" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    {bookings.data?.length === 0 && <p>Không có booking tại quầy bị sân hủy trong ngày này.</p>}
    {bookings.data?.length > 0 && <ActionForm key={date} label="Lập khiếu nại" after={refresh}
      action={(form) => api.post(staffPath, { ...form, bookingId: Number(form.bookingId), complaintType: 'COURT_SERVICE' })}>
      <Field label="Booking bị sân hủy" name="bookingId" required options={[
        ['', 'Chọn booking'], ...bookings.data.map((item) => [item.id, item.bookingCode + ' · ' + item.customerName + ' · ' + item.startTime]),
      ]} />
      <Field label="Nội dung khách phản ánh" name="content" required maxLength={1000} />
    </ActionForm>}
  </Section>
}

function OwnerDecision({ complaint, refresh }) {
  const latePayment = complaint.complaintType === 'LATE_PAYMENT_CONFIRMATION'
  const [result, setResult] = useState(latePayment ? 'LATE_PAYMENT_CONFIRMED' : 'REFUND')
  const results = latePayment ? [['LATE_PAYMENT_CONFIRMED', 'Xác nhận thanh toán trễ']] :
    [['REFUND', 'Tạo yêu cầu hoàn tiền'], ...(complaint.playerId ? [['POINTS', 'Cộng điểm bồi hoàn']] : []),
      ['NO_COMPENSATION', 'Ghi nhận không bồi thường']]

  return <>
    <ActionForm label="Xác nhận phương án" after={refresh} confirmation="Ghi nhận phương án xử lý này?"
      action={(form) => api.post(ownerPath + '/' + complaint.id + '/resolve', {
        result, note: form.note,
        refundAmount: form.refundAmount ? Number(form.refundAmount) : null,
        verifiedUnrecordedAmount: form.verifiedUnrecordedAmount ? Number(form.verifiedUnrecordedAmount) : null,
        originalTransferDate: form.originalTransferDate || null,
        compensationPoints: form.compensationPoints ? Number(form.compensationPoints) : null,
      })}>
      <Field label="Phương án" options={results} value={result} onChange={(event) => setResult(event.target.value)} />
      {result === 'REFUND' && <>
        <Field label="Số tiền đề xuất (để trống dùng gợi ý của hệ thống)" name="refundAmount" type="number" min={1} />
        <Field label="Đã thu chưa ghi doanh thu (VND, nếu có)" name="verifiedUnrecordedAmount" type="number" min={1} />
        <Field label="Ngày chuyển khoản gốc nếu chưa ghi doanh thu" name="originalTransferDate" type="date" max={today()} />
      </>}
      {result === 'POINTS' && <Field label="Số điểm bồi hoàn" name="compensationPoints" type="number" min={1} required />}
      <Field label="Ghi chú" name="note" maxLength={255} />
    </ActionForm>
    <ActionForm label="Từ chối khiếu nại" tone="danger" after={refresh} confirmation="Xác nhận từ chối khiếu nại?"
      action={(form) => api.post(ownerPath + '/' + complaint.id + '/reject', form)}>
      <Field label="Lý do từ chối" name="reason" maxLength={500} required />
    </ActionForm>
  </>
}

function CaseDetails({ id, role, refreshList }) {
  const owner = role === 'owner'
  const path = owner ? ownerPath : role === 'player' ? '/complaints' : staffPath
  const load = useCallback((signal) => api.get(path + '/' + id, { signal }).then((response) => response.data.data), [id, path])
  const detail = useResource(load, id)
  const item = detail.data
  const container = useRef(null)
  // Chi tiết mở ngay dưới dòng vừa bấm; cuộn tới để không bị khuất dưới danh sách.
  useEffect(() => { container.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  function refresh() {
    detail.reload()
    refreshList()
  }
  return <div ref={container}><Section title={'Chi tiết khiếu nại #' + id} resource={detail}>
    {item && <>
      <div className="cw-record"><strong>{item.bookingCode ?? 'Lịch đặt #' + item.bookingId}</strong>
        <StatusPill tone={statusTone(item.status)}>
          {labels[item.status] ?? item.status}
        </StatusPill>
      </div>
      <p className="cw-muted">
        {typeLabels[item.complaintType] ?? item.complaintType}
        {item.playerName && ' · ' + item.playerName}
        {' · Gửi lúc ' + formatCreatedAt(item.createdAt)}
      </p>
      <p>{item.content}</p>
      {item.staffNote && <p>Ghi chú của Staff: {item.staffNote}</p>}
      {item.rejectReason && <p>Lý do từ chối: {item.rejectReason}</p>}
      {item.result && <p>Kết quả: {resultLabels[item.result] ?? item.result}
        {item.result === 'POINTS' && item.compensationPoints ? ' (' + item.compensationPoints + ' điểm)' : ''}</p>}
      {owner && item.result === 'REFUND' && <Link className="underline" to={'/owner/workspace?tab=refund&complaintId=' + item.id}>Mở yêu cầu hoàn tiền</Link>}
      {role === 'staff' && item.status === 'SUBMITTED' && <ActionForm label="Chuyển Owner" after={refresh}
        action={(form) => api.post(staffPath + '/' + id + '/forward', form)}>
        <Field label="Ghi chú khi chuyển Owner" name="staffNote" required maxLength={1000} />
      </ActionForm>}
      {owner && item.status === 'PENDING_OWNER' && item.complaintType === 'LATE_PAYMENT_CONFIRMATION' &&
        <p><Link className="underline" to={`/staff/confirm-payments?paymentId=${item.paymentId}${item.reschedulePayment ? '&type=reschedule' : ''}`}>
          Mở giao dịch để yêu cầu bổ sung hoặc từ chối
        </Link></p>}
      {owner && item.status === 'PENDING_OWNER' && <OwnerDecision complaint={item} refresh={refresh} />}
    </>}
  </Section></div>
}

const typeLabels = {
  COURT_SERVICE: 'Dịch vụ sân',
  PAYMENT_ISSUE: 'Vấn đề thanh toán',
  OTHER: 'Khác',
  LATE_PAYMENT_CONFIRMATION: 'Xác nhận thanh toán trễ',
}

function statusTone(status) {
  return status === 'RESOLVED' ? 'positive' : status === 'REJECTED' ? 'negative' : 'pending'
}

function formatCreatedAt(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function CaseList({ role = 'staff' }) {
  const cases = useResource(role === 'owner' ? loadOwnerCases : role === 'player' ? loadPlayerCases : loadStaffCases)
  const [params] = useSearchParams()
  const requestedId = params.get('complaintId')
  const [id, setId] = useState(() => /^[1-9]\d*$/.test(requestedId || '') ? requestedId : '')
  const [status, setStatus] = useState('')
  // D65: Owner chỉ nhận khiếu nại Staff đã chuyển lên, nên không có mục "Chờ Staff chuyển".
  const statusOptions = Object.entries(labels).filter(([value]) => role !== 'owner' || value !== 'SUBMITTED')
  const visible = cases.data
    ?.filter((item) => !status || item.status === status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return <>
    <Section title={role === 'player' ? 'Khiếu nại của tôi' : 'Khiếu nại tại địa điểm'} resource={cases}>
      {role === 'owner' && <p className="cw-muted">
        Khiếu nại của người chơi hiện ở đây sau khi Staff kiểm tra và chuyển lên; khiếu nại xác nhận thanh toán trễ đến thẳng chủ sân.
      </p>}
      <Field label="Trạng thái" value={status} options={[[ '', 'Tất cả' ], ...statusOptions]}
        onChange={(event) => { setStatus(event.target.value); setId('') }} />
      {visible?.length > 0 && <ul className="cw-records">
        {visible.map((item) => {
          const selected = String(item.id) === String(id)
          return <li key={item.id} className="cw-record"
            style={selected ? { borderColor: 'var(--cw-accent, #059669)', borderWidth: 2, display: 'block' } : undefined}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px 14px' }}>
              <div>
                <div className="cw-record-title">#{item.id} · {item.bookingCode || 'Booking #' + item.bookingId}</div>
                <small>
                  {typeLabels[item.complaintType] ?? item.complaintType}
                  {role !== 'player' && item.playerName && ' · ' + item.playerName}
                  {' · ' + formatCreatedAt(item.createdAt)}
                </small>
              </div>
              <StatusPill tone={statusTone(item.status)}>{labels[item.status] ?? item.status}</StatusPill>
              <button type="button" className="cw-secondary" onClick={() => setId(selected ? '' : String(item.id))}>
                {selected ? 'Đóng chi tiết' : 'Xem chi tiết'}
              </button>
            </div>
            {selected && <div style={{ marginTop: 12 }}>
              <CaseDetails key={item.id} id={String(item.id)} role={role} refreshList={cases.reload} />
            </div>}
          </li>
        })}
      </ul>}
      {visible?.length === 0 && <EmptyState>Không có khiếu nại trong mục này.</EmptyState>}
    </Section>
    {id && visible && !visible.some((item) => String(item.id) === String(id)) &&
      <CaseDetails key={id} id={id} role={role} refreshList={cases.reload} />}
  </>
}

export function OwnerCourtComplaints() {
  return <CaseList role="owner" />
}

function StaffComplaints() {
  const [revision, setRevision] = useState(0)
  return <>
    <Link className="underline" to="/staff/confirm-payments">Xác nhận thanh toán</Link>
    <WalkInComplaintForm refresh={() => setRevision((value) => value + 1)} />
    <CaseList key={revision} />
  </>
}

function PlayerComplaintForm({ bookingId, paymentId, refresh }) {
  const loadBooking = useCallback((signal) => api.get('/bookings/' + bookingId, { signal }).then((response) => response.data.data), [bookingId])
  const booking = useResource(loadBooking, bookingId)
  const item = booking.data
  const types = [['COURT_SERVICE', 'Dịch vụ sân'], ['PAYMENT_ISSUE', 'Vấn đề thanh toán'], ['OTHER', 'Khác']]
  const targetPaymentId = paymentId || item?.paymentId
  const loadEligibility = useCallback(async (signal) => {
    if (!targetPaymentId) return false
    return isLatePaymentEligible(bookingId, targetPaymentId, signal)
  }, [bookingId, targetPaymentId])
  const eligibility = useResource(loadEligibility, targetPaymentId)
  if (eligibility.data) types.push(['LATE_PAYMENT_CONFIRMATION', 'Xác nhận thanh toán trễ · nhận voucher 10.000 đ'])

  return <Section title="Gửi khiếu nại" resource={booking}>
    {item && <>
      <p>{item.bookingCode} · {item.playDate}</p>
      <ActionForm label="Gửi khiếu nại" after={() => { eligibility.reload(); refresh() }} action={(form) => api.post('/complaints', {
        ...form, bookingId: item.id ?? Number(bookingId),
        paymentId: form.complaintType === 'LATE_PAYMENT_CONFIRMATION' ? targetPaymentId : null,
      })}>
        <Field label="Loại khiếu nại" name="complaintType" options={types} required />
        <Field label="Nội dung" name="content" maxLength={1000} required />
      </ActionForm>
    </>}
  </Section>
}

export function PlayerComplaintsPage() {
  const [params] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const bookingId = params.get('bookingId')
  return <WorkspaceLayout role="player" title="Khiếu nại">
    {bookingId && /^[1-9]\d*$/.test(bookingId) &&
      <PlayerComplaintForm key={bookingId + ':' + params.get('paymentId')} bookingId={bookingId}
        paymentId={/^[1-9]\d*$/.test(params.get('paymentId') || '') ? params.get('paymentId') : null} refresh={() => setRevision((value) => value + 1)} />}
    <Link to="/my-bookings" className="cw-secondary justify-self-start">Chọn lịch đặt sân để gửi khiếu nại</Link>
    <CaseList role="player" key={revision} />
  </WorkspaceLayout>
}

export default function CourtComplaintsPage() {
  return <WorkspaceLayout role="staff" title="Khiếu nại của khách"><StaffComplaints /></WorkspaceLayout>
}
