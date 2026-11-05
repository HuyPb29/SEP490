import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchFacilities } from '../../api/facilityApi';
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
  const [keyword, setKeyword] = useState('');
  const [playDate, setPlayDate] = useState('2026-10-24');
  const [facilities, setFacilities] = useState([]);
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'rating'
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingGps, setUsingGps] = useState(false);
  const [position, setPosition] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const fetchList = async (kw = keyword, lat = null, lng = null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await searchFacilities({ keyword: kw, userLat: lat, userLng: lng });
      if (res?.success) {
        setFacilities(res.data.items || []);
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
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return (a.distance_km || 0) - (b.distance_km || 0);
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
    navigate(`/facilities/${facility.facility_id}`);
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
            <a href="#matches">Open Matches</a>
            <a href="#register-service">Register Service</a>
          </nav>
          <div className={styles.authActions}>
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
              onClick={() => navigate('/login')}
            >
              Sign Up
            </button>
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
                      {[item.address, item.district, idx === 0 ? item.city : null].filter(Boolean).join(', ')}
                    </p>
                    <div className={styles.cardMeta}>
                      {item.distance_km != null && (
                        <strong>{String(item.distance_km).replace('.', ',')} km</strong>
                      )}
                      {item.courts_count != null && (
                        <span>{item.courts_count} courts · {item.open_hours}</span>
                      )}
                    </div>
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