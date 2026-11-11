import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchFacilities } from '../../api/facilityApi';
import { logoutApi } from '../../api/authApi';
import { getSavedUser } from '../../api/session';
import styles from './FacilitySearchPage.module.css';

// Bản đồ CSS tĩnh: quy đổi tọa độ về % trong khung, cách mép 25% để nhãn tên không bị cắt
function scaleToMap(value, min, max) {
  return max === min ? 50 : 25 + ((value - min) / (max - min)) * 50;
}

function buildMapProjection(points) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return ({ lat, lng }) => ({
    top: `${100 - scaleToMap(lat, minLat, maxLat)}%`,
    left: `${scaleToMap(lng, minLng, maxLng)}%`,
  });
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
  const [userInfo, setUserInfo] = useState(getSavedUser);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    const syncUserInfo = () => setUserInfo(getSavedUser());
    window.addEventListener('bms-auth-change', syncUserInfo);
    window.addEventListener('storage', syncUserInfo);
    return () => {
      window.removeEventListener('bms-auth-change', syncUserInfo);
      window.removeEventListener('storage', syncUserInfo);
    };
  }, []);
  const [position, setPosition] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const fetchList = async (kw = keyword, lat = null, lng = null) => {
    setLoading(true);
    setLoadError(false);
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
      setFacilities([]);
      setLoadError(true);
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
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        fetchList(keyword, lat, lng);
      },
      () => {
        setUsingGps(false);
        setPosition(null);
        fetchList(keyword);
      }
    );
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchList(keyword, position?.lat, position?.lng);
  };

  const sortedFacilities = [...facilities].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return (a.distance_km ?? 0) - (b.distance_km ?? 0);
  });

  // Backend chưa trả điểm đánh giá nên chỉ hiện nút sắp xếp khi có dữ liệu
  const hasRating = facilities.some((item) => item.rating != null);

  const mappedFacilities = sortedFacilities.filter((item) => item.latitude != null && item.longitude != null);
  const projectToMap = buildMapProjection([
    ...mappedFacilities.map((item) => ({ lat: Number(item.latitude), lng: Number(item.longitude) })),
    ...(position ? [position] : []),
  ]);

  const handleSelectFacility = (facility) => {
    sessionStorage.setItem('selected_facility_id', String(facility.facility_id));
    navigate(`/facilities/${facility.facility_id}`, { state: { playDate } });
  };
  const userDisplayName = userInfo?.full_name || userInfo?.username || userInfo?.email;

  const handleLogout = async () => {
    setLogoutPending(true);
    setLogoutError('');
    try {
      await logoutApi();
    } catch (error) {
      setLogoutError(error.response?.data?.message || 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setLogoutPending(false);
    }
  };

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
                  <button type="button" className={styles.dropdownItem} onClick={() => navigate('/notifications')}>Thông báo</button>
                  {['player', 'owner'].includes(userInfo.role_code) &&
                    <button type="button" className={styles.dropdownItem} onClick={() => navigate('/account')}>Tài khoản của tôi</button>}
                  {userInfo.role_code === 'player' &&
                    <button type="button" className={styles.dropdownItem} onClick={() => navigate('/my-rewards')}>Ưu đãi của tôi</button>}
                  {userInfo.role_code === 'owner' &&
                    <button type="button" className={styles.dropdownItem} onClick={() => navigate('/owner/workspace')}>Quản lý địa điểm</button>}
                  {userInfo.role_code === 'admin' &&
                    <button type="button" className={styles.dropdownItem} onClick={() => navigate('/admin/workspace')}>Quản trị hệ thống</button>}
                  {userInfo.role_code === 'staff' &&
                    <button type="button" className={styles.dropdownItem} onClick={() => navigate('/staff/confirm-payments')}>Xác nhận thanh toán</button>}
                  {userInfo.role_code === 'player' && <div
                    className={styles.dropdownItem}
                    onClick={() => navigate('/my-bookings')}
                  >
                    🏸 My Bookings
                  </div>}
                  <button
                    type="button"
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                    onClick={handleLogout}
                    disabled={logoutPending}
                  >
                    {logoutPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                  {logoutError && <p className={styles.dropdownItem} role="alert">{logoutError}</p>}
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
            <h2 className={styles.resultsTitle}>
              {sortedFacilities.length} {position ? 'facilities near you' : 'facilities'}
            </h2>
            <p className={styles.resultsSubtitle}>
              {position
                ? 'Sorted from nearest to farthest based on your current location.'
                : 'Use your location to sort facilities from nearest to farthest.'}
            </p>
          </div>
          {hasRating && (
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
          )}
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.cardsGrid}>
            {loading ? (
              <p>Loading facilities...</p>
            ) : loadError ? (
              <p>Cannot load facilities. Please try again.</p>
            ) : sortedFacilities.length === 0 ? (
              <p>No facilities found.</p>
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

              {position && (
                <div className={styles.userDot} style={projectToMap(position)} title="Your location" />
              )}

              {mappedFacilities.map((item) => (
                <button
                  key={item.facility_id}
                  type="button"
                  style={item.pin_pos || projectToMap({ lat: Number(item.latitude), lng: Number(item.longitude) })}
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
