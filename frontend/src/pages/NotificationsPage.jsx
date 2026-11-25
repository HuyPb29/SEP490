import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import api, { apiErrorMessage, getAllPages } from '../api'
import { getSavedUser } from '../api/session'
import { cancelMatchApi, keepMatchAfterRescheduleApi } from '../api/bookingApi'
import WorkspaceLayout from '../components/layout/WorkspaceLayout'
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, StatusBadge, Tabs, Toast } from '../components/common'
import { STATUS_CATALOG } from '../components/common/statusCatalog'
import { useResource } from './workspaceSupport'
import { useAuth } from '../hooks/useAuth'
import { dateTime, notificationMessage, shortDate } from '../utils/formatters'
import { notificationDestination } from '../utils/notificationNavigation'
import styles from './notification/NotificationsPage.module.css'

const loadNotifications = (signal) => Promise.all([
  getAllPages('/notifications', { signal }),
  api.get('/notifications/unread-count', { signal }).then((response) => response.data.data),
])

function MatchDecision({ id }) {
  const load = useCallback((signal) => api.get('/matches/' + id, { signal }).then((response) => response.data.data), [id])
  const match = useResource(load, id)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState('')
  const lock = useRef(false)
  const [message, setMessage] = useState(null)
  async function decide(kind) {
    if (lock.current) return
    lock.current = true
    setBusy(kind)
    setMessage(null)
    try {
      if (kind === 'keep') await keepMatchAfterRescheduleApi(id)
      else await cancelMatchApi(id)
      setConfirm(false)
      setMessage({ text: kind === 'keep' ? 'Đã giữ kèo ở giờ mới.' : 'Đã hủy kèo.' })
      match.reload()
    } catch (error) {
      setMessage({ error: true, text: apiErrorMessage(error) })
    } finally {
      lock.current = false
      setBusy('')
    }
  }
  return <div className={styles.matchDecision}>
    {message && (!confirm || !message.error) && <Toast tone={message.error ? 'danger' : 'success'}>{message.text}</Toast>}
    {match.loading ? <LoadingState message="Đang tải kèo…" /> : match.error ? <ErrorState message={match.error} onRetry={match.reload} /> : !match.data ?
      <EmptyState title="Chưa có thông tin kèo" description="Thử tải lại để xem thông tin mới nhất." action={<Button variant="secondary" onClick={match.reload}>Tải lại kèo</Button>} /> : <>
        <div className={styles.matchMeta}><strong>{match.data.bookingCode}</strong><span>{shortDate(match.data.playDate)} · {match.data.courtName}</span><StatusBadge status={match.data.status} category="match" /></div>
        {match.data.host && match.data.reschedulePending && <div className={styles.decisionActions}>
          <Button variant="secondary" loading={busy === 'keep'} disabled={!!busy} onClick={() => decide('keep')}>Giữ kèo ở giờ mới</Button>
          <Button variant="danger" disabled={!!busy} onClick={() => { setMessage(null); setConfirm(true) }}>Hủy kèo</Button>
        </div>}
      </>}
    {confirm && <ConfirmDialog title="Hủy kèo sau khi đổi lịch?" tone="danger" confirmText="Hủy kèo" busy={!!busy} onCancel={() => setConfirm(false)} onConfirm={() => decide('cancel')}>
      <p>Kèo sẽ bị hủy và không tiếp tục ở giờ mới. Các yêu cầu tham gia đang chờ cũng sẽ bị hủy; người chơi sẽ được thông báo.</p>
      {message?.error && <Toast tone="danger">{message.text}</Toast>}
    </ConfirmDialog>}
  </div>
}

