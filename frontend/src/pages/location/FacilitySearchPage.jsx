import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchFacilities } from '../../api/facilityApi';
import styles from './FacilitySearchPage.module.css';

function getSavedUserInfo() {
  const savedUserInfo = localStorage.getItem('bms_user_info');
  if (!savedUserInfo) return null;

  try {
    return JSON.parse(savedUserInfo);
  } catch (error) {
    console.error('Error reading saved user information:', error);
    return null;
  }
}

export default function FacilitySearchPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('Cau Giay');
  // Lấy đúng giờ Việt Nam (Local Time)
  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [playDate, setPlayDate] = useState(getLocalToday());
  const [facilities, setFacilities] = useState([]);
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'rating'
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingGps, setUsingGps] = useState(false);
  const [userInfo, setUserInfo] = useState(getSavedUserInfo);

  useEffect(() => {
    const syncUserInfo = () => setUserInfo(getSavedUserInfo());
    window.addEventListener('bms-auth-change', syncUserInfo);
    window.addEventListener('storage', syncUserInfo);
    return () => {
      window.removeEventListener('bms-auth-change', syncUserInfo);
      window.removeEventListener('storage', syncUserInfo);
    };
  }, []);

  const fetchList = async (kw = keyword, lat = null, lng = null) => {
    setLoading(true);
    try {
      const res = await searchFacilities({ keyword: kw, userLat: lat, userLng: lng });
      if (res?.success) {
        const locations = Array.isArray(res.data) ? res.data : res.data?.items;
        if (!Array.isArray(locations)) {
          throw new Error('Unexpected locations response: expected an array in data.');
        }

        setFacilities(locations.map((location) => ({
          ...location,
          facility_id: location.id ?? location.facility_id,
          facility_name: location.name ?? location.facility_name,
          distance_km: location.distanceKm ?? location.distance_km,
        })));
      }
    } catch (err) {
      console.error('Error loading facilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList('');
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      fetchList(keyword);
      return;
    }
    setUsingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Chỉ truyền tọa độ lúc truy vấn, không lưu vào CSDL
        fetchList(keyword, pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setUsingGps(false);
        fetchList(keyword);
      }
    );
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchList(keyword === 'Cau Giay' ? '' : keyword);
  };

  const sortedFacilities = [...facilities].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return (a.distance_km ?? 0) - (b.distance_km ?? 0);
  });

  const handleSelectFacility = (facility) => {
    sessionStorage.setItem('selected_facility_id', String(facility.facility_id));
    navigate(`/facilities/${facility.facility_id}`, { state: { playDate } });
  };
  const userDisplayName = userInfo?.full_name || userInfo?.username || userInfo?.email;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>
          <nav className={styles.navLinks}>
            <a href="#search" className={styles.activeLink}>Find Court</a>
            <Link to="/open-matches">Open Matches</Link>
            <a href="#register-service">Register Service</a>
          </nav>
          <div className={styles.authActions}>
            {userDisplayName ? (
              <div className={styles.userProfileWrapper}>
                <div className={styles.userProfileHover}>
                  <div className={styles.avatar}>
                    {userDisplayName.charAt(0).toUpperCase()}
                  </div>
                  <span className={styles.userName}>{userDisplayName}</span>
                </div>

                {/* Dropdown Menu thả xuống */}
                <div className={styles.dropdownMenu}>
                  <div
                    className={styles.dropdownItem}
                    onClick={() => navigate('/my-bookings')}
                  >
                    🏸 My Bookings
                  </div>
                  <div
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                    onClick={() => {
                      localStorage.removeItem('bms_user_info');
                      localStorage.removeItem('token');
                      window.dispatchEvent(new Event('bms-auth-change'));
                    }}
                  >
                    Đăng xuất
                  </div>
                </div>
              </div>
            ) : (
              <>
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
                  // Gắn thêm state: { isSignUp: true } để báo cho AuthPage biết
                  onClick={() => navigate('/login', { state: { isSignUp: true } })}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.activeBadge}>
            <span className={styles.badgeCheck}>✓</span>
            <span>Showing only active facilities</span>
          </div>

          <h1 className={styles.heroTitle}>Find Badminton Courts Near You</h1>
          <p className={styles.heroSubtitle}>
            Search by name or address, view on the map, select available slots and book a court.
          </p>

          <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
            <div className={styles.searchField}>
              <span className={styles.fieldIcon}>📍</span>
              <div className={styles.fieldContent}>
                <label>NAME OR ADDRESS</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Enter court name or district..."
                />
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.searchField}>
              <span className={styles.fieldIcon}>📅</span>
              <div className={styles.fieldContent}>
                <label>PLAY DATE</label>
                <input
                  type="date"
                  value={playDate}
                  onChange={(e) => setPlayDate(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.divider} />

            <button
              type="button"
              className={`${styles.gpsBtn} ${usingGps ? styles.gpsActive : ''}`}
              onClick={handleUseMyLocation}
            >
              <span className={styles.fieldIcon}>🎯</span>
              <span>Use my location</span>
            </button>

            <button type="submit" className={styles.submitSearchBtn}>
              🔍 Find Court
            </button>
          </form>
        </div>
      </section>

      <main className={styles.mainContent}>
        <div className={styles.resultsHeader}>
          <div>
            <span className={styles.sectionTag}>SEARCH RESULTS</span>
            <h2 className={styles.resultsTitle}>{sortedFacilities.length} facilities near you</h2>
            <p className={styles.resultsSubtitle}>Sorted from nearest to farthest based on your current location.</p>
          </div>
          <div className={styles.sortGroup}>
            <button
              type="button"
              className={`${styles.sortBtn} ${sortBy === 'nearest' ? styles.sortBtnActive : ''}`}
              onClick={() => setSortBy('nearest')}
            >
              Nearest
            </button>
            <button
              type="button"
              className={`${styles.sortBtn} ${sortBy === 'rating' ? styles.sortBtnActive : ''}`}
              onClick={() => setSortBy('rating')}
            >
              High Rating
            </button>
          </div>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.cardsGrid}>
            {loading ? (
              <p>Loading facilities...</p>
            ) : (
              sortedFacilities.map((item, idx) => (
                <div
                  key={item.facility_id}
                  className={`${styles.card} ${selectedId === item.facility_id ? styles.cardSelected : ''}`}
                  onClick={() => handleSelectFacility(item)}
                  onMouseEnter={() => setSelectedId(item.facility_id)}
                >
                  <div className={`${styles.cardThumb} ${idx === 0 ? styles.thumbBlue : styles.thumbGreen}`}>
                    {item.available_slots != null && (
                      <span className={styles.slotBadge}>
                        <span className={styles.dot} /> {item.available_slots} slots left today
                      </span>
                    )}
                    <svg viewBox="0 0 200 110" className={styles.courtSvg}>
                      <rect x="15" y="15" width="170" height="80" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                      <line x1="100" y1="15" x2="100" y2="95" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                      <line x1="40" y1="15" x2="40" y2="95" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                      <line x1="160" y1="15" x2="160" y2="95" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                      <line x1="15" y1="55" x2="185" y2="55" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                    </svg>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardName}>{item.facility_name}</h3>
                      {item.rating != null && (
                        <span className={styles.rating}>★ <strong>{item.rating}</strong></span>
                      )}
                    </div>
                    <p className={styles.cardAddress}>
                      {item.address}
                      {item.district && `, ${item.district}`}
                      {idx === 0 && item.city && `, ${item.city}`}
                    </p>
                    {(item.distance_km != null || item.courts_count != null || item.open_hours) && (
                      <div className={styles.cardMeta}>
                        {item.distance_km != null && (
                          <strong>{String(item.distance_km).replace('.', ',')} km</strong>
                        )}
                        {(item.courts_count != null || item.open_hours) && (
                          <span>
                            {item.courts_count != null && `${item.courts_count} courts`}
                            {item.courts_count != null && item.open_hours && ' · '}
                            {item.open_hours}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mockup UI: Bản đồ CSS tĩnh (Không dùng API Key) */}
          <aside className={styles.mapCard}>
            <div className={styles.mapCanvas}>
              <div className={styles.roadH1} />
              <div className={styles.roadH2} />
              <div className={styles.roadV1} />
              <div className={styles.roadV2} />

              <div className={styles.userDot} title="Your location" />

              {sortedFacilities.map((item) => (
                <button
                  key={item.facility_id}
                  type="button"
                  style={{ top: item.pin_pos?.top || '50%', left: item.pin_pos?.left || '50%' }}
                  className={`${styles.mapPinWrapper} ${selectedId === item.facility_id ? styles.pinActive : ''}`}
                  onClick={() => handleSelectFacility(item)}
                >
                  <span className={styles.pinLabel}>{item.pin_pos?.short_name || item.facility_name}</span>
                  <span className={styles.pinIcon} />
                </button>
              ))}
            </div>
            <p className={styles.mapFooter}>
              Click a pin to view the facility's name and address.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}