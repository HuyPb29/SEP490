import { Button as UiButton } from '../ui';
import { useNavigationDrawer } from '../../hooks/useNavigationDrawer';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocationContext } from '../../hooks/useLocation';
import { PageHeader } from '../common/PageHeader';
import styles from './AppLayouts.module.css';
import { UserMenu } from './UserMenu';
import NavigationDrawer from './NavigationDrawer';
import LocationSwitcher from './LocationSwitcher';
import { useManagementInboxCounts } from '../../hooks/useManagementInbox';
import { ManagementInboxContext } from '../../contexts/managementInbox';

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
  badges = {},
  children,
}) {
  const location = useLocation();
  const { user, roleHome } = useAuth();
  const {
    locations: ctxLocations,
    locationId: ctxLocationId,
    currentLocation,
    setLocationId,
  } = useLocationContext();
  const [drawerOpen, setDrawerOpen] = useNavigationDrawer();
  const inbox = useManagementInboxCounts(String(user?.role_code || user?.role || '').toLowerCase(),
    propLocationId || ctxLocationId || user?.facility_id || user?.locationId, user?.user_id ?? user?.id);
  const liveBadges = { ...badges, ...inbox };

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

  // Đặt sân tại quầy (UC16) và đối soát cuối ngày (UC20) mở từ nút trên bảng điều hành.
  const staffMenu = [
    { to: '/staff/dashboard', label: 'Bảng điều hành', end: true },
    { to: '/staff/schedule', label: 'Lịch sân' },
    {
      to: '/staff/confirm-payments',
      label: 'Xác nhận thanh toán',
      badge: liveBadges.payments,
      urgent: liveBadges.urgentPayments,
    },
    { to: '/maintenance', label: 'Yêu cầu bảo trì' },
    {
      to: '/staff/complaints',
      label: 'Khiếu nại của khách',
      badge: liveBadges.complaints,
    },
  ];

  const ownerMenu = [
    { to: '/owner/workspace', label: 'Tổng quan & Vận hành', end: true, badge: (liveBadges.complaints || 0) + (liveBadges.refund || 0) },
    { to: '/owner/courts-pricing', label: 'Sân & Bảng giá' },
    { to: '/owner/opening-hours', label: "Giờ mở cửa & khung giờ" },
    { to: '/owner/facility-settings', label: 'Hồ sơ địa điểm' },
    { to: '/owner/workspace?tab=reviews', label: 'Đánh giá' },
    { to: '/staff/confirm-payments', label: 'Xác nhận thanh toán', badge: liveBadges.payments, urgent: liveBadges.urgentPayments },
    { to: '/owner/reconciliations', label: 'Đối soát doanh thu' },
    { to: '/owner/reports', label: 'Báo cáo & Xuất dữ liệu' },
    { to: '/maintenance', label: 'Quản lý bảo trì' },
  ];

  const menuItems = userRole === 'owner' ? ownerMenu : staffMenu;
  const homeUrl = userRole === 'owner' ? '/owner/workspace' : '/staff/dashboard';

  const renderMenuList = (closeDrawer = false) =>
    menuItems.map((item, index) => {
      if (item.onClick) {
        return (
          <UiButton variant="custom"
            key={item.label}
            type="button"
            className={styles.sidebarLink}
            onClick={() => {
              if (closeDrawer) setDrawerOpen(false);
              item.onClick();
            }}
          >
            <span>{item.label}</span>
          </UiButton>
        );
      }
      const group = index === 0 ? 'Vận hành' : index === 1 && userRole === 'owner' ? 'Cấu hình địa điểm' : index === (userRole === 'owner' ? 4 : 3) ? 'Dịch vụ & hỗ trợ' : null;
      return (
        <div key={item.to} className={styles.navItem}>
        {group && <p className={styles.navGroup}>{group}</p>}
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => {
            if (closeDrawer) setDrawerOpen(false);
          }}
          className={({ isActive }) => {
            const hasQuery = item.to.includes('?');
            const itemActive = hasQuery
              ? (location.pathname + location.search) === item.to
              : isActive && (!location.search.includes('tab=reviews') || item.to.includes('tab=reviews'));
            return `${styles.sidebarLink} ${itemActive ? styles.sidebarLinkActive : ''}`;
          }}
        >
          <span>{item.label}</span>
          {Number(item.badge) > 0 && (
            <span
              className={`${styles.menuBadge} ${item.urgent ? styles.menuBadgeUrgent : ''}`}
              aria-label={`${item.badge} việc chờ xử lý${item.urgent ? `, ${item.urgent} thanh toán quá 10 phút` : ''}`}
            >
              {item.badge}
            </span>
          )}
        </NavLink>
        </div>
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

        <LocationSwitcher locations={locations} value={activeLocationId} name={displayLocationName} onChange={handleSelectLocation} />

        <nav className={styles.sidebarNav} aria-label="Menu vai trò">
          {renderMenuList(false)}
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

            <span className={styles.locationStaticPill}>{displayLocationName}</span>
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
          <ManagementInboxContext.Provider value={inbox}>{children}</ManagementInboxContext.Provider>
        </main>
      </div>

      {drawerOpen && (
        <NavigationDrawer label="Menu quản lý di động" left onClose={() => setDrawerOpen(false)}>
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
              <UiButton variant="custom"
                type="button"
                className={styles.drawerCloseBtn}
                aria-label="Đóng menu"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </UiButton>
            </div>

            <LocationSwitcher locations={locations} value={activeLocationId} name={displayLocationName} onChange={handleSelectLocation} />

            <nav className={styles.drawerNav} aria-label="Menu vai trò di động">
              {renderMenuList(true)}
            </nav>
        </NavigationDrawer>
      )}
    </div>
  );
}
