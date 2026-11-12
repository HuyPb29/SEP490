import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import VenueSchedule from './VenueSchedule';
import { usePublicVenue } from '../../hooks/usePublicVenue';
import { useVenueSession } from '../../hooks/useVenueSchedule';
import VenueInformation from './VenueInformation';
import styles from './FacilityDetailPage.module.css';

export default function FacilityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scheduleRef = useRef(null);
  const [reload, setReload] = useState(0);
  const [packagePrompt, setPackagePrompt] = useState(false);
  const { user: currentUser } = useVenueSession();
  const venue = usePublicVenue(id, reload);
  const facility = venue?.data;
  const canBook = !currentUser || currentUser.role_code === 'player';
  function handleGoPackageBooking() {
    if (!currentUser) { setPackagePrompt(true); return; }
    if (canBook) navigate('/facilities/' + id + '/package-booking', { state: { facilityName: facility.facility_name } });
  }

  if (!facility) return <div className={styles.loadingScreen}>
    <p role={venue?.error ? 'alert' : 'status'}>{venue?.error || 'Đang tải địa điểm…'}</p>
    {venue?.error && <button type="button" onClick={() => setReload((value) => value + 1)}>Thử lại</button>}
  </div>;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand} onClick={() => navigate('/')}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>
          <nav className={styles.navLinks}>
            <Link to="/" className={styles.activeLink}>Find Court</Link>
            <Link to="/open-matches">Open Matches</Link>
            <Link to="/my-bookings">My Bookings</Link>
          </nav>
          <div className={styles.userArea}>
            <button type="button" className={styles.bellBtn} aria-label="Notifications">🔔</button>
            <div className={styles.userProfile}>
              <span className={styles.avatar}>MA</span>
              <span className={styles.userName}>Minh Anh</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className={styles.breadcrumb}>
          <Link to="/" className={styles.breadcrumbLink}>Find Court</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{facility.facility_name}</span>
        </div>

        {/* UC12: Thông tin sân */}
        <section className={styles.heroGrid}>
          <div className={styles.courtVisualCard}>
            <svg viewBox="0 0 400 200" className={styles.courtSvg}>
              <rect x="20" y="15" width="360" height="170" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
              <line x1="200" y1="15" x2="200" y2="185" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              <line x1="65" y1="15" x2="65" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
              <line x1="335" y1="15" x2="335" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
              <line x1="145" y1="15" x2="145" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
              <line x1="255" y1="15" x2="255" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
              <line x1="20" y1="100" x2="380" y2="100" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            </svg>
          </div>

          <div className={styles.facilityInfoCard}>
            <h1 className={styles.facilityTitle}>{facility.facility_name}</h1>
            {facility.rating != null && (
              <div className={styles.ratingRow}>
                <span className={styles.starIcon}>★</span>
                <strong>{String(facility.rating).replace(',', '.')}</strong>
                <span className={styles.reviewCount}>({facility.review_count} reviews)</span>
              </div>
            )}
            <p className={styles.infoLine}>{facility.address}</p>
            <p className={styles.infoLine}>
              Open hours: {facility.open_hours} · {facility.courts_count} courts
            </p>
            <p className={styles.infoLine}>Contact: {facility.contact_phone}</p>

            <div className={styles.bookingActions}>
              <button
                type="button"
                className={styles.scrollScheduleBtn}
                onClick={() => scheduleRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                View schedule &amp; book
              </button>
              {canBook && <button type="button" className={styles.packageBookingBtn} onClick={handleGoPackageBooking}>
                Đặt sân nhiều buổi
              </button>}
            </div>
          </div>
        </section>

        <VenueSchedule key={id} id={id} facility={facility} scheduleRef={scheduleRef}
          openPackage={packagePrompt} onClosePackage={() => setPackagePrompt(false)} />

        <VenueInformation key={facility.facility_id} facility={facility} retryVenue={() => setReload((value) => value + 1)} />
      </main>
    </div>
  );
}
