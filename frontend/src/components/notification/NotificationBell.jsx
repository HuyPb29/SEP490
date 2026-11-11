import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  apiErrorMessage,
  getNotifications,
  getUnreadCount,
  hasSession,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notificationApi'
import styles from './NotificationBell.module.css'

/** Nhãn + màu cho từng loại thông báo do job tự động sinh ra. */
const TYPE_META = {
  BOOKING_HOLD_EXPIRED: { label: 'Booking expired', tone: 'warn' },
  BOOKING_STARTED: { label: 'Booking started', tone: 'info' },
  BOOKING_COMPLETED: { label: 'Booking completed', tone: 'ok' },
  BOOKING_AFFECTED: { label: 'Booking affected', tone: 'warn' },
  SERVICE_TERM_EXPIRED: { label: 'Service term expired', tone: 'danger' },
  VOUCHER_EXPIRED: { label: 'Voucher expired', tone: 'warn' },
}

const PREVIEW_SIZE = 8

function relativeTime(value) {
  if (!value) return ''
  const then = new Date(String(value)).getTime()
  if (Number.isNaN(then)) return ''
  const diffMinutes = Math.round((Date.now() - then) / 60_000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const date = new Date(then)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function readRole() {
  try {
    const raw = localStorage.getItem('bms_user_info')
    const info = raw ? JSON.parse(raw) : null
    return String(info?.role_code ?? '').toUpperCase()
  } catch {
    return ''
  }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const wrapperRef = useRef(null)
  const mounted = hasSession()

  const loadUnread = useCallback(async () => {
    if (!mounted) return
    try {
      setUnread(await getUnreadCount())
    } catch {
      // Bell không được làm hỏng trang: lỗi mạng thì giữ nguyên số cũ.
    }
  }, [mounted])

  const loadPreview = useCallback(async () => {
    if (!mounted) return
    setLoading(true)
    try {
      const page = await getNotifications({ page: 0, size: PREVIEW_SIZE })
      setItems(page.content ?? [])
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [mounted])

  // Đếm lại mỗi phút để bắt kịp job tự động (job chạy 60 giây/lần).
  useEffect(() => {
    if (!mounted) return undefined
    loadUnread()
    const timer = setInterval(loadUnread, 60_000)
    return () => clearInterval(timer)
  }, [mounted, loadUnread])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!mounted) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      loadPreview()
      loadUnread()
    }
  }

  const handleItemClick = async (item) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id)
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)))
        setUnread((current) => Math.max(0, current - 1))
      } catch (err) {
        setError(apiErrorMessage(err))
      }
    }
    // Chỉ điều hướng tới màn hình đã có thật, tránh link chết.
    const role = readRole()
    if (item.refType === 'LOCATION') {
      setOpen(false)
      navigate(role === 'ADMIN' ? '/admin/facilities' : '/owner/courts-pricing')
    } else if (item.refType === 'VOUCHER' && role === 'OWNER') {
      setOpen(false)
      navigate('/owner/courts-pricing')
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setItems((current) => current.map((entry) => ({ ...entry, read: true })))
      setUnread(0)
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={styles.bellButton}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a6 6 0 0 0-6 6v3.6l-1.6 2.7A1 1 0 0 0 5.3 16h13.4a1 1 0 0 0 .9-1.7L18 11.6V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2H9.2a3 3 0 0 0 2.8 2Z"
          />
        </svg>
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHeader}>
            <strong>Notifications</strong>
            <button className={styles.markAll} type="button" onClick={handleMarkAll} disabled={unread === 0}>
              Mark all read
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {loading && <p className={styles.empty}>Loading…</p>}
          {!loading && items.length === 0 && (
            <p className={styles.empty}>No notification yet. Automated jobs will notify you here.</p>
          )}

          <ul className={styles.list}>
            {items.map((item) => {
              const meta = TYPE_META[item.type] ?? { label: item.type, tone: 'info' }
              return (
                <li key={item.id}>
                  <button
                    className={`${styles.item} ${item.read ? '' : styles.itemUnread}`}
                    type="button"
                    onClick={() => handleItemClick(item)}
                  >
                    <span className={`${styles.dot} ${styles[`tone${meta.tone}`] ?? ''}`} aria-hidden="true" />
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemContent}>{item.content}</span>
                      <span className={styles.itemMeta}>
                        {meta.label} · {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <Link className={styles.viewAll} to="/notifications" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
