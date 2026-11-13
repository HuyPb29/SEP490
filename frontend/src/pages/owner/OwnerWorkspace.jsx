import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import { useOwnerRefund, useOwnerRefunds } from '../../hooks/useOwnerRefunds'
import WorkspaceLayout, { ActionForm, EmptyState, Feedback, Field, Section, StatusPill } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import { OwnerCourtComplaints } from '../feedback/CourtComplaintsPage'
import { StaffAccounts } from '../account/AccountPages'
import { OwnerPromotions } from '../promotion/PromotionPages'

const ownerTabs = [['staff', 'Nhân viên'], ['cancel', 'Hủy đặt sân'], ['refund', 'Hoàn tiền'], ['complaints', 'Khiếu nại'], ['rewards', 'Ưu đãi và điểm']]
const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')

function refundSource(item) {
  if (item.complaintId) return 'Khiếu nại #' + item.complaintId
  if (item.affectedBookingId) return 'Đặt sân bị ảnh hưởng'
  return 'Yêu cầu hoàn tiền'
}

function RefundDetail({ id, saved, onRecorded }) {
  const refund = useOwnerRefund(id)
  const item = saved ?? refund.data
  const canRecord = item?.status === 'PENDING_REFUND' && item.remainingRefundableAmount > 0
  return <div className="space-y-3">
    {!saved && refund.loading && <p role="status">Đang tải chi tiết…</p>}
    {!saved && refund.error && <Feedback tone="error">{refund.error}
      <button type="button" className="cw-secondary" onClick={refund.reload}>Thử tải lại chi tiết</button>
    </Feedback>}
    {item && <>
      <dl className="cw-facts">
        <div><dt>Mã đặt sân</dt><dd>{item.bookingCode}</dd></div>
        <div><dt>Nguồn yêu cầu</dt><dd>{refundSource(item)}</dd></div>
        <div><dt>Ngày thanh toán gốc</dt><dd>{item.originalPaymentDate}</dd></div>
        <div><dt>Số tiền gợi ý</dt><dd>{money(item.suggestedAmount)}</dd></div>
        <div><dt>Trạng thái</dt><dd><StatusPill tone={item.status === 'REFUNDED' ? 'positive' : 'pending'}>
          {item.status === 'REFUNDED' ? 'Đã hoàn' : 'Chờ hoàn'}
        </StatusPill></dd></div>
        {item.status === 'PENDING_REFUND' && <div><dt>Số tiền còn có thể hoàn</dt><dd>{money(item.remainingRefundableAmount)}</dd></div>}
      </dl>
      {item.verifiedUnrecordedAmount != null &&
        <p>Khoản thu đã xác minh ngoài doanh thu {money(item.verifiedUnrecordedAmount)}.</p>}
      {canRecord && <>
        <p>Chuyển tiền cho khách bên ngoài hệ thống trước khi ghi nhận.</p>
        <ActionForm label="Ghi nhận đã hoàn" confirmation={`Xác nhận đã hoàn tiền cho đặt sân ${item.bookingCode}?`}
          action={refund.record} successMessage={false} after={({ data }) => onRecorded(data)}>
          {(errors) => <>
            <Field label="Số tiền thực hoàn" name="amount" type="number" min={1}
              defaultValue={Math.min(item.suggestedAmount, item.remainingRefundableAmount)} required error={errors.amount} />
            <Field label="Ngày hoàn" name="refundDate" type="date" min={item.originalPaymentDate} max={today()}
              defaultValue={today()} required error={errors.refundDate} />
            <Field label="Lý do (bắt buộc nếu khác số tiền gợi ý)" name="reason" maxLength={500} error={errors.reason} />
            <Field label="Ghi chú" name="note" maxLength={500} error={errors.note} />
          </>}
        </ActionForm>
      </>}
      {item.status === 'REFUNDED' && <dl className="cw-facts">
        <div><dt>Số tiền thực hoàn</dt><dd>{money(item.refundedAmount)}</dd></div>
        <div><dt>Ngày hoàn</dt><dd>{item.refundDate}</dd></div>
        <div><dt>Lý do</dt><dd>{item.reason || '—'}</dd></div>
        <div><dt>Ghi chú</dt><dd>{item.note || '—'}</dd></div>
      </dl>}
    </>}
  </div>
}

