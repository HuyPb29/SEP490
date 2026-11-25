import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { toMinutes, toTimeLabel } from '../../api/bookingApi';
import PublicLayout from '../../components/layout/PublicLayout';
import { Button, EmptyState, ErrorState, FormStepper, Input, Select, LoadingState, Modal, PageHeader, StatusBadge, Tabs, STATUS_CATALOG } from '../../components/common';
import { useBookingActions } from '../../hooks/useBooking';
import { money, uiMessage, today as getTodayStr } from '../../utils/formatters';
import { readPackageDraft, savePackageDraft } from '../../utils/packageDraft';
import { groupRanges } from '../../utils/slotRanges';
import { isBookable } from '../../utils/venueSchedule';
import { usePackagePreview } from '../../hooks/usePackagePreview';
import BookingSummaryBar from '../../components/booking/BookingSummaryBar';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';
import SelectedRanges from '../../components/schedule/SelectedRanges';
import gridStyles from '../../components/schedule/ScheduleGrid.module.css';
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

// Định kỳ: các hàng giờ bắt đầu theo buổi trong ngày; thời lượng từ 1 slot (30 phút), mỗi lựa chọn thêm 1 slot
const PERIODS = [
  { label: 'Sáng', from: 0, to: 600 },
  { label: 'Trưa', from: 600, to: 840 },
  { label: 'Chiều', from: 840, to: 1080 },
  { label: 'Tối', from: 1080, to: 1440 },
];
const DURATIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 30);
const durationLabel = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const text = [hours ? `${hours} giờ` : '', minutes % 60 ? '30 phút' : ''].filter(Boolean).join(' ');
  return `${text} (${minutes / 30} khung giờ)`;
};

const CONFLICT_LABELS = {
  TAKEN: STATUS_CATALOG.slot.BOOKED.label,
  MAINTENANCE: STATUS_CATALOG.slot.MAINTENANCE.label,
  CLOSED: STATUS_CATALOG.slot.CLOSED.label,
  STARTED: STATUS_CATALOG.slot.PAST.label,
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
const formatCurrency = value => money(value).replace(/\s*₫/, 'đ');
const PACKAGE_STEPS = ['Thiết lập lịch', 'Xử lý buổi trùng', 'Tóm tắt & xác nhận'];
const conflictStatus = conflict => ({ TAKEN: 'BOOKED', STARTED: 'PAST' })[conflict] || conflict;
const sessionKey = (session) => `${session.date}|${session.courtId}|${session.startMinute}`;

const TODAY_DATE = getTodayStr();
// D175: gói định kỳ dài 1–12 tháng; mọi buổi nằm trong 1 năm kể từ hôm nay, tính cả hôm nay
// (đặt 20/11/2026 thì xa nhất 19/11/2027), và không quá hạn dịch vụ của địa điểm (lấy từ backend, xem packageMaxDate)
const MAX_PACKAGE_MONTHS = 12;
const PACKAGE_MONTH_OPTIONS = Array.from({ length: MAX_PACKAGE_MONTHS }, (_, index) => index + 1);
const MAX_ALLOWED_DATE = addMonths(TODAY_DATE, MAX_PACKAGE_MONTHS, 1);
const shiftDay = (dateKey, offset) => {
  const date = parseDateKey(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset));
};
const formatDay = (dateKey) => {
  const date = parseDateKey(dateKey);
  return `${['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][date.getDay()]}, ${dateKey.slice(8)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`;
};

// Lịch sân một ngày để chọn buổi trên bảng slot; Player xem được tới ngày xa nhất đặt được của gói (forPackage)
function useDaySchedule(facilityId, date, enabled, load, revision = 0) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!enabled || !facilityId || !date) return undefined;
    const controller = new AbortController();
    load(facilityId, date, controller.signal, undefined, { forPackage: true })
      .then((data) => { if (!controller.signal.aborted) setResult({ date, data }); })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ date, error: apiErrorMessage(error, 'Không tải được lịch sân.') });
      });
    return () => controller.abort();
  }, [facilityId, date, enabled, load, revision]);
  return enabled && result?.date === date ? result : null;
}

// Ngày đầu tiên từ fromDate rơi vào thứ weekday (Date.getDay())
function firstDateOf(fromDate, weekday) {
  const date = parseDateKey(fromDate);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return toDateKey(date);
}

