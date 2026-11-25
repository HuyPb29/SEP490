import { useNavigationDrawer } from '../../hooks/useNavigationDrawer';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../common/PageHeader';
import PublicFooter from './PublicFooter';
import styles from './AppLayouts.module.css';
import { UserMenu } from './UserMenu';
import NavigationDrawer from './NavigationDrawer';

function getPublicMenuItems(roleCode) {
  if (roleCode === 'player') {
    return [
      ['/locations', 'Tìm sân'],
      ['/my-bookings', 'Lịch đặt sân của tôi'],
      ['/open-matches', 'Kèo đang mở'],
      ['/teams', 'Đội của tôi'],
      ['/my-rewards', "Ưu đãi & Điểm"],
      ['/my-complaints', 'Khiếu nại'],
    ];
  }
  if (roleCode === 'owner') return [['/owner/workspace', 'Quản lý cụm sân']];
  if (roleCode === 'staff') return [['/staff/dashboard', 'Bảng điều hành']];
  if (roleCode === 'admin') return [['/admin/workspace', 'Quản trị hệ thống']];
  return [
    ['/', 'Tìm sân'],
    ['/open-matches', 'Kèo đang mở'],
    ['/my-bookings', 'Lịch đặt sân của tôi'],
    ['/my-rewards', 'Ưu đãi'],
    ['/register-service', 'Đăng ký chủ sân'],
  ];
}

export function PublicHeader({ user: userProp }) {
  const { user: contextUser, roleHome } = useAuth();
  const location = useLocation();
  const user = userProp !== undefined ? userProp : contextUser;
  const [drawerOpen, setDrawerOpen] = useNavigationDrawer();

  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const menuItems = getPublicMenuItems(roleCode);
  const homeUrl = roleCode === 'player' ? '/locations' : roleHome?.[roleCode] || '/';
  const isAuthRoute = location.pathname.startsWith('/login');

  return (
    <header className={styles.publicHeader}>
      <div className={styles.publicHeaderInner}>
        <Link to={homeUrl} className={styles.brandLink}>
          <span className={styles.brandMark} aria-hidden="true">
            C
          </span>
          <span>Courtly</span>
        </Link>

        <nav className={styles.publicNav} aria-label="Điều hướng chính">
          {menuItems.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.publicNavLink} ${isActive ? styles.publicNavLinkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.rightControls}>
          {!isAuthRoute && <UserMenu user={user} />}
          <button
            type="button"
            className={styles.hamburgerBtn}
            aria-label="Mở menu điều hướng"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
        </div>
      </div>

      {drawerOpen && (
        <NavigationDrawer label="Menu di động" onClose={() => setDrawerOpen(false)}>
            <div className={styles.drawerTop}>
              <Link to={homeUrl} className={styles.brandLink} onClick={() => setDrawerOpen(false)}>
                <span className={styles.brandMark} aria-hidden="true">
                  C
                </span>
                <span>Courtly</span>
              </Link>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                aria-label="Đóng menu"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className={styles.drawerNav} aria-label="Điều hướng di động">
              {menuItems.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `${styles.publicNavLink} ${isActive ? styles.publicNavLinkActive : ''}`
                  }
                >
                  {label}
                </NavLink>
              ))}
              {user && (
                <NavLink
                  to="/notifications"
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `${styles.publicNavLink} ${isActive ? styles.publicNavLinkActive : ''}`
                  }
                >
                  Thông báo
                </NavLink>
              )}
            </nav>
        </NavigationDrawer>
      )}
    </header>
  );
}

export default function PublicLayout({
  title,
  subtitle,
  eyebrow,
  backTo,
  actions,
  fullWidth = false,
  hideHeader = false,
  hideFooter = false,
  className = '',
  children,
}) {
  return (
    <div className={`${styles.publicShell} cw-workspace ${className}`.trim()}>
      <a href="#public-main" className={styles.skipLink}>
        Đến nội dung chính
      </a>
      {!hideHeader && <PublicHeader />}
      <main id="public-main" className={fullWidth ? styles.publicMainFull : styles.publicMain}>
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
      {!hideFooter && <PublicFooter />}
    </div>
  );
}
