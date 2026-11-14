import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { toMinutes, toTimeLabel } from '../../api/bookingApi';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { ConfirmDialog } from '../../components/common/WorkspacePrimitives';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import { formatVnd, today as getTodayStr } from '../../utils/formatters';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, pointInputError } from '../../utils/checkoutPoints';
import { usePackagePreview } from '../../hooks/usePackagePreview';
import styles from './MultiSessionBookingPage.module.css';

// value theo Date.getDay() (CN = 0); backend dùng 1 = Thứ 2 … 7 = Chủ nhật
const WEEKDAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// Mốc 30 phút từ 05:00 đến 24:00; giờ mở cửa thật do backend kiểm (buổi ngoài giờ bị đánh dấu trùng)
const TIMES = Array.from({ length: 39 }, (_, index) => toTimeLabel(300 + index * 30));

const CONFLICT_LABELS = {
  TAKEN: 'Đã có người đặt',
  MAINTENANCE: 'Đang bảo trì',
  CLOSED: 'Ngoài giờ mở cửa',
  STARTED: 'Đã qua giờ bắt đầu',
};

const toDateKey = (date) => date.toLocaleDateString('en-CA');
const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addMonths = (dateKey, months, minusDays = 0) => {
  const date = parseDateKey(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + months, date.getDate() - minusDays));
};
const formatCurrency = formatVnd;
const sessionKey = (session) => `${session.date}|${session.courtId}|${session.startMinute}`;

const TODAY_DATE = getTodayStr();
const MAX_ALLOWED_DATE = addMonths(TODAY_DATE, 3, 0);

