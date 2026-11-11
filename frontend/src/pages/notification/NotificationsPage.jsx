import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiErrorMessage,
  getNotifications,
  getUnreadCount,
  hasSession,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notificationApi'
import styles from './NotificationsPage.module.css'

const PAGE_SIZE = 20

const TYPE_META = {
  BOOKING_HOLD_EXPIRED: { label: 'Booking expired', tone: 'warn' },
  BOOKING_STARTED: { label: 'Booking started', tone: 'info' },
  BOOKING_COMPLETED: { label: 'Booking completed', tone: 'ok' },
  BOOKING_AFFECTED: { label: 'Booking affected', tone: 'warn' },
  SERVICE_TERM_EXPIRED: { label: 'Service term expired', tone: 'danger' },
  VOUCHER_EXPIRED: { label: 'Voucher expired', tone: 'warn' },
}

function formatDateTime(value) {
  if (!value) return '—'
  const [datePart, timePart = ''] = String(value).split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`
}

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [isLast, setIsLast] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loggedIn = hasSession()

  const load = useCallback(async (nextPage, append) => {
    if (!loggedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getNotifications({ unreadOnly, page: nextPage, size: PAGE_SIZE })
      const content = result.content ?? []
      setItems((current) => (append ? [...current, ...content] : content))
      setTotalElements(result.totalElements ?? content.length)
      // Backend PageResponse dùng field `isLast` -> Jackson serialize thành `last`.
      setIsLast(result.last ?? result.isLast ?? true)
      setPage(nextPage)
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [loggedIn, unreadOnly])

  useEffect(() => {
    load(0, false)
    if (loggedIn) {
      getUnreadCount().then(setUnread).catch(() => {})
    }
  }, [load, loggedIn])

  const handleMarkRead = async (item) => {
    if (item.read) return
    try {
      await markNotificationRead(item.id)
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)))
      setUnread((current) => Math.max(0, current - 1))
      if (unreadOnly) {
        setItems((current) => current.filter((entry) => entry.id !== item.id))
        setTotalElements((current) => Math.max(0, current - 1))
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setUnread(0)
      if (unreadOnly) {
        setItems([])
        setTotalElements(0)
      } else {
        setItems((current) => current.map((entry) => ({ ...entry, read: true })))
      }
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Notifications</h1>
            <p className={styles.subtitle}>
              Automated jobs (expired holds, finished bookings, expired service terms, expired vouchers) write here.
            </p>
          </div>
          <Link className={styles.backLink} to="/">← Back to home</Link>
        </div>

        {!loggedIn && (
          <p className={styles.notice}>Sign in to see your notifications.</p>
        )}

        {loggedIn && (
          <section className={styles.panel}>
            <div className={styles.toolbar}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                <span>Unread only</span>
              </label>
              <span className={styles.counter}>
                {totalElements} notification{totalElements === 1 ? '' : 's'}
                {unread > 0 ? ` · ${unread} unread` : ''}
              </span>
              <button className={styles.markAll} type="button" onClick={handleMarkAll} disabled={unread === 0}>
                Mark all read
              </button>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <ul className={styles.list}>
              {items.map((item) => {
                const meta = TYPE_META[item.type] ?? { label: item.type, tone: 'info' }
                return (
                  <li className={`${styles.item} ${item.read ? '' : styles.itemUnread}`} key={item.id}>
                    <span className={`${styles.dot} ${styles[`tone${meta.tone}`] ?? ''}`} aria-hidden="true" />
                    <div className={styles.body}>
                      <div className={styles.head}>
                        <strong>{item.title}</strong>
                        <span className={styles.time}>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p className={styles.content}>{item.content}</p>
                      <div className={styles.foot}>
                        <span className={styles.typeTag}>{meta.label}</span>
                        {item.refType && (
                          <span className={styles.refTag}>{item.refType} #{item.refId ?? '—'}</span>
                        )}
                        {!item.read && (
                          <button className={styles.readButton} type="button" onClick={() => handleMarkRead(item)}>
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {loading && <p className={styles.empty}>Loading…</p>}
            {!loading && items.length === 0 && (
              <p className={styles.empty}>
                {unreadOnly ? 'No unread notification.' : 'No notification yet.'}
              </p>
            )}

            {!isLast && (
              <button className={styles.loadMore} type="button" onClick={() => load(page + 1, true)} disabled={loading}>
                Load more
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
