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
    (isOwnerRoute ? 'Facility Owner' : '')
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
            <span className={styles.portalBadge}>Owner Portal</span>
          )}
        </div>

        {/* Global Navigation Links */}
        <nav className={styles.navLinks} aria-label="Main navigation">
          <Link
            to="/locations"
            className={isFindCourtsActive ? styles.activeLink : ''}
          >
            Find Courts
          </Link>
          <Link
            to="/open-matches"
            className={isOpenMatchesActive ? styles.activeLink : ''}
          >
            Open Matches
          </Link>
          <Link
            to="/my-bookings"
            className={isMyBookingsActive ? styles.activeLink : ''}
          >
            My Bookings
          </Link>
          <Link
            to="/register-service"
            className={isRegisterServiceActive ? styles.activeLink : ''}
          >
            Register Service
          </Link>
        </nav>

        {/* Right side: User Area & Notifications OR Login/Sign Up */}
        <div className={styles.userArea}>
          {isLoggedIn ? (
            <>
              <button
                type="button"
                className={styles.bellBtn}
                aria-label="Notifications"
                onClick={() => alert('No new notifications')}
              >
                🔔
              </button>

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
                        {user?.role_code?.toUpperCase() || user?.role || (isOwnerRoute ? 'FACILITY_OWNER' : 'PLAYER')}
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
                      ⚙️ Account Settings
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
                      🏸 My Bookings
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
                        🌐 Switch to Player View
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
                        🏟️ Switch to Owner Portal
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
                      🚪 Sign Out
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
                Login
              </button>
              <button
                type="button"
                className={styles.registerBtn}
                onClick={() => navigate('/login', { state: { isSignUp: true } })}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
