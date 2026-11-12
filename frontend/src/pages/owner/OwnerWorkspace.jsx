import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import WorkspaceLayout, { ActionForm, Field, Section } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import { OwnerCourtComplaints } from '../feedback/CourtComplaintsPage'
import { StaffAccounts } from '../account/AccountPages'
import { OwnerPromotions } from '../promotion/PromotionPages'

const loadRefunds = (signal) => api.get('/owner/refunds', { signal }).then((response) => response.data.data)
const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')

function RefundDetail({ id, refresh }) {
  const load = useCallback((signal) => api.get('/owner/refunds/' + id, { signal }).then((response) => response.data.data), [id])
  const refund = useResource(load, id)
  const item = refund.data
  return <div className="space-y-3">
    {refund.loading && <p role="status">Đang tải chi tiết…</p>}
    {refund.error && <p role="alert">{refund.error}</p>}
    {item && <>
      <p>Booking #{item.bookingId} · Ngày thanh toán gốc {item.originalPaymentDate}</p>
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
  const refunds = useResource(loadRefunds)
  const [id, setId] = useState('')
  return <Section title="Hoàn tiền" resource={refunds}>
    <Field label="Yêu cầu hoặc khoản đã hoàn" value={id} onChange={(event) => setId(event.target.value)}
      options={[[ '', 'Chọn yêu cầu' ], ...(refunds.data ?? []).map((item) => [item.id,
        '#' + item.id + ' · Booking #' + item.bookingId + ' · ' + (item.status === 'REFUNDED' ? 'Đã hoàn' : 'Chờ hoàn')])]} />
    {refunds.data?.length === 0 && <p>Chưa có yêu cầu hoàn tiền.</p>}
    {id && <RefundDetail key={id} id={id} refresh={refunds.reload} />}
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
    {bookings.data?.length === 0 && <p>Không có booking phù hợp.</p>}
    {bookings.data?.map((item) => <details className="space-y-2 border-t py-3" key={item.id}>
      <summary>{item.bookingCode} · Sân #{item.courtId} · {clock(item.startMinute)}–{clock(item.endMinute)}</summary>
      <ActionForm label="Xác nhận hủy" confirmation="Xác nhận hủy booking này?" action={(form) => api.post('/owner/bookings/' + item.id + '/cancel', {
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
  const tab = params.get('tab') || 'staff'
  const location = locations.data?.find((item) => String(item.id) === selected)
  const tabs = [['staff', 'Nhân viên'], ['cancel', 'Hủy booking'], ['refund', 'Hoàn tiền'], ['complaints', 'Khiếu nại'], ['rewards', 'Ưu đãi và điểm']]
  return <>
    <Section title="Địa điểm làm việc" resource={locations}>
      <Field label="Địa điểm" value={location ? selected : ''} onChange={(event) => {
        selectLocation(event.target.value)
        setSelected(event.target.value)
      }} options={[[ '', 'Chọn địa điểm' ], ...(locations.data ?? []).map((item) => [item.id, item.name + ' · ' + item.status])]} />
      {locations.data?.length === 0 && <p>Bạn chưa có địa điểm.</p>}
    </Section>
    {location && location.status !== 'ACTIVE' && <Section title="Địa điểm đã khóa">
      <p>{lockedVenueNotice(location)}</p>
      {canDownloadLockedVenue(location) && <ActionForm label="Tải dữ liệu địa điểm" action={() => downloadVenueData()} />}
    </Section>}
    {location?.status === 'ACTIVE' && <>
      <div className="flex flex-wrap gap-4">
        {tabs.map(([value, title]) => <button key={value} type="button" onClick={() => setParams({ tab: value })}
          aria-pressed={tab === value} className={tab === value ? 'font-semibold underline' : ''}>{title}</button>)}
        <Link className="underline" to="/owner/reports">Báo cáo</Link>
        <Link className="underline" to="/staff/confirm-payments?type=reschedule">Xử lý phụ thu đổi lịch</Link>
      </div>
      <div key={selected + ':' + tab} className="space-y-5">
        {tab === 'staff' && <StaffAccounts />}
        {tab === 'cancel' && <Cancellations />}
        {tab === 'refund' && <Refunds />}
        {tab === 'complaints' && <OwnerCourtComplaints />}
        {tab === 'rewards' && <OwnerPromotions location={location} refreshLocation={locations.reload} />}
      </div>
    </>}
  </>
}

export default function OwnerWorkspace() {
  return <WorkspaceLayout role="owner" title="Quản lý địa điểm"><OwnerLocation /></WorkspaceLayout>
}
