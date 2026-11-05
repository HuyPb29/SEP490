import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createBookingPackageApi } from '../../api/bookingApi';
import styles from './MultiSessionBookingPage.module.css';

// Danh sách sân con và giá mỗi slot 30 phút (80,000 VND/slot)
const COURTS = [
  { id: 'Court 1', name: 'Court 1', slotPrice: 80000 },
  { id: 'Court 2', name: 'Court 2', slotPrice: 80000 },
  { id: 'Court 3', name: 'Court 3', slotPrice: 80000 },
  { id: 'Court 4', name: 'Court 4', slotPrice: 80000 },
  { id: 'Court 5', name: 'Court 5', slotPrice: 80000 },
];

const WEEKDAYS = [
  { code: 1, label: 'Mon' },
  { code: 2, label: 'Tue' },
  { code: 3, label: 'Wed' },
  { code: 4, label: 'Thu' },
  { code: 5, label: 'Fri' },
  { code: 6, label: 'Sat' },
  { code: 0, label: 'Sun' },
];

const TIME_OPTIONS = [
  { value: '17:00', label: '05:00 PM' },
  { value: '18:00', label: '06:00 PM' },
  { value: '19:00', label: '07:00 PM' },
  { value: '20:00', label: '08:00 PM' },
  { value: '21:00', label: '09:00 PM' },
  { value: '22:00', label: '10:00 PM' },
];

// BR50: Giả lập các slot đã có người đặt hoặc bảo trì trên Sân 3 khung 19:00 - 21:00 (12/11 và 24/11)
const INITIAL_CONFLICT_DAYS = [12, 24];

