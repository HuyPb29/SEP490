import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './WorkspaceNav.module.css'

/**
 * Menu điều hướng theo vai trò.
 *
 * Trang chủ ("/") là màn hình tìm sân của Player và không có link nào tới các màn
 * hình quản lý, nên sau khi đăng nhập Owner/Admin/Staff không có đường vào nghiệp vụ
 * của mình. Component này bổ sung lối vào đó mà không phải sửa header của trang chủ
 * (file của thành viên khác).
 *
 * Chỉ hiện khi đã đăng nhập. Tự ẩn khi chưa có token.
 */

const SCREENS = {
  admin: [
    { to: '/admin/facilities', label: 'Facilities & Registration', uc: 'UC05 · UC06' },
    { to: '/notifications', label: 'Notifications', uc: 'UC37' },
  ],
  owner: [
    { to: '/owner/courts-pricing', label: 'Courts & Pricing', uc: 'UC07 · UC09' },
    { to: '/owner/opening-hours', label: 'Opening Hours', uc: 'UC08' },
    { to: '/owner/facility-settings', label: 'Facility Settings', uc: 'UC07' },
    { to: '/maintenance', label: 'Maintenance Approval', uc: 'UC10' },
    { to: '/owner/reports', label: 'Reports', uc: 'UC35' },
    { to: '/notifications', label: 'Notifications', uc: 'UC37' },
  ],
  staff: [
    { to: '/maintenance', label: 'Maintenance Requests', uc: 'UC10' },
    { to: '/notifications', label: 'Notifications', uc: 'UC37' },
  ],
  player: [
    { to: '/', label: 'Find Court', uc: 'UC11' },
    { to: '/my-bookings', label: 'My Bookings', uc: 'UC17' },
    { to: '/notifications', label: 'Notifications', uc: 'UC37' },
  ],
}

const ROLE_LABEL = {
  admin: 'Administrator',
  owner: 'Facility Owner',
  staff: 'Facility Staff',
  player: 'Player',
}

/** Đọc role từ localStorage; chịu được cả hai kiểu key mà app đang ghi. */
function readSession() {
  let role = null
  let name = ''
  try {
    const raw = localStorage.getItem('bms_user_info')
    if (raw) {
      const info = JSON.parse(raw)
      role = info?.role_code ? String(info.role_code).toLowerCase() : null
      name = info?.full_name || info?.username || ''
    }
  } catch {
    role = null
  }
  if (!role) {
    try {
      const raw = localStorage.getItem('user')
      if (raw) {
        const user = JSON.parse(raw)
        role = user?.role ? String(user.role).toLowerCase() : null
        name = name || user?.fullName || user?.username || ''
      }
    } catch {
      role = null
    }
  }
  const hasToken = Boolean(
    localStorage.getItem('token') || localStorage.getItem('bms_access_token'),
  )
  return { role, name, signedIn: hasToken && Boolean(role) }
}

export default function WorkspaceNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(readSession)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const sync = () => setSession(readSession())
    sync()
    window.addEventListener('bms-auth-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('bms-auth-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Đổi route thì đóng menu cho gọn.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const handleLogout = useCallback(() => {
    ;['token', 'bms_access_token', 'bms_user_info', 'bms_selected_location_id', 'user'].forEach(
      (key) => localStorage.removeItem(key),
    )
    setOpen(false)
    // Reload cứng để xoá sạch state trong bộ nhớ của các trang.
    window.location.href = '/login'
  }, [])

  if (!session.signedIn) return null

  const screens = SCREENS[session.role] || []
  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHead}>
            <span className={styles.roleBadge}>{ROLE_LABEL[session.role] || session.role}</span>
            {session.name && <span className={styles.userName}>{session.name}</span>}
          </div>

          <div className={styles.list}>
            {screens.map((screen) => (
              <button
                type="button"
                key={screen.to}
                role="menuitem"
                className={`${styles.item} ${isActive(screen.to) ? styles.itemActive : ''}`}
                onClick={() => navigate(screen.to)}
              >
                <span className={styles.itemLabel}>{screen.label}</span>
                <span className={styles.itemUc}>{screen.uc}</span>
              </button>
            ))}
          </div>

          <button type="button" className={styles.logout} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-expanded={open}
        aria-label="Open management menu"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2 4h12M2 8h12M2 12h12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>Workspace</span>
      </button>
    </div>
  )
}
