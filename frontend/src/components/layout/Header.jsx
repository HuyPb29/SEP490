import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import styles from './Header.module.css'

function getSavedUserInfo() {
  const saved = localStorage.getItem('bms_user_info')
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch (err) {
    return null
  }
}

export default function Header({ roleContext = 'owner' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [userInfo, setUserInfo] = useState(getSavedUserInfo)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleAuthChange = () => setUserInfo(getSavedUserInfo())
    window.addEventListener('bms-auth-change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('bms-auth-change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

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
    localStorage.removeItem('bms_user_info')
    localStorage.removeItem('bms_access_token')
    localStorage.removeItem('token')
    window.dispatchEvent(new Event('bms-auth-change'))
    navigate('/login')
  }

  const displayName =
    userInfo?.full_name || userInfo?.username || (roleContext === 'owner' ? 'Facility Owner' : 'Minh Anh')
  const initial = (displayName || 'O').charAt(0).toUpperCase()
  const isOwnerRoute = location.pathname.startsWith('/owner')

  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Brand */}
        <div className={styles.brandGroup}>
          <div className={styles.brand} onClick={() => navigate('/')} role="button" tabIndex={0}>
            <span className={styles.brandIcon} aria-hidden="true">⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>
          {roleContext === 'owner' && (
            <span className={styles.portalBadge}>Owner Portal</span>
          )}
        </div>

        {/* Global Navigation Links */}
        <nav className={styles.navLinks} aria-label="Main navigation">
          <Link
            to="/"
            className={location.pathname === '/' ? styles.activeLink : ''}
          >
            Find Courts
          </Link>
          <Link
            to="/open-matches"
            className={location.pathname === '/open-matches' ? styles.activeLink : ''}
          >
            Open Matches
          </Link>
          <Link
            to="/my-bookings"
            className={location.pathname === '/my-bookings' ? styles.activeLink : ''}
          >
            My Bookings
          </Link>
        </nav>

        {/* User Area & Notifications */}
        <div className={styles.userArea}>
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
                    {userInfo?.role || (roleContext === 'owner' ? 'FACILITY_OWNER' : 'PLAYER')}
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
        </div>
      </div>
    </header>
  )
}