export default function MultiSessionBookingPage() {
  const navigate = useNavigate();

  // Chế độ đặt: 'recurring' (Định kỳ) | 'custom' (Tự chọn buổi)
  const [mode, setMode] = useState('recurring');

  // Form cấu hình bên trái
  const [selectedCourt, setSelectedCourt] = useState('Court 3');
  const [fromDate, setFromDate] = useState('2026-11-01');
  const [toDate, setToDate] = useState('2026-11-30');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([2, 4]); // Mặc định Thứ 3 (Tue) & Thứ 5 (Thu)
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [bookFor, setBookFor] = useState('Cau Giay Smashers');

  // Chế độ Tự chọn buổi (Custom Selection): lưu danh sách ngày trong tháng 11 được click chọn
  const [customSelectedDays, setCustomSelectedDays] = useState([3, 5, 10, 12, 17, 19, 24, 26]);

  // Lưu trạng thái xử lý xung đột: các ngày đã bỏ hoặc đã chọn slot bù
  const [removedDays, setRemovedDays] = useState([]);
  const [compensatedMap, setCompensatedMap] = useState({});

  // Modal chọn slot bù (Compensation Slot - BR50)
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [compensateCourt, setCompensateCourt] = useState('Court 2');
  const [compensateTimeRange, setCompensateTimeRange] = useState('19:00–21:00');

  // Thông báo lỗi / trạng thái nghiệp vụ
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tính số slot mỗi buổi (mỗi slot = 30 phút)
  const slotsPerSession = useMemo(() => {
    const [sh] = startTime.split(':').map(Number);
    const [eh] = endTime.split(':').map(Number);
    const diffHours = eh - sh;
    return diffHours > 0 ? diffHours * 2 : 0;
  }, [startTime, endTime]);

  const shortTimeBadge = useMemo(() => {
    const sh = Number(startTime.split(':')[0]);
    const eh = Number(endTime.split(':')[0]);
    return `${sh}–${eh}h`;
  }, [startTime, endTime]);

  // Kiểm tra khoảng thời gian Từ ngày - Đến ngày (BR27 / P18: 1 đến 3 tháng)
  const dateRangeValidationError = useMemo(() => {
    if (!fromDate || !toDate) return 'Please select both start and end dates.';
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);
    
    // VÁ LỖI ZERO-DAY: Bắt buộc ngày kết thúc phải lớn hơn ngày bắt đầu
    if (start.getTime() >= end.getTime()) {
      return 'End date must be strictly after start date.';
    }

    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (mode === 'recurring' && (diffDays < 28 || diffDays > 93)) {
      return 'MSG41: Recurring booking requires at least 1 session per week, with a duration from 1 to 3 months.';
    }
    if (mode === 'custom' && diffDays > 93) {
      return 'MSG91: Custom multi-session package requires at least 2 sessions within a maximum of 3 months.';
    }
    return '';
  }, [fromDate, toDate, mode]);

  // Sinh danh sách 30 ngày của Tháng 11/2026 (Ngày 01/11/2026 là Chủ Nhật)
  const novemberDays = useMemo(() => {
    const days = [];
    for (let d = 1; d <= 30; d += 1) {
      // 2026-11-01 là Chủ nhật (0), 2026-11-02 là Thứ hai (1)...
      const dayOfWeek = d % 7;
      const isSelectedByRule =
        mode === 'recurring'
          ? selectedDaysOfWeek.includes(dayOfWeek)
          : customSelectedDays.includes(d);

      const isRemoved = removedDays.includes(d);
      const isSelected = isSelectedByRule && !isRemoved;

      const compensation = compensatedMap[d];
      const hasRawConflict =
        selectedCourt === 'Court 3' &&
        startTime === '19:00' &&
        INITIAL_CONFLICT_DAYS.includes(d);

      const isConflicted = isSelected && hasRawConflict && !compensation;

      days.push({
        day: d,
        date: `2026-11-${String(d).padStart(2, '0')}`,
        display_date: `${String(d).padStart(2, '0')}/11`,
        dayOfWeek,
        isSelected,
        isConflicted,
        compensation,
        court_name: compensation ? compensation.court : selectedCourt,
        time_label: compensation ? compensation.timeRange : `${startTime} – ${endTime}`,
      });
    }
    return days;
  }, [
    mode,
    selectedDaysOfWeek,
    customSelectedDays,
    removedDays,
    compensatedMap,
    selectedCourt,
    startTime,
    endTime,
  ]);

  const selectedSessions = useMemo(
    () => novemberDays.filter((item) => item.isSelected),
    [novemberDays]
  );

  const conflictedSessions = useMemo(
    () => selectedSessions.filter((item) => item.isConflicted),
    [selectedSessions]
  );

  const validSessions = useMemo(
    () => selectedSessions.filter((item) => !item.isConflicted),
    [selectedSessions]
  );

  const slotUnitPrice = 80000;
  const totalPackageAmount = validSessions.length * slotsPerSession * slotUnitPrice;

  // BR47 / D152 / MSG93: Kiểm tra điều kiện nhận Voucher ưu đãi đặt theo lô (>= 1,000,000 VND)
  const bulkPromoThreshold = 1000000;
  const qualifiesForBulkPromo = totalPackageAmount >= bulkPromoThreshold;

  const handleToggleWeekday = (code) => {
    setErrorMessage('');
    setInfoMessage('');
    setRemovedDays([]);
    setSelectedDaysOfWeek((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleCalendarDayClick = (dayObj) => {
    setErrorMessage('');
    setInfoMessage('');

    if (mode === 'custom') {
      setCustomSelectedDays((prev) =>
        prev.includes(dayObj.day) ? prev.filter((d) => d !== dayObj.day) : [...prev, dayObj.day]
      );
      setRemovedDays((prev) => prev.filter((d) => d !== dayObj.day));
    }
  };

  // BR50 / MSG92: Bỏ tất cả buổi bị trùng (Kiểm tra điều kiện còn ít nhất 2 buổi hợp lệ)
  const handleRemoveAllConflicts = () => {
    setErrorMessage('');
    setInfoMessage('');

    if (validSessions.length < 2) {
      setErrorMessage(
        'MSG92: Package must have at least 2 sessions remaining. Please choose a compensation slot for conflicted sessions instead of removing.'
      );
      return;
    }

    const conflictDayNums = conflictedSessions.map((s) => s.day);
    setRemovedDays((prev) => [...new Set([...prev, ...conflictDayNums])]);
    setInfoMessage(
      `Removed ${conflictDayNums.length} conflicted session(s). ${validSessions.length} valid sessions remain.`
    );
  };

  // BR50: Áp dụng slot bù (Đổi sang sân khác hoặc giờ khác cho các buổi bị trùng)
  const handleApplyCompensationSlot = () => {
    setErrorMessage('');
    const nextMap = { ...compensatedMap };
    conflictedSessions.forEach((s) => {
      nextMap[s.day] = {
        court: compensateCourt,
        timeRange: compensateTimeRange,
      };
    });
    setCompensatedMap(nextMap);
    setShowCompensateModal(false);
    setInfoMessage(
      `Compensation slot (${compensateCourt}, ${compensateTimeRange}) applied to ${conflictedSessions.length} session(s). All sessions are now valid!`
    );
  };

  // UC15: Bấm Xác nhận lịch (Kiểm tra MSG41, MSG91, MSG44, MSG92 và giữ chỗ 15 phút P27)
  const handleConfirmSchedule = async () => {
    if (submitting) return;
    setErrorMessage('');
    setInfoMessage('');

    if (slotsPerSession <= 0) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    if (dateRangeValidationError) {
      setErrorMessage(dateRangeValidationError);
      return;
    }

    // BR27 / MSG41: Đặt định kỳ cần ít nhất 1 buổi/tuần
    if (mode === 'recurring' && selectedDaysOfWeek.length === 0) {
      setErrorMessage(
        'MSG41: Recurring booking requires at least 1 session per week, with a duration from 1 to 3 months.'
      );
      return;
    }

    // MSG91: Đặt tự chọn cần tối thiểu 2 buổi
    if (mode === 'custom' && selectedSessions.length < 2) {
      setErrorMessage(
        'MSG91: Custom multi-session package requires at least 2 sessions within a maximum of 3 months.'
      );
      return;
    }

    // BR50 / MSG44: Chặn nếu còn buổi trùng chưa xử lý
    if (conflictedSessions.length > 0) {
      const listStr = conflictedSessions.map((s) => s.display_date).join(' and ');
      setErrorMessage(
        `MSG44: You have ${conflictedSessions.length} conflicted session(s) on ${listStr} (${startTime} – ${endTime} on ${selectedCourt}). Please click "Choose Compensation Slot" or "Remove All Conflicts" before confirming.`
      );
      return;
    }

    // BR27 / MSG92: Bắt buộc còn tối thiểu 2 buổi hợp lệ
    if (validSessions.length < 2) {
      setErrorMessage(
        'MSG92: Package must have at least 2 sessions remaining. Please choose a compensation slot instead of removing.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBookingPackageApi({
        facility_id: 1,
        facility_name: 'Smash Arena',
        mode,
        court_name: selectedCourt,
        from_date: fromDate,
        to_date: toDate,
        start_time: startTime,
        end_time: endTime,
        slots_per_session: slotsPerSession,
        booker_label: bookFor,
        total_amount: totalPackageAmount,
        sessions: selectedSessions.map((s) => ({
          date: s.date,
          display_date: s.display_date,
          court_name: s.court_name,
          time_label: s.time_label,
          is_conflicted: s.isConflicted,
        })),
      });

      if (res?.success) {
        // BR53 / P27: Lưu mốc giữ chỗ 15 phút vào sessionStorage và chuyển sang màn Thanh toán UC18
        sessionStorage.setItem('active_holding_booking', JSON.stringify(res.data));
        navigate('/booking/payment');
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Could not confirm package schedule.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Tháng 11/2026 bắt đầu vào Chủ Nhật -> Cần 6 ô trống đầu tuần (Mon -> Sat)
  const leadingEmptyCells = [1, 2, 3, 4, 5, 6];

  return (
    <div className={styles.pageWrapper}>
      {/* Top Navbar (Thương hiệu BMS) */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand} onClick={() => navigate('/')}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>BMS</span>
          </div>

          <nav className={styles.navLinks}>
            <Link to="/" className={styles.activeLink}>
              Find Courts
            </Link>
            <a href="#matches">Open Matches</a>
            <Link to="/my-bookings">My Bookings</Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>MA</span>
            <span className={styles.userName}>Minh Anh</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        <h1 className={styles.pageTitle}>Book Multiple Sessions · Smash Arena</h1>

        <div className={styles.layoutGrid}>
          {/* CỘT TRÁI: Cấu hình Định kỳ / Tự chọn buổi (BR27, P18) */}
          <aside className={styles.configCard}>
            <div className={styles.modeSwitch} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'recurring'}
                className={`${styles.modeTab} ${mode === 'recurring' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('recurring');
                  setErrorMessage('');
                }}
              >
                Recurring
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'custom'}
                className={`${styles.modeTab} ${mode === 'custom' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('custom');
                  setErrorMessage('');
                }}
              >
                Custom Selection
              </button>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Court</label>
              <select
                className={styles.selectInput}
                value={selectedCourt}
                onChange={(e) => {
                  setSelectedCourt(e.target.value);
                  setRemovedDays([]);
                  setCompensatedMap({});
                }}
              >
                {COURTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>From date</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>To date</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {mode === 'recurring' ? (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Days of week</label>
                <div className={styles.weekdayRow}>
                  {WEEKDAYS.map((day) => {
                    const active = selectedDaysOfWeek.includes(day.code);
                    return (
                      <button
                        key={day.code}
                        type="button"
                        className={`${styles.weekdayBtn} ${
                          active ? styles.weekdayBtnActive : ''
                        }`}
                        onClick={() => handleToggleWeekday(day.code)}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.customModeHint}>
                Click directly on any date in the November 2026 calendar to select or deselect
                custom sessions (minimum 2 sessions).
              </div>
            )}

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Start time</label>
                <select
                  className={styles.selectInput}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                >
                  {TIME_OPTIONS.slice(0, 5).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>End time</label>
                <select
                  className={styles.selectInput}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                >
                  {TIME_OPTIONS.slice(1).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Book for</label>
              <select
                className={styles.selectInput}
                value={bookFor}
                onChange={(e) => setBookFor(e.target.value)}
              >
                <option value="Cau Giay Smashers">Team Cau Giay Smashers</option>
                <option value="FPT Badminton">Team FPT Badminton</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            <p className={styles.ruleHintText}>
              Recurring: at least 1 session/week, from 1 to 3 months.
            </p>
          </aside>

          {/* CỘT PHẢI: Banner ưu đãi lô + Lịch toàn kỳ + Xử lý trùng + Chốt lịch */}
          <div className={styles.rightColumn}>
            {/* BR47 / D152 / MSG93: Thông báo ưu đãi đặt theo lô (Tặng voucher sau khi thanh toán) */}
            <div className={styles.promoBanner}>
              <span>
                Bulk booking promo: packages from 1,000,000 VND receive a 100,000 VND voucher
              </span>
              <strong className={styles.promoStatus}>
                {qualifiesForBulkPromo
                  ? 'Your package qualifies for the reward'
                  : `${(bulkPromoThreshold - totalPackageAmount).toLocaleString('vi-VN')} VND more to qualify`}
              </strong>
            </div>

            {/* Khung Lịch Tháng 11/2026 (MSG43) */}
            <section className={styles.calendarCard}>
              <div className={styles.calendarHeader}>
                <h2 className={styles.monthTitle}>November 2026</h2>
                <div className={styles.legendGroup}>
                  <span className={styles.legendItem}>
                    <span className={styles.dotSelected} />
                    Selected · {selectedSessions.length}
                  </span>
                  <span className={styles.legendItem}>
                    <span className={styles.dotConflicted} />
                    Conflicted · {conflictedSessions.length}
                  </span>
                </div>
              </div>

              <div className={styles.weekdayHeaderGrid}>
                {WEEKDAYS.map((w) => (
                  <span key={w.code} className={styles.weekdayHeaderCell}>
                    {w.label}
                  </span>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {leadingEmptyCells.map((item) => (
                  <div key={`empty-${item}`} className={styles.emptyDayCell} />
                ))}

                {novemberDays.map((dayObj) => {
                  let cellClass = styles.dayCell;
                  if (dayObj.isConflicted) {
                    cellClass = `${styles.dayCell} ${styles.dayCellConflicted}`;
                  } else if (dayObj.isSelected) {
                    cellClass = `${styles.dayCell} ${styles.dayCellSelected}`;
                  }

                  return (
                    <div
                      key={dayObj.day}
                      role="button"
                      tabIndex={0}
                      className={cellClass}
                      onClick={() => handleCalendarDayClick(dayObj)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleCalendarDayClick(dayObj);
                      }}
                    >
                      <strong className={styles.dayNumber}>{dayObj.day}</strong>
                      {dayObj.isConflicted && (
                        <span className={styles.conflictTag}>Conflicted</span>
                      )}
                      {dayObj.isSelected && !dayObj.isConflicted && (
                        <span className={styles.timeSubTag}>
                          {dayObj.compensation ? `${dayObj.compensation.court}` : shortTimeBadge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* BR50: Khối xử lý các buổi bị trùng (Chọn slot bù hoặc Bỏ tất cả buổi trùng) */}
              {conflictedSessions.length > 0 && (
                <div className={styles.conflictResolutionBox}>
                  <strong className={styles.conflictBoxTitle}>
                    {conflictedSessions.length} conflicted session(s):{' '}
                    {conflictedSessions.map((s) => s.display_date).join(' and ')} ({startTime} –{' '}
                    {endTime} already booked)
                  </strong>
                  <div className={styles.conflictActionRow}>
                    <button
                      type="button"
                      className={styles.compensateBtn}
                      onClick={() => setShowCompensateModal(true)}
                    >
                      Choose Compensation Slot
                    </button>
                    <button
                      type="button"
                      className={styles.removeConflictsBtn}
                      onClick={handleRemoveAllConflicts}
                    >
                      Remove All Conflicts
                    </button>
                  </div>
                </div>
              )}

              {infoMessage && <div className={styles.infoAlert}>{infoMessage}</div>}
              {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}
            </section>

            {/* Thanh tổng kết tiền gói & Nút Xác nhận lịch (BR53, P27 = 15 phút) */}
            <section className={styles.summaryFooterCard}>
              <div className={styles.summaryLeft}>
                <span className={styles.formulaText}>
                  {validSessions.length} valid sessions × {slotsPerSession} slots ×{' '}
                  {slotUnitPrice.toLocaleString('vi-VN')} VND
                </span>
                <strong className={styles.totalPriceText}>
                  {totalPackageAmount.toLocaleString('vi-VN')} VND
                </strong>
                <span className={styles.holdNoteText}>
                  One-time payment. After confirming the schedule, the package is held for 15
                  minutes.
                </span>
              </div>

              <button
                type="button"
                className={styles.confirmScheduleBtn}
                disabled={submitting || validSessions.length < 2}
                onClick={handleConfirmSchedule}
              >
                {submitting ? 'Confirming...' : 'Confirm Schedule'}
              </button>
            </section>
          </div>
        </div>
      </main>

      {/* Modal Chọn slot bù cho các buổi bị trùng (BR50) */}
      {showCompensateModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Choose Compensation Slot (BR50)</h3>
            <p className={styles.modalSub}>
              Select an alternative court or time slot for conflicted date(s):{' '}
              <strong>{conflictedSessions.map((s) => s.display_date).join(', ')}</strong>.
            </p>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Alternative Court</label>
              <select
                className={styles.selectInput}
                value={compensateCourt}
                onChange={(e) => setCompensateCourt(e.target.value)}
              >
                <option value="Court 1">Court 1 (Available)</option>
                <option value="Court 2">Court 2 (Available)</option>
                <option value="Court 4">Court 4 (Available)</option>
                <option value="Court 5">Court 5 (Available)</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Alternative Time Slot</label>
              <select
                className={styles.selectInput}
                value={compensateTimeRange}
                onChange={(e) => setCompensateTimeRange(e.target.value)}
              >
                <option value="19:00–21:00">19:00 – 21:00 (Same time, different court)</option>
                <option value="17:00–19:00">17:00 – 19:00 (Earlier slot)</option>
                <option value="20:00–22:00">20:00 – 22:00 (Later slot)</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.removeConflictsBtn}
                onClick={() => setShowCompensateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmScheduleBtn}
                onClick={handleApplyCompensationSlot}
              >
                Apply Compensation Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}