import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import api, { getAllPages } from '../api'
import { getSavedUser } from '../api/session'
import { cancelMatchApi, keepMatchAfterRescheduleApi } from '../api/bookingApi'
import WorkspaceLayout, { ActionForm, EmptyState, Section, StatusPill } from './WorkspaceLayout'
import { useResource } from './workspaceSupport'
import { useAuth } from '../hooks/useAuth'
import { notificationMessage } from '../utils/formatters'

const loadNotifications = (signal) => Promise.all([
  getAllPages('/notifications', { signal }),
  api.get('/notifications/unread-count', { signal }).then((response) => response.data.data),
])

function MatchDecision({ id }) {
  const load = useCallback((signal) => api.get('/matches/' + id, { signal }).then((response) => response.data.data), [id])
  const match = useResource(load, id)
  if (match.loading) return <p role="status">Đang tải kèo…</p>
  if (match.error) return <p role="alert">{match.error}</p>
  return <div className="space-y-2">
    <p>{match.data.bookingCode} · {match.data.playDate} · {match.data.courtName} · {match.data.status}</p>
    {match.data.host && match.data.reschedulePending && <>
      <ActionForm label="Giữ kèo ở giờ mới" action={() => keepMatchAfterRescheduleApi(id)} after={match.reload} />
      <ActionForm label="Hủy kèo" confirmation="Hủy kèo sau khi đổi lịch?"
        action={() => cancelMatchApi(id)} after={match.reload} />
    </>}
  </div>
}

export function Inbox({ title = 'Hộp thư' }) {
  const inbox = useResource(loadNotifications)
  const { setSelectedVenue } = useAuth()
  const [items, count] = inbox.data ?? []
  const [unreadOnly, setUnreadOnly] = useState(false)
  const visible = items?.filter((item) => !unreadOnly || !item.read)
  const role = getSavedUser()?.role_code
  const isPlayer = role === 'player'
  return <Section title={count ? title + ' · ' + (count.unread ?? 0) + ' chưa đọc' : title} resource={inbox}>
    {items?.some((item) => !item.read) && <ActionForm label="Đánh dấu đã đọc tất cả"
      action={() => api.patch('/notifications/read-all')} after={inbox.reload} />}
    <div className="cw-tabs" role="group" aria-label="Lọc thông báo">
      <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Tất cả</button>
      <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Chưa đọc</button>
    </div>
    {visible?.length === 0 && <EmptyState>{unreadOnly ? 'Bạn đã đọc hết thông báo.' : 'Bạn chưa có thông báo.'}</EmptyState>}
    {visible?.map((item) => <article key={item.id} className={'cw-record flex-col !items-start' + (item.read ? '' : ' cw-notification--new')}>
      <h3 className="font-semibold">{notificationMessage(item.title) || 'Thông báo'} {!item.read && <StatusPill tone="positive">Chưa đọc</StatusPill>}</h3>
      <p>{notificationMessage(item.content)}</p>
      <time dateTime={item.createdAt} className="cw-muted text-sm">{item.createdAt?.replace('T', ' ')}</time>
      {isPlayer && item.refType === 'BOOKING' && <Link className="block underline" to="/my-bookings">Mở lịch đặt sân</Link>}
      {(role === 'owner' || role === 'staff') && item.type === 'RESCHEDULE_PROOF_SUBMITTED' && item.refId &&
        <Link className="block underline" to="/staff/confirm-payments?type=reschedule"
          onClick={() => setSelectedVenue(item.refId)}>Mở danh sách phụ thu chờ xác nhận</Link>}
      {role === 'staff' && item.type === 'PAYMENT_ESCALATED' &&
        <Link className="block underline" to="/staff/dashboard">Mở bảng điều hành</Link>}
      {role === 'owner' && item.type === 'PAYMENT_ESCALATED_TO_OWNER' && item.refId &&
        <Link className="block underline" to={'/staff/confirm-payments?paymentId=' + item.refId
          + (item.refType === 'RESCHEDULE_PAYMENT' ? '&type=reschedule' : '')}>Xử lý giao dịch</Link>}
      {role === 'staff' && item.type === 'BOOKING_ENDING_SOON' &&
        <Link className="block underline" to="/staff/dashboard">Mở bảng điều hành</Link>}
      {role === 'admin' && item.refType === 'SERVICE_REGISTRATION' &&
        <Link className="block underline" to="/admin/facilities">Xem đơn đăng ký dịch vụ</Link>}
      {role === 'owner' && item.refType === 'COMPLAINT' &&
        <Link className="block underline" to={`/owner/workspace?tab=complaints&complaintId=${item.refId}`}>Xem khiếu nại</Link>}
      {role === 'owner' && item.type === 'REFUND_REQUEST' &&
        <Link className="block underline" to="/owner/workspace?tab=refund">Xem yêu cầu hoàn tiền</Link>}
      {isPlayer && item.type === 'LATE_PAYMENT_VOUCHER' &&
        <Link className="block underline" to="/my-rewards">Xem voucher bồi thường</Link>}
      {isPlayer && item.refType === 'COMPLAINT' &&
        <Link className="block underline" to={`/my-complaints?complaintId=${item.refId}`}>Mở khiếu nại</Link>}
      {isPlayer && item.refType === 'PAYMENT' &&
        <Link className="block underline" to="/my-bookings">Xem trạng thái thanh toán</Link>}
      {role === 'owner' && item.type === 'WALK_IN_AFFECTED' &&
        <Link className="block underline" to="/owner/workspace?tab=complaints">Theo dõi khiếu nại khách tại quầy</Link>}
      {item.type === 'MATCH_RESCHEDULED_HOST' && item.refId && <MatchDecision id={item.refId} />}
      {!item.read && <ActionForm label="Đánh dấu đã đọc" action={() => api.patch('/notifications/' + item.id + '/read')} after={inbox.reload} />}
    </article>)}
  </Section>
}

export default function NotificationsPage() {
  // Player và Owner xem thông báo trong trang tài khoản (cùng thanh điều hướng với hồ sơ, đổi mật khẩu).
  if (['player', 'owner'].includes(getSavedUser()?.role_code)) return <Navigate to="/account/notifications" replace />
  return <WorkspaceLayout title="Thông báo"><Inbox /></WorkspaceLayout>
}
