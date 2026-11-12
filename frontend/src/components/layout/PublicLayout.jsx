import { useNavigationDrawer } from '../../hooks/useNavigationDrawer';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../common/PageHeader';
import styles from './AppLayouts.module.css';
import { UserMenu } from './UserMenu';

function getPublicMenuItems(roleCode) {
  if (roleCode === 'player') {
    return [
      ['/', 'Tìm địa điểm'],
      ['/my-bookings', 'Booking của tôi'],
      ['/my-reschedules', 'Lịch sử đổi lịch'],
      ['/open-matches', 'Kèo'],
      ['/teams', 'Đội của tôi'],
      ['/my-rewards', 'Voucher & Điểm'],
      ['/my-complaints', 'Khiếu nại'],
      ['/account', 'Tài khoản'],
    ];
  }
  if (roleCode === 'staff') {
    return [
      ['/', 'Tìm địa điểm'],
      ['/open-matches', 'Kèo mở'],
      ['/staff/dashboard', 'Bảng điều hành'],
    ];
  }
  if (roleCode === 'owner') {
    return [
      ['/', 'Tìm địa điểm'],
      ['/open-matches', 'Kèo mở'],
      ['/owner/workspace', 'Quản lý cụm sân'],
    ];
  }
  if (roleCode === 'admin') {
    return [
      ['/', 'Tìm địa điểm'],
      ['/open-matches', 'Kèo mở'],
      ['/admin/workspace', 'Quản trị hệ thống'],
    ];
  }
  return [
    ['/', 'Tìm địa điểm'],
    ['/open-matches', 'Kèo mở'],
  ];
}

export function PublicHeader({ user: userProp }) {
  const { user: contextUser, roleHome } = useAuth();
  const location = useLocation();
  const user = userProp !== undefined ? userProp : contextUser;
  const [drawerOpen, setDrawerOpen] = useNavigationDrawer();

  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const menuItems = getPublicMenuItems(roleCode);
  const homeUrl = user ? roleHome?.[roleCode] || '/' : '/';
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
        <div
          className={styles.drawerBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside className={styles.drawerPanel} aria-label="Menu di động">
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
          </aside>
        </div>
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
  className = '',
  children,
}) {
  return (
    <div className={`${styles.publicShell} cw-workspace ${className}`.trim()}>
      <a href="#public-main" className={styles.skipLink}>
        Đến nội dung chính
      </a>
      <PublicHeader />
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
    </div>
  );
}