// Định kỳ: xem trước gói trên từng sân để biết số buổi trùng của mỗi sân và gợi ý sân ít trùng nhất
function useCourtRanking(pattern, courts, load) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!pattern || courts.length === 0) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      Promise.all(courts.map((court) => load({ ...pattern, courtId: court.court_id })
        .then((value) => ({ courtId: court.court_id, conflicts: (value?.data ?? value)?.conflictSessions ?? 0 }))
        .catch(() => ({ courtId: court.court_id, conflicts: null }))))
        .then((list) => { if (active) setResult({ pattern, list }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [pattern, courts, load]);
  return result?.pattern === pattern ? result.list : null;
}

export default function MultiSessionBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { getLocationCourts, getVenueSchedule, previewBookingPackage } = useBookingActions();

  const facilityId = Number(id || location.state?.facilityId) || null;

  const today = TODAY_DATE;
  // Ngày xa nhất backend cho chọn buổi của gói (mốc 1 năm, không quá hạn dịch vụ của địa điểm, D175)
  const [packageMaxDate, setPackageMaxDate] = useState(null);
  const maxAllowedDate = packageMaxDate && packageMaxDate < MAX_ALLOWED_DATE ? packageMaxDate : MAX_ALLOWED_DATE;

  // Quay lại từ trang tóm tắt gói thì khôi phục lịch đã chọn, kể cả buổi bỏ và slot bù
  const [draft] = useState(() => readPackageDraft(facilityId));
  const saved = draft?.schedule;
  const facilityName = location.state?.facilityName || draft?.facilityName || '';

  const [courts, setCourts] = useState([]);

  const [mode, setMode] = useState(saved?.mode ?? 'recurring');
  // Định kỳ: chỉ bắt buộc chọn thứ và giờ; thời gian gói mặc định 1 tháng, sân tự chọn sân ít trùng nhất
  const [courtId, setCourtId] = useState(saved?.courtId ?? null);
  const [courtTouched, setCourtTouched] = useState(saved?.courtTouched ?? false);
  const [fromDate, setFromDate] = useState(saved?.fromDate && saved.fromDate >= today ? saved.fromDate : today);
  const [months, setMonths] = useState(saved?.months ?? 1);
  const [showFromInput, setShowFromInput] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState(saved?.selectedWeekdays ?? []);
  // Giờ chơi: khóa 'all' dùng chung mọi thứ, hoặc khóa theo thứ khi mỗi thứ một giờ; { start, end, duration } tính bằng phút
  const [perDayTimes, setPerDayTimes] = useState(saved?.perDayTimes ?? false);
  const [weeklyTimes, setWeeklyTimes] = useState(saved?.weeklyTimes ?? {});
  const [timeTab, setTimeTab] = useState(null);

  // Tự chọn ngày: các ô 30 phút Player bấm trên bảng slot; ô liền nhau cùng sân, cùng ngày là một buổi
  const [customSlots, setCustomSlots] = useState(saved?.customSlots ?? []);
  const customRanges = useMemo(() => groupRanges(customSlots), [customSlots]);
  const customSessions = useMemo(() => customRanges.map(({ date, courtId, startMinute, endMinute }) =>
    ({ date, courtId, startMinute, endMinute })), [customRanges]);
  const [gridDate, setGridDate] = useState(() => saved?.customSlots?.[0]?.date ?? today);
  const customDates = useMemo(() => [...new Set(customSlots.map((slot) => slot.date))], [customSlots]);
  // Xử lý buổi trùng (BR50): buổi bỏ và buổi đổi sang slot bù, theo khóa của buổi gốc
  const [removedKeys, setRemovedKeys] = useState(saved?.removedKeys ?? []);
  const [replacements, setReplacements] = useState(saved?.replacements ?? {});
  // Cửa sổ slot bù: buổi trùng đang chọn bù, ngày đang xem và slot bù đã bấm (chưa áp dụng)
  const [showCompensation, setShowCompensation] = useState(false);
  const [compensationTargetKey, setCompensationTargetKey] = useState(null);
  const [compensationDate, setCompensationDate] = useState('');
  const [compensationPicks, setCompensationPicks] = useState({});
  const [compensationMessage, setCompensationMessage] = useState(null);

  const [viewMonth, setViewMonth] = useState(() =>
    parseDateKey(saved?.mode === 'custom' ? (saved.customSlots?.[0]?.date ?? today) : (saved?.fromDate ?? today)));
  const [previewError, setPreviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(location.state?.reviewConflicts ? 1 : 0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtRevision, setCourtRevision] = useState(0);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);
  const stepTitle = useRef(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      stepTitle.current?.focus({ preventScroll: true });
      stepTitle.current?.scrollIntoView({ block: 'start' });
    }
    previousStep.current = step;
  }, [step]);

  useEffect(() => {
    if (!facilityId) return;
    getLocationCourts(facilityId)
      .then((courtList) => {
        setCourts(courtList);
        setCourtId((current) => current ?? courtList[0]?.court_id ?? null);
      })
      .catch((err) => setPreviewError(apiErrorMessage(err, 'Không tải được danh sách sân.')))
      .finally(() => setCourtsLoading(false));
  }, [facilityId, getLocationCourts, courtRevision]);

  useEffect(() => {
    if (!facilityId) return undefined;
    const controller = new AbortController();
    getVenueSchedule(facilityId, today, controller.signal, undefined, { forPackage: true })
      .then((data) => { if (!controller.signal.aborted && data?.max_date) setPackageMaxDate(data.max_date); })
      .catch(() => {});
    return () => controller.abort();
  }, [facilityId, today, getVenueSchedule]);

  const resetConflictAdjustments = () => {
    setRemovedKeys([]);
    setReplacements({});
  };

  // ---- Định kỳ: thời gian gói 1–12 tháng từ ngày bắt đầu (BR27), mọi buổi không quá maxAllowedDate (D175)
  const monthEnd = (count) => addMonths(fromDate, count, 1);
  const monthAllowed = (count) => monthEnd(count) <= maxAllowedDate;
  const effectiveMonths = monthAllowed(months) ? months
    : ([...PACKAGE_MONTH_OPTIONS].reverse().find(monthAllowed) ?? 1);
  const toDate = monthEnd(effectiveMonths);
  // Ngày bắt đầu muộn nhất để gói 1 tháng vẫn kết thúc trước maxAllowedDate
  // (lùi thêm vài ngày khi tháng trước ngắn hơn, ví dụ 31/03 lùi 1 tháng thành 03/03 thì quá)
  let latestFromDate = addMonths(shiftDay(maxAllowedDate, 1), -1, 0);
  while (latestFromDate > today && addMonths(latestFromDate, 1, 1) > maxAllowedDate) {
    latestFromDate = shiftDay(latestFromDate, -1);
  }

  const timeKey = perDayTimes ? (selectedWeekdays.includes(timeTab) ? timeTab : selectedWeekdays[0]) : 'all';
  const recurringPattern = useMemo(() => {
    if (mode !== 'recurring' || selectedWeekdays.length === 0) return null;
    const slots = selectedWeekdays.map((day) => {
      const time = perDayTimes ? weeklyTimes[day] : weeklyTimes.all;
      return time?.start != null ? { dayOfWeek: day === 0 ? 7 : day, startMinute: time.start, endMinute: time.end } : null;
    });
    if (slots.some((slot) => !slot)) return null;
    return { startDate: fromDate, endDate: toDate, packageType: 'RECURRING', weeklySlots: slots };
  }, [mode, selectedWeekdays, perDayTimes, weeklyTimes, fromDate, toDate]);

  const courtRanking = useCourtRanking(recurringPattern, courts, previewBookingPackage);
  const bestCourtId = courtRanking?.filter((item) => item.conflicts != null)
    .sort((a, b) => a.conflicts - b.conflicts)[0]?.courtId ?? null;
  // Chưa tự đổi sân thì dùng sân ít trùng nhất; xếp hạng lỗi hết thì dùng sân đầu tiên
  const effectiveCourtId = courtTouched ? courtId : courtRanking ? (bestCourtId ?? courtId) : null;

  // UC15 #2, #3: PackageRequest theo mẫu Player nhập (chưa xử lý buổi trùng).
  // Đội, voucher, điểm, ghi chú chọn ở trang tóm tắt gói.
  const baseRequest = useMemo(() => {
    if (mode === 'custom') {
      // Chưa đủ 2 ngày (D163) thì chưa xem trước gói; thanh tóm tắt cộng giá các ô đã chọn
      if (customDates.length < 2) return null;
      const dates = customSessions.map((session) => session.date).sort();
      return { courtId: customSessions[0].courtId, startDate: dates[0], endDate: dates.at(-1),
        packageType: 'CUSTOM', sessions: customSessions };
    }
    if (!recurringPattern || !effectiveCourtId) return null;
    return { ...recurringPattern, courtId: effectiveCourtId };
  }, [mode, customSessions, customDates, recurringPattern, effectiveCourtId]);

  // Bảng giờ bắt đầu lấy giờ mở cửa và giá của ngày đầu tiên có buổi (theo thứ đang chọn giờ)
  const representativeDate = (() => {
    const days = perDayTimes && timeKey != null ? [timeKey] : selectedWeekdays;
    if (days.length === 0) return fromDate;
    return days.map((day) => firstDateOf(fromDate, day)).sort()[0];
  })();
  const timeGrid = useDaySchedule(facilityId, representativeDate, mode === 'recurring', getVenueSchedule, scheduleRevision);
  const timeRow = timeGrid?.data?.courts.find((court) => court.court_id === effectiveCourtId) ?? timeGrid?.data?.courts[0];
  const openStarts = (timeRow?.slots ?? []).filter((slot) => slot.status !== 'closed').map((slot) => toMinutes(slot.time));
  const closeMinute = openStarts.length ? Math.max(...openStarts) + 30 : 1440;
  const currentTime = timeKey != null ? weeklyTimes[timeKey] : null;
  const currentDuration = currentTime?.duration ?? 30;

  const updateTime = (next) => {
    if (timeKey == null) return;
    resetConflictAdjustments();
    setNotice('');
    setWeeklyTimes((current) => ({ ...current, [timeKey]: next }));
  };
  // Bấm ô = giờ bắt đầu; giờ kết thúc theo thời lượng, sát giờ đóng cửa thì rút ngắn
  const pickStart = (minute) => updateTime({ start: minute, end: minute + Math.min(currentDuration, closeMinute - minute), duration: currentDuration });
  const changeDuration = (duration) => updateTime(currentTime?.start != null
    ? { ...currentTime, duration, end: currentTime.start + Math.min(duration, closeMinute - currentTime.start) }
    : { start: null, end: null, duration });

  const togglePerDayTimes = () => {
    resetConflictAdjustments();
    if (!perDayTimes) {
      setWeeklyTimes((current) => {
        const next = { ...current };
        selectedWeekdays.forEach((day) => { if (!next[day] && current.all) next[day] = { ...current.all }; });
        return next;
      });
      setTimeTab(selectedWeekdays[0] ?? null);
    }
    setPerDayTimes((value) => !value);
  };

  const chooseCourt = (value) => {
    resetConflictAdjustments();
    setCourtId(value);
    setCourtTouched(true);
  };

  const baseResult = usePackagePreview(baseRequest, previewBookingPackage, previewRevision);
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

  const adjustedResult = usePackagePreview(adjustedRequest, previewBookingPackage, previewRevision);
  const finalRequest = hasAdjustments ? adjustedRequest : baseRequest;
  const result = hasAdjustments ? adjustedResult : baseResult;
  const preview = result?.data;
  const sessions = useMemo(() => preview?.sessions ?? [], [preview]);
  const conflictedSessions = sessions.filter((session) => session.conflict);
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
    const adding = !selectedWeekdays.includes(weekday);
    // Mỗi thứ một giờ: thứ mới lấy giờ chung (hoặc giờ của thứ đang xem) làm mặc định
    if (adding && perDayTimes && !weeklyTimes[weekday]) {
      const copy = weeklyTimes.all ?? (timeKey != null ? weeklyTimes[timeKey] : null);
      if (copy) setWeeklyTimes((current) => ({ ...current, [weekday]: { ...copy } }));
    }
    setSelectedWeekdays((current) => adding
      ? [...current, weekday].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      : current.filter((day) => day !== weekday));
    setNotice('');
  };

  // Tự chọn ngày: bấm ngày trên lịch tháng để xem bảng slot của ngày đó
  const chooseGridDate = (date) => {
    if (mode !== 'custom' || date < today || date > maxAllowedDate) return;
    setGridDate(date);
  };

  const toggleCustomSlot = (court, slot) => {
    resetConflictAdjustments();
    setNotice('');
    const same = (item) => item.date === gridDate && item.courtId === court.court_id && item.time === slot.time;
    setCustomSlots((current) => current.some(same) ? current.filter((item) => !same(item))
      : [...current, { date: gridDate, courtId: court.court_id, courtName: court.court_name, time: slot.time, price: Number(slot.price) }]);
  };

  const removeCustomRange = (range) => {
    resetConflictAdjustments();
    setCustomSlots((current) => current.filter((item) => !range.items.includes(item)));
  };

  const customGrid = useDaySchedule(facilityId, gridDate, mode === 'custom', getVenueSchedule, scheduleRevision);
  // Buổi tự chọn bị trùng hiện viền đỏ trên bảng (không hiện như ô đã chọn)
  const conflictCells = useMemo(() => new Set(conflictedSessions.flatMap((session) => {
    const cells = [];
    for (let minute = session.startMinute; minute < session.endMinute; minute += 30) {
      cells.push(`${session.date}|${session.courtId}|${toTimeLabel(minute)}`);
    }
    return cells;
  })), [conflictedSessions]);
  const customGridSelected = customSlots.filter((item) => item.date === gridDate &&
    !conflictCells.has(`${item.date}|${item.courtId}|${item.time}`));

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
      setNotice("Gói phải có buổi trong ít nhất 2 ngày khác nhau. Vui lòng chọn khung giờ bù thay vì bỏ. (MSG92)");
      return;
    }
    const keys = conflictedSessions.map(originalKeyOf);
    setRemovedKeys((current) => [...new Set([...current, ...keys])]);
    setNotice(`Đã bỏ ${keys.length} buổi trùng khỏi lịch đặt.`);
  };

  // ---- Slot bù (BR50, D48): chọn trên bảng slot của ngày, giữ nguyên thời lượng buổi
  const compensationTarget = conflictedSessions.find((session) => originalKeyOf(session) === compensationTargetKey) ?? null;
  const compensationMinDate = mode === 'recurring' && fromDate > today ? fromDate : today;
  const compensationMaxDate = mode === 'recurring' && toDate < maxAllowedDate ? toDate : maxAllowedDate;
  const compensationGrid = useDaySchedule(facilityId, compensationDate, showCompensation, getVenueSchedule, scheduleRevision);

  const openCompensation = () => {
    const first = conflictedSessions[0];
    if (!first) return;
    setCompensationTargetKey(originalKeyOf(first));
    setCompensationDate(first.date);
    setCompensationPicks({});
    setCompensationMessage(null);
    setShowCompensation(true);
  };

  const chooseCompensationTarget = (session) => {
    const key = originalKeyOf(session);
    setCompensationTargetKey(key);
    setCompensationDate(compensationPicks[key]?.date ?? session.date);
    setCompensationMessage(null);
  };

  const chooseCompensationDate = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < compensationMinDate || date > compensationMaxDate) return;
    setCompensationDate(date);
    setCompensationMessage(null);
  };

  // Ô thuộc buổi khác của gói (hoặc slot bù đã chọn cho buổi trùng khác) trong ngày đang xem
  const compensationMark = (court, slot) => {
    const minute = toMinutes(slot.time);
    const inside = (item) => item.date === compensationDate && item.courtId === court.court_id &&
      minute >= item.startMinute && minute < item.endMinute;
    if (compensationTarget && inside(compensationTarget)) return 'conflict';
    const otherPicks = Object.entries(compensationPicks).filter(([key]) => key !== compensationTargetKey).map(([, pick]) => pick);
    if (sessions.some((session) => session !== compensationTarget && inside(session)) || otherPicks.some(inside)) return 'package';
    return null;
  };

  const pickCompensation = (court, slot, timeIdx) => {
    if (!compensationTarget) return;
    const duration = compensationTarget.endMinute - compensationTarget.startMinute;
    const startAt = toMinutes(slot.time);
    const needed = duration / 30;
    const cells = court.slots.slice(timeIdx, timeIdx + needed);
    const fits = cells.length === needed && cells.every((cell, index) =>
      isBookable(cell) && toMinutes(cell.time) === startAt + index * 30 && !compensationMark(court, cell));
    if (!fits) {
      setCompensationMessage({ error: true, text: `Từ ${slot.time} trên ${court.court_name} không đủ ${duration} phút trống liên tiếp. Vui lòng chọn ô khác.` });
      return;
    }
    setCompensationPicks((current) => ({ ...current, [compensationTargetKey]: {
      date: compensationDate, courtId: court.court_id, courtName: court.court_name,
      startMinute: startAt, endMinute: startAt + duration,
    } }));
    setCompensationMessage({ error: false, text: `khung giờ bù: ${formatDay(compensationDate)} · ${court.court_name} · ${toTimeLabel(startAt)}–${toTimeLabel(startAt + duration)}` });
  };

  // Áp dụng cùng sân, cùng giờ bắt đầu cho các buổi trùng còn lại, mỗi buổi giữ ngày của mình (xử lý hàng loạt, D49)
  const applyPickToAll = () => {
    const pick = compensationPicks[compensationTargetKey];
    if (!pick) return;
    const next = { ...compensationPicks };
    conflictedSessions.forEach((session) => {
      const key = originalKeyOf(session);
      if (key === compensationTargetKey || next[key]) return;
      next[key] = { date: session.date, courtId: pick.courtId, courtName: pick.courtName,
        startMinute: pick.startMinute, endMinute: pick.startMinute + (session.endMinute - session.startMinute) };
    });
    setCompensationPicks(next);
    setCompensationMessage({ error: false, text: `Đã chọn ${pick.courtName} · ${toTimeLabel(pick.startMinute)} cho mọi buổi trùng, mỗi buổi giữ ngày của mình. Hệ thống kiểm tra lại khi áp dụng.` });
  };

  const applyCompensation = () => {
    const entries = Object.entries(compensationPicks);
    if (!entries.length) return;
    const next = { ...replacements };
    entries.forEach(([key, { date, courtId: pickCourt, startMinute: pickStart, endMinute: pickEnd }]) => {
      next[key] = { date, courtId: pickCourt, startMinute: pickStart, endMinute: pickEnd };
    });
    setReplacements(next);
    setShowCompensation(false);
    setNotice(`Đã áp dụng khung giờ bù cho ${entries.length} buổi trùng.`);
  };

  // Sang trang tóm tắt gói; chưa tạo gói, chưa giữ chỗ (giữ chỗ khi bấm xác nhận ở trang tóm tắt)
  const goToSummary = () => {
    setNotice('');
    if (!finalRequest || !preview || distinctDays < 2) {
      setNotice(previewError || 'Gói phải có buổi trong ít nhất 2 ngày khác nhau. Vui lòng chọn sân, khung giờ và các buổi đặt.');
      return;
    }
    if (conflictedSessions.length > 0) {
      setNotice("Vui lòng xử lý tất cả các buổi trùng (chọn khung giờ bù hoặc bỏ buổi trùng) trước khi tiếp tục.");
      return;
    }
    savePackageDraft({
      facilityId,
      facilityName: facilityName || preview.locationName || '',
      request: finalRequest,
      schedule: {
        mode, courtId: effectiveCourtId ?? courtId, courtTouched, fromDate, months: effectiveMonths,
        selectedWeekdays, perDayTimes, weeklyTimes, customSlots, removedKeys, replacements,
      },
    });
    navigate('/booking/package-summary');
  };

  // Thanh tóm tắt giống đặt lẻ: số buổi · tổng giá niêm yết, các buổi/lịch đã chọn, gợi ý bước còn thiếu.
  // Có bản xem trước thì lấy số buổi và giá của backend (đã trừ buổi trùng, tính buổi bù).
  const summaryCount = preview ? preview.totalSessions - preview.conflictSessions : customRanges.length;
  const summaryAmount = preview ? preview.listAmount : customSlots.reduce((total, slot) => total + slot.price, 0);
  const pendingTitle = result?.error ? 'Chưa tính được giá gói' : finalRequest ? 'Đang tính giá gói…' : null;
  const courtName = courts.find((court) => court.court_id === effectiveCourtId)?.court_name;
  const weeklyChips = selectedWeekdays.map((day) => {
    const time = perDayTimes ? weeklyTimes[day] : weeklyTimes.all;
    const text = [WEEKDAYS.find((entry) => entry.value === day)?.label, courtName,
      time?.start != null ? `${toTimeLabel(time.start)}–${toTimeLabel(time.end)}` : 'chưa chọn giờ'].filter(Boolean).join(' · ');
    return { day, text, missing: time?.start == null };
  });
  const conflictHint = conflictedSessions.length > 0
    ? `Còn ${conflictedSessions.length} buổi trùng: chọn khung giờ bù hoặc bỏ buổi trùng ở lịch phía trên.` : null;
  const summaryTitle = mode === 'custom'
    ? customRanges.length
      ? `${summaryCount} buổi · ${preview ? distinctDays : customDates.length} ngày · ${formatCurrency(summaryAmount)}`
      : 'Chưa chọn buổi'
    : preview ? `${summaryCount} buổi · ${formatCurrency(summaryAmount)}` : pendingTitle ?? 'Chưa chọn lịch';
  const summaryHint = mode === 'custom'
    ? customRanges.length === 0
      ? 'Bấm ô trống để chọn. Ô liền nhau trên cùng sân là một buổi; gói cần buổi ở ít nhất 2 ngày khác nhau.'
      : customDates.length < 2 ? 'Chọn thêm buổi ở ít nhất một ngày khác để đặt gói.' : conflictHint
    : selectedWeekdays.length === 0
      ? 'Chọn thứ trong tuần rồi bấm ô giờ bắt đầu trên bảng khung giờ.'
      : weeklyChips.some((chip) => chip.missing)
        ? 'Bấm ô giờ bắt đầu cho các thứ chưa chọn giờ.' : conflictHint;

  const sessionWeeks = useMemo(() => {
    const groups = new Map();
    [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute).forEach(session => {
      const weekday = parseDateKey(session.date).getDay();
      const week = shiftDay(session.date, -((weekday + 6) % 7));
      if (!groups.has(week)) groups.set(week, []);
      groups.get(week).push(session);
    });
    return [...groups];
  }, [sessions]);
  const openSessionCompensation = session => { openCompensation(); chooseCompensationTarget(session); };
  const removeConflict = session => {
    if (new Set(sessions.filter(item => item !== session).map(item => item.date)).size < 2) {
      setNotice('Gói phải có buổi trong ít nhất 2 ngày khác nhau. Vui lòng chọn khung giờ bù thay vì bỏ. (MSG92)'); return;
    }
    const key = originalKeyOf(session);
    setRemovedKeys(current => [...new Set([...current, key])]);
    setNotice('Đã bỏ buổi trùng khỏi lịch đặt.');
  };
  const retryCourts = () => { setPreviewError(''); setCourtsLoading(true); setCourtRevision(value => value + 1); };
  const retrySchedule = () => setScheduleRevision(value => value + 1);

  const shiftMonth = (offset) =>
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  if (!facilityId) return <PublicLayout title="Đặt lịch nhiều buổi"><EmptyState title="Chưa chọn địa điểm" description="Mở lịch gói từ trang chi tiết địa điểm để bắt đầu." action={<Link to="/locations">Tìm sân</Link>} /></PublicLayout>;

  return (
    <PublicLayout fullWidth className={styles.pageWrapper}>
      <div className={styles.mainContainer}>
        <PageHeader title="Đặt gói nhiều buổi" subtitle={facilityName || preview?.locationName || 'Chủ động lịch chơi, giữ nhịp tập luyện.'}
          backTo={{ to: '/facilities/' + facilityId, label: 'Quay lại lịch sân' }} />
        <FormStepper steps={PACKAGE_STEPS} current={step} onChange={value => { if (value <= step) setStep(value); }} />
        <div className={styles.stepHeader}><div><p className={styles.eyebrow}>Bước {step + 1} / 3</p><h2 ref={stepTitle} tabIndex={-1}>{PACKAGE_STEPS[step]}</h2></div>
          {step === 1 && <Button variant="secondary" onClick={() => setStep(0)}>Chỉnh sửa thiết lập</Button>}
        </div>
        {courtsLoading && <LoadingState message="Đang tải danh sách sân…" />}
        {previewError && <ErrorState message={uiMessage(previewError)} onRetry={retryCourts} />}
        {!courtsLoading && !previewError && !courts.length && <EmptyState title="Chưa có sân đang hoạt động" description="Chọn địa điểm khác hoặc quay lại khi sân được mở đặt." action={<Link to="/locations">Tìm sân khác</Link>} />}
        <div className={step === 1 ? styles.reviewLayout : styles.layoutGrid}>
          {step === 0 && <aside className={styles.configCard}>
            <Tabs label="Chế độ đặt nhiều buổi" value={mode} onChange={value => { resetConflictAdjustments(); setMode(value); setNotice(''); setPreviewError(''); }} items={[{ value: 'recurring', label: 'Định kỳ' }, { value: 'custom', label: 'Tự chọn' }]} />
            {mode === 'recurring' && <>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Thứ trong tuần
                {selectedWeekdays.length > 0 && <em className={styles.fieldLabelValue}>
                  {selectedWeekdays.map((day) => WEEKDAYS.find((entry) => entry.value === day)?.label).join(', ')}
                </em>}
              </span>
              <div className={styles.weekdayRow} role="group" aria-label="Thứ trong tuần">
                {WEEKDAYS.map((day) => (
                  <Button variant="secondary"
                    key={day.value}
                    type="button"
                    aria-pressed={selectedWeekdays.includes(day.value)}
                    className={`${styles.weekdayBtn} ${selectedWeekdays.includes(day.value) ? styles.weekdayBtnActive : ''}`}
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Thời gian gói
                <em className={styles.fieldLabelValue}>{formatDay(fromDate).split(', ')[1]} – {formatDay(toDate).split(', ')[1]}</em>
              </span>
              <div className={styles.monthRow} role="group" aria-label="Thời gian gói">
                {PACKAGE_MONTH_OPTIONS.map((count) => (
                  <Button variant="secondary" key={count} type="button" aria-pressed={effectiveMonths === count} disabled={!monthAllowed(count)}
                    className={`${styles.weekdayBtn} ${effectiveMonths === count ? styles.weekdayBtnActive : ''}`}
                    onClick={() => { resetConflictAdjustments(); setMonths(count); }}>
                    {count} tháng
                  </Button>
                ))}
              </div>
              <p className={styles.customModeHint}>
                Bắt đầu từ {formatDay(fromDate)} ·{' '}
                <Button variant="secondary" type="button" className={styles.linkBtn} onClick={() => setShowFromInput((value) => !value)}>
                  Đổi ngày bắt đầu
                </Button>
              </p>
              {showFromInput && <Input type="date" className={styles.dateInput} aria-label="Ngày bắt đầu gói"
                min={today} max={latestFromDate} value={fromDate}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value || value < today || value > latestFromDate) return;
                  resetConflictAdjustments();
                  setFromDate(value);
                  setViewMonth(parseDateKey(value));
                }} />}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="court">Sân</label>
              <Select id="court" className={styles.selectInput} value={effectiveCourtId ?? courtId ?? ''}
                onChange={(event) => chooseCourt(Number(event.target.value))}>
                {courts.map((court) => {
                  const rank = courtRanking?.find((item) => item.courtId === court.court_id);
                  const status = rank?.conflicts == null ? '' : rank.conflicts ? ` · ${rank.conflicts} buổi trùng` : ' · trống mọi buổi';
                  return <option key={court.court_id} value={court.court_id}>
                    {court.court_name}{status}{bestCourtId === court.court_id ? ' (ít trùng nhất)' : ''}
                  </option>;
                })}
              </Select>
              <p className={styles.customModeHint}>
                {courtTouched
                  ? <>Bạn đã tự chọn sân.{' '}
                    <Button variant="secondary" type="button" className={styles.linkBtn} onClick={() => { resetConflictAdjustments(); setCourtTouched(false); }}>
                      Dùng sân ít trùng nhất
                    </Button></>
                  : 'Tự chọn sân ít buổi trùng nhất với lịch của bạn; đổi được.'}
              </p>
            </div>
            </>}

            {mode === 'custom' && <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Các buổi đã chọn ({customRanges.length} buổi · {customDates.length} ngày)</span>
              <p className={styles.customModeHint}>
                Bấm một ngày trên lịch tháng để mở bảng khung giờ của ngày đó, rồi bấm các ô trống để thêm buổi.
                Ô liền nhau trên cùng sân là một buổi; một ngày có thể có nhiều buổi, nhiều sân.
                Các buổi đã chọn hiện ở thanh tóm tắt dưới bảng.
              </p>
            </div>}

            <p className={styles.ruleHintText}>
              Định kỳ: tối thiểu 1 buổi/tuần, kéo dài từ 1 đến 12 tháng. Tất cả các buổi phải nằm trong vòng 1 năm
              kể từ hôm nay và trong thời hạn sử dụng dịch vụ của địa điểm, muộn nhất {formatDay(maxAllowedDate)}.
            </p>
          </aside>}

          <div className={styles.rightColumn}>
            {step === 0 && mode === 'recurring' && (
              <section className={styles.gridCard} aria-label="Khung giờ chơi hằng tuần">
                <div className={styles.gridHeader}>
                  <h2 className={styles.gridTitle}>Khung giờ chơi</h2>
                  <label className={styles.durationField}>
                    Thời lượng mỗi buổi
                    <Select className={styles.selectInput} value={currentDuration} disabled={timeKey == null}
                      onChange={(event) => changeDuration(Number(event.target.value))}>
                      {DURATIONS.map((minutes) => (
                        <option key={minutes} value={minutes}
                          disabled={currentTime?.start != null && minutes > closeMinute - currentTime.start}>
                          {durationLabel(minutes)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                {perDayTimes && selectedWeekdays.length > 0 && <Tabs label="Giờ chơi của từng thứ" value={timeKey} onChange={setTimeTab}
                  items={selectedWeekdays.map(day => ({ value: day, label: WEEKDAYS.find(entry => entry.value === day)?.label + (weeklyTimes[day]?.start != null ? ' · ' + toTimeLabel(weeklyTimes[day].start) : ' · Chưa chọn') }))} />}

                <p className={styles.gridHint} aria-live="polite">
                  {selectedWeekdays.length === 0
                    ? 'Chọn thứ trong tuần ở cột bên trái trước.'
                    : currentTime?.start != null
                      ? <>Đang chọn <strong>{toTimeLabel(currentTime.start)}–{toTimeLabel(currentTime.end)}</strong>
                        {currentTime.end - currentTime.start < currentDuration ? ` (rút ngắn vì ${toTimeLabel(closeMinute)} đóng cửa)` : ''}.
                        {' '}Bấm ô khác để đổi giờ bắt đầu; đổi thời lượng ở ô bên phải.</>
                      : "Bấm một ô để chọn giờ bắt đầu, rồi chọn thời lượng ở ô bên phải (tối thiểu 1 khung giờ = 30 phút)."}
                </p>

                {selectedWeekdays.length > 0 && !timeGrid && <LoadingState message="Đang tải giờ mở cửa…" />}
                {timeGrid?.error && <ErrorState message={uiMessage(timeGrid.error)} onRetry={retrySchedule} />}
                {selectedWeekdays.length > 0 && timeRow && (
                  <div className={gridStyles.wrapper}>
                    <table className={gridStyles.table}>
                      <tbody>
                        {PERIODS.map((period) => {
                          const cells = timeRow.slots.filter((slot) => {
                            const minute = toMinutes(slot.time);
                            return minute >= period.from && minute < period.to;
                          });
                          if (cells.length === 0) return null;
                          return (
                            <tr key={period.label}>
                              <th scope="row" className={gridStyles.court}>
                                {period.label}
                                <small className={styles.periodRange}>{cells[0].time}–{toTimeLabel(toMinutes(cells.at(-1).time) + 30)}</small>
                              </th>
                              {cells.map((slot) => {
                                const minute = toMinutes(slot.time);
                                const closed = slot.status === 'closed' || minute >= closeMinute;
                                const chosen = currentTime?.start != null && minute >= currentTime.start && minute < currentTime.end;
                                const tone = closed ? gridStyles.closed : chosen ? gridStyles.selected : gridStyles.available;
                                return (
                                  <td key={slot.time}>
                                    <Button type="button" className={`${gridStyles.cell} ${tone}`} disabled={closed}
                                      aria-pressed={closed ? undefined : chosen}
                                      aria-label={`${slot.time}${closed ? ', ngoài giờ mở cửa' : `, ${formatCurrency(slot.price)} mỗi 30 phút`}`}
                                      onClick={() => pickStart(minute)}>
                                      {slot.time}<small>{closed ? 'Đóng' : formatCurrency(slot.price)}</small>
                                    </Button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {selectedWeekdays.length > 0 && (
                  <p className={styles.customModeHint}>
                    Giá theo {formatDay(representativeDate)}; giá từng buổi xem ở bước sau.{' '}
                    <Button variant="secondary" type="button" className={styles.linkBtn} onClick={togglePerDayTimes}>
                      {perDayTimes ? 'Dùng cùng một giờ cho mọi thứ' : 'Mỗi thứ chơi một giờ khác nhau?'}
                    </Button>
                  </p>
                )}
              </section>
            )}

            <section className={styles.calendarCard} aria-label="Lịch dự kiến các buổi đặt">
              <div className={styles.calendarHeader}>
                <h2 className={styles.monthTitle}>
                  <Button variant="secondary" type="button" className={styles.navBtn} onClick={() => shiftMonth(-1)} aria-label="Tháng trước">‹</Button>
                  {' '}{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}{' '}
                  <Button variant="secondary" type="button" className={styles.navBtn} onClick={() => shiftMonth(1)} aria-label="Tháng sau">›</Button>
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
                <div className={styles.monthSummary}>
                  {preview.months.map((m) => (
                    <span
                      key={m.month}
                      className={styles.monthChip}
                    >
                      Tháng {String(m.month).replace(/^(\d{4})-(\d{2})$/, '$2/$1')}: {m.totalSessions ?? m.sessions ?? 0} buổi
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
                    mode === 'custom' && day.dateKey === gridDate ? styles.dayCellActive : '',
                  ].filter(Boolean).join(' ');
                  const first = day.sessions[0];
                  const isOutOfWindow = day.dateKey < today || day.dateKey > maxAllowedDate;

                  return (
                    <Button variant="secondary"
                      type="button"
                      key={day.dateKey}
                      disabled={isOutOfWindow || (mode !== 'custom' && day.sessions.length === 0)}
                      aria-current={mode === 'custom' && day.dateKey === gridDate ? 'date' : undefined}
                      aria-label={`${formatDay(day.dateKey)}${day.isConflicted ? ', trùng lịch' : day.isSelected ? ', có buổi' : ''}, xem các buổi trong ngày`}
                      className={className}
                      onClick={() => { setSelectedCalendarDate(day.dateKey); if (mode === 'custom' && step === 0) chooseGridDate(day.dateKey); else { setStep(1); if (day.isConflicted) openSessionCompensation(day.sessions.find(session => session.conflict)); } }}
                    >
                      <strong className={styles.dayNumber}>{day.day}</strong><span aria-hidden="true" className={day.isConflicted ? styles.conflictDot : day.isSelected ? styles.selectedDot : styles.noDot} />
                      {day.isConflicted
                        ? <span className={styles.conflictTag}>{CONFLICT_LABELS[first?.conflict] || 'Trùng lịch'}</span>
                        : first && (
                          <span className={styles.timeSubTag}>
                            {first.startTime}–{first.endTime}{day.sessions.length > 1 ? ` +${day.sessions.length - 1}` : ''}
                          </span>
                        )}
                    </Button>
                  );
                })}
              </div>

              {step === 1 && conflictedSessions.length > 0 && (
                <div className={styles.conflictResolutionBox} role="status">
                  <strong className={styles.conflictBoxTitle}>
                    {preview?.summary} — {conflictedSessions
                      .map((session) => `${session.date.slice(8)}/${session.date.slice(5, 7)} ${session.startTime}–${session.endTime} ${session.courtName} (${CONFLICT_LABELS[session.conflict] || session.conflict})`)
                      .join(', ')}
                  </strong>
                  <div className={styles.conflictActionRow}>
                    <Button type="button" className={styles.compensateBtn} onClick={openCompensation}>
                      Chọn khung giờ bù
                    </Button>
                    <Button variant="secondary" type="button" className={styles.removeConflictsBtn} onClick={removeAllConflicts}>
                      Bỏ tất cả buổi trùng
                    </Button>
                  </div>
                </div>
              )}
              {finalRequest && !result && <LoadingState message="Đang kiểm tra lịch gói…" />}
              {result?.error && <ErrorState message={uiMessage(result.error)} onRetry={() => setPreviewRevision(value => value + 1)} />}
              {notice && <p className={styles.notice} role="status">{uiMessage(notice)}</p>}
            </section>

            {step === 0 && mode === 'custom' && (
              <section className={styles.gridCard} aria-label="Bảng khung giờ của ngày đang chọn">
                <div className={styles.gridHeader}>
                  <h2 className={styles.gridTitle}>Bảng khung giờ {formatDay(gridDate)}</h2>
                  <div className={styles.gridDateNav}>
                    <Button variant="secondary" type="button" className={styles.navBtn} aria-label="Ngày trước"
                      disabled={gridDate <= today} onClick={() => chooseGridDate(shiftDay(gridDate, -1))}>‹</Button>
                    <Input type="date" className={styles.dateInput} aria-label="Chọn ngày xem bảng khung giờ"
                      min={today} max={maxAllowedDate} value={gridDate}
                      onChange={(event) => {
                        chooseGridDate(event.target.value);
                        if (event.target.value) setViewMonth(parseDateKey(event.target.value));
                      }} />
                    <Button variant="secondary" type="button" className={styles.navBtn} aria-label="Ngày sau"
                      disabled={gridDate >= maxAllowedDate} onClick={() => chooseGridDate(shiftDay(gridDate, 1))}>›</Button>
                  </div>
                </div>
                <p className={styles.gridHint}>Bấm ô trống để thêm vào gói, bấm lại ô đã chọn để bỏ. Đổi ngày khác vẫn giữ các buổi đã chọn.</p>
                {!customGrid && <LoadingState message="Đang tải lịch sân…" />}
                {customGrid?.error && <ErrorState message={uiMessage(customGrid.error)} onRetry={retrySchedule} />}
                {customGrid?.data?.time_headers.length === 0 && <p>Ngày này địa điểm không mở cửa.</p>}
                {customGrid?.data?.time_headers.length > 0 && (
                  <ScheduleGrid role="player" schedule={customGrid.data} selected={customGridSelected} allowBooking
                    onSlot={toggleCustomSlot}
                    mark={(court, slot) => conflictCells.has(`${gridDate}|${court.court_id}|${slot.time}`) ? 'conflict' : null}
                    markLegend={conflictedSessions.length ? ['conflict'] : []} />
                )}
              </section>
            )}

            {step === 1 && <section className={styles.sessionReview} aria-label="Danh sách buổi theo tuần">
              <div className={styles.gridHeader}><h2 className={styles.gridTitle}>Rà soát các buổi</h2><span>{sessions.length} buổi · {conflictedSessions.length} buổi trùng</span></div>
              {selectedCalendarDate && <p className={styles.gridHint}>Ngày đã chọn: {formatDay(selectedCalendarDate)}</p>}
              {!sessions.length && !finalRequest && <EmptyState title="Chưa có lịch để rà soát" description="Quay lại bước thiết lập để chọn ít nhất hai ngày chơi." action={<Button variant="secondary" onClick={() => setStep(0)}>Thiết lập lịch</Button>} />}
              {sessionWeeks.map(([week, entries]) => <div className={styles.weekGroup} key={week}><h3>Tuần {formatDay(week).split(', ')[1]} – {formatDay(shiftDay(week, 6)).split(', ')[1]}</h3>
                {entries.map(session => <article key={sessionKey(session)} className={[styles.sessionCard, session.conflict ? styles.sessionConflict : '', selectedCalendarDate === session.date ? styles.sessionHighlighted : ''].join(' ')}>
                  <div><h4>{formatDay(session.date)}</h4><p>{session.courtName} · {session.startTime}–{session.endTime}</p>
                    {session.conflict ? <StatusBadge category="slot" status={conflictStatus(session.conflict)} /> : <span className={styles.validSession}><StatusBadge category="slot" status="FREE" /> · {formatCurrency(session.listAmount)}</span>}
                  </div>
                  {session.conflict && <div className={styles.sessionActions}><Button onClick={() => openSessionCompensation(session)}>Chọn khung giờ bù</Button><Button variant="secondary" onClick={() => removeConflict(session)}>Bỏ buổi này</Button></div>}
                </article>)}
              </div>)}
            </section>}
            <BookingSummaryBar title={summaryTitle} hint={summaryHint} sticky expandable
              actionLabel={step === 0 ? "Rà soát lịch" : "Tiếp tục tóm tắt"} disabled={!preview || distinctDays < 2 || (step === 1 && conflictedSessions.length > 0)}
              onContinue={() => step === 0 ? setStep(1) : goToSummary()}>
              {mode === 'custom'
                ? <SelectedRanges ranges={customRanges} onRemove={removeCustomRange} showDate />
                : weeklyChips.length > 0 && (
                  <ul className={gridStyles.chips} aria-label="Lịch chơi hằng tuần">
                    {weeklyChips.map(({ day, text }) => (
                      <li key={day} className={gridStyles.chip}>
                        {text}
                        <Button type="button" className={gridStyles.chipRemove} aria-label={'Bỏ ' + text}
                          onClick={() => toggleWeekday(day)}>×</Button>
                      </li>
                    ))}
                  </ul>
                )}
            </BookingSummaryBar>
          </div>
        </div>
      </div>

      {showCompensation && (
        <Modal className={styles.compensationModal} labelledBy="modal-title" onClose={() => setShowCompensation(false)}>
          <div className={styles.modalCard}>
            <Button variant="secondary" type="button" className={styles.modalClose} aria-label="Đóng" onClick={() => setShowCompensation(false)}>×</Button>
            <h2 id="modal-title" className={styles.modalTitle}>Chọn khung giờ bù cho buổi trùng</h2>
            <p className={styles.modalSub}>
              Chọn buổi trùng cần bù, rồi bấm ô bắt đầu trên bảng: hệ thống tự lấy đủ thời lượng buổi. Đổi được sang ngày khác trong thời gian gói.
            </p>

            <div className={styles.targetPills} role="group" aria-label="Buổi trùng cần bù">
              {conflictedSessions.map((session) => {
                const key = originalKeyOf(session);
                const picked = compensationPicks[key];
                const className = [styles.targetPill, key === compensationTargetKey ? styles.targetPillActive : picked ? styles.targetPillDone : '']
                  .filter(Boolean).join(' ');
                return (
                  <Button key={key} type="button" className={className} aria-pressed={key === compensationTargetKey}
                    onClick={() => chooseCompensationTarget(session)}>
                    {formatDay(session.date)} · {session.courtName} · {session.startTime}–{session.endTime}{picked ? ' ✓' : ''}
                  </Button>
                );
              })}
            </div>

            {compensationTarget && (
              <p className={styles.notice} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', marginBottom: 10 }}>
                Buổi gốc {formatDay(compensationTarget.date)} · {compensationTarget.courtName} · {compensationTarget.startTime}–{compensationTarget.endTime}
                {' '}({CONFLICT_LABELS[compensationTarget.conflict] || 'Trùng lịch'}). Cần {compensationTarget.endMinute - compensationTarget.startMinute} phút
                {' '}= {(compensationTarget.endMinute - compensationTarget.startMinute) / 30} ô liên tiếp.
              </p>
            )}

            <div className={styles.gridHeader}>
              <strong>{compensationDate && formatDay(compensationDate)}{compensationTarget?.date === compensationDate ? ' (ngày gốc)' : ''}</strong>
              <div className={styles.gridDateNav}>
                <Button variant="secondary" type="button" className={styles.navBtn} aria-label="Ngày trước"
                  disabled={compensationDate <= compensationMinDate} onClick={() => chooseCompensationDate(shiftDay(compensationDate, -1))}>‹</Button>
                <Input type="date" className={styles.dateInput} aria-label="Ngày của khung giờ bù"
                  min={compensationMinDate} max={compensationMaxDate} value={compensationDate}
                  onChange={(event) => chooseCompensationDate(event.target.value)} />
                <Button variant="secondary" type="button" className={styles.navBtn} aria-label="Ngày sau"
                  disabled={compensationDate >= compensationMaxDate} onClick={() => chooseCompensationDate(shiftDay(compensationDate, 1))}>›</Button>
              </div>
            </div>

            {!compensationGrid && <LoadingState message="Đang tải lịch sân…" />}
            {compensationGrid?.error && <ErrorState message={uiMessage(compensationGrid.error)} onRetry={retrySchedule} />}
            {compensationGrid?.data?.time_headers.length === 0 && <p>Ngày này địa điểm không mở cửa.</p>}
            {compensationGrid?.data?.time_headers.length > 0 && (() => {
              const pick = compensationPicks[compensationTargetKey];
              const selected = pick && pick.date === compensationDate
                ? Array.from({ length: (pick.endMinute - pick.startMinute) / 30 }, (_, index) =>
                  ({ courtId: pick.courtId, time: toTimeLabel(pick.startMinute + index * 30) }))
                : [];
              return <ScheduleGrid role="player" schedule={compensationGrid.data} selected={selected} allowBooking={Boolean(compensationTarget)}
                onSlot={pickCompensation} mark={compensationMark} markLegend={['conflict', 'package']} />;
            })()}

            {compensationMessage && (
              <p role={compensationMessage.error ? 'alert' : 'status'}
                className={styles.pickMessage + (compensationMessage.error ? ' ' + styles.pickError : '')}>
                {compensationMessage.text}
              </p>
            )}

            <div className={styles.modalActions}>
              {conflictedSessions.length > 1 && compensationPicks[compensationTargetKey] && (
                <Button variant="secondary" type="button" className={styles.removeConflictsBtn} onClick={applyPickToAll}>
                  Dùng sân và giờ này cho cả {conflictedSessions.length} buổi trùng
                </Button>
              )}
              <Button variant="secondary" type="button" className={styles.removeConflictsBtn} onClick={() => setShowCompensation(false)}>Quay lại</Button>
              <Button type="button" className={styles.confirmScheduleBtn} disabled={!Object.keys(compensationPicks).length}
                onClick={applyCompensation}>
                Áp dụng khung giờ bù ({Object.keys(compensationPicks).length}/{conflictedSessions.length})
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PublicLayout>
  );
}
