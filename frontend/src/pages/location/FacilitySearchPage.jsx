import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import courtPhoto from '../../assets/badminton-court.jpg';
import { PublicHeader } from '../../components/layout/PublicLayout';
import PublicFooter from '../../components/layout/PublicFooter';
import LocationMap from '../../components/map/LocationMap';
import { useAuth } from '../../hooks/useAuth';
import { useFacilitySearch } from '../../hooks/useFacilitySearch';
import { useGeolocation } from '../../hooks/useGeolocation';
import { distanceKm } from '../../utils/distance';
import { today } from '../../utils/formatters';
import HomeIcon from './HomeIcons';
import styles from './HomePage.module.css';

const MIN_PLAY_DATE = today();
const FEATURED_LIMIT = 6;
const NEARBY_LIMIT = 4;
const vnd = new Intl.NumberFormat('vi-VN');

const HIGHLIGHTS = ['Giá niêm yết rõ ràng', 'Xem giờ trống theo ngày', 'Tích điểm, dùng voucher'];

const FEATURES = [
  { icon: 'pin', title: 'Tìm sân gần bạn', text: 'Sắp xếp sân từ gần đến xa theo vị trí' },
  { icon: 'clock', title: 'Đặt sân online', text: 'Chủ động đặt lịch bất cứ lúc nào' },
  { icon: 'card', title: 'Thanh toán chuyển khoản', text: 'Quét QR, tải biên lai, sân xác nhận' },
  { icon: 'receipt', title: 'Giá cả minh bạch', text: 'Biết chính xác chi phí trước khi đặt' },
];

const STEPS = [
  { icon: 'search', title: 'Tìm sân', text: 'Nhập khu vực hoặc dùng vị trí để tìm sân gần bạn.' },
  { icon: 'calendar', title: 'Chọn khung giờ', text: 'So sánh sân, giá và chọn giờ còn trống.' },
  { icon: 'shield', title: 'Thanh toán & xác nhận', text: 'Chuyển khoản theo QR, tải biên lai và chờ sân xác nhận.' },
];

