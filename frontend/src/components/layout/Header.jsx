import NotificationBell from '../notification/NotificationBell';
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import styles from './Header.module.css'

export default function Header({ roleContext }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isOwnerRoute = location.pathname.startsWith('/owner') || roleContext === 'owner'
  const isLoggedIn =
    Boolean(user && (user.full_name || user.username || user.email)) ||
    isAuthenticated ||
    isOwnerRoute

  const displayName =
    user?.full_name ||
    user?.username ||
    user?.email ||
    (isOwnerRoute ? 'Chủ sân' : '')
  const initial = (displayName || 'U').charAt(0).toUpperCase()

  // Active route matching
  const isFindCourtsActive =
    location.pathname === '/' ||
    location.pathname === '/locations' ||
    location.pathname.startsWith('/locations/') ||
    location.pathname.startsWith('/facilities/') ||
    location.pathname.startsWith('/booking/')

  const isOpenMatchesActive = location.pathname.startsWith('/open-matches')
  const isMyBookingsActive = location.pathname.startsWith('/my-bookings')
  const isRegisterServiceActive =
    location.pathname.startsWith('/register-service') || location.pathname.startsWith('/owner')

  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Brand */}
        <div className={styles.brandGroup}>
          <div className={styles.brand} onClick={() => navigate('/')} role="button" tabIndex={0}>
            <span className={styles.brandIcon} aria-hidden="true">⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>
          {isOwnerRoute && (
            <span className={styles.portalBadge}>Quản lý chủ sân</span>
          )}
        </div>

        {/* Global Navigation Links */}
        <nav className={styles.navLinks} aria-label="Điều hướng chính">
          <Link
            to="/locations"
            className={isFindCourtsActive ? styles.activeLink : ''}
          >
            Tìm địa điểm
          </Link>
          <Link
            to="/open-matches"
            className={isOpenMatchesActive ? styles.activeLink : ''}
          >
            Kèo đang mở
          </Link>
          <Link
            to="/my-bookings"
            className={isMyBookingsActive ? styles.activeLink : ''}
          >
            Lịch đặt sân của tôi
          </Link>
          <Link
            to="/register-service"
            className={isRegisterServiceActive ? styles.activeLink : ''}
          >
            Đăng ký chủ sân
          </Link>
        </nav>

        {/* Right side: User Area & Notifications OR Đăng nhập/Đăng ký */}
        <div className={styles.userArea}>
          {isLoggedIn ? (
            <>
              <NotificationBell />

              <div className={styles.userMenuWrapper} ref={dropdownRef}>
                <button
                  type="button"
                  className={styles.userProfileBtn}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <span className={styles.avatar}>{initial}</span>
                  <span className={styles.userName}>{displayName}</span>
                  <span className={styles.caret} aria-hidden="true">▾</span>
                </button>

                {dropdownOpen && (
                  <div className={styles.dropdownMenu} role="menu">
                    <div className={styles.dropdownHeader}>
                      <p className={styles.dropdownUser}>{displayName}</p>
                      <p className={styles.dropdownRole}>
                        {({ owner: 'Chủ sân', staff: 'Nhân viên', admin: 'Quản trị viên', player: 'Người chơi' })[String(user?.role_code || user?.role || '').toLowerCase()] || (isOwnerRoute ? 'Chủ sân' : 'Người chơi')}
                      </p>
                    </div>
                    <div className={styles.dropdownDivider} />
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setDropdownOpen(false)
                        navigate('/account/settings')
                      }}
                      role="menuitem"
                    >
                      ⚙️ Cài đặt tài khoản
                    </button>
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setDropdownOpen(false)
                        navigate('/my-bookings')
                      }}
                      role="menuitem"
                    >
                      🏸 Lịch đặt sân của tôi
                    </button>
                    {isOwnerRoute ? (
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate('/')
                        }}
                        role="menuitem"
                      >
                        🌐 Xem giao diện người chơi
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate('/owner/locations/1/reports')
                        }}
                        role="menuitem"
                      >
                        🏟️ Mở trang quản lý chủ sân
                      </button>
                    )}
                    <div className={styles.dropdownDivider} />
                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${styles.logoutItem}`}
                      onClick={() => {
                        setDropdownOpen(false)
                        handleLogout()
                      }}
                      role="menuitem"
                    >
                      🚪 Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <button
                type="button"
                className={styles.loginBtn}
                onClick={() => navigate('/login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={styles.registerBtn}
                onClick={() => navigate('/login', { state: { isSignUp: true } })}
              >
                Đăng ký
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
