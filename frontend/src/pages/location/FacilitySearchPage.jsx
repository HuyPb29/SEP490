import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchFacilities } from '../../api/facilityApi';
import styles from './FacilitySearchPage.module.css';

export default function FacilitySearchPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('Cầu Giấy');
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
      console.error('Lỗi tải danh sách sân:', err);
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
    fetchList(keyword === 'Cầu Giấy' ? '' : keyword);
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
      {/* Top Navbar giống Mockup */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>
          <nav className={styles.navLinks}>
            <a href="#search" className={styles.activeLink}>Tìm sân</a>
            <a href="#matches">Kèo đang mở</a>
            <a href="#register-service">Đăng ký sử dụng dịch vụ</a>
          </nav>
          <div className={styles.authActions}>
            <button type="button" className={styles.loginBtn}>Đăng nhập</button>
            <button type="button" className={styles.registerBtn}>Đăng ký</button>
          </div>
        </div>
      </header>

      {/* Hero Section nền tối + Thanh Search Bar 3 ô */}
      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.activeBadge}>
            <span className={styles.badgeCheck}>✓</span>
            <span>Chỉ hiển thị địa điểm đang hoạt động</span>
          </div>

          <h1 className={styles.heroTitle}>Tìm sân cầu lông gần bạn</h1>
          <p className={styles.heroSubtitle}>
            Tìm theo tên hoặc địa chỉ, xem trên bản đồ, chọn giờ trống và đặt sân.
          </p>

          <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
            <div className={styles.searchField}>
              <span className={styles.fieldIcon}>📍</span>
              <div className={styles.fieldContent}>
                <label>TÊN HOẶC ĐỊA CHỈ</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập tên sân hoặc quận..."
                />
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.searchField}>
              <span className={styles.fieldIcon}>📅</span>
              <div className={styles.fieldContent}>
                <label>NGÀY CHƠI</label>
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
              <span>Dùng vị trí của tôi</span>
            </button>

            <button type="submit" className={styles.submitSearchBtn}>
              🔍 Tìm sân
            </button>
          </form>
        </div>
      </section>

      {/* Kết quả tìm kiếm: Lưới Card 3 cột bên trái + Bản đồ bên phải */}
      <main className={styles.mainContent}>
        <div className={styles.resultsHeader}>
          <div>
            <span className={styles.sectionTag}>KẾT QUẢ TÌM KIẾM</span>
            <h2 className={styles.resultsTitle}>{sortedFacilities.length} địa điểm gần bạn</h2>
            <p className={styles.resultsSubtitle}>Xếp từ gần đến xa theo vị trí hiện tại của bạn.</p>
          </div>
          <div className={styles.sortGroup}>
            <button
              type="button"
              className={`${styles.sortBtn} ${sortBy === 'nearest' ? styles.sortBtnActive : ''}`}
              onClick={() => setSortBy('nearest')}
            >
              Gần nhất
            </button>
            <button
              type="button"
              className={`${styles.sortBtn} ${sortBy === 'rating' ? styles.sortBtnActive : ''}`}
              onClick={() => setSortBy('rating')}
            >
              Đánh giá cao
            </button>
          </div>
        </div>

        <div className={styles.contentGrid}>
          {/* Danh sách Card bên trái (3 cột như Mockup) */}
          <div className={styles.cardsGrid}>
            {loading ? (
              <p>Đang tải danh sách địa điểm...</p>
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
                      <span className={styles.dot} /> Còn {item.available_slots} slot hôm nay
                    </span>
                    {/* Hình vẽ mặt sân cầu lông bằng SVG */}
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
                      <span>{item.courts_count} sân · {item.open_hours}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bản đồ giả lập bên phải (Không cần API Key, giống 100% Mockup) */}
          <aside className={styles.mapCard}>
            <div className={styles.mapCanvas}>
              {/* Đường phố giả lập như Mockup */}
              <div className={styles.roadH1} />
              <div className={styles.roadH2} />
              <div className={styles.roadV1} />
              <div className={styles.roadV2} />

              {/* Chấm xanh vị trí người dùng */}
              <div className={styles.userDot} title="Vị trí của bạn" />

              {/* Các điểm ghim (Pin) sân cầu lông */}
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
              Bấm điểm ghim để xem tên và địa chỉ địa điểm.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}