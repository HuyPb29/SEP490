import { NavLink } from 'react-router-dom'
import styles from './AdminFacilitiesPage.module.css'

const NAV_ITEMS = [
  { label: 'Facilities', to: '/admin/facilities' },
  { label: 'Accounts', to: '/admin/accounts' },
  { label: 'Violating Vouchers', to: '/admin/violating-vouchers' },
  { label: 'Violating Reviews', to: '/admin/violating-reviews' },
]

export default function AdminPortalSidebar({ pendingRequestCount = 3 }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandBolt} aria-hidden="true">⚡</span>
        <span>Courtly</span>
      </div>

      <div className={styles.roleCard}>
        <span>System Administration</span>
        <strong>Admin</strong>
      </div>

      <nav className={styles.navigation} aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            to={item.to}
            key={item.to}
          >
            <span>{item.label}</span>
            {item.to === '/admin/facilities' && (
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