import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { getLocationDetailAndSchedule } from '../../api/locationApi';
import BookingModeSelector from '../../components/booking/BookingModeSelector';
import CourtScheduleGrid from '../../components/booking/CourtScheduleGrid';
import BookingSelectionSummary from '../../components/booking/BookingSelectionSummary';
import styles from './LocationDetailPage.module.css';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getThreeMonthLimit() {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  return localDateKey(maxDate);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function groupSlotsIntoSessions(slots) {
  const ordered = [...slots].sort((a, b) => (
    a.date.localeCompare(b.date) || Number(a.courtId) - Number(b.courtId) || a.timeIdx - b.timeIdx
  ));
  const sessions = [];
  ordered.forEach((slot) => {
    const previous = sessions[sessions.length - 1];
    const startMinute = toMinutes(slot.time);
    if (previous && previous.date === slot.date && previous.courtId === slot.courtId && previous.endMinute === startMinute) {
      previous.endMinute += 30;
    } else {
      sessions.push({
        date: slot.date,
        courtId: slot.courtId,
        startMinute,
        endMinute: startMinute + 30,
      });
    }
  });
  return sessions;
}

export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const scheduleRef = useRef(null);

  const [playDate, setPlayDate] = useState(
    () => location.state?.playDate || new Date().toISOString().split('T')[0]
  );
  const [mode, setMode] = useState(() => location.state?.bookingMode || (
    location.pathname.endsWith('/package-booking') ? 'custom' : 'single'
  ));
  const [packageStartDate, setPackageStartDate] = useState(() => location.state?.playDate || localDateKey(new Date()));
  const [packageEndDate, setPackageEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return localDateKey(date);
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 3]);
  const [facility, setFacility] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [timeHeaders, setTimeHeaders] = useState([]);
  const [courts, setCourts] = useState([]);

  // Type: [{ courtId, courtName, timeIdx, time, price }]
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [ruleMessage, setRuleMessage] = useState('Select available slots to build your booking.');

  useEffect(() => {
    const loadData = async () => {
      const res = await getLocationDetailAndSchedule(Number(id) || 1, playDate);
      if (res?.success) {
        setLoadError('');
        setFacility(res.data.facility);
        setTimeHeaders(res.data.time_headers);
        setCourts(res.data.courts);

        setSelectedSlots((current) => {
          if (current.length || mode !== 'single') return current;
          const initialSelected = [];
          res.data.courts.forEach((court) => {
            court.slots.forEach((slot, idx) => {
              if (slot.defaultSelected && slot.status === 'available') {
                initialSelected.push({
                  date: playDate,
                  courtId: court.court_id,
                  courtName: court.court_name,
                  timeIdx: idx,
                  time: slot.time,
                  price: slot.price,
                });
              }
            });
          });
          return initialSelected;
        });
      } else {
        setFacility(null);
        setLoadError(res?.error || 'Could not load location details.');
      }
    };
    loadData();
  }, [id, playDate, mode]);

  // UC13: Xử lý chọn/bỏ chọn slot (Yêu cầu liền kề trên cùng 1 sân)
  const handleToggleSlot = (court, slot, timeIdx) => {
    if (slot.status !== 'available') return;

    const isAlreadySelected = selectedSlots.some(
      (s) => s.courtId === court.court_id && s.timeIdx === timeIdx && (mode === 'recurring' || s.date === playDate)
    );

    if (isAlreadySelected) {
      setSelectedSlots(selectedSlots.filter((s) => !(
        s.courtId === court.court_id && s.timeIdx === timeIdx && (mode === 'recurring' || s.date === playDate)
      )));
      setRuleMessage('Select available slots to build your booking.');
      return;
    }

    if (mode === 'single' && selectedSlots.some((selected) => selected.date !== playDate)) {
      setRuleMessage('MSG30: Các slot phải liền nhau trên cùng một sân (trong cùng một ngày).');
      return;
    }

    if (mode === 'recurring' && selectedSlots.some((selected) => selected.courtId !== court.court_id)) {
      setRuleMessage('Recurring sessions must use the same court.');
      return;
    }

    if (mode === 'recurring' && selectedSlots.some((selected) => selected.date !== playDate)) {
      setRuleMessage('Choose recurring time ranges from one schedule date.');
      return;
    }

    setSelectedSlots([...selectedSlots, {
      date: playDate,
      courtId: court.court_id,
      courtName: court.court_name,
      timeIdx,
      time: slot.time,
      price: slot.price,
    }]);
    setRuleMessage('Select available slots to build your booking.');
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSelectedSlots([]);
    setRuleMessage('Select available slots to build your booking.');
    setPackageStartDate(playDate);
  };

  // Đã vá lỗi múi giờ UTC bằng .toLocaleDateString('en-CA')
  const changeDay = (offset) => {
    const [y, m, day] = playDate.split('-').map(Number);
    const d = new Date(y, m - 1, day + offset);
    setPlayDate(d.toLocaleDateString('en-CA'));
  };

  const formatDateLabel = (dateStr) => {
    const [y, m, day] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[d.getDay()]}, ${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}/${y}`;
  };

  const visibleSelectedSlots = mode === 'recurring'
    ? selectedSlots
    : selectedSlots.filter((slot) => mode !== 'single' || slot.date === playDate);
  const totalPrice = visibleSelectedSlots.reduce((sum, slot) => sum + slot.price, 0);

  const handleProceedBooking = () => {
    if (selectedSlots.length === 0) return;
    let packagePayload = null;
    if (mode === 'single') {
      if (selectedSlots.some((slot) => slot.date !== playDate)) {
        setRuleMessage('MSG30: Các slot phải liền nhau trên cùng một sân (trong cùng một ngày).');
        return;
      }
    } else if (mode === 'custom') {
      const sessions = groupSlotsIntoSessions(selectedSlots);
      const uniqueDays = new Set(sessions.map((session) => session.date));
      if (sessions.length < 2) {
        setRuleMessage('MSG91: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.');
        return;
      }
      if (uniqueDays.size < 2) {
        setRuleMessage('MSG92: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.');
        return;
      }
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      const latestDate = localDateKey(maxDate);
      if (sessions.some((session) => session.date > latestDate)) {
        setRuleMessage('MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.');
        return;
      }
      packagePayload = {
        packageType: 'CUSTOM',
        courtId: sessions[0].courtId,
        sessions,
      };
    } else {
      if (selectedWeekdays.length === 0) {
        setRuleMessage('Select at least one weekday for recurring booking.');
        return;
      }
      if (packageEndDate < packageStartDate) {
        setRuleMessage('The recurring end date must be on or after the start date.');
        return;
      }
      if (packageEndDate > getThreeMonthLimit()) {
        setRuleMessage('MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.');
        return;
      }
      const sessions = groupSlotsIntoSessions(selectedSlots.filter((slot) => slot.date === selectedSlots[0].date));
      packagePayload = {
        packageType: 'RECURRING',
        courtId: sessions[0].courtId,
        startDate: packageStartDate,
        endDate: packageEndDate,
        weeklySlots: sessions.flatMap((session) => selectedWeekdays.map((day) => ({
          dayOfWeek: day === 0 ? 7 : day,
          startMinute: session.startMinute,
          endMinute: session.endMinute,
        }))),
      };
    }
    sessionStorage.setItem(
      'pending_booking_selection',
      JSON.stringify({ mode, facility, playDate, selectedSlots, totalPrice, packagePayload })
    );
    navigate('/booking/summary');
  };

  if (!facility) {
    if (loadError) {
      return (
        <div className={styles.loadingScreen}>
          <p>Failed to load location details: {loadError}</p>
          <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
            Back to search
          </button>
        </div>
      );
    }
    return <div className={styles.loadingScreen}>Loading location details...</div>;
  }

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
                onClick={() => {
                  handleModeChange('single');
                  scheduleRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View schedule &amp; book
              </button>
              <button
                type="button"
                className={styles.packageBookingBtn}
                onClick={() => {
                  handleModeChange('custom');
                  scheduleRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Custom Multi-Session
              </button>
            </div>
          </div>
        </section>

        <BookingModeSelector mode={mode} onChange={handleModeChange} styles={styles} />

        {/* UC13: Shared court schedule for all booking modes. */}
        <section ref={scheduleRef} className={styles.scheduleCard}>
          <div className={styles.scheduleHeader}>
            <h2 className={styles.sectionTitle}>Court Schedule</h2>
            <div className={styles.dateControls}>
              <button type="button" className={styles.navArrowBtn} onClick={() => changeDay(-1)}>‹</button>
              <span className={styles.dateDisplay}>{formatDateLabel(playDate)}</span>
              <button type="button" className={styles.navArrowBtn} onClick={() => changeDay(1)}>›</button>
              {mode === 'recurring' ? (
                <>
                  <input type="date" aria-label="Recurring start date" className={styles.dateInput} value={packageStartDate} max={getThreeMonthLimit()} onChange={(e) => setPackageStartDate(e.target.value)} />
                  <input type="date" aria-label="Recurring end date" className={styles.dateInput} value={packageEndDate} min={packageStartDate} max={getThreeMonthLimit()} onChange={(e) => setPackageEndDate(e.target.value)} />
                </>
              ) : (
                <input type="date" className={styles.dateInput} value={playDate} max={getThreeMonthLimit()} onChange={(e) => setPlayDate(e.target.value)} />
              )}
            </div>
          </div>

          {(mode === 'custom' || mode === 'recurring') && (
            <div className={styles.packageModeControls}>
              {mode === 'custom' ? (
                <p className={styles.packageModeHint}>Choose a date above, then select session ranges. Your selections remain saved as you move between dates.</p>
              ) : (
                <div className={styles.weekdayPicker} aria-label="Recurring weekdays">
                  <span>Repeat on</span>
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={selectedWeekdays.includes(day.value)}
                      className={`${styles.weekdayButton} ${selectedWeekdays.includes(day.value) ? styles.weekdayButtonActive : ''}`}
                      onClick={() => setSelectedWeekdays((days) => days.includes(day.value)
                        ? days.filter((value) => value !== day.value)
                        : [...days, day.value])}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.legendRow}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBox} ${styles.boxAvailable}`} /> Available
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBox} ${styles.boxSelected}`} /> Selected
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBox} ${styles.boxHolding}`} /> Holding
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBox} ${styles.boxBooked}`} /> Booked
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBox} ${styles.boxMaintenance}`} /> Maintenance
            </span>
          </div>

          <CourtScheduleGrid
            courts={courts}
            timeHeaders={timeHeaders}
            selectedSlots={selectedSlots}
            playDate={playDate}
            mode={mode}
            onToggleSlot={handleToggleSlot}
            styles={styles}
          />
          <BookingSelectionSummary
            count={visibleSelectedSlots.length}
            totalPrice={totalPrice}
            message={ruleMessage}
            disabled={visibleSelectedSlots.length === 0}
            onContinue={handleProceedBooking}
            styles={styles}
          />
        </section>

        <section className={styles.bottomGrid}>
          <div className={styles.bottomCard}>
            <h2 className={styles.sectionTitle}>Price Table</h2>
            <table className={styles.priceTable}>
              <thead>
                <tr>
                  <th>Time Range</th>
                  <th>Mon – Fri</th>
                  <th>Sat, Sun</th>
                </tr>
              </thead>
              <tbody>
                {facility.price_table.map((row) => (
                  <tr key={row.time_range}>
                    <td>{row.time_range}</td>
                    <td>{row.weekday_price}</td>
                    <td>{row.weekend_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.bottomCard}>
            <h2 className={styles.sectionTitle}>Reviews</h2>
            <div className={styles.reviewList}>
              {facility.reviews.map((rev) => (
                <div key={rev.review_id} className={styles.reviewItem}>
                  <div className={styles.reviewerHeader}>
                    <strong>{rev.reviewer_name}</strong> ·{' '}
                    <span className={styles.stars}>
                      {'★'.repeat(rev.stars)}{'☆'.repeat(5 - rev.stars)}
                    </span>
                  </div>
                  <p className={styles.reviewComment}>{rev.comment}</p>
                  {rev.owner_reply && (
                    <div className={styles.ownerReplyBox}>{rev.owner_reply}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}