export function Inbox({ title = 'Hộp thư' }) {
  const inbox = useResource(loadNotifications)
  const { setSelectedVenue } = useAuth()
  const [items, count] = inbox.data ?? []
  const [unreadOnly, setUnreadOnly] = useState(false)
  const visible = items?.filter((item) => !unreadOnly || !item.read)
  const [busy, setBusy] = useState([])
  const pending = useRef(new Set())
  const [message, setMessage] = useState(null)
  const role = getSavedUser()?.role_code
  const container = useRef(null)
  const { hash } = useLocation()
  useEffect(() => {
    if (message && !message.error && !inbox.loading) container.current?.focus({ preventScroll: true })
  }, [message, inbox.loading])
  useEffect(() => {
    if (!hash.startsWith('#notification-')) return
    const item = document.getElementById(hash.slice(1))
    item?.scrollIntoView({ block: 'center' })
    item?.focus({ preventScroll: true })
  }, [hash, items])

  async function markRead(id = null, announce = true) {
    const key = id ?? 'all'
    if (pending.current.has(key)) return
    pending.current.add(key)
    setBusy(current => [...current, key])
    setMessage(null)
    try {
      await api.patch(id == null ? '/notifications/read-all' : '/notifications/' + id + '/read')
      if (announce) setMessage({ text: id == null ? 'Đã đánh dấu tất cả thông báo là đã đọc.' : 'Đã đánh dấu thông báo là đã đọc.' })
      inbox.reload()
    } catch (error) {
      setMessage({ error: true, text: apiErrorMessage(error) })
    } finally {
      pending.current.delete(key)
      setBusy(current => current.filter(value => value !== key))
    }
  }
  const openNotification = (item) => {
    const locationId = item.locationId || (item.refType === 'LOCATION' ? item.refId : null)
    if (locationId && ['owner', 'staff'].includes(role)) setSelectedVenue(locationId)
    if (!item.read) markRead(item.id, false)
  }
  const list = inbox.loading ? <LoadingState message="Đang tải thông báo…" /> : inbox.error ? <ErrorState message={inbox.error} onRetry={inbox.reload} /> :
    visible?.length ? <div className={styles.list}>{visible.map((item) => {
      const meta = STATUS_CATALOG.notification[item.type]
      return <article key={item.id} id={`notification-${item.id}`} tabIndex={-1} aria-label={notificationMessage(item.title) || 'Thông báo'}
        className={styles.item} data-unread={!item.read || undefined} data-attention={meta?.attention || undefined} data-tone={meta?.tone}>
        <div className={styles.itemMain}><span className={styles.itemIcon} aria-hidden="true">{meta?.attention ? '!' : '↗'}</span>
          <Link className={styles.notificationLink} to={notificationDestination(item, role)} onClick={() => openNotification(item)}>
            <div className={styles.itemTags}><StatusBadge status={item.read ? 'READ' : 'UNREAD'} category="notification" />
              {meta && <StatusBadge status={item.type} category="notification">{meta.tag || meta.label}</StatusBadge>}</div>
            <h3>{notificationMessage(item.title) || 'Thông báo'}</h3>
            <p>{notificationMessage(item.content)}</p><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
          </Link>
        </div>
        {item.type === 'MATCH_RESCHEDULED_HOST' && item.refId && <MatchDecision id={item.refId} />}
        {!item.read && <div className={styles.itemActions}><Button variant="ghost" size="sm" loading={busy.includes(item.id)} disabled={busy.length > 0}
          onClick={() => markRead(item.id)}>Đánh dấu đã đọc</Button></div>}
      </article>
    })}</div> : <EmptyState title={unreadOnly ? 'Bạn đã đọc hết thông báo' : 'Bạn chưa có thông báo'}
      description={unreadOnly ? 'Thông báo mới sẽ xuất hiện tại đây. Bạn có thể xem lại các thông báo đã đọc ở mục Tất cả.' : 'Thông tin về lịch đặt sân và hoạt động tài khoản sẽ xuất hiện tại đây.'}
      action={unreadOnly ? <Button variant="secondary" onClick={() => setUnreadOnly(false)}>Xem tất cả thông báo</Button> : <Button variant="secondary" onClick={inbox.reload}>Làm mới thông báo</Button>} />
  return <section ref={container} tabIndex={-1} className={styles.inbox} aria-label={title}>
    <header className={styles.header}><div><h2>{title}</h2><p>Theo dõi lịch đặt sân và các hoạt động mới nhất.</p></div>
      {!inbox.loading && !inbox.error && <span className={styles.unreadCount}>{count?.unread ?? 0} chưa đọc</span>}</header>
    {message && <Toast tone={message.error ? 'danger' : 'success'}>{message.text}</Toast>}
    <div className={styles.toolbar}><Button variant="secondary" size="sm" loading={busy.includes('all')} disabled={inbox.loading || !!inbox.error || !items?.some(item => !item.read) || busy.length > 0}
      onClick={() => markRead()}>Đánh dấu tất cả đã đọc</Button></div>
    <Tabs className={styles.filters} label="Lọc thông báo" value={unreadOnly ? 'unread' : 'all'} onChange={value => setUnreadOnly(value === 'unread')} items={[
      { value: 'all', label: 'Tất cả', content: !unreadOnly ? list : null },
      { value: 'unread', label: 'Chưa đọc', content: unreadOnly ? list : null },
    ]} />
  </section>
}

export default function NotificationsPage() {
  if (['player', 'owner'].includes(getSavedUser()?.role_code)) return <Navigate to="/account/notifications" replace />
  return <WorkspaceLayout title="Thông báo"><Inbox /></WorkspaceLayout>
}
