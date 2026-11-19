import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import api, { getAllPages } from '../api'
import { getSavedUser } from '../api/session'
import { cancelMatchApi, keepMatchAfterRescheduleApi } from '../api/bookingApi'
import WorkspaceLayout, { ActionForm, EmptyState, Section, StatusPill } from './WorkspaceLayout'
import { useResource } from './workspaceSupport'
import { useAuth } from '../hooks/useAuth'
import { dateTime, notificationMessage } from '../utils/formatters'
import { notificationDestination } from '../utils/notificationNavigation'

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
    <p>{match.data.bookingCode} · {match.data.playDate} · {match.data.courtName} · {notificationMessage(match.data.status)}</p>
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
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash.startsWith('#notification-')) return
    const item = document.getElementById(hash.slice(1))
    item?.scrollIntoView({ block: 'center' })
    item?.focus({ preventScroll: true })
  }, [hash, items])
  const openNotification = (item) => {
    const locationId = item.locationId || (item.refType === 'LOCATION' ? item.refId : null)
    if (locationId && ['owner', 'staff'].includes(role)) setSelectedVenue(locationId)
    if (!item.read) api.patch('/notifications/' + item.id + '/read').then(inbox.reload).catch(() => {})
  }
  return <Section title={count ? title + ' · ' + (count.unread ?? 0) + ' chưa đọc' : title} resource={inbox}>
    {items?.some((item) => !item.read) && <ActionForm label="Đánh dấu đã đọc tất cả"
      action={() => api.patch('/notifications/read-all')} after={inbox.reload} />}
    <div className="cw-tabs" role="group" aria-label="Lọc thông báo">
      <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Tất cả</button>
      <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Chưa đọc</button>
    </div>
    {visible?.length === 0 && <EmptyState>{unreadOnly ? 'Bạn đã đọc hết thông báo.' : 'Bạn chưa có thông báo.'}</EmptyState>}
    {visible?.map((item) => <article key={item.id} id={`notification-${item.id}`} tabIndex={-1} className={'cw-record flex-col !items-start' + (item.read ? '' : ' cw-notification--new')}>
      <Link className="block w-full rounded hover:bg-emerald-50 focus-visible:outline focus-visible:outline-emerald-700"
        to={notificationDestination(item, role)} onClick={() => openNotification(item)}>
      <h3 className="font-semibold">{notificationMessage(item.title) || 'Thông báo'} {!item.read && <StatusPill tone="positive">Chưa đọc</StatusPill>}</h3>
      <p>{notificationMessage(item.content)}</p>
      <time dateTime={item.createdAt} className="cw-muted text-sm">{dateTime(item.createdAt)}</time>
      </Link>
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
