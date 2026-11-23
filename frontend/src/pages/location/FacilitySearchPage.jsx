import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import courtPhoto from '../../assets/badminton-court.jpg';
import PublicLayout from '../../components/layout/PublicLayout';
import { Button, EmptyState, ErrorState, Input, LoadingState, PageHeader, StatusBadge } from '../../components/common';
import GoogleVenueMap from '../../components/map/GoogleVenueMap';
import { useFacilitySearch } from '../../hooks/useFacilitySearch';
import { useGeolocation } from '../../hooks/useGeolocation';
import { distanceKm } from '../../utils/distance';
import { money, shortDate, today } from '../../utils/formatters';
import HomeIcon from './HomeIcons';
import home from './HomePage.module.css';
import styles from './FacilitySearchPage.module.css';

const MIN_PLAY_DATE = today();
const formatKm = (km) => `${km.toFixed(1).replace('.', ',')} km`;
const byRating = (a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
const byDistance = (a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);

function openingHours(venue) {
  if (venue.open_hours) return venue.open_hours;
  return 'Xem tại trang chi tiết';
}

function VenueCard({ venue, index, active, onSelect, onHighlight }) {
  const imageUrl = venue.imageUrl || venue.photoUrl;
  const [imageFailed, setImageFailed] = useState(false);
  return <article className={`${styles.venueCard} ${active ? styles.cardActive : ''}`}
    aria-labelledby={`venue-${venue.facility_id}`}
    onMouseEnter={() => onHighlight(venue.facility_id)} onMouseLeave={() => onHighlight(null)}
    onFocus={() => onHighlight(venue.facility_id)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onHighlight(null); }}>
    <button type="button" className={styles.venuePhoto} onClick={() => onSelect(venue)} aria-label={`Xem lịch sân ${venue.facility_name}`}>
      <img src={!imageFailed && imageUrl ? imageUrl : courtPhoto} alt={!imageFailed && imageUrl ? `Sân tại ${venue.facility_name}` : ''} loading="lazy" onError={() => setImageFailed(true)} />
      {(!imageUrl || imageFailed) && <span className={styles.photoCaption}>Ảnh minh họa</span>}
    </button>
    <div className={styles.venueBody}>
      <div className={styles.cardTop}><span className={styles.venueNumber} aria-label={`Ghim ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
        <StatusBadge status="ACTIVE" category="location" />
        {venue.distance_km != null && <span className={styles.distance}><HomeIcon name="navigation" size={14} />{formatKm(venue.distance_km)}</span>}
      </div>
      <h3 id={`venue-${venue.facility_id}`} className={styles.venueName}>
        <button type="button" onClick={() => onSelect(venue)}>{venue.facility_name}</button>
      </h3>
      <p className={styles.address}><HomeIcon name="pin" size={16} /><span>{venue.address || 'Địa chỉ chưa cập nhật'}</span></p>
      <div className={styles.facts}>
        <span><HomeIcon name="court" size={16} />{venue.activeCourtCount ?? 0} sân</span>
        <span><HomeIcon name="clock" size={16} /><span>Giờ mở cửa: {openingHours(venue)}</span></span>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardSummary}>
          <p className={styles.rating}><HomeIcon name="star" size={15} filled />
            {venue.averageRating != null ? <><strong>{Number(venue.averageRating).toFixed(1).replace('.', ',')}</strong><span>({venue.reviewCount ?? 0} đánh giá)</span></> : <span>Chưa có đánh giá</span>}
          </p>
          {venue.minPricePerHour != null ? <p className={styles.price}>Từ <strong>{money(venue.minPricePerHour).replace(/\s*₫/, 'đ')}</strong><span>/giờ</span></p> : <p className={styles.priceMissing}>Chưa có bảng giá</p>}
        </div>
        <Button size="sm" onClick={() => onSelect(venue)}>Xem lịch sân<HomeIcon name="arrowRight" size={16} /></Button>
      </div>
    </div>
  </article>;
}

export default function FacilitySearchPage({ searchOnly = false }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [searchedKeyword, setSearchedKeyword] = useState('');
  const [playDate, setPlayDate] = useState(MIN_PLAY_DATE);
  const [mobileView, setMobileView] = useState('list');
  const [activeVenueId, setActiveVenueId] = useState(null);
  const keywordInput = useRef(null);
  const debounce = useRef(null);
  const lastQuery = useRef(null);
  const formId = useId();
  const { facilities, loading, loadError, fetchFacilities } = useFacilitySearch();
  const { position, locating, locationError, requestLocation } = useGeolocation();

  const runSearch = useCallback((value, retry = false) => {
    const query = value.trim();
    if (!retry && query === lastQuery.current) return;
    lastQuery.current = query;
    setSearchedKeyword(query);
    void fetchFacilities(query);
  }, [fetchFacilities]);

  // Input debounce is presentation only; the hook still owns cancellation and API rules.
  useEffect(() => {
    debounce.current = setTimeout(() => runSearch(keyword), lastQuery.current == null ? 0 : 350);
    return () => clearTimeout(debounce.current);
  }, [keyword, runSearch]);

  const listed = useMemo(() => facilities.map((venue) => ({ ...venue, distance_km: distanceKm(position, venue) }))
    .sort(position ? byDistance : searchedKeyword ? () => 0 : byRating), [facilities, position, searchedKeyword]);
  const pendingKeyword = keyword.trim() !== searchedKeyword;
  const busy = loading || pendingKeyword;

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    clearTimeout(debounce.current);
    runSearch(keyword);
  };
  const clearSearch = () => {
    clearTimeout(debounce.current);
    setKeyword('');
    runSearch('');
    keywordInput.current?.focus();
  };
  const handleSelectFacility = (facility) => {
    sessionStorage.setItem('selected_facility_id', String(facility.facility_id));
    navigate(`/facilities/${facility.facility_id}`, { state: { playDate } });
  };

  return <PublicLayout fullWidth className={home.page}>
    {!searchOnly && <section className={home.hero} aria-labelledby="search-title">
      <div className={home.heroContent}><p className={home.eyebrow}><HomeIcon name="court" size={16} />Courtly · Cầu lông mỗi ngày</p>
        <h1 id="search-title">Sân phù hợp.<br /><span>Buổi chơi trọn vẹn.</span></h1>
        <p>Tìm địa điểm, xem lịch sân và chọn khung giờ của bạn. Một buổi cầu lông tốt bắt đầu từ đây.</p>
        <div className={home.highlights}><span><HomeIcon name="check" size={15} />Giá niêm yết rõ ràng</span><span><HomeIcon name="check" size={15} />Xem lịch trước khi đặt</span></div>
        <Link className={home.ownerLink} to="/register-service">Bạn là chủ sân? Đăng ký sử dụng dịch vụ<HomeIcon name="arrowRight" size={16} /></Link>
      </div>
      <div className={home.heroVisual}><img src={courtPhoto} alt="Không gian sân cầu lông trong nhà, ảnh minh họa" fetchPriority="high" /><span>Chọn sân. Lên lịch. Ra sân.</span></div>
    </section>}

    <div className={styles.workspace}>
      {searchOnly && <PageHeader eyebrow="Địa điểm cầu lông" title="Tìm sân cho buổi chơi tiếp theo" subtitle="Tìm theo tên hoặc địa chỉ, đối chiếu vị trí và xem lịch sân." />}
      <div className={styles.searchDock}>
        <form id={formId} role="search" aria-label="Tìm địa điểm" className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <div className={styles.keywordField}><label htmlFor={`${formId}-keyword`}>Tên hoặc địa chỉ địa điểm</label>
            <div className={styles.keywordControl}><HomeIcon name="search" size={20} />
              <Input ref={keywordInput} id={`${formId}-keyword`} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tên sân, đường, quận/huyện…" autoComplete="off" aria-controls="venue-results" />
              {keyword && <Button variant="ghost" size="sm" onClick={clearSearch} aria-label="Xóa từ khóa tìm kiếm"><HomeIcon name="close" size={18} /></Button>}
            </div>
          </div>
          <div className={styles.dateField}><label htmlFor={`${formId}-date`}>Ngày chơi</label><Input id={`${formId}-date`} type="date" min={MIN_PLAY_DATE} value={playDate} onChange={(event) => setPlayDate(event.target.value)} /></div>
          <Button type="submit" className={styles.submitButton} loading={loading}>Tìm sân</Button>
        </form>
      </div>
      <div className={styles.searchExtras}>
        <div className={styles.locationGroup}><Button variant="secondary" loading={locating} onClick={requestLocation} aria-describedby={`${formId}-location-help`}><HomeIcon name="crosshair" size={17} />Dùng vị trí của tôi</Button>
          <p id={`${formId}-location-help`}>Cho phép vị trí để sắp xếp sân gần đến xa. Bạn vẫn tìm được sân nếu không cấp quyền.</p>
        </div>
        <p className={styles.playDate}>Ngày chơi: <strong>{shortDate(playDate)}</strong></p>
      </div>
      {locationError && <div role="status" className={styles.locationNotice}><HomeIcon name="info" size={18} /><p>{locationError}</p><Button variant="ghost" size="sm" onClick={() => keywordInput.current?.focus()}>Tìm theo tên hoặc địa chỉ</Button></div>}
      {position && !locationError && <p role="status" className={styles.locationSuccess}><HomeIcon name="check" size={16} />Đã dùng vị trí của bạn. Danh sách được sắp xếp từ gần đến xa.</p>}

      <div className={styles.resultsHeading}><div><h2 id="results-title">{searchedKeyword ? `Kết quả cho “${searchedKeyword}”` : 'Địa điểm đang hoạt động'}</h2>
        <p role="status" aria-live="polite">{busy ? 'Đang tìm địa điểm phù hợp…' : loadError ? 'Danh sách tạm thời chưa tải được.' : `${listed.length} địa điểm${position ? ' · Gần bạn nhất trước' : searchedKeyword ? ' · Khớp tên hoặc địa chỉ' : ' · Đánh giá tốt nhất trước'}`}</p></div>
        <div className={styles.viewSwitch} role="group" aria-label="Cách xem kết quả">
          <Button variant={mobileView === 'list' ? 'primary' : 'ghost'} aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}><HomeIcon name="list" size={16} />Danh sách</Button>
          <Button variant={mobileView === 'map' ? 'primary' : 'ghost'} aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}><HomeIcon name="map" size={16} />Bản đồ</Button>
        </div>
      </div>

      <section className={styles.resultsGrid} aria-labelledby="results-title">
        <div id="venue-results" className={`${styles.resultsList} ${mobileView === 'map' ? styles.listHidden : ''}`} aria-busy={busy}>
          {busy ? <div className={styles.loadingGrid}><LoadingState message="Đang tải danh sách địa điểm…" /><LoadingState message="Đang chuẩn bị thông tin sân…" /></div> : loadError ? <ErrorState message="Không tải được danh sách địa điểm. Vui lòng kiểm tra kết nối và thử lại." onRetry={() => runSearch(searchedKeyword, true)} /> : !listed.length ?
            <EmptyState title={searchedKeyword ? 'Chưa tìm thấy địa điểm phù hợp' : 'Chưa có địa điểm để hiển thị'} description={searchedKeyword ? 'Thử bỏ bớt từ khóa hoặc tìm bằng tên đường, quận/huyện. Bạn cũng có thể xem lại tất cả địa điểm.' : 'Hiện chưa có địa điểm đang hoạt động trong danh sách. Bạn có thể thử tải lại sau.'} action={searchedKeyword ? <Button variant="secondary" onClick={clearSearch}>Xóa tìm kiếm và xem tất cả</Button> : <Button variant="secondary" onClick={() => runSearch('', true)}>Tải lại danh sách</Button>} /> :
            <ol className={styles.cards}>{listed.map((venue, index) => <li key={venue.facility_id}><VenueCard venue={venue} index={index} active={String(activeVenueId) === String(venue.facility_id)} onSelect={handleSelectFacility} onHighlight={setActiveVenueId} /></li>)}</ol>}
        </div>
        <aside className={`${styles.mapColumn} ${mobileView === 'list' ? styles.mapHidden : ''}`} aria-label="Bản đồ kết quả tìm kiếm">
          <div className={styles.mapCard}><header className={styles.mapHeader}><div><HomeIcon name="map" size={18} /><h2>Địa điểm trên bản đồ</h2></div><span>{!busy && !loadError ? `${listed.length} địa điểm` : 'Đang cập nhật'}</span></header>
            <div className={styles.mapWrap}>{busy ? <LoadingState message="Đang cập nhật địa điểm trên bản đồ…" /> : loadError ? <ErrorState message="Chưa có dữ liệu để hiển thị bản đồ." onRetry={() => runSearch(searchedKeyword, true)} /> : !listed.length ? <EmptyState title="Chưa có địa điểm trên bản đồ" description="Bỏ bớt từ khóa hoặc tải lại danh sách để xem thêm địa điểm." action={searchedKeyword ? <Button variant="secondary" onClick={clearSearch}>Xóa tìm kiếm</Button> : <Button variant="secondary" onClick={() => runSearch('', true)}>Tải lại danh sách</Button>} /> : <GoogleVenueMap key={mobileView} venues={listed} onSelect={handleSelectFacility} activeVenueId={activeVenueId} />}</div>
            <p className={styles.mapHint}><HomeIcon name="pin" size={15} />Bấm ghim để xem địa chỉ và lịch sân. Số ghim theo danh sách; chỉ hiển thị địa điểm có tọa độ.</p>
          </div>
        </aside>
      </section>
      {!searchOnly && <section className={home.ownerCallout} aria-labelledby="owner-callout-title"><span className={home.ownerIcon}><HomeIcon name="court" size={24} /></span><div><h2 id="owner-callout-title">Bạn đang quản lý sân cầu lông?</h2><p>Đưa địa điểm của bạn lên Courtly để người chơi dễ dàng tìm thấy và đặt lịch.</p></div><Link to="/register-service">Đăng ký sử dụng dịch vụ<HomeIcon name="arrowRight" size={18} /></Link></section>}
    </div>
  </PublicLayout>;
}
