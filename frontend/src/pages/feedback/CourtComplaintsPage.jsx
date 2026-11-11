import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getAllPages } from '../../api'
import WorkspaceLayout, { ActionForm, Field, Section } from '../WorkspaceLayout'
import { today, useResource } from '../workspaceSupport'

const staffPath = '/staff/complaints'
const ownerPath = '/owner/complaints'
const labels = { SUBMITTED: 'Chờ Staff chuyển', PENDING_OWNER: 'Chờ Owner xử lý', RESOLVED: 'Đã xử lý', REJECTED: 'Đã từ chối' }
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
    [['REFUND', 'Tạo yêu cầu hoàn tiền'], ...(complaint.playerId ? [['POINTS', 'Cộng điểm bồi hoàn']] : [])]

  return <>
    <ActionForm label="Xác nhận phương án" after={refresh} confirmation="Ghi nhận phương án xử lý này?"
      action={(form) => api.post(ownerPath + '/' + complaint.id + '/resolve', {
        result, note: form.note,
        refundAmount: form.refundAmount ? Number(form.refundAmount) : null,
        compensationPoints: form.compensationPoints ? Number(form.compensationPoints) : null,
      })}>
      <Field label="Phương án" options={results} value={result} onChange={(event) => setResult(event.target.value)} />
      {result === 'REFUND' && <Field label="Số tiền đề xuất (để trống dùng gợi ý của hệ thống)" name="refundAmount" type="number" min={1} />}
      {result === 'POINTS' && <Field label="Số điểm bồi hoàn" name="compensationPoints" type="number" min={1} required />}
      <Field label="Ghi chú" name="note" maxLength={255} />
    </ActionForm>
    <ActionForm label="Từ chối khiếu nại" after={refresh} confirmation="Xác nhận từ chối khiếu nại?"
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
  function refresh() {
    detail.reload()
    refreshList()
  }
  return <Section title={'Chi tiết khiếu nại #' + id} resource={detail}>
    {item && <>
      <p>{labels[item.status] ?? item.status} · {item.bookingCode ?? 'Booking #' + item.bookingId} · {item.complaintType}</p>
      <p>{item.content}</p>
      {item.staffNote && <p>Ghi chú của Staff: {item.staffNote}</p>}
      {item.rejectReason && <p>Lý do từ chối: {item.rejectReason}</p>}
      {item.result && <p>Kết quả: {item.result === 'REFUND' ? 'Đã tạo yêu cầu hoàn tiền' : item.result}</p>}
      {owner && item.result === 'REFUND' && <Link className="underline" to="/owner/workspace?tab=refund">Mở danh sách hoàn tiền</Link>}
      {role === 'staff' && item.status === 'SUBMITTED' && <ActionForm label="Chuyển Owner" after={refresh}
        action={(form) => api.post(staffPath + '/' + id + '/forward', form)}>
        <Field label="Ghi chú khi chuyển Owner" name="staffNote" required maxLength={1000} />
      </ActionForm>}
      {owner && item.status === 'PENDING_OWNER' && <OwnerDecision complaint={item} refresh={refresh} />}
    </>}
  </Section>
}

function CaseList({ role = 'staff' }) {
  const cases = useResource(role === 'owner' ? loadOwnerCases : role === 'player' ? loadPlayerCases : loadStaffCases)
  const [id, setId] = useState('')
  return <>
    <Section title={role === 'player' ? 'Khiếu nại của tôi' : 'Khiếu nại tại địa điểm'} resource={cases}>
      <Field label="Chọn khiếu nại" value={id} onChange={(event) => setId(event.target.value)}
        options={[[ '', 'Chọn khiếu nại' ], ...(cases.data ?? []).map((item) => [
          item.id, '#' + item.id + ' · ' + (item.bookingCode || 'Booking #' + item.bookingId) + ' · ' + (labels[item.status] ?? item.status),
        ])]} />
      {cases.data?.length === 0 && <p>Chưa có khiếu nại.</p>}
    </Section>
    {id && <CaseDetails key={id} id={id} role={role} refreshList={cases.reload} />}
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

function PlayerComplaintForm({ bookingId, refresh }) {
  const loadBooking = useCallback((signal) => api.get('/bookings/' + bookingId, { signal }).then((response) => response.data.data), [bookingId])
  const booking = useResource(loadBooking, bookingId)
  const item = booking.data
  const types = [['COURT_SERVICE', 'Dịch vụ sân'], ['PAYMENT_ISSUE', 'Vấn đề thanh toán'], ['OTHER', 'Khác']]
  if (item?.paymentId) types.push(['LATE_PAYMENT_CONFIRMATION', 'Xác nhận thanh toán trễ'])

  return <Section title="Gửi khiếu nại" resource={booking}>
    {item && <>
      <p>{item.bookingCode} · {item.playDate}</p>
      <ActionForm label="Gửi khiếu nại" after={refresh} action={(form) => api.post('/complaints', {
        ...form, bookingId: item.id ?? Number(bookingId),
        paymentId: form.complaintType === 'LATE_PAYMENT_CONFIRMATION' ? item.paymentId : null,
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
      <PlayerComplaintForm key={bookingId} bookingId={bookingId} refresh={() => setRevision((value) => value + 1)} />}
    <Link to="/my-bookings" className="underline">Chọn booking trong lịch sử đặt sân</Link>
    <CaseList role="player" key={revision} />
  </WorkspaceLayout>
}

export default function CourtComplaintsPage() {
  return <WorkspaceLayout role="staff" title="Khiếu nại của khách"><StaffComplaints /></WorkspaceLayout>
}
