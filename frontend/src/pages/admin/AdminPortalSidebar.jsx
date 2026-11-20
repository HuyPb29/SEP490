import { NavLink } from 'react-router-dom'
import styles from './AdminLocationsPage.module.css'

const NAV_ITEMS = [
  { label: "Địa điểm", to: '/admin/locations' },
  { label: "Tài khoản", to: '/admin/accounts' },
  { label: "Đánh giá vi phạm", to: '/admin/violating-reviews' },
]

export default function AdminPortalSidebar({ pendingRequestCount = 3 }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandBolt} aria-hidden="true">⚡</span>
        <span>Courtly</span>
      </div>

      <div className={styles.roleCard}>
        <span>Quản trị hệ thống</span>
        <strong>Quản trị viên</strong>
      </div>

      <nav className={styles.navigation} aria-label="Điều hướng quản trị viên">
        {NAV_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            to={item.to}
            key={item.to}
          >
            <span>{item.label}</span>
            {item.to === '/admin/locations' && (
              <span className={styles.pendingBadge} aria-label={`${pendingRequestCount} pending requests`}>
                {pendingRequestCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
