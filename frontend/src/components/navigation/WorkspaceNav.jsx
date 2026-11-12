import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './WorkspaceNav.module.css';

/**
 * Menu điều hướng nhanh theo vai trò dựa trên AuthContext.
 * Chỉ hiện khi đã đăng nhập; tự ẩn khi chưa có phiên hợp lệ.
 */
const SCREENS = {
  admin: [
    { to: '/admin/workspace', label: 'Admin Workspace' },
    { to: '/admin/facilities', label: 'Facilities & Registration' },
    { to: '/notifications', label: 'Notifications' },
  ],
  owner: [
    { to: '/owner/workspace', label: 'Owner Workspace' },
    { to: '/owner/courts-pricing', label: 'Courts & Pricing' },
    { to: '/owner/opening-hours', label: 'Opening Hours' },
    { to: '/owner/facility-settings', label: 'Facility Settings' },
    { to: '/maintenance', label: 'Maintenance Approval' },
    { to: '/owner/reports', label: 'Reports' },
    { to: '/notifications', label: 'Notifications' },
  ],
  staff: [
    { to: '/staff/dashboard', label: 'Staff Dashboard' },
    { to: '/staff/confirm-payments', label: 'Confirm Payments' },
    { to: '/staff/complaints', label: 'Complaints' },
    { to: '/maintenance', label: 'Maintenance Requests' },
    { to: '/notifications', label: 'Notifications' },
  ],
  player: [
    { to: '/facilities', label: 'Find Court' },
    { to: '/open-matches', label: 'Open Matches' },
    { to: '/my-bookings', label: 'My Bookings' },
    { to: '/my-rewards', label: 'Rewards & Points' },
    { to: '/account', label: 'Account Profile' },
    { to: '/notifications', label: 'Notifications' },
  ],
};

const ROLE_LABEL = {
  admin: 'Administrator',
  owner: 'Facility Owner',
  staff: 'Facility Staff',
  player: 'Player',
};

export default function WorkspaceNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const handleLogout = useCallback(async () => {
    setSigningOut(true);
    setLogoutError('');
    try {
      await logout();
      setOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error.response?.data?.message || 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setSigningOut(false);
    }
  }, [logout, navigate]);

  if (!isAuthenticated || !role) return null;

  const screens = SCREENS[role] || [];
  const displayName = user?.full_name || user?.fullName || user?.username || '';
  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHead}>
            <span className={styles.roleBadge}>{ROLE_LABEL[role] || role}</span>
            {displayName && <span className={styles.userName}>{displayName}</span>}
          </div>

          <div className={styles.list}>
            {screens.map((screen) => (
              <button
                type="button"
                key={screen.to}
                role="menuitem"
                className={`${styles.item} ${isActive(screen.to) ? styles.itemActive : ''}`}
                onClick={() => {
                  setOpen(false);
                  navigate(screen.to);
                }}
              >
                <span className={styles.itemLabel}>{screen.label}</span>
              </button>
            ))}
          </div>

          <button type="button" className={styles.logout} onClick={handleLogout} disabled={signingOut}>
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
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
  );
}
