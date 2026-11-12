import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { errorMessage } from '../../utils/formatters';
import NotificationBell from '../notification/NotificationBell';
import styles from './AppLayouts.module.css';

const ROLE_LABELS = {
  player: 'Người chơi',
  staff: 'Nhân viên',
  owner: 'Chủ sân',
  admin: 'Quản trị viên',
};

export function UserMenu({ user: userProp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: contextUser, logout } = useAuth();
  const user = userProp !== undefined ? userProp : contextUser;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!user) {
    return (
      <div className={styles.guestActions}>
        <Link
          to="/login"
          state={{ returnTo: location.pathname + location.search }}
          className={styles.loginLink}
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          state={{ returnTo: location.pathname + location.search }}
          className={styles.registerLink}
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const roleCode = String(user.role_code || user.role || '').toLowerCase();
  const displayName = user.full_name || user.fullName || user.username || 'Tài khoản';
  const roleLabel = ROLE_LABELS[roleCode] || 'Thành viên';
  const initial = displayName.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || 'U';
  const canAccessAccountPage = roleCode === 'player' || roleCode === 'owner';

  const handleSignOut = async () => {
    setSigningOut(true);
    setLogoutError('');
    setOpen(false);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setLogoutError(errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className={styles.rightControls}>
      <NotificationBell />

      <div className={styles.userMenuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.userTrigger}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((prev) => !prev)}
          title={displayName}
        >
          <span className={styles.userAvatar} aria-hidden="true">
            {initial}
          </span>
          <span className={styles.userText}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </span>
          <span aria-hidden="true" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            ▾
          </span>
        </button>

        <button
          type="button"
          className={styles.signoutQuickBtn}
          disabled={signingOut}
          onClick={handleSignOut}
        >
          {signingOut ? 'Đang thoát…' : 'Đăng xuất'}
        </button>

        {open && (
          <div className={styles.userDropdown} role="menu" aria-label="Menu người dùng">
            <div className={styles.dropdownHeader}>
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
            </div>
            {canAccessAccountPage && (
              <Link
                to="/account"
                role="menuitem"
                className={styles.dropdownItem}
                onClick={() => setOpen(false)}
              >
                Hồ sơ cá nhân
              </Link>
            )}
            {canAccessAccountPage && (
              <Link to="/change-password" role="menuitem" className={styles.dropdownItem} onClick={() => setOpen(false)}>
                Đổi mật khẩu
              </Link>
            )}
            <Link
              to="/notifications"
              role="menuitem"
              className={styles.dropdownItem}
              onClick={() => setOpen(false)}
            >
              Tất cả thông báo
            </Link>
            <button
              type="button"
              role="menuitem"
              className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
              disabled={signingOut}
              onClick={handleSignOut}
            >
              {signingOut ? 'Đang thoát…' : 'Đăng xuất'}
            </button>
          </div>
        )}
      </div>

      {logoutError && (
        <span role="alert" style={{ color: 'var(--color-danger)', fontSize: 11 }}>
          {logoutError}
        </span>
      )}
    </div>
  );
}

export default UserMenu;
