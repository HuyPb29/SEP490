import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { today } from '../../utils/formatters';
import LocationMap from '../../components/map/LocationMap';
import { useFacilitySearch } from '../../hooks/useFacilitySearch';
import { useGeolocation } from '../../hooks/useGeolocation';
import { distanceKm } from '../../utils/distance';
import styles from './FacilitySearchPage.module.css';

const MIN_PLAY_DATE = today();

export default function FacilitySearchPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [playDate, setPlayDate] = useState(MIN_PLAY_DATE);
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' | 'rating'
  const [selectedId, setSelectedId] = useState(null);

  const { facilities, loading, loadError, fetchFacilities } = useFacilitySearch();
  const { position, locating, locationError, requestLocation } = useGeolocation();

  useEffect(() => { void fetchFacilities(''); }, [fetchFacilities]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    void fetchFacilities(keyword);
  };

  const sortedFacilities = facilities.map((venue) => ({ ...venue, distance_km: distanceKm(position, venue) }))
    .sort((a, b) => position
      ? (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity)
      : sortBy === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : 0);
  const hasRating = !position && facilities.some((item) => item.rating != null);

  const handleSelectFacility = (facility) => {
    sessionStorage.setItem('selected_facility_id', String(facility.facility_id));
    navigate(`/facilities/${facility.facility_id}`, { state: { playDate } });
  };

  return (
    <div className={styles.pageWrapper}>
      <PublicHeader />

      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.activeBadge}>
            <span className={styles.badgeCheck}>✓</span>
            <span>Chỉ hiển thị địa điểm đang hoạt động (BR62)</span>
          </div>

          <h1 className={styles.heroTitle}>Tìm sân cầu lông gần bạn</h1>
          <p className={styles.heroSubtitle}>
            Tìm kiếm theo tên hoặc địa chỉ, xem vị trí trên bản đồ, chọn khung giờ trống và đặt sân nhanh chóng.
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
                  placeholder="Nhập tên cơ sở hoặc quận/huyện..."
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
                  min={MIN_PLAY_DATE}
                  value={playDate}
                  onChange={(e) => setPlayDate(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.divider} />

            <button
              type="button"
              className={`${styles.gpsBtn} ${position ? styles.gpsActive : ''}`}
              onClick={requestLocation}
              disabled={locating}
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

      <main className={styles.mainContent}>
        {locationError && <p role="status">{locationError}</p>}
        <div className={styles.resultsHeader}>
          <div>
            <span className={styles.sectionTag}>KẾT QUẢ TÌM KIẾM</span>
            <h2 className={styles.resultsTitle}>
              {sortedFacilities.length} {position ? 'địa điểm gần bạn' : 'địa điểm'}
            </h2>
            <p className={styles.resultsSubtitle}>
              {position
                ? 'Đã sắp xếp từ gần đến xa theo vị trí hiện tại của bạn (FR29).'
                : 'Bấm "Dùng vị trí của tôi" để sắp xếp các địa điểm từ gần đến xa.'}
            </p>
          </div>
          {hasRating && (
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
          )}
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.cardsGrid}>
            {loading ? (
              <p>Đang tải danh sách địa điểm...</p>
            ) : loadError ? (
              <p>Không tải được danh sách địa điểm. Vui lòng thử lại.</p>
            ) : sortedFacilities.length === 0 ? (
              <p>Không tìm thấy địa điểm phù hợp.</p>
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
                        <span className={styles.dot} /> Còn {item.available_slots} slot trống hôm nay
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
                          <strong>{item.distance_km.toFixed(1).replace('.', ',')} km</strong>
                        )}
                        {(item.courts_count != null || item.open_hours) && (
                          <span>
                            {item.courts_count != null && `${item.courts_count} sân`}
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

          <aside className={styles.mapCard}>
            <LocationMap venues={sortedFacilities} onSelect={handleSelectFacility} />
          </aside>
        </div>
      </main>
    </div>
  );
}
