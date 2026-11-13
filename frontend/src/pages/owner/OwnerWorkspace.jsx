import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import WorkspaceLayout, { ActionForm, EmptyState, Feedback, Field, Section, StatusPill } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import { OwnerCourtComplaints } from '../feedback/CourtComplaintsPage'
import { StaffAccounts } from '../account/AccountPages'
import { OwnerPromotions } from '../promotion/PromotionPages'

const loadRefunds = (signal) => api.get('/owner/refunds', { signal }).then((response) => response.data.data)
const ownerTabs = [['staff', 'Nhân viên'], ['cancel', 'Hủy đặt sân'], ['refund', 'Hoàn tiền'], ['complaints', 'Khiếu nại'], ['rewards', 'Ưu đãi và điểm']]
const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')

function RefundDetail({ id, refresh }) {
  const load = useCallback((signal) => api.get('/owner/refunds/' + id, { signal }).then((response) => response.data.data), [id])
  const refund = useResource(load, id)
  const item = refund.data
  return <div className="space-y-3">
    {refund.loading && <p role="status">Đang tải chi tiết…</p>}
    {refund.error && <p role="alert">{refund.error}</p>}
    {item && <>
      <dl className="cw-facts">
        <div><dt>Đặt sân</dt><dd>#{item.bookingId}</dd></div>
        <div><dt>Ngày thanh toán gốc</dt><dd>{item.originalPaymentDate}</dd></div>
        <div><dt>Trạng thái</dt><dd><StatusPill tone={item.status === 'REFUNDED' ? 'positive' : 'pending'}>
          {item.status === 'REFUNDED' ? 'Đã hoàn' : 'Chờ hoàn'}
        </StatusPill></dd></div>
      </dl>
      {item.verifiedUnrecordedAmount != null &&
        <p>Khoản thu đã xác minh ngoài doanh thu: {money(item.verifiedUnrecordedAmount)}</p>}
      <p>Gợi ý hoàn {money(item.suggestedAmount)} {item.complaintId && '· Khiếu nại #' + item.complaintId}</p>
      {item.status === 'PENDING_REFUND' && <ActionForm label="Ghi nhận đã hoàn" confirmation="Xác nhận đã chuyển khoản hoàn tiền cho khách?" action={(form) =>
        api.post('/owner/refunds/' + id + '/record', { ...form, amount: Number(form.amount) })
      } after={() => { refund.reload(); refresh() }}>
        <Field label="Số tiền thực hoàn" name="amount" type="number" min={1} defaultValue={item.suggestedAmount} required />
        <Field label="Ngày hoàn" name="refundDate" type="date" min={item.originalPaymentDate} max={today()} defaultValue={today()} required />
        <Field label="Lý do (bắt buộc nếu khác số tiền gợi ý)" name="reason" maxLength={500} />
        <Field label="Ghi chú" name="note" maxLength={500} />
      </ActionForm>}
      {item.status === 'REFUNDED' && <p>Đã hoàn {money(item.refundedAmount)} ngày {item.refundDate}. {item.reason} {item.note}</p>}
    </>}
  </div>
}

function Refunds() {
  const [params, setParams] = useSearchParams()
  const complaintId = params.get('complaintId')
  const refunds = useResource(loadRefunds)
  const [id, setId] = useState(null)
  const [status, setStatus] = useState(complaintId ? '' : 'PENDING_REFUND')
  const visible = refunds.data?.filter((item) => !status || item.status === status)
  const selectedId = id ?? visible?.find((item) => complaintId && String(item.complaintId) === complaintId)?.id ?? ''
  return <Section title="Hoàn tiền" resource={refunds}>
    <div className="cw-tabs" role="group" aria-label="Trạng thái hoàn tiền">
      {[['PENDING_REFUND', 'Chờ hoàn'], ['REFUNDED', 'Đã hoàn'], ['', 'Tất cả']].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setId('') }}>{label}</button>)}
    </div>
    {complaintId && <Feedback>Đang xem yêu cầu hoàn tiền từ khiếu nại #{complaintId}.
      <button type="button" className="cw-secondary" onClick={() => {
        const next = new URLSearchParams(params)
        next.delete('complaintId')
        setParams(next, { replace: true })
      }}>Bỏ liên kết</button>
    </Feedback>}
    <Field label="Yêu cầu hoặc khoản đã hoàn" value={selectedId} onChange={(event) => setId(event.target.value)}
      options={[[ '', 'Chọn yêu cầu' ], ...(visible ?? []).map((item) => [item.id,
        '#' + item.id + ' · Booking #' + item.bookingId + ' · ' + (item.status === 'REFUNDED' ? 'Đã hoàn' : 'Chờ hoàn')])]} />
    {visible?.length === 0 && <EmptyState>Không có yêu cầu trong mục này.</EmptyState>}
    {selectedId && <RefundDetail key={selectedId} id={selectedId} refresh={refunds.reload} />}
  </Section>
}