export default function MultiSessionBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const {
    getLocationCourts,
    getMyOwnedTeams,
    getCheckoutVouchers,
    getMyPointsAtFacility,
    previewBookingPackage,
    createBookingPackage,
  } = useBookingActions();

  const facilityId = Number(id || location.state?.facilityId) || null;
  const facilityName = location.state?.facilityName || '';

  const today = TODAY_DATE;
  const maxAllowedDate = MAX_ALLOWED_DATE;

  const [courts, setCourts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myVouchers, setMyVouchers] = useState([]);
  const [availablePoints, setAvailablePoints] = useState(0);

  const [mode, setMode] = useState('recurring');
  const [courtId, setCourtId] = useState(null);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(() => addMonths(today, 1, 1));
  const [selectedWeekdays, setSelectedWeekdays] = useState([2, 4]);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [teamId, setTeamId] = useState('');
  const [note, setNote] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [selectedGrantId, setSelectedGrantId] = useState(null);
  const [pointsToUse, setPointsToUse] = useState(0);

  const [customSessions, setCustomSessions] = useState([]);
  const [sessionDate, setSessionDate] = useState(today);
  const [weekdayTimes, setWeekdayTimes] = useState({});
  const customDates = useMemo(() => [...new Set(customSessions.map((session) => session.date))], [customSessions]);
  // Xử lý buổi trùng (BR50): buổi bỏ và buổi đổi sang slot bù, theo khóa của buổi gốc
  const [removedKeys, setRemovedKeys] = useState([]);
  const [replacements, setReplacements] = useState({});
  const [showCompensation, setShowCompensation] = useState(false);
  const [compensationCourtId, setCompensationCourtId] = useState(null);
  const [compensationTime, setCompensationTime] = useState('19:00');
  const [compensationDate, setCompensationDate] = useState('');
  const [compensationTargetKey, setCompensationTargetKey] = useState('ALL');

  const [viewMonth, setViewMonth] = useState(() => parseDateKey(today));
  const [revision, setRevision] = useState(0);
  const [previewError, setPreviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [rewardSubmitError, setRewardSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmPoints, setConfirmPoints] = useState(false);

  useEffect(() => {
    if (!facilityId) return;
    Promise.all([
      getLocationCourts(facilityId),
      getMyOwnedTeams().catch(() => []),
      getCheckoutVouchers(facilityId).catch(() => ({ publicVouchers: [], grants: [] })),
      getMyPointsAtFacility(facilityId).catch(() => 0),
    ])
      .then(([courtList, teamList, voucherData, pointBalance]) => {
        setCourts(courtList);
        setCourtId((current) => current ?? courtList[0]?.court_id ?? null);
        setTeams(Array.isArray(teamList) ? teamList : (teamList?.data || []));
        const grants = (voucherData?.grants || []).map((g) => ({
          grant_id: g.grantId,
          code: g.voucher?.code,
          name: g.voucher?.name,
          end_date: g.expiresAt || g.voucher?.validTo || '',
        }));
        setMyVouchers(grants);
        setAvailablePoints(Number(pointBalance || 0));
      })
      .catch((err) => setPreviewError(apiErrorMessage(err, 'Không tải được danh sách sân.')));
  }, [facilityId, getLocationCourts, getMyOwnedTeams, getCheckoutVouchers, getMyPointsAtFacility]);

  const startMinute = toMinutes(startTime);
  const endMinute = toMinutes(endTime);

  const resetConflictAdjustments = () => {
    setRemovedKeys([]);
    setReplacements({});
  };

  // UC15 #2, #3: PackageRequest theo mẫu Player nhập (chưa xử lý buổi trùng)
  const baseRequest = useMemo(() => {
    if (!courtId || endMinute <= startMinute) return null;
    const common = {
      courtId,
      startDate: fromDate,
      endDate: toDate,
      teamId: teamId ? Number(teamId) : null,
      voucherCode: voucherCode.trim() || null,
      voucherGrantId: selectedGrantId || null,
      pointsToUse: Number(pointsToUse) > 0 ? Number(pointsToUse) : 0,
      note: note.trim() || null,
    };
    if (mode === 'recurring') {
      if (selectedWeekdays.length === 0) return null;
      return {
        ...common,
        packageType: 'RECURRING',
        weeklySlots: selectedWeekdays.map((day) => ({ dayOfWeek: day === 0 ? 7 : day, startMinute, endMinute, ...weekdayTimes[day] })),
      };
    }
    if (customSessions.length === 0) return null;
    const dates = customSessions.map((session) => session.date).sort();
    return { ...common, startDate: dates[0], endDate: dates.at(-1),
      packageType: 'CUSTOM', sessions: customSessions };
  }, [
    courtId,
    fromDate,
    toDate,
    teamId,
    voucherCode,
    selectedGrantId,
    pointsToUse,
    note,
    mode,
    selectedWeekdays, weekdayTimes,
    customSessions,
    startMinute,
    endMinute,
  ]);

  const baseResult = usePackagePreview(baseRequest, previewBookingPackage, revision);
  const activeBasePreview = baseResult?.data;
  const hasAdjustments = removedKeys.length > 0 || Object.keys(replacements).length > 0;

  // Danh sách buổi gửi backend sau khi bỏ buổi trùng hoặc chọn slot bù (UC15 #5)
  const adjustedRequest = useMemo(() => {
    if (!baseRequest || !activeBasePreview || !hasAdjustments) return null;
    const sessions = activeBasePreview.sessions
      .filter((session) => !removedKeys.includes(sessionKey(session)))
      .map((session) => {
        const replacement = replacements[sessionKey(session)];
        return {
          date: replacement?.date ?? session.date,
          courtId: replacement?.courtId ?? session.courtId,
          startMinute: replacement?.startMinute ?? session.startMinute,
          endMinute: replacement?.endMinute ?? session.endMinute,
        };
      });
    return sessions.length ? { ...baseRequest, sessions } : null;
  }, [baseRequest, activeBasePreview, hasAdjustments, removedKeys, replacements]);

  const adjustedResult = usePackagePreview(adjustedRequest, previewBookingPackage, revision);
  const finalRequest = hasAdjustments ? adjustedRequest : baseRequest;
  const result = hasAdjustments ? adjustedResult : baseResult;
  const preview = result?.data;
  const sessions = useMemo(() => preview?.sessions ?? [], [preview]);
  const conflictedSessions = sessions.filter((session) => session.conflict);
  const pointsLimit = preview ? checkoutPointLimit(preview.listAmount - preview.voucherDiscount, availablePoints) : availablePoints;
  const selectedPoints = Number(pointsToUse);
  const pointValidation = pointInputError(selectedPoints, availablePoints, pointsLimit);
  const invalidPoints = Boolean(pointValidation);
  const rewardError = rewardSubmitError || result?.error;
  const rewardErrorField = checkoutRewardErrorField(rewardError);
  const voucherError = rewardErrorField === 'voucher' ? rewardError : '';
  const pointError = pointValidation || (rewardErrorField === 'points' ? rewardError : '');
  const distinctDays = new Set(sessions.map((session) => session.date)).size;

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach((session) => {
      map[session.date] = [...(map[session.date] || []), session];
    });
    return map;
  }, [sessions]);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: leadingDays }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toDateKey(new Date(year, month, day));
      const daySessions = sessionsByDate[dateKey] || [];
      cells.push({
        dateKey,
        day,
        sessions: daySessions,
        isSelected: daySessions.length > 0 || (mode === 'custom' && customDates.includes(dateKey)),
        isConflicted: daySessions.some((session) => session.conflict),
      });
    }
    return cells;
  }, [viewMonth, sessionsByDate, mode, customDates]);

  const toggleWeekday = (weekday) => {
    resetConflictAdjustments();
    setSelectedWeekdays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday]
    );
    setNotice('');
  };

  const addCustomSession = (date) => {
    if (!courtId || date < today || date > maxAllowedDate || startMinute >= endMinute) return;
    resetConflictAdjustments();
    setCustomSessions((current) => current.some((session) => session.date === date && session.courtId === courtId &&
      session.startMinute === startMinute && session.endMinute === endMinute) ? current :
      [...current, { date, courtId, startMinute, endMinute }]);
    setNotice('');
  };

  const toggleCustomDate = (date) => {
    if (mode !== 'custom') return;
    setSessionDate(date);
    if (!customDates.includes(date)) { addCustomSession(date); return; }
    resetConflictAdjustments();
    setCustomSessions((current) => current.filter((session) => session.date !== date));
  };

  const originalKeyOf = (session) => {
    const replaced = Object.entries(replacements).find(
      ([key, value]) =>
        (value.date || key.split('|')[0]) === session.date &&
        value.courtId === session.courtId &&
        value.startMinute === session.startMinute
    );
    return replaced ? replaced[0] : sessionKey(session);
  };

  const removeAllConflicts = () => {
    const remaining = new Set(sessions.filter((session) => !session.conflict).map((session) => session.date));
    if (remaining.size < 2) {
      setNotice('Gói phải có buổi trong ít nhất 2 ngày khác nhau. Vui lòng chọn slot bù thay vì bỏ. (MSG92)');
      return;
    }
    const keys = conflictedSessions.map(originalKeyOf);
    setRemovedKeys((current) => [...new Set([...current, ...keys])]);
    setNotice(`Đã bỏ ${keys.length} buổi trùng khỏi lịch đặt.`);
  };

  const applyCompensation = () => {
    const replacementStart = toMinutes(compensationTime);
    const next = { ...replacements };
    const targetSessions = compensationTargetKey === 'ALL'
      ? conflictedSessions
      : conflictedSessions.filter((s) => originalKeyOf(s) === compensationTargetKey);

    targetSessions.forEach((session) => {
      const duration = session.endMinute - session.startMinute;
      next[originalKeyOf(session)] = {
        date: compensationTargetKey !== 'ALL' && compensationDate ? compensationDate : session.date,
        courtId: Number(compensationCourtId),
        startMinute: replacementStart,
        endMinute: replacementStart + duration,
      };
    });
    setReplacements(next);
    setShowCompensation(false);
    setNotice(`Đã áp dụng slot bù cho ${targetSessions.length} buổi trùng.`);
  };

  const confirmSchedule = async () => {
    setNotice('');
    setRewardSubmitError('');
    if (note.length > 200) {
      setPreviewError('Ghi chú không được vượt quá 200 ký tự.');
      return;
    }
    if (!finalRequest || !preview || invalidPoints || distinctDays < 2) {
      setNotice(previewError || 'Vui lòng chọn sân, khung giờ và ít nhất 1 buổi đặt.');
      return;
    }
    if (conflictedSessions.length > 0) {
      setNotice('Vui lòng xử lý tất cả các buổi trùng (chọn slot bù hoặc bỏ buổi trùng) trước khi xác nhận.');
      return;
    }
    if ((preview.totalSessions - preview.conflictSessions) <= 0) {
      setPreviewError('Không còn buổi hợp lệ sau khi bỏ các buổi trùng.');
      return;
    }
    setSubmitting(true);
    try {
      // UC15 #11: giữ chỗ gói 15 phút (P27) rồi sang thanh toán UC18
      const pkg = await createBookingPackage(finalRequest);
      const packageId = pkg?.id ?? pkg?.booking_id ?? pkg?.data?.booking_id;
      sessionStorage.setItem('active_holding_booking', JSON.stringify(pkg));
      navigate(`/booking/payment?packageId=${packageId}`);
    } catch (err) {
      if (err.response?.status === 409 || err.response?.data?.message?.includes('MSG44')) setRevision((value) => value + 1);
      const message = apiErrorMessage(err, 'Không thể tạo gói đặt sân.');
      if (checkoutRewardErrorField(message)) setRewardSubmitError(message);
      else setNotice(message);
    } finally {
      setSubmitting(false);
    }
  };

  const shiftMonth = (offset) =>
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  if (!facilityId) {
    return (
      <div className={styles.pageWrapper + ' cw-workspace'}>
        <PublicHeader user={user} />
        <main className={styles.mainContainer}>
          <h1 className={styles.pageTitle}>Đặt lịch nhiều buổi</h1>
          <p>Vui lòng mở trang đặt nhiều buổi từ trang chi tiết cụm sân.</p>
          <Link to="/">‹ Tìm sân</Link>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper + ' cw-workspace'}>
      <PublicHeader user={user} />
      {confirmPoints && <ConfirmDialog title="Xác nhận dùng điểm" onCancel={() => setConfirmPoints(false)}
        onConfirm={() => { setConfirmPoints(false); confirmSchedule(); }}>
        Dùng {selectedPoints} điểm để giảm {formatCurrency(preview?.pointDiscount ?? 0)}?
        Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy booking. (MSG39)
      </ConfirmDialog>}

      <main className={styles.mainContainer}>
        <div style={{ marginBottom: 10 }}>
          <Link to={`/facilities/${facilityId}`} style={{ color: '#0d8a52', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            ‹ Quay lại lịch sân {facilityName || preview?.locationName || ''}
          </Link>
        </div>
        <h1 className={styles.pageTitle}>
          Đặt lịch nhiều buổi{facilityName || preview?.locationName ? ` · ${facilityName || preview?.locationName}` : ''}
        </h1>

        <div className={styles.layoutGrid}>
          <aside className={styles.configCard}>
            <div className={styles.modeSwitch} role="tablist" aria-label="Chế độ đặt nhiều buổi">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'recurring'}
                className={`${styles.modeTab} ${mode === 'recurring' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  resetConflictAdjustments();
                  setMode('recurring');
                  setNotice('');
                  setPreviewError('');
                }}
              >
                Định kỳ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'custom'}
                className={`${styles.modeTab} ${mode === 'custom' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  resetConflictAdjustments();
                  setMode('custom');
                  setNotice('');
                  setPreviewError('');
                }}
              >
                Tự chọn ngày
              </button>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="court">Sân</label>
              <select
                id="court"
                className={styles.selectInput}
                value={courtId ?? ''}
                onChange={(event) => {
                  resetConflictAdjustments();
                  setCourtId(Number(event.target.value));
                }}
              >
                {courts.map((court) => (
                  <option key={court.court_id} value={court.court_id}>{court.court_name}</option>
                ))}
              </select>
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="from-date">Từ ngày</label>
                <input
                  id="from-date"
                  type="date"
                  className={styles.dateInput}
                  min={today}
                  max={maxAllowedDate}
                  value={fromDate}
                  onChange={(event) => {
                    resetConflictAdjustments();
                    setFromDate(event.target.value);
                    if (event.target.value) setViewMonth(parseDateKey(event.target.value));
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="to-date">Đến ngày</label>
                <input
                  id="to-date"
                  type="date"
                  className={styles.dateInput}
                  min={fromDate}
                  max={maxAllowedDate}
                  value={toDate}
                  onChange={(event) => {
                    resetConflictAdjustments();
                    setToDate(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Thứ trong tuần</span>
              <div className={styles.weekdayRow}>
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={selectedWeekdays.includes(day.value)}
                    disabled={mode === 'custom'}
                    className={`${styles.weekdayBtn} ${selectedWeekdays.includes(day.value) ? styles.weekdayBtnActive : ''}`}
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {mode === 'custom' && (
                <p className={styles.customModeHint}>
                  Nhấn trực tiếp vào các ngày trên lịch bên phải để chọn hoặc bỏ chọn buổi tự chọn ({customDates.length} ngày đã chọn).
                </p>
              )}
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="start-time">Giờ bắt đầu</label>
                <select
                  id="start-time"
                  className={styles.selectInput}
                  value={startTime}
                  onChange={(event) => {
                    resetConflictAdjustments();
                    const nextStart = event.target.value;
                    setStartTime(nextStart);
                    if (toMinutes(endTime) <= toMinutes(nextStart)) {
                      const nextEndMin = Math.min(1440, toMinutes(nextStart) + 60);
                      setEndTime(toTimeLabel(nextEndMin));
                    }
                  }}
                >
                  {TIMES.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="end-time">Giờ kết thúc</label>
                <select
                  id="end-time"
                  className={styles.selectInput}
                  value={endTime}
                  onChange={(event) => {
                    resetConflictAdjustments();
                    setEndTime(event.target.value);
                  }}
                >
                  {TIMES.slice(1).filter((time) => toMinutes(time) > startMinute).map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'recurring' && selectedWeekdays.map((day) => <fieldset className="flex flex-wrap gap-2" key={day}>
              <legend>{WEEKDAYS.find((entry) => entry.value === day)?.label}</legend>
              <label>Giờ bắt đầu <select className={styles.selectInput} value={weekdayTimes[day]?.startMinute ?? startMinute}
                onChange={(event) => {
                  resetConflictAdjustments();
                  const start = Number(event.target.value);
                  setWeekdayTimes({ ...weekdayTimes, [day]: { startMinute: start, endMinute: Math.max(start + 30, weekdayTimes[day]?.endMinute ?? endMinute) } });
                }}>{TIMES.slice(0, -1).map((time) => <option key={time} value={toMinutes(time)}>{time}</option>)}</select></label>
              <label>Giờ kết thúc <select className={styles.selectInput} value={weekdayTimes[day]?.endMinute ?? endMinute}
                onChange={(event) => {
                  resetConflictAdjustments();
                  setWeekdayTimes({ ...weekdayTimes, [day]: { startMinute: weekdayTimes[day]?.startMinute ?? startMinute, endMinute: Number(event.target.value) } });
                }}>{TIMES.filter((time) => toMinutes(time) > (weekdayTimes[day]?.startMinute ?? startMinute))
                  .map((time) => <option key={time} value={toMinutes(time)}>{time}</option>)}</select></label>
            </fieldset>)}
            {mode === 'custom' && <div className={styles.fieldGroup}>
              <label>Ngày buổi tự chọn <input type="date" min={today} max={maxAllowedDate} value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></label>
              <button type="button" className={styles.removeConflictsBtn} onClick={() => addCustomSession(sessionDate)}>Thêm buổi với sân và giờ đang chọn</button>
              <ul>{customSessions.map((session) => <li key={sessionKey(session)}>
                {session.date} · {courts.find((court) => court.court_id === session.courtId)?.court_name || 'Sân ' + session.courtId} · {toTimeLabel(session.startMinute)}–{toTimeLabel(session.endMinute)}
                <button type="button" className="ml-2 underline" onClick={() => {
                  resetConflictAdjustments();
                  setCustomSessions((current) => current.filter((item) => sessionKey(item) !== sessionKey(session)));
                }}>Bỏ buổi</button>
              </li>)}</ul>
            </div>}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="book-for">Đặt cho</label>
              <select id="book-for" className={styles.selectInput} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                <option value="">Cá nhân</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>Đội: {team.team_name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="voucher-code">Mã giảm giá (Voucher)</label>
              <input
                id="voucher-code"
                type="text"
                className={styles.dateInput}
                placeholder="Nhập mã voucher..."
                value={voucherCode}
                aria-invalid={Boolean(voucherError)}
                aria-describedby={voucherError ? 'package-voucher-error' : undefined}
                onChange={(event) => {
                  setVoucherCode(event.target.value);
                  setSelectedGrantId(null);
                  setRewardSubmitError('');
                }}
              />
              {myVouchers.length > 0 && (
                <select
                  aria-label="Chọn từ ví voucher của tôi"
                  className={styles.selectInput}
                  value={selectedGrantId ?? ''}
                  aria-invalid={Boolean(voucherError)}
                  aria-describedby={voucherError ? 'package-voucher-error' : undefined}
                  onChange={(event) => {
                    const grantId = event.target.value ? Number(event.target.value) : null;
                    setSelectedGrantId(grantId);
                    setVoucherCode('');
                    setRewardSubmitError('');
                  }}
                >
                  <option value="">-- Chọn từ ví voucher của tôi ({myVouchers.length}) --</option>
                  {myVouchers.map((v) => (
                    <option key={v.grant_id} value={v.grant_id}>
                      {v.code} — {v.name} (HSD: {v.end_date})
                    </option>
                  ))}
                </select>
              )}
              {voucherError && <small id="package-voucher-error" className="cw-field-error" role="alert">{voucherError}</small>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="points-input">
                Điểm thưởng sử dụng (Khả dụng: {availablePoints} điểm · 1 điểm = 500đ)
              </label>
              <input
                id="points-input"
                type="number"
                min={0}
                max={pointsLimit}
                className={styles.dateInput}
                value={pointsToUse}
                disabled={submitting}
                aria-invalid={Boolean(pointError)}
                aria-describedby={pointError ? 'package-point-error' : undefined}
                onChange={(event) => { setPointsToUse(event.target.value); setRewardSubmitError(''); }}
              />
              {preview && <small>Tối đa {checkoutPointPercent}% số tiền {preview.voucherDiscount > 0 ? 'còn lại sau voucher' : 'niêm yết'}.</small>}
              {pointError && <small id="package-point-error" className="cw-field-error" role="alert">{pointError}</small>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="owner-note">
                Ghi chú cho chủ sân ({note.length}/200)
              </label>
              <input
                id="owner-note"
                type="text"
                maxLength={200}
                className={styles.dateInput}
                placeholder="VD: Chuẩn bị thêm 2 ống cầu..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <p className={styles.ruleHintText}>
              Định kỳ: tối thiểu 1 buổi/tuần, kéo dài từ 1 đến 3 tháng. Tất cả các buổi phải nằm trong vòng 3 tháng kể từ hôm nay.
            </p>
          </aside>

          <div className={styles.rightColumn}>
            {preview?.batchOffer && (
              <div className={styles.promoBanner}>
                <strong>🎁 {preview.batchOffer.name}</strong>
                <span>{preview.batchOffer.message}</span>
              </div>
            )}

            <section className={styles.calendarCard} aria-label="Lịch dự kiến các buổi đặt">
              <div className={styles.calendarHeader}>
                <h2 className={styles.monthTitle}>
                  <button type="button" className={styles.weekdayBtn} onClick={() => shiftMonth(-1)} aria-label="Tháng trước">‹</button>
                  {' '}{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}{' '}
                  <button type="button" className={styles.weekdayBtn} onClick={() => shiftMonth(1)} aria-label="Tháng sau">›</button>
                </h2>
                <div className={styles.legendGroup}>
                  <span className={styles.legendItem}>
                    <i className={styles.dotSelected} />
                    Tổng buổi · {preview?.totalSessions ?? 0}
                  </span>
                  <span className={styles.legendItem}>
                    <i className={styles.dotConflicted} />
                    Buổi trùng · {conflictedSessions.length}
                  </span>
                </div>
              </div>

              {preview?.months?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {preview.months.map((m) => (
                    <span
                      key={m.month}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: '#f1f5f2',
                        color: '#28372e',
                        padding: '4px 10px',
                        borderRadius: 999,
                      }}
                    >
                      Tháng {m.month}: {m.totalSessions ?? m.sessions ?? 0} buổi
                      {Number(m.conflictSessions) > 0 ? ` (${m.conflictSessions} trùng)` : ''}
                    </span>
                  ))}
                </div>
              )}

              <div className={styles.weekdayHeaderGrid}>
                {WEEKDAYS.map((day) => <span key={day.value} className={styles.weekdayHeaderCell}>{day.label}</span>)}
              </div>
              <div className={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} className={styles.emptyDayCell} />;
                  const className = [
                    styles.dayCell,
                    day.isSelected && !day.isConflicted ? styles.dayCellSelected : '',
                    day.isConflicted ? styles.dayCellConflicted : '',
                  ].filter(Boolean).join(' ');
                  const first = day.sessions[0];
                  const isOutOfWindow = day.dateKey < today || day.dateKey > maxAllowedDate;

                  return (
                    <button
                      type="button"
                      key={day.dateKey}
                      disabled={mode !== 'custom' || isOutOfWindow}
                      aria-pressed={day.isSelected}
                      aria-label={`${day.day}${day.isConflicted ? ', trùng lịch' : day.isSelected ? ', đã chọn' : ''}`}
                      className={className}
                      onClick={() => toggleCustomDate(day.dateKey)}
                    >
                      <strong className={styles.dayNumber}>{day.day}</strong>
                      {day.isConflicted
                        ? <span className={styles.conflictTag}>{CONFLICT_LABELS[first?.conflict] || 'Trùng lịch'}</span>
                        : first && (
                          <span className={styles.timeSubTag}>
                            {first.startTime}–{first.endTime}{day.sessions.length > 1 ? ` +${day.sessions.length - 1}` : ''}
                          </span>
                        )}
                    </button>
                  );
                })}
              </div>

              {conflictedSessions.length > 0 && (
                <div className={styles.conflictResolutionBox} role="status">
                  <strong className={styles.conflictBoxTitle}>
                    {preview?.summary} — {conflictedSessions
                      .map((session) => `${session.date.slice(8)}/${session.date.slice(5, 7)} ${session.startTime}–${session.endTime} ${session.courtName} (${CONFLICT_LABELS[session.conflict] || session.conflict})`)
                      .join(', ')}
                  </strong>
                  <div className={styles.conflictActionRow}>
                    <button
                      type="button"
                      className={styles.compensateBtn}
                      onClick={() => {
                        setCompensationCourtId(courtId);
                        setCompensationTargetKey('ALL');
                        setShowCompensation(true);
                      }}
                    >
                      Chọn slot bù
                    </button>
                    <button type="button" className={styles.removeConflictsBtn} onClick={removeAllConflicts}>
                      Bỏ tất cả buổi trùng
                    </button>
                  </div>
                </div>
              )}
              {finalRequest && !result && <p role="status">Đang kiểm tra lịch gói…</p>}
              {((result?.error && !checkoutRewardErrorField(result.error)) || previewError) &&
                <p className={styles.notice} style={{ background: '#fef2f2', color: '#b91c1c' }} role="alert">
                  {previewError || result.error}
                </p>}
              {notice && <p className={styles.notice} role="status">{notice}</p>}
            </section>

            <section className={styles.summaryFooterCard}>
              <div className={styles.summaryLeft}>
                <span className={styles.formulaText}>
                  {preview
                    ? `${preview.totalSessions - preview.conflictSessions} buổi hợp lệ · Giá gốc ${formatCurrency(preview.listAmount)}${
                      Number(preview.voucherDiscount ?? preview.discountAmount) > 0
                        ? ` · Giảm voucher -${formatCurrency(preview.voucherDiscount ?? preview.discountAmount)}`
                        : ''
                    }${
                      Number(preview.pointDiscount ?? preview.pointsDiscountAmount) > 0
                        ? ` · Đổi điểm -${formatCurrency(preview.pointDiscount ?? preview.pointsDiscountAmount)}`
                        : ''
                    }`
                    : 'Chưa có buổi đặt nào'}
                </span>
                <strong className={styles.totalPriceText}>{formatCurrency(preview?.finalAmount)}</strong>
                <span className={styles.holdNoteText}>
                  Thanh toán 1 lần cho toàn bộ gói. Sau khi xác nhận, gói được giữ chỗ 15 phút.
                </span>
              </div>
              <button type="button" className={styles.confirmScheduleBtn} disabled={submitting || !preview || invalidPoints || distinctDays < 2 || conflictedSessions.length > 0}
                onClick={() => selectedPoints > 0 ? setConfirmPoints(true) : confirmSchedule()}>
                {submitting ? 'Đang giữ chỗ gói...' : 'Xác nhận lịch đặt'}
              </button>
            </section>
          </div>
        </div>
      </main>

      {showCompensation && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setShowCompensation(false)}>
          <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.modalClose} aria-label="Đóng" onClick={() => setShowCompensation(false)}>×</button>
            <h2 id="modal-title" className={styles.modalTitle}>Chọn slot bù cho buổi trùng</h2>
            <p className={styles.modalSub}>
              Chọn sân hoặc giờ bắt đầu thay thế cho buổi bị trùng (giữ nguyên thời lượng buổi chơi).
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-target">Áp dụng cho</label>
              <select
                id="replacement-target"
                className={styles.selectInput}
                value={compensationTargetKey}
                onChange={(event) => { setCompensationTargetKey(event.target.value); setCompensationDate(''); }}
              >
                <option value="ALL">Tất cả {conflictedSessions.length} buổi đang trùng</option>
                {conflictedSessions.map((s) => {
                  const key = originalKeyOf(s);
                  return (
                    <option key={key} value={key}>
                      Ngày {s.date} · {s.startTime}–{s.endTime} ({s.courtName})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-court">Sân thay thế</label>
              <select
                id="replacement-court"
                className={styles.selectInput}
                value={compensationCourtId ?? ''}
                onChange={(event) => setCompensationCourtId(Number(event.target.value))}
              >
                {courts.map((court) => (
                  <option key={court.court_id} value={court.court_id}>{court.court_name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-time">Giờ bắt đầu thay thế</label>
              <select id="replacement-time" className={styles.selectInput} value={compensationTime} onChange={(event) => setCompensationTime(event.target.value)}>
                {TIMES.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            {compensationTargetKey !== 'ALL' && <label>Ngày bù
              <input type="date" min={mode === 'recurring' ? fromDate : today} max={mode === 'recurring' ? toDate : maxAllowedDate}
                value={compensationDate} onChange={(event) => setCompensationDate(event.target.value)} />
            </label>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.removeConflictsBtn} onClick={() => setShowCompensation(false)}>Hủy</button>
              <button type="button" className={styles.confirmScheduleBtn} onClick={applyCompensation}>Áp dụng slot bù</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
