/**
 * OwnerLayout.jsx — shared layout for the Owner Portal.
 *
 * Structure:
 * 1. Full-width Top Navigation Header (Header.jsx)
 * 2. 2-column Layout Body:
 *    - Left: Dark Owner Sidebar with Location Switcher & 10 navigation tabs
 *    - Right: Main Content Area (Outlet)
 */
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { getOwnerLocations, MOCK_OWNER_LOCATIONS } from '../../api/ownerApi'
import styles from './OwnerLayout.module.css'

const NAV_ITEMS = [
  { label: 'Reports',              segment: 'reports'      },
  { label: 'Courts & Pricing',     segment: 'courts'       },
  { label: 'Opening Hours',        segment: 'hours'        },
  { label: 'Staff',                segment: 'staff'        },
  { label: 'Vouchers & Offers',    segment: 'vouchers'     },
  { label: 'Complaints',           segment: 'complaints'   },
  { label: 'Refunds',              segment: 'refunds'      },
  { label: 'Maintenance Approval', segment: 'maintenance'  },
  { label: 'Reviews',              segment: 'reviews'      },
  { label: 'Location Settings',    segment: 'settings'     },
]

export default function OwnerLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [locations, setLocations] = useState(MOCK_OWNER_LOCATIONS)

  useEffect(() => {
    getOwnerLocations()
      .then(setLocations)
      .catch(() => setLocations(MOCK_OWNER_LOCATIONS))
  }, [])

  /** Swap :id in the current path while preserving the tab segment. */
  function handleLocationChange(event) {
    const nextId = event.target.value
    // Current path: /owner/locations/1/staff -> split and replace index 3
    const segments = window.location.pathname.split('/')
    segments[3] = nextId
    navigate(segments.join('/'), { replace: true })
  }

  /** Build the full path for each nav item. */
  function tabPath(segment) {
    return `/owner/locations/${id}/${segment}`
  }

  return (
    <div className={styles.layoutWrapper}>
      {/* 1. Global Top Navigation Header */}
      <Header roleContext="owner" />

      {/* 2. Main 2-column Layout Body */}
      <div className={styles.layoutBody}>
        <aside className={styles.sidebar}>
          <div className={styles.locationSelectorSection}>
            <label className={styles.facilityLabel} htmlFor="owner-location-select">
              Location
            </label>
            <select
              className={styles.facilitySelect}
              id="owner-location-select"
              value={id ?? ''}
              onChange={handleLocationChange}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <nav className={styles.navigation} aria-label="Owner navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.segment}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
                to={tabPath(item.segment)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