function formatKm(km) {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function formatPrice(value) {
  return `${vnd.format(Number(value))}đ`;
}

function byRating(a, b) {
  return (b.averageRating ?? 0) - (a.averageRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
}

function byDistance(a, b) {
  return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
}

function VenueCard({ venue, index, onSelect }) {
  const hasRating = venue.averageRating != null;
  return (
    <article className={styles.venueCard}>
      {/* Bấm ảnh cũng mở sân cho tiện dùng chuột; bàn phím và trình đọc màn hình dùng nút "Xem sân". */}
      <div className={styles.venueThumb} onClick={() => onSelect(venue)}>
        <img
          src={courtPhoto}
          alt=""
          loading="lazy"
          style={{ objectPosition: `${20 + ((index * 23) % 60)}% center` }}
        />
        {venue.activeCourtCount > 0 && (
          <span className={styles.courtBadge}>
            <span className={styles.badgeDot} />
            {venue.activeCourtCount} sân
          </span>
        )}
      </div>

      <div className={styles.venueBody}>
        <div className={styles.venueTitleRow}>
          <h3 className={styles.venueName}>{venue.facility_name}</h3>
          {hasRating && (
            <span className={styles.venueRating} aria-label={`Đánh giá ${venue.averageRating} trên 5`}>
              <HomeIcon name="star" size={14} filled />
              {venue.averageRating.toFixed(1).replace('.', ',')}
            </span>
          )}
        </div>
        <p className={styles.venueAddress}>
          <HomeIcon name="pin" size={13} />
          <span>{venue.address}</span>
        </p>
        <div className={styles.venueMeta}>
          <span>{venue.distance_km != null ? `${formatKm(venue.distance_km)} từ bạn` : ''}</span>
          <span>{venue.reviewCount > 0 ? `${venue.reviewCount} đánh giá` : 'Chưa có đánh giá'}</span>
        </div>
        <div className={styles.venueFooter}>
          {venue.minPricePerHour != null ? (
            <p className={styles.venuePrice}>
              <span className={styles.priceFrom}>Từ </span>
              <strong>{formatPrice(venue.minPricePerHour)}</strong>
              <span className={styles.priceUnit}>/ giờ</span>
            </p>
          ) : (
            <p className={styles.venuePriceMissing}>Chưa có bảng giá</p>
          )}
          <button type="button" className={styles.viewBtn} onClick={() => onSelect(venue)}>
            Xem sân
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FacilitySearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const [keyword, setKeyword] = useState('');
  const [searchedKeyword, setSearchedKeyword] = useState('');
  const [playDate, setPlayDate] = useState(MIN_PLAY_DATE);
  const [showAll, setShowAll] = useState(false);
  const [activeCount, setActiveCount] = useState(null);
  const keywordInput = useRef(null);
  const resultsSection = useRef(null);

  const { facilities, loading, loadError, fetchFacilities } = useFacilitySearch();
  const { position, locating, locationError, requestLocation } = useGeolocation();

  useEffect(() => { void fetchFacilities(''); }, [fetchFacilities]);

  // Ghi lại tổng số sân ở lần tải đầu (chưa lọc) để badge không đổi theo từ khoá tìm kiếm.
  if (activeCount == null && !loading && !loadError && !searchedKeyword) setActiveCount(facilities.length);

  const venues = facilities.map((venue) => ({ ...venue, distance_km: distanceKm(position, venue) }));
  const isSearching = searchedKeyword !== '';
  const listed = [...venues].sort(position ? byDistance : isSearching ? () => 0 : byRating);
  const visible = showAll ? listed : listed.slice(0, FEATURED_LIMIT);
  const nearby = (position ? [...venues].sort(byDistance) : venues).slice(0, NEARBY_LIMIT);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    setSearchedKeyword(trimmed);
    setShowAll(false);
    void fetchFacilities(trimmed);
    resultsSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearSearch = () => {
    setKeyword('');
    setSearchedKeyword('');
    void fetchFacilities('');
  };

  const handleSelectFacility = (facility) => {
    sessionStorage.setItem('selected_facility_id', String(facility.facility_id));
    navigate(`/facilities/${facility.facility_id}`, { state: { playDate } });
  };

  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    keywordInput.current?.focus({ preventScroll: true });
  };

  const rewardsLink = roleCode === 'player'
    ? { to: '/my-rewards', label: 'Xem điểm & voucher' }
    : !user ? { to: '/login?mode=register', label: 'Đăng ký để tích điểm' } : null;

  return (
    <div className={styles.page}>
      <PublicHeader />

      <section className={styles.hero}>
        <img className={styles.heroPhoto} src={courtPhoto} alt="" fetchPriority="high" />
        <div className={styles.heroInner}>
          {activeCount > 0 && (
            <p className={styles.heroBadge}>
              <HomeIcon name="check" size={13} />
              {activeCount} cụm sân đang hoạt động trên Courtly
            </p>
          )}
          <h1 className={styles.heroTitle}>Đặt sân cầu lông dễ dàng hơn</h1>
          <p className={styles.heroSubtitle}>
            Tìm sân gần bạn, chọn giờ phù hợp và đặt sân chỉ trong vài bước.
          </p>

          <form className={styles.searchCard} onSubmit={handleSearchSubmit} role="search">
            <label className={styles.searchField}>
              <span className={styles.fieldIcon}><HomeIcon name="pin" /></span>
              <span className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Địa điểm</span>
                <input
                  ref={keywordInput}
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tên sân, quận/huyện…"
                />
              </span>
            </label>

            <label className={styles.searchField}>
              <span className={styles.fieldIcon}><HomeIcon name="calendar" /></span>
              <span className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Ngày chơi</span>
                <input
                  type="date"
                  min={MIN_PLAY_DATE}
                  value={playDate}
                  onChange={(e) => setPlayDate(e.target.value)}
                />
              </span>
            </label>

            <button
              type="button"
              className={`${styles.searchField} ${styles.locateField} ${position ? styles.locateActive : ''}`}
              onClick={requestLocation}
              disabled={locating}
              aria-pressed={Boolean(position)}
            >
              <span className={styles.fieldIcon}><HomeIcon name="crosshair" /></span>
              <span className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Vị trí</span>
                <span className={styles.locateText}>
                  {locating ? 'Đang lấy vị trí…' : position ? 'Đã dùng vị trí của bạn' : 'Dùng vị trí của tôi'}
                </span>
              </span>
            </button>

            <button type="submit" className={styles.searchBtn}>
              <HomeIcon name="search" />
              Tìm sân
            </button>
          </form>

          {locationError && <p role="status" className={styles.heroNotice}>{locationError}</p>}

          <ul className={styles.heroChecks}>
            {HIGHLIGHTS.map((item) => (
              <li key={item}><HomeIcon name="check" size={14} />{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <main>
        <div className={styles.featureStrip}>
          {FEATURES.map((item) => (
            <div key={item.title} className={styles.featureItem}>
              <span className={styles.featureIcon}><HomeIcon name={item.icon} /></span>
              <div>
                <p className={styles.featureTitle}>{item.title}</p>
                <p className={styles.featureText}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <section className={styles.section} ref={resultsSection} aria-labelledby="featured-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>{isSearching ? 'Kết quả tìm kiếm' : 'Được yêu thích'}</p>
              <h2 id="featured-title" className={styles.sectionTitle}>
                {isSearching ? `Sân phù hợp với “${searchedKeyword}”` : 'Sân cầu lông nổi bật'}
              </h2>
              <p className={styles.sectionLead}>
                {isSearching
                  ? `${listed.length} cụm sân khớp tên hoặc địa chỉ.`
                  : position
                    ? 'Đã sắp xếp từ gần đến xa theo vị trí hiện tại của bạn.'
                    : 'Những sân được người chơi Courtly đánh giá tốt.'}
              </p>
            </div>
            {isSearching ? (
              <button type="button" className={styles.linkBtn} onClick={clearSearch}>
                Xoá tìm kiếm
              </button>
            ) : listed.length > FEATURED_LIMIT && (
              <button type="button" className={styles.linkBtn} onClick={() => setShowAll((value) => !value)}>
                {showAll ? 'Thu gọn' : 'Xem tất cả'}
                <HomeIcon name="arrowRight" size={16} />
              </button>
            )}
          </div>

          {loading ? (
            <p role="status" className={styles.stateText}>Đang tải danh sách sân…</p>
          ) : loadError ? (
            <p role="alert" className={styles.stateText}>
              Không tải được danh sách sân.{' '}
              <button type="button" className={styles.inlineBtn} onClick={() => void fetchFacilities(searchedKeyword)}>
                Thử lại
              </button>
            </p>
          ) : listed.length === 0 ? (
            <p className={styles.stateText}>Không tìm thấy sân phù hợp. Thử từ khoá khác hoặc xoá tìm kiếm.</p>
          ) : (
            <div className={styles.venueGrid}>
              {visible.map((venue, index) => (
                <VenueCard key={venue.facility_id} venue={venue} index={index} onSelect={handleSelectFacility} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.stepsBand} aria-labelledby="steps-title">
          <div className={styles.stepsInner}>
            <p className={styles.eyebrow}>Nhanh chóng & đơn giản</p>
            <h2 id="steps-title" className={styles.sectionTitle}>Đặt sân chỉ với 3 bước</h2>
            <ol className={styles.steps}>
              {STEPS.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepIcon}><HomeIcon name={step.icon} size={20} /></span>
                  <span className={styles.stepNo}>Bước {String(index + 1).padStart(2, '0')}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {rewardsLink && (
          <section className={styles.section} aria-labelledby="rewards-title">
            <div className={styles.promo}>
              <span className={styles.promoTag}>Dành cho người chơi</span>
              <h2 id="rewards-title" className={styles.promoTitle}>Tích điểm sau mỗi lần đặt sân</h2>
              <p className={styles.promoText}>
                Đặt sân là được cộng điểm tại cụm sân đó. Dùng điểm và voucher để giảm giá cho lần đặt tiếp theo.
              </p>
              <Link to={rewardsLink.to} className={styles.promoBtn}>
                {rewardsLink.label}
                <HomeIcon name="arrowRight" size={16} />
              </Link>
            </div>
          </section>
        )}

        <section className={`${styles.section} ${styles.nearbySection}`} aria-labelledby="nearby-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>Quanh bạn</p>
              <h2 id="nearby-title" className={styles.sectionTitle}>Sân gần đây</h2>
              <p className={styles.sectionLead}>
                {position
                  ? 'Xem nhanh sân và mức giá quanh khu vực hiện tại.'
                  : 'Bật vị trí để xem những sân gần bạn nhất.'}
              </p>
            </div>
            {!position && (
              <button type="button" className={styles.linkBtn} onClick={requestLocation} disabled={locating}>
                <HomeIcon name="navigation" size={15} />
                {locating ? 'Đang lấy vị trí…' : 'Dùng vị trí của tôi'}
              </button>
            )}
          </div>

          <div className={styles.nearbyCard}>
            <div className={styles.nearbyMap}>
              <LocationMap venues={nearby} onSelect={handleSelectFacility} />
            </div>
            <ol className={styles.nearbyList}>
              {nearby.map((venue, index) => (
                <li key={venue.facility_id}>
                  <button type="button" className={styles.nearbyItem} onClick={() => handleSelectFacility(venue)}>
                    <img src={courtPhoto} alt="" className={styles.nearbyThumb} loading="lazy" />
                    <span className={styles.nearbyBody}>
                      <span className={styles.nearbyName}>{venue.facility_name}</span>
                      <span className={styles.nearbyMeta}>
                        <HomeIcon name="pin" size={12} />
                        {venue.distance_km != null ? `${formatKm(venue.distance_km)} · ` : ''}
                        {venue.address}
                      </span>
                      {venue.minPricePerHour != null && (
                        <span className={styles.nearbyPrice}>{formatPrice(venue.minPricePerHour)}/giờ</span>
                      )}
                    </span>
                    <span className={styles.nearbyIndex}>{index + 1}</span>
                  </button>
                </li>
              ))}
              {!loading && nearby.length === 0 && <li className={styles.stateText}>Chưa có sân để hiển thị.</li>}
            </ol>
          </div>
        </section>

        <section className={styles.ctaBand} aria-labelledby="cta-title">
          <h2 id="cta-title" className={styles.ctaTitle}>Sẵn sàng ra sân?</h2>
          <p className={styles.ctaText}>Tìm sân phù hợp và bắt đầu trận đấu của bạn ngay hôm nay.</p>
          <button type="button" className={styles.ctaBtn} onClick={focusSearch}>
            Tìm sân ngay
            <HomeIcon name="arrowRight" size={16} />
          </button>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
