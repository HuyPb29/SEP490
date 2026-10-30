import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFacilityDetailAndSchedule } from '../../api/facilityApi';
import styles from './FacilityDetailPage.module.css';

export default function FacilityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scheduleRef = useRef(null);

  const [playDate, setPlayDate] = useState('2026-10-24');
  const [facility, setFacility] = useState(null);
  const [timeHeaders, setTimeHeaders] = useState([]);
  const [courts, setCourts] = useState([]);
  
  // Type: [{ courtId, courtName, timeIdx, time, price }]
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [ruleMessage, setRuleMessage] = useState(
    'You can only select consecutive available slots on the same court. Each slot is 30 minutes.'
  );

  useEffect(() => {
    const loadData = async () => {
      const res = await getFacilityDetailAndSchedule(Number(id) || 1, playDate);
      if (res?.success) {
        setFacility(res.data.facility);
        setTimeHeaders(res.data.time_headers);
        setCourts(res.data.courts);

        // Mockup: Khởi tạo sẵn các slot default theo thiết kế
        const initialSelected = [];
        res.data.courts.forEach((court) => {
          court.slots.forEach((slot, idx) => {
            if (slot.defaultSelected && slot.status === 'available') {
              initialSelected.push({
                courtId: court.court_id,
                courtName: court.court_name,
                timeIdx: idx,
                time: slot.time,
                price: slot.price,
              });
            }
          });
        });
        setSelectedSlots(initialSelected);
      }
    };
    loadData();
  }, [id, playDate]);

  // UC13: Xử lý chọn/bỏ chọn slot (Yêu cầu liền kề trên cùng 1 sân)
  const handleToggleSlot = (court, slot, timeIdx) => {
    if (slot.status !== 'available') return;

    const isAlreadySelected = selectedSlots.some(
      (s) => s.courtId === court.court_id && s.timeIdx === timeIdx
    );

    if (isAlreadySelected) {
      const indices = selectedSlots.map((s) => s.timeIdx).sort((a, b) => a - b);
      const minIdx = indices[0];
      const maxIdx = indices[indices.length - 1];

      // Chỉ cho bỏ chọn ở 2 đầu mút để không làm đứt đoạn giữa
      if (timeIdx === minIdx || timeIdx === maxIdx) {
        setSelectedSlots(selectedSlots.filter((s) => s.timeIdx !== timeIdx));
        setRuleMessage('You can only select consecutive available slots on the same court. Each slot is 30 minutes.');
      } else {
        setRuleMessage('⚠️ Please deselect from the outermost slot to keep the slots consecutive!');
      }
      return;
    }

    if (selectedSlots.length > 0 && selectedSlots[0].courtId !== court.court_id) {
      setSelectedSlots([
        {
          courtId: court.court_id,
          courtName: court.court_name,
          timeIdx,
          time: slot.time,
          price: slot.price,
        },
      ]);
      setRuleMessage(`Selection changed to ${court.court_name} (booking restricted to a single court).`);
      return;
    }

    // Kiểm tra tính liền kề (Adjacent slots)
    if (selectedSlots.length > 0) {
      const indices = selectedSlots.map((s) => s.timeIdx).sort((a, b) => a - b);
      const minIdx = indices[0];
      const maxIdx = indices[indices.length - 1];

      if (timeIdx !== minIdx - 1 && timeIdx !== maxIdx + 1) {
        setRuleMessage('⚠️ You can only select consecutive available slots on the same court!');
        return;
      }
    }

    const updated = [
      ...selectedSlots,
      {
        courtId: court.court_id,
        courtName: court.court_name,
        timeIdx,
        time: slot.time,
        price: slot.price,
      },
    ].sort((a, b) => a.timeIdx - b.timeIdx);

    setSelectedSlots(updated);
    setRuleMessage('You can only select consecutive available slots on the same court. Each slot is 30 minutes.');
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

  const totalPrice = selectedSlots.reduce((sum, s) => sum + s.price, 0);

  const handleProceedBooking = () => {
    if (selectedSlots.length === 0) return;
    sessionStorage.setItem(
      'pending_booking_selection',
      JSON.stringify({ facility, playDate, selectedSlots, totalPrice })
    );
    navigate('/booking/summary');
  };

  if (!facility) {
    return <div className={styles.loadingScreen}>Loading facility details...</div>;
  }

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand} onClick={() => navigate('/')}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>BMS</span>
          </div>
          <nav className={styles.navLinks}>
            <Link to="/" className={styles.activeLink}>Find Court</Link>
            <a href="#matches">Open Matches</a>
            <a href="#my-bookings">My Bookings</a>
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
            <div className={styles.ratingRow}>
              <span className={styles.starIcon}>★</span>
              <strong>{String(facility.rating).replace(',', '.')}</strong>
              <span className={styles.reviewCount}>({facility.review_count} reviews)</span>
            </div>
            <p className={styles.infoLine}>{facility.address}</p>
            <p className={styles.infoLine}>
              Open hours: {facility.open_hours} · {facility.courts_count} courts
            </p>
            <p className={styles.infoLine}>Contact: {facility.contact_phone}</p>

            <button
              type="button"
              className={styles.scrollScheduleBtn}
              onClick={() => scheduleRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              View schedule & book
            </button>
          </div>
        </section>

        {/* UC13: Lịch sân */}
        <section ref={scheduleRef} className={styles.scheduleCard}>
          <div className={styles.scheduleHeader}>
            <h2 className={styles.sectionTitle}>Court Schedule</h2>
            <div className={styles.dateControls}>
              <button type="button" className={styles.navArrowBtn} onClick={() => changeDay(-1)}>‹</button>
              <span className={styles.dateDisplay}>{formatDateLabel(playDate)}</span>
              <button type="button" className={styles.navArrowBtn} onClick={() => changeDay(1)}>›</button>
              <input
                type="date"
                className={styles.dateInput}
                value={playDate}
                onChange={(e) => setPlayDate(e.target.value)}
              />
            </div>
          </div>

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

          <div className={styles.tableWrapper}>
            <table className={styles.scheduleTable}>
              <thead>
                <tr>
                  <th className={styles.courtColHeader}>Court</th>
                  {timeHeaders.map((time) => (
                    <th key={time}>{time}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.court_id}>
                    <td className={styles.courtNameCell}>{court.court_name}</td>
                    {court.slots.map((slot, idx) => {
                      const isSelected = selectedSlots.some(
                        (s) => s.courtId === court.court_id && s.timeIdx === idx
                      );

                      let btnClass = styles.slotAvailable;
                      let label = `${slot.price / 1000}k`;

                      if (isSelected) {
                        btnClass = styles.slotSelected;
                        label = 'Selected';
                      } else if (slot.status === 'booked') {
                        btnClass = styles.slotBooked;
                        label = 'Booked';
                      } else if (slot.status === 'holding') {
                        btnClass = styles.slotHolding;
                        label = 'Holding';
                      } else if (slot.status === 'maintenance') {
                        btnClass = styles.slotMaintenance;
                        label = 'Maint.';
                      }

                      return (
                        <td key={slot.time}>
                          <button
                            type="button"
                            className={`${styles.slotBtn} ${btnClass}`}
                            disabled={slot.status !== 'available'}
                            onClick={() => handleToggleSlot(court, slot, idx)}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.summaryBar}>
            <div>
              <div className={styles.summaryMainText}>
                {selectedSlots.length} slots selected · {totalPrice.toLocaleString('en-US')} VND
              </div>
              <div className={styles.summarySubText}>{ruleMessage}</div>
            </div>
            <button
              type="button"
              className={styles.continueBookingBtn}
              disabled={selectedSlots.length === 0}
              onClick={handleProceedBooking}
            >
              Proceed to book
            </button>
          </div>
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