function Cancellations() {
  const [date, setDate] = useState(today)
  const load = useCallback((signal) => date
    ? api.get('/owner/bookings/cancellable', { params: { playDate: date }, signal }).then((response) => response.data.data)
    : Promise.resolve([]), [date])
  const bookings = useResource(load, date)
  return <Section title="Hủy booking tại địa điểm" resource={bookings}>
    <Field label="Ngày chơi" type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} />
    {bookings.data?.length === 0 && <EmptyState>Ngày này không có lịch đặt sân có thể hủy.</EmptyState>}
    {bookings.data?.map((item) => <details className="space-y-2 border-t py-3" key={item.id}>
      <summary>{item.bookingCode} · Sân #{item.courtId} · {clock(item.startMinute)}–{clock(item.endMinute)}</summary>
      <ActionForm label="Xác nhận hủy" tone="danger" confirmation="Xác nhận hủy booking này?" action={(form) => api.post('/owner/bookings/' + item.id + '/cancel', {
        ...form, cause: form.cause || 'OWNER_CANCELLED',
      })} after={bookings.reload}>
        {item.bookingType === 'WALK_IN' && <Field label="Nguyên nhân" name="cause" options={[
          ['OWNER_CANCELLED', 'Địa điểm hủy'], ['WALK_IN_CUSTOMER_REQUEST', 'Khách tại quầy yêu cầu'],
        ]} />}
        <Field label="Lý do hủy" name="reason" maxLength={500} required />
      </ActionForm>
    </details>)}
  </Section>
}

function lockedVenueDeadline(location) {
  const lockedAt = new Date(location.lockedAt)
  if (!location.lockedAt || Number.isNaN(lockedAt.getTime())) return null
  lockedAt.setDate(lockedAt.getDate() + 30)
  return lockedAt
}

function canDownloadLockedVenue(location) {
  const deadline = lockedVenueDeadline(location)
  return !deadline || deadline.getTime() >= Date.now()
}

function lockedVenueNotice(location) {
  const deadline = lockedVenueDeadline(location)
  const name = 'Địa điểm ' + location.name + ' đã bị khóa.'
  if (!deadline) return name
  if (!canDownloadLockedVenue(location)) return name + ' Đã hết thời hạn tải dữ liệu quản lý.'
  return name + ' Anh/chị chỉ còn tải được dữ liệu quản lý đến ngày '
    + new Intl.DateTimeFormat('vi-VN').format(deadline) + '.'
}

function OwnerLocation() {
  const locations = useResource(loadOwnerLocations)
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState(() => getSelectedLocation() || '')
  const requestedTab = params.get('tab')
  const tab = ownerTabs.some(([value]) => value === requestedTab) ? requestedTab : 'staff'
  const location = locations.data?.find((item) => String(item.id) === selected)
  return <>
    <Section title="Địa điểm làm việc" resource={locations}>
      <Field label="Địa điểm" value={location ? selected : ''} onChange={(event) => {
        selectLocation(event.target.value)
        setSelected(event.target.value)
      }} options={[[ '', 'Chọn địa điểm' ], ...(locations.data ?? []).map((item) => [item.id, item.name + ' · ' + item.status])]} />
      {locations.data?.length === 0 && <EmptyState>Bạn chưa có địa điểm.</EmptyState>}
      {locations.data?.length > 0 && !location && <Feedback>Chọn địa điểm để xem nhân viên, đặt sân và ưu đãi.</Feedback>}
    </Section>
    {location && location.status !== 'ACTIVE' && <Section title="Địa điểm đã khóa">
      <p>{lockedVenueNotice(location)}</p>
      {canDownloadLockedVenue(location) && <ActionForm label="Tải dữ liệu địa điểm" action={() => downloadVenueData()} />}
    </Section>}
    {location?.status === 'ACTIVE' && <>
      <div className="cw-tabs" role="group" aria-label="Quản lý địa điểm">
        {ownerTabs.map(([value, title]) => <button key={value} type="button" onClick={() => setParams({ tab: value })}
          aria-pressed={tab === value}>{title}</button>)}
      </div>
      <div key={selected + ':' + tab} className="cw-stack">
        {tab === 'staff' && <StaffAccounts />}
        {tab === 'cancel' && <Cancellations />}
        {tab === 'refund' && <Refunds key={params.get('complaintId') || ''} />}
        {tab === 'complaints' && <OwnerCourtComplaints />}
        {tab === 'rewards' && <OwnerPromotions location={location} refreshLocation={locations.reload} />}
      </div>
    </>}
  </>
}

export default function OwnerWorkspace() {
  return <WorkspaceLayout role="owner" title="Quản lý địa điểm"><OwnerLocation /></WorkspaceLayout>
}