function Refunds() {
  const [params, setParams] = useSearchParams()
  const complaintId = params.get('complaintId')
  const refunds = useOwnerRefunds()
  const [id, setId] = useState(null)
  const [status, setStatus] = useState(complaintId ? '' : 'PENDING_REFUND')
  const [recorded, setRecorded] = useState(null)
  const items = refunds.data ?? []
  const currentItems = recorded
    ? items.some((item) => item.id === recorded.data.id)
      ? items.map((item) => item.id === recorded.data.id ? recorded.data : item)
      : [recorded.data, ...items]
    : items
  const visible = currentItems.filter((item) => !status || item.status === status)
  const selectedId = id ?? visible.find((item) => complaintId && String(item.complaintId) === complaintId)?.id
  function handleRecorded(result) {
    setRecorded(result)
    setId(result.data.id)
    setStatus('REFUNDED')
    refunds.reload()
  }
  return <Section title="Hoàn tiền" resource={refunds}>
    <div className="cw-tabs" role="group" aria-label="Trạng thái hoàn tiền">
      {[['PENDING_REFUND', 'Chờ hoàn'], ['REFUNDED', 'Đã hoàn'], ['', 'Tất cả']].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setId(''); setRecorded(null) }}>{label}</button>)}
    </div>
    {complaintId && <Feedback>Đang xem yêu cầu hoàn tiền từ khiếu nại #{complaintId}.
      <button type="button" className="cw-secondary" onClick={() => {
        const next = new URLSearchParams(params)
        next.delete('complaintId')
        setParams(next, { replace: true })
      }}>Bỏ liên kết</button>
    </Feedback>}
    {recorded && <Feedback tone="success">{recorded.message}</Feedback>}
    {!refunds.loading && !refunds.error && !visible.length && <EmptyState>Không có yêu cầu trong mục này.</EmptyState>}
    {!!visible.length && <ul className="divide-y">
      {visible.map((item) => <li key={item.id} className="py-3">
        <button type="button" className="cw-secondary" aria-pressed={selectedId === item.id}
          onClick={() => setId(item.id)}>{item.bookingCode} · {refundSource(item)}</button>
        <p>{item.status === 'REFUNDED'
          ? `Đã hoàn ${money(item.refundedAmount)} ngày ${item.refundDate}`
          : `Chờ hoàn · Gợi ý ${money(item.suggestedAmount)}`}</p>
        {item.status === 'REFUNDED' && <p>Ngày thanh toán gốc {item.originalPaymentDate}</p>}
      </li>)}
    </ul>}
    {visible.some((item) => item.id === selectedId) && <RefundDetail key={selectedId} id={selectedId}
      saved={recorded?.data.id === selectedId ? recorded.data : null} onRecorded={handleRecorded} />}
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
    {!bookings.loading && bookings.data?.map((item) => <details className="space-y-2 border-t py-3" key={item.id}>
      <summary>{item.bookingCode} · Sân #{item.courtId} · {clock(item.startMinute)}–{clock(item.endMinute)}</summary>
      <ActionForm label="Xác nhận hủy" tone="danger" confirmation={(form) => {
        if (form.get('cause') === 'WALK_IN_CUSTOMER_REQUEST') {
          return `Hủy ${item.bookingCode} theo yêu cầu của khách? Khoản đã thanh toán không được hoàn lại.`
        }
        if (item.bookingType === 'WALK_IN') {
          return `Sân hủy booking tại quầy ${item.bookingCode}. Nhân viên cần lập khiếu nại cho khách. Tiếp tục?`
        }
        return `Thay đổi này ảnh hưởng 1 booking đã xác nhận (${item.bookingCode}). Khách sẽ được thông báo để chọn cách xử lý. Tiếp tục? (MSG15)`
      }} action={(form) => api.post('/owner/bookings/' + item.id + '/cancel', {
        ...form, cause: form.cause || 'OWNER_CANCELLED',
      })} after={bookings.reload}>
        {(errors) => <>
          {item.bookingType === 'WALK_IN' && <Field label="Nguyên nhân" name="cause" options={[
            ['OWNER_CANCELLED', 'Sân hủy'], ['WALK_IN_CUSTOMER_REQUEST', 'Khách tại quầy yêu cầu'],
          ]} error={errors.cause} />}
          <Field label="Lý do hủy" name="reason" maxLength={500} required error={errors.reason} />
        </>}
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
        <Link className="underline" to="/owner/reports">Báo cáo</Link>
        <Link className="underline" to="/staff/confirm-payments?type=reschedule">Xử lý phụ thu đổi lịch</Link>
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
