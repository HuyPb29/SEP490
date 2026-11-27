import { Button as UiButton } from '../ui';
import { useNavigationDrawer } from '../../hooks/useNavigationDrawer';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../common/PageHeader';
import styles from './AppLayouts.module.css';
import { UserMenu } from './UserMenu';
import NavigationDrawer from './NavigationDrawer';

const ADMIN_MENU = [
  { to: '/admin/workspace', label: 'Quản lý tài khoản', end: true },
  { to: '/admin/facilities', label: 'Quản lý địa điểm' },
  { to: '/admin/reviews', label: 'Kiểm duyệt đánh giá' },
];

export default function AdminLayout({
  title,
  subtitle,
  eyebrow,
  backTo,
  actions,
  fitViewport = false,
  children,
}) {
  const location = useLocation();
  const { user, roleHome } = useAuth();
  const [drawerOpen, setDrawerOpen] = useNavigationDrawer();

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  const userRole = String(user.role_code || user.role || '').toLowerCase();
  if (userRole !== 'admin') {
    return <Navigate to={roleHome?.[userRole] ?? '/'} replace />;
  }

  const displayName = user.full_name || user.fullName || user.username || 'Quản trị viên';

  const renderNavLinks = (closeDrawer = false) =>
    ADMIN_MENU.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={() => {
          if (closeDrawer) setDrawerOpen(false);
        }}
        className={({ isActive }) =>
          `${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ''}`
        }
      >
        <span>{item.label}</span>
      </NavLink>
    ));

  return (
    <div data-admin-layout className={`${styles.managementShell} cw-workspace custom-scrollbar ${fitViewport ? styles.adminFitShell : ''}`}>
      <a href="#admin-main" className={styles.skipLink}>
        Đến nội dung chính
      </a>

      <aside className={styles.sidebar} aria-label="Điều hướng quản trị hệ thống">
        <div className={styles.sidebarHeader}>
          <Link to="/admin/workspace" className={`${styles.brandLink} ${styles.brandLinkDark}`}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            <span>Courtly</span>
          </Link>
        </div>

        <div className={styles.roleBadgeCard}>
          <span>Quản trị hệ thống</span>
          <strong>{displayName}</strong>
        </div>

        <nav className={styles.sidebarNav} aria-label="Menu quản trị">
          <p className={styles.navGroup}>Quản trị hệ thống</p>
          {renderNavLinks(false)}
        </nav>
      </aside>

      <div className={styles.managementBody}>
        <header className={styles.managementTopbar}>
          <div className={styles.topbarLeft}>
            <UiButton variant="custom"
              type="button"
              className={styles.hamburgerBtn}
              aria-label="Mở menu điều hướng"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              ☰
            </UiButton>
            <span className={styles.locationStaticPill}>🛡️ Cổng Quản Trị Hệ Thống</span>
          </div>

          <UserMenu user={user} />
        </header>

        <main id="admin-main" className={`${styles.managementMain} ${fitViewport ? styles.adminFitMain : ''}`}>
          {(title || backTo || actions) && (
            <PageHeader
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
              backTo={backTo}
              actions={actions}
            />
          )}
          {children}
        </main>
      </div>

      {drawerOpen && (
        <NavigationDrawer label="Menu quản trị di động" left onClose={() => setDrawerOpen(false)}>
            <div className={styles.drawerTop}>
              <Link
                to="/admin/workspace"
                className={`${styles.brandLink} ${styles.brandLinkDark}`}
                onClick={() => setDrawerOpen(false)}
              >
                <span className={styles.brandMark} aria-hidden="true">
                  C
                </span>
                <span>Courtly</span>
              </Link>
              <UiButton variant="custom"
                type="button"
                className={styles.drawerCloseBtn}
                aria-label="Đóng menu"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </UiButton>
            </div>

            <div className={styles.roleBadgeCard}>
              <span>Quản trị hệ thống</span>
              <strong>{displayName}</strong>
            </div>

            <nav className={styles.drawerNav} aria-label="Menu quản trị di động">
              <p className={styles.navGroup}>Quản trị hệ thống</p>
              {renderNavLinks(true)}
            </nav>
        </NavigationDrawer>
      )}
    </div>
  );
}
