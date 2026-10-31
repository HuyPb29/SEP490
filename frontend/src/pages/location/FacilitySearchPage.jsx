import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchFacilities } from '../../api/facilityApi';
import styles from './FacilitySearchPage.module.css';

export default function FacilitySearchPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('Cau Giay');
  const [playDate, setPlayDate] = useState('2026-10-24');
  const [facilities, setFacilities] = useState([]);
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'rating'
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingGps, setUsingGps] = useState(false);

  const fetchList = async (kw = keyword, lat = null, lng = null) => {
    setLoading(true);
    try {
      const res = await searchFacilities({ keyword: kw, userLat: lat, userLng: lng });
      if (res?.success) {
        setFacilities(res.data.items || []);
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
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return (a.distance_km || 0) - (b.distance_km || 0);
  });

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
                    <span className={styles.slotBadge}>
                      <span className={styles.dot} /> {item.available_slots} slots left today
                    </span>
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
                      <span className={styles.rating}>★ <strong>{item.rating}</strong></span>
                    </div>
                    <p className={styles.cardAddress}>
                      {item.address}, {item.district}{idx === 0 ? `, ${item.city}` : ''}
                    </p>
                    <div className={styles.cardMeta}>
                      <strong>{String(item.distance_km).replace('.', ',')} km</strong>
                      <span>{item.courts_count} courts · {item.open_hours}</span>
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