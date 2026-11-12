import { useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocationContext } from '../../hooks/useLocation';
import { PageHeader } from '../common/PageHeader';
import styles from './AppLayouts.module.css';
import { UserMenu } from './UserMenu';

export default function ManagementLayout({
  role: requiredRole,
  title,
  subtitle,
  eyebrow,
  backTo,
  actions,
  locations: propLocations,
  locationId: propLocationId,
  locationName: propLocationName,
  onLocationChange,
  onOpenCounterBooking,
  onOpenReconciliation,
  badges = {},
  children,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roleHome } = useAuth();
  const {
    locations: ctxLocations,
    locationId: ctxLocationId,
    currentLocation,
    setLocationId,
  } = useLocationContext();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  const userRole = String(user.role_code || user.role || '').toLowerCase();
  if (requiredRole && userRole !== requiredRole && !(requiredRole === 'staff' && userRole === 'owner')) {
    return <Navigate to={roleHome?.[userRole] ?? '/'} replace />;
  }

  const locations = propLocations !== undefined ? propLocations : ctxLocations;
  const activeLocationId =
    propLocationId !== undefined && propLocationId !== null
      ? String(propLocationId)
      : String(ctxLocationId || '');
  const activeLocationObj =
    locations?.find((item) => String(item.id) === activeLocationId) || currentLocation;
  const displayLocationName =
    propLocationName || activeLocationObj?.name || user.full_name || 'Cụm sân đang chọn';

  const handleSelectLocation = (event) => {
    const nextId = event.target.value;
    setLocationId(nextId);
    onLocationChange?.(nextId);
  };

  const staffMenu = [
    { to: '/staff/dashboard', label: 'Bảng điều hành', end: true },
    {
      to: activeLocationId ? `/facilities/${activeLocationId}` : '/',
      label: 'Lịch sân (UC13)',
    },
    {
      label: 'Đặt sân tại quầy (UC16)',
      onClick: () => {
        if (onOpenCounterBooking) onOpenCounterBooking();
        else navigate('/staff/dashboard?modal=counter');
      },
    },
    {
      to: '/staff/confirm-payments',
      label: 'Xác nhận thanh toán (UC19)',
      badge: badges.payments,
    },
    {
      label: 'Đối soát cuối ngày (UC20)',
      onClick: () => {
        if (onOpenReconciliation) onOpenReconciliation();
        else navigate('/staff/dashboard?modal=reconciliation');
      },
    },
    { to: '/maintenance', label: 'Yêu cầu bảo trì (UC10)' },
    {
      to: '/staff/complaints',
      label: 'Khiếu nại của khách (UC33)',
      badge: badges.complaints,
    },
  ];

  const ownerMenu = [
    { to: '/owner/workspace', label: 'Tổng quan & Vận hành', end: true },
    { to: '/owner/courts-pricing', label: 'Sân & Bảng giá (UC07–09)' },
    { to: '/owner/opening-hours', label: 'Giờ mở cửa & Slot (UC08)' },
    { to: '/owner/facility-settings', label: 'Hồ sơ địa điểm (UC07)' },
    { to: '/staff/confirm-payments', label: 'Xác nhận thanh toán (UC19)' },
    { to: '/owner/reconciliations', label: 'Đối soát doanh thu (UC20)' },
    { to: '/owner/reports', label: 'Báo cáo & Xuất dữ liệu (UC35)' },
    { to: '/maintenance', label: 'Quản lý bảo trì (UC10)' },
  ];

  const menuItems = userRole === 'owner' ? ownerMenu : staffMenu;
  const homeUrl = userRole === 'owner' ? '/owner/workspace' : '/staff/dashboard';
  const roleTitle = userRole === 'owner' ? 'Chủ cụm sân' : 'Nhân viên tại';

  const renderMenuList = (closeDrawer = false) =>
    menuItems.map((item) => {
      if (item.onClick) {
        return (
          <button
            key={item.label}
            type="button"
            className={styles.sidebarLink}
            onClick={() => {
              if (closeDrawer) setDrawerOpen(false);
              item.onClick();
            }}
          >
            <span>{item.label}</span>
          </button>
        );
      }
      return (
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
          {Number(item.badge) > 0 && (
            <span
              style={{
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 999,
                background: '#f59e0b',
                color: '#172033',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.badge}
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <div className={`${styles.managementShell} cw-workspace`}>
      <a href="#management-main" className={styles.skipLink}>
        Đến nội dung chính
      </a>

      <aside className={styles.sidebar} aria-label="Điều hướng quản lý">
        <div className={styles.sidebarHeader}>
          <Link to={homeUrl} className={`${styles.brandLink} ${styles.brandLinkDark}`}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            <span>Courtly</span>
          </Link>
        </div>

        <div className={styles.roleBadgeCard}>
          <span>{roleTitle}</span>
          <strong>{displayLocationName}</strong>
        </div>

        <nav className={styles.sidebarNav} aria-label="Menu vai trò">
          {renderMenuList(false)}
        </nav>
      </aside>

      <div className={styles.managementBody}>
        <header className={styles.managementTopbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.hamburgerBtn}
              aria-label="Mở menu điều hướng"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              ☰
            </button>

            <div className={styles.locationSelectorWrap}>
              <span className={styles.locationLabel}>Địa điểm:</span>
              {locations && locations.length > 0 ? (
                <select
                  aria-label="Chọn địa điểm làm việc"
                  className={styles.locationSelect}
                  value={activeLocationId}
                  onChange={handleSelectLocation}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.status === 'LOCKED' ? ' (Đã khóa)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.locationStaticPill} title={displayLocationName}>
                  📍 {displayLocationName}
                </span>
              )}
            </div>
          </div>

          <UserMenu user={user} />
        </header>

        <main id="management-main" className={styles.managementMain}>
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
        <div
          className={`${styles.drawerBackdrop} ${styles.drawerBackdropLeft}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside className={`${styles.drawerPanel} ${styles.drawerPanelDark}`} aria-label="Menu quản lý di động">
            <div className={styles.drawerTop}>
              <Link
                to={homeUrl}
                className={`${styles.brandLink} ${styles.brandLinkDark}`}
                onClick={() => setDrawerOpen(false)}
              >
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

            <div className={styles.roleBadgeCard}>
              <span>{roleTitle}</span>
              <strong>{displayLocationName}</strong>
            </div>

            <nav className={styles.drawerNav} aria-label="Menu vai trò di động">
              {renderMenuList(true)}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
