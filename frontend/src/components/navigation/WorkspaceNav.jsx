import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './WorkspaceNav.module.css';
import { handleMenuKeyDown } from '../common/menuKeyboard';

/**
 * Menu điều hướng nhanh theo vai trò dựa trên AuthContext.
 * Chỉ hiện khi đã đăng nhập; tự ẩn khi chưa có phiên hợp lệ.
 */
const SCREENS = {
  admin: [
    { to: '/admin/workspace', label: "Quản trị hệ thống" },
    { to: '/admin/facilities', label: "Địa điểm và đăng ký dịch vụ" },
    { to: '/notifications', label: "Thông báo" },
  ],
  owner: [
    { to: '/owner/workspace', label: "Quản lý của chủ sân" },
    { to: '/owner/courts-pricing', label: "Sân và bảng giá" },
    { to: '/owner/opening-hours', label: "Giờ mở cửa" },
    { to: '/owner/facility-settings', label: "Cài đặt địa điểm" },
    { to: '/maintenance', label: "Duyệt yêu cầu bảo trì" },
    { to: '/owner/reports', label: "Báo cáo" },
    { to: '/notifications', label: "Thông báo" },
  ],
  staff: [
    { to: '/staff/dashboard', label: "Bảng điều hành nhân viên" },
    { to: '/staff/confirm-payments', label: "Xác nhận thanh toán" },
    { to: '/staff/complaints', label: "Khiếu nại" },
    { to: '/maintenance', label: "Yêu cầu bảo trì" },
    { to: '/notifications', label: "Thông báo" },
  ],
  player: [
    { to: '/facilities', label: "Tìm sân" },
    { to: '/open-matches', label: "Kèo đang mở" },
    { to: '/my-bookings', label: "Lịch đặt sân của tôi" },
    { to: '/my-rewards', label: "Ưu đãi và điểm thưởng" },
    { to: '/account', label: "Hồ sơ tài khoản" },
    { to: '/notifications', label: "Thông báo" },
  ],
};

const ROLE_LABEL = {
  admin: "Quản trị viên",
  owner: "Chủ địa điểm",
  staff: "Nhân viên địa điểm",
  player: "Người chơi",
};

export default function WorkspaceNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
        <div className={styles.panel} role="menu" aria-label="Menu quản lý" onKeyDown={handleMenuKeyDown}>
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

          <button type="button" role="menuitem" className={styles.logout} onClick={handleLogout} disabled={signingOut}>
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      )}

      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mở menu quản lý"
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
        <span>Khu vực quản lý</span>
      </button>
    </div>
  );
}
