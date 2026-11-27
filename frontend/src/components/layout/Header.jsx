import { Button as UiButton } from '../ui';
import NotificationBell from '../notification/NotificationBell';
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import styles from './Header.module.css'
import NavigationDrawer from './NavigationDrawer'
import { useNavigationDrawer } from '../../hooks/useNavigationDrawer'

export default function Header({ roleContext }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useNavigationDrawer()

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

  const navigation = (
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
  )

  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Brand */}
        <div className={styles.brandGroup}>
          <Link className={styles.brand} to="/">
            <span className={styles.brandIcon} aria-hidden="true">⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </Link>
          {isOwnerRoute && (
            <span className={styles.portalBadge}>Quản lý chủ sân</span>
          )}
        </div>

        {/* Global Navigation Links */}
        {navigation}

        {/* Right side: User Area & Notifications OR Đăng nhập/Đăng ký */}
        <div className={styles.userArea}>
          <UiButton variant="custom" type="button" className={styles.mobileMenu} aria-label="Mở menu điều hướng" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>☰</UiButton>
          {isLoggedIn ? (
            <>
              <NotificationBell />

              <div className={styles.userMenuWrapper} ref={dropdownRef}>
                <UiButton variant="custom"
                  type="button"
                  className={styles.userProfileBtn}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <span className={styles.avatar}>{initial}</span>
                  <span className={styles.userName}>{displayName}</span>
                  <span className={styles.caret} aria-hidden="true">▾</span>
                </UiButton>

                {dropdownOpen && (
                  <div className={styles.dropdownMenu} role="menu">
                    <div className={styles.dropdownHeader}>
                      <p className={styles.dropdownUser}>{displayName}</p>
                      <p className={styles.dropdownRole}>
                        {({ owner: 'Chủ sân', staff: 'Nhân viên', admin: 'Quản trị viên', player: 'Người chơi' })[String(user?.role_code || user?.role || '').toLowerCase()] || (isOwnerRoute ? 'Chủ sân' : 'Người chơi')}
                      </p>
                    </div>
                    <div className={styles.dropdownDivider} />
                    <UiButton variant="custom"
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setDropdownOpen(false)
                        navigate('/account/settings')
                      }}
                      role="menuitem"
                    >
                      ⚙️ Cài đặt tài khoản
                    </UiButton>
                    <UiButton variant="custom"
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setDropdownOpen(false)
                        navigate('/my-bookings')
                      }}
                      role="menuitem"
                    >
                      🏸 Lịch đặt sân của tôi
                    </UiButton>
                    {isOwnerRoute ? (
                      <UiButton variant="custom"
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate('/')
                        }}
                        role="menuitem"
                      >
                        🌐 Xem giao diện người chơi
                      </UiButton>
                    ) : (
                      <UiButton variant="custom"
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate('/owner/locations/1/reports')
                        }}
                        role="menuitem"
                      >
                        🏟️ Mở trang quản lý chủ sân
                      </UiButton>
                    )}
                    <div className={styles.dropdownDivider} />
                    <UiButton variant="custom"
                      type="button"
                      className={`${styles.dropdownItem} ${styles.logoutItem}`}
                      onClick={() => {
                        setDropdownOpen(false)
                        handleLogout()
                      }}
                      role="menuitem"
                    >
                      🚪 Đăng xuất
                    </UiButton>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <UiButton variant="custom"
                type="button"
                className={styles.loginBtn}
                onClick={() => navigate('/login')}
              >
                Đăng nhập
              </UiButton>
              <UiButton variant="custom"
                type="button"
                className={styles.registerBtn}
                onClick={() => navigate('/login', { state: { isSignUp: true } })}
              >
                Đăng ký
              </UiButton>
            </div>
          )}
        </div>
      </div>
      {drawerOpen && <NavigationDrawer label="Điều hướng di động" onClose={() => setDrawerOpen(false)}>
        <UiButton variant="custom" type="button" className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>Đóng menu ✕</UiButton>
        <div className={styles.drawerLinks} onClick={(event) => { if (event.target.closest('a')) setDrawerOpen(false); }}>{navigation}</div>
      </NavigationDrawer>}
    </header>
  )
}
