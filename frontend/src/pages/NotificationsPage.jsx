import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import api, { getAllPages } from '../api'
import { getSavedUser } from '../api/session'
import { cancelMatchApi, keepMatchAfterRescheduleApi } from '../api/bookingApi'
import WorkspaceLayout, { ActionForm, Section } from './WorkspaceLayout'
import { useResource } from './workspaceSupport'

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

function Inbox() {
  const inbox = useResource(loadNotifications)
  const [items, count] = inbox.data ?? []
  const role = getSavedUser()?.role_code
  const isPlayer = role === 'player'
  return <Section title={count ? 'Hộp thư · ' + (count.unread ?? 0) + ' chưa đọc' : 'Hộp thư'} resource={inbox}>
    {items?.some((item) => !item.read) && <ActionForm label="Đánh dấu đã đọc tất cả"
      action={() => api.patch('/notifications/read-all')} after={inbox.reload} />}
    {items?.length === 0 && <p>Bạn chưa có thông báo.</p>}
    {items?.map((item) => <article key={item.id} className="space-y-2 border-t pt-3">
      <h3 className="font-semibold">{item.title || item.type}</h3>
      <p>{item.content}</p>
      <time className="text-sm text-slate-600">{item.createdAt}</time>
      {isPlayer && item.refType === 'BOOKING' && <Link className="block underline" to="/my-bookings">Mở lịch đặt sân</Link>}
      {isPlayer && item.refType === 'COMPLAINT' &&
        <Link className="block underline" to="/my-complaints">Mở khiếu nại</Link>}
      {role === 'owner' && item.type === 'WALK_IN_AFFECTED' &&
        <Link className="block underline" to="/owner/workspace?tab=complaints">Theo dõi khiếu nại khách tại quầy</Link>}
      {item.type === 'MATCH_RESCHEDULED_HOST' && item.refId && <MatchDecision id={item.refId} />}
      {!item.read && <ActionForm label="Đánh dấu đã đọc" action={() => api.patch('/notifications/' + item.id + '/read')} after={inbox.reload} />}
    </article>)}
  </Section>
}

export default function NotificationsPage() {
  return <WorkspaceLayout title="Thông báo"><Inbox /></WorkspaceLayout>
}
