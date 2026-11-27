import { DatePicker as UiDatePicker } from '../../components/ui';
import HistoryDetailDialog from './HistoryDetailDialog';
import { subscribeLiveRefresh } from '../../utils/liveRefresh';
import { bookingStartsAfter, canPayHistoryEntry, canRescheduleBooking } from '../../api/bookingHistory';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import styles from './MyBookingsPage.module.css';
import { money, shortDate, uiMessage } from '../../utils/formatters';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, FormField, Input, Select, Modal, PageHeader, StatusBadge, Tabs, STATUS_CATALOG } from '../../components/common';
import PublicLayout from '../../components/layout/PublicLayout';
import ScheduleGrid from '../../components/schedule/ScheduleGrid';

// Phân nhóm 10 trạng thái chính thức theo chuẩn SRS (Sheet Trang_thai)
const PENDING_STATUSES = ['holding', 'resubmit_requested', 'awaiting_confirmation'];
const PAST_STATUSES = [
  'completed',
  'cancelled_by_player',
  'cancelled_by_facility',
  'expired',
  'payment_rejected',
];

// UC22: Nhãn nguyên nhân và kết quả xử lý booking bị ảnh hưởng
const AFFECTED_CAUSES = {
  OWNER_CANCELLED: 'Sân hủy lịch',
  MAINTENANCE: 'Sân bảo trì',
  COURT_DISABLED: 'Sân tạm ngừng hoạt động',
  HOURS_CHANGED: 'Địa điểm đổi giờ mở cửa',
};
const AFFECTED_CHOICES = {
  RESCHEDULE: "Đã đổi khung giờ miễn phí",
  REFUND: 'Đã chọn hoàn tiền',
  POINTS: 'Đã nhận điểm bồi hoàn',
};

function indexAffected(items) {
  const latest = {};
  for (const item of items) {
    if (!latest[item.bookingId]) latest[item.bookingId] = item;
  }
  return latest;
}

function formatSlotTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const SLOT_MINUTES = 30;
const dayLabelFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: 'UTC' });
const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function serverTimestamp(value) {
  if (!value) return Number.NaN;
  return Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+07:00');
}

const formatDeadline = (value) => new Date(serverTimestamp(value))
  .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

/** UC21: "Sân A · 2026-11-20 · 17:30–19:00" cho slot cũ (from) hoặc slot mới (to) của một lần đổi lịch. */
const describeSlot = (change, side) => [
  change[side + 'CourtName'], shortDate(change[side + 'Date']),
  change[side + 'StartTime'] + '–' + change[side + 'EndTime'],
].filter(Boolean).join(' · ');

const formatVnd = (value) => money(value).replace(/\s*₫/, 'đ');

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [notificationParams, setNotificationParams] = useSearchParams();
  const requestedBooking = notificationParams.get('bookingId');
  const requestedPackage = notificationParams.get('packageId');
  const { user } = useAuth();
  const {
    getMyBookingsApi,
    createBookingReviewApi,
    getPackageSessionsApi,
    getMyAffectedBookingsApi,
    getAffectedBookingApi,
    submitAffectedChoiceApi,
    previewRescheduleApi,
    createRescheduleApi,
    getVenueSchedule,
  } = useBookingActions();
  const isPlayer = user?.role_code === 'player';

  // Bộ lọc hiển thị, không thay đổi dữ liệu hoặc điều kiện thao tác.
  const [activeTab, setActiveTab] = useState('all');
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [exactStatus, setExactStatus] = useState('');
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [fetchError, setFetchError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // Tick mỗi giây để cập nhật đồng hồ đếm ngược cho các booking 'holding' (BR03)
  const [nowMs, setNowMs] = useState(() => Date.now());

  // State Modal xem chi tiết đơn đặt sân (UC17 #3-5, FR35, FR51, FR52, FR57)
  const [manualDetailTarget, setDetailTarget] = useState(null);
  const notificationTarget = useMemo(() => {
    const id = requestedPackage || requestedBooking;
    if (!isPlayer || !/^[1-9]\d*$/.test(id || '')) return null;
    return { booking_id: Number(id), booking_type: requestedPackage ? 'package' : 'single', booking_code: '#' + id };
  }, [isPlayer, requestedBooking, requestedPackage]);
  const detailTarget = manualDetailTarget || notificationTarget;

  const closeDetail = () => {
    setDetailTarget(null);
    if (requestedBooking || requestedPackage) {
      setNotificationParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('bookingId');
        next.delete('packageId');
        return next;
      }, { replace: true });
    }
  };


  // UC31: State Modal đánh giá sân sau khi hoàn tất buổi chơi
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const [packageLoading, setPackageLoading] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState([]);
  // UC22: Bản ghi affected mới nhất theo booking và hộp xác nhận lựa chọn
  const [affectedByBooking, setAffectedByBooking] = useState({});
  const [affectedReady, setAffectedReady] = useState(false);
  const [affectedError, setAffectedError] = useState('');
  const [affectedRevision, setAffectedRevision] = useState(0);
  const [affectedLoading, setAffectedLoading] = useState(false);
  const [choiceTarget, setChoiceTarget] = useState(null);
  const [choiceSubmitting, setChoiceSubmitting] = useState(false);
  const [choiceError, setChoiceError] = useState('');

  // UC21: State cho Modal đổi lịch (chọn slot mới, xem chênh lệch và xác nhận)
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDeadline, setRescheduleDeadline] = useState(null);
  // Slot mới được chọn trên bảng lịch sân: một dải khung giờ liền nhau trên cùng một sân
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [newPlayDate, setNewPlayDate] = useState('');
  const [startMin, setStartMin] = useState(null);
  const [endMin, setEndMin] = useState(null);
  const [rsSchedule, setRsSchedule] = useState(null);
  const [rsRevision, setRsRevision] = useState(0);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [reviewReschedule, setReviewReschedule] = useState(false);
  const quoteRequest = useRef(null);
  const deadlinePassed = rescheduleDeadline && serverTimestamp(rescheduleDeadline) <= nowMs;

  useEffect(() => () => {
    quoteRequest.current?.abort();
  }, []);

  useEffect(() => {
    if (!isPlayer) return undefined;
    let active = true;
    getMyBookingsApi().then((items) => {
      if (!active) return;
      setExpandedPackages([]);
      setBookings(items);
    }).catch((error) => {
      if (active) setFetchError(error.response?.data?.message || 'Không tải được lịch sử đặt sân.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isPlayer, reload, getMyBookingsApi]);

  useEffect(() => {
    if (!isPlayer) return undefined;
    const controller = new AbortController();
    async function refreshAffected() {
      try {
        if (document.visibilityState === 'hidden') return;
        const affected = await getMyAffectedBookingsApi(controller.signal);
        if (controller.signal.aborted) return;
        setAffectedByBooking(indexAffected(affected));
        setAffectedReady(true);
        setAffectedError('');
      } catch (error) {
        if (!controller.signal.aborted) {
          setAffectedReady(false);
          setAffectedError(error.response?.data?.message || "Không tải được đặt sân bị ảnh hưởng.");
        }
      }
    }
    const stop = subscribeLiveRefresh(refreshAffected, 5000, true);
    return () => { controller.abort(); stop(); };
  }, [isPlayer, affectedRevision, getMyAffectedBookingsApi]);

  useEffect(() => {
    if (!isPlayer || loading) return undefined;
    let active = true;
    let updating = false;
    const stop = subscribeLiveRefresh(async () => {
      if (updating || document.visibilityState === 'hidden') return;
      updating = true;
      try {
        const [items, packages] = await Promise.all([
          getMyBookingsApi(),
          Promise.allSettled(expandedPackages.map(getPackageSessionsApi)),
        ]);
        if (active) { setFetchError(''); setBookings((current) => [
          ...items,
          ...packages.flatMap((result, index) => result.status === 'fulfilled' ? result.value
            : current.filter((item) => item.package_id === expandedPackages[index])),
        ]); }
      } catch {
        // Keep the last successful list while polling.
      } finally {
        updating = false;
      }
    });
    return () => { active = false; stop(); };
  }, [isPlayer, loading, fetchError, reload, expandedPackages, getMyBookingsApi, getPackageSessionsApi]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // UC21/UC22: Tải bảng lịch sân của địa điểm theo ngày đang xem trong modal đổi lịch
  const rsLocationId = rescheduleTarget?.booking.location_id;
  const rsBookingId = rescheduleTarget?.booking.booking_id;
  const rsKey = rsLocationId && newPlayDate ? rsBookingId + ':' + newPlayDate + ':' + rsRevision : null;
  useEffect(() => {
    if (!rsKey) return undefined;
    const controller = new AbortController();
    getVenueSchedule(rsLocationId, newPlayDate, controller.signal, rsBookingId).then((data) => {
      if (!controller.signal.aborted) setRsSchedule({ key: rsKey, data, maxDate: data.max_date });
    }).catch((error) => {
      if (!controller.signal.aborted) setRsSchedule((prev) => ({
        key: rsKey,
        maxDate: prev?.maxDate ?? null,
        error: error.response?.data?.message || 'Không tải được lịch sân.',
      }));
    });
    return () => controller.abort();
  }, [rsKey, rsLocationId, rsBookingId, newPlayDate, getVenueSchedule]);
  const rsCurrent = rsSchedule?.key === rsKey ? rsSchedule : null;
  const rsMaxDate = rsSchedule?.maxDate ?? null;
  const rsSelected = useMemo(() => {
    if (selectedCourtId == null || startMin == null || !rsCurrent?.data) return [];
    const court = rsCurrent.data.courts.find((c) => c.court_id === selectedCourtId);
    return (court?.slots || [])
      .filter((s) => toMinutes(s.time) >= startMin && toMinutes(s.time) < endMin)
      .map((s) => ({ courtId: court.court_id, courtName: court.court_name, time: s.time, price: Number(s.price) }));
  }, [rsCurrent, selectedCourtId, startMin, endMin]);
  const originalBooking = rescheduleTarget?.booking;
  const originalStart = originalBooking?.start_time ? toMinutes(originalBooking.start_time) : null;
  const originalEnd = originalBooking?.end_time ? toMinutes(originalBooking.end_time) : null;
  const originalMinutes = originalStart != null && originalEnd != null ? originalEnd - originalStart : 0;
  const showingOriginalDate = newPlayDate === originalBooking?.booking_date && originalMinutes > 0;
  const isOriginalSlot = showingOriginalDate
    ? (court, slot) => {
      const sameCourt = originalBooking.court_id == null
        ? court.court_name === originalBooking.court_name
        : String(court.court_id) === String(originalBooking.court_id);
      const minute = toMinutes(slot.time);
      return sameCourt && minute >= originalStart && minute < originalEnd;
    }
    : undefined;
  const selectedMinutes = rsSelected.length > 0 ? endMin - startMin : 0;
  const missingSlots = selectedMinutes > 0 ? Math.ceil((originalMinutes - selectedMinutes) / SLOT_MINUTES) : 0;

  const clearQuote = () => {
    quoteRequest.current?.abort();
    setQuote(null);
    setQuoteError('');
    setQuoteLoading(false);
  };

  const clearRescheduleSlot = () => {
    setSelectedCourtId(null);
    setStartMin(null);
    setEndMin(null);
    clearQuote();
  };

  const chooseRescheduleDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today() || (rsMaxDate && value > rsMaxDate)) return;
    setNewPlayDate(value);
    clearRescheduleSlot();
  };

  const shiftRescheduleDate = (offset) => {
    const value = new Date(newPlayDate + 'T12:00:00Z');
    value.setUTCDate(value.getUTCDate() + offset);
    chooseRescheduleDate(value.toISOString().slice(0, 10));
  };

  // Chọn slot trên bảng: bấm ô liền kề để kéo dài, bấm ô đầu/cuối để bớt, bấm ô khác sân/không liền kề để chọn lại
  const pickRescheduleSlot = (court, slot) => {
    const t = toMinutes(slot.time);
    const sameCourt = selectedCourtId === court.court_id && startMin != null;
    const extending = sameCourt && (t === endMin || t + SLOT_MINUTES === startMin);
    if (rescheduleTarget.affected && extending && originalMinutes > 0 && endMin - startMin + SLOT_MINUTES > originalMinutes) {
      setQuoteError('Đổi miễn phí chỉ áp dụng cho khung bằng hoặc ngắn hơn lịch gốc.');
      return;
    }
    clearQuote();
    if (sameCourt && t === endMin) { setEndMin(t + SLOT_MINUTES); return; }
    if (sameCourt && t + SLOT_MINUTES === startMin) { setStartMin(t); return; }
    if (sameCourt && t === startMin && t + SLOT_MINUTES === endMin) { clearRescheduleSlot(); return; }
    if (sameCourt && t === startMin) { setStartMin(t + SLOT_MINUTES); return; }
    if (sameCourt && t + SLOT_MINUTES === endMin) { setEndMin(t); return; }
    setSelectedCourtId(court.court_id);
    setStartMin(t);
    setEndMin(t + SLOT_MINUTES);
  };

  const pendingCount = useMemo(
    () => bookings.filter((b) => PENDING_STATUSES.includes(b.status)).length,
    [bookings]
  );

  // Lọc và giữ nguyên thứ tự ưu tiên: Nhóm chờ thanh toán luôn nằm trên đầu
  const displayedBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    const isPast = (item) => {
      const lastDate = item.booking_type === 'package'
        ? item.time_range?.match(/\d{4}-\d{2}-\d{2}/g)?.at(-1) || item.booking_date : item.booking_date;
      return PAST_STATUSES.includes(item.status) ||
        (lastDate && lastDate < today() && !PENDING_STATUSES.includes(item.status));
    };
    const matches = (item) => (!exactStatus || item.status === exactStatus) &&
      (activeTab === 'all' || (activeTab === 'past' ? isPast(item) : !isPast(item))) &&
      (!query || [item.booking_code, item.facility_name, item.court_name]
        .some((value) => value?.toLocaleLowerCase('vi-VN').includes(query)));
    const childrenByPackage = new Map();
    const rows = [];
    for (const item of bookings) {
      if (item.booking_type === 'session') {
        if (!childrenByPackage.has(item.package_id)) childrenByPackage.set(item.package_id, []);
        childrenByPackage.get(item.package_id).push(item);
      } else rows.push(item);
    }
    rows.sort((a, b) => Number(PENDING_STATUSES.includes(b.status)) - Number(PENDING_STATUSES.includes(a.status)) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return rows.flatMap((item) => {
      const children = item.booking_type === 'package' && expandedPackages.includes(item.booking_id)
        ? childrenByPackage.get(item.booking_id) ?? [] : [];
      const filtered = children.filter(matches);
      if (matches(item)) return [item, ...filtered];
      return filtered.length ? [item, ...filtered] : [];
    });
  }, [bookings, activeTab, exactStatus, search, expandedPackages]);

  const formatDayBadge = (dateStr) => {
    if (!dateStr) return { day: '—', monthLabel: '' };
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? { day: '—', monthLabel: '' } : {
      day: String(d.getDate()).padStart(2, '0'),
      monthLabel: 'Thg ' + (d.getMonth() + 1),
    };
  };

  const formatCountdown = (deadline) => {
    const secs = Math.ceil((deadline - nowMs) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleGoToPayment = (booking) => {
    if (['holding', 'resubmit_requested'].includes(booking.status) && !canPayHistoryEntry(booking, nowMs)) return;
    const param = booking.booking_type === 'package' ? 'packageId' : 'bookingId';
    navigate('/booking/payment?' + param + '=' + booking.booking_id);
  };

  const showPackageSessions = async (item) => {
    if (expandedPackages.includes(item.booking_id)) {
      setExpandedPackages((current) => current.filter((id) => id !== item.booking_id));
      return;
    }
    setPackageLoading(item.booking_id);
    setFeedbackBanner('');
    try {
      const sessions = await getPackageSessionsApi(item.booking_id);
      setBookings((current) => [
        ...current.filter((booking) => booking.package_id !== item.booking_id),
        ...sessions,
      ]);
      setExpandedPackages((current) => [...current, item.booking_id]);
    } catch (error) {
      setFeedbackBanner(error.response?.data?.message || 'Không tải được lịch của gói.');
    } finally {
      setPackageLoading(null);
    }
  };

  const openReviewModal = (booking) => {
    setReviewTarget(booking);
    setReviewRating(5);
    setReviewComment('');
    setReviewError('');
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || reviewSubmitting) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await createBookingReviewApi(reviewTarget.booking_id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setBookings((prev) =>
        prev.map((item) =>
          item.booking_type !== 'package' && item.booking_id === reviewTarget.booking_id
            ? { ...item, can_review: false }
            : item
        )
      );
      setFeedbackBanner(`Cảm ơn bạn đã gửi đánh giá ${reviewRating}★ cho ${reviewTarget.booking_code}!`);
      setReviewTarget(null);
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Không thể gửi đánh giá sân.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const closeRescheduleModal = () => {
    setReviewReschedule(false);
    clearRescheduleSlot();
    setRescheduleTarget(null);
  };

  const openRescheduleModal = (booking, affected = null, deadline = null) => {
    setRescheduleTarget({ booking, affected });
    setRescheduleDeadline(deadline);
    const playDate = booking.booking_date && booking.booking_date >= today() ? booking.booking_date : today();
    setNewPlayDate(playDate);
    clearRescheduleSlot();
    setRsSchedule(null);
    if (!booking.location_id) setQuoteError("Không xác định được địa điểm của đặt sân này.");
  };

  const beginAffectedAction = async (booking, affectedId, choice) => {
    if (affectedLoading) return;
    setAffectedLoading(true);
    setFeedbackBanner('');
    setChoiceError('');
    try {
      const affected = await getAffectedBookingApi(affectedId);
      setAffectedByBooking((current) => ({ ...current, [booking.booking_id]: affected }));
      if (affected.status !== 'PENDING') {
        setFeedbackBanner("đặt sân bị ảnh hưởng đã được xử lý.");
      } else if (choice === 'RESCHEDULE') {
        openRescheduleModal(booking, affected);
      } else {
        setChoiceTarget({ booking, affected, choice });
      }
    } catch (error) {
      setFeedbackBanner(error.response?.data?.message || "Không tải được chi tiết đặt sân bị ảnh hưởng.");
    } finally {
      setAffectedLoading(false);
    }
  };

  const handleRescheduleClick = (booking) => {
    const { reschedule } = booking;
    if (reschedule?.pendingRequestId) {
      navigate('/booking/payment?rescheduleId=' + reschedule.pendingRequestId);
      return;
    }
    if (!canRescheduleBooking(reschedule, nowMs)) return;
    setFeedbackBanner('');
    openRescheduleModal(booking, null, reschedule.deadline);
  };

  const handlePreviewQuote = async () => {
    if (!rescheduleTarget || rsSelected.length === 0 || deadlinePassed || rescheduleSubmitting) return;
    clearQuote();
    const controller = new AbortController();
    quoteRequest.current = controller;
    setQuoteLoading(true);
    try {
      const slot = {
        courtId: Number(selectedCourtId),
        date: newPlayDate,
        startMinute: Number(startMin),
        endMinute: Number(endMin),
      };
      const result = await previewRescheduleApi(rescheduleTarget.booking.booking_id, slot, controller.signal);
      if (!controller.signal.aborted) setQuote(result);
    } catch (err) {
      if (!controller.signal.aborted) setQuoteError(err.response?.data?.message || "khung giờ mới không hợp lệ hoặc không khả dụng.");
    } finally {
      if (!controller.signal.aborted) setQuoteLoading(false);
    }
  };

  const handleConfirmReschedule = async () => {
    setReviewReschedule(false);
    if (!rescheduleTarget || rsSelected.length === 0 || rescheduleSubmitting ||
        (!rescheduleTarget.affected && (!quote || deadlinePassed))) return;
    setRescheduleSubmitting(true);
    setQuoteError('');
    const slot = {
      courtId: Number(selectedCourtId),
      date: newPlayDate,
      startMinute: Number(startMin),
      endMinute: Number(endMin),
    };
    try {
      if (rescheduleTarget.affected) {
        // UC22: Đổi slot miễn phí cho booking bị ảnh hưởng
        const result = await submitAffectedChoiceApi(rescheduleTarget.affected.id, 'RESCHEDULE', slot);
        setFeedbackBanner(result.choice === 'RESCHEDULE'
          ? `Đặt sân ${rescheduleTarget.booking.booking_code} đã được đổi khung giờ miễn phí.`
          : `Đã quá giờ chơi. Hệ thống tự cộng ${result.compensationPoints ?? 0} điểm bồi hoàn.`);
        closeRescheduleModal();
        setAffectedByBooking((current) => ({ ...current, [result.bookingId]: result }));
        setAffectedRevision((value) => value + 1);
        setReload((value) => value + 1);
      } else {
        // UC21: Đổi lịch bình thường
        const req = await createRescheduleApi(rescheduleTarget.booking.booking_id, slot);
        if (req.status === 'APPROVED') {
          setFeedbackBanner(`Đổi lịch thành công cho đặt sân ${rescheduleTarget.booking.booking_code}!`);
          closeRescheduleModal();
          const items = await getMyBookingsApi();
          setExpandedPackages([]);
          setBookings(items);
        } else if (req.status === 'PENDING_PAYMENT' || req.status === 'AWAITING_CONFIRMATION') {
          closeRescheduleModal();
          navigate('/booking/payment?rescheduleId=' + req.id);
        } else {
          setQuote(null);
          setQuoteError("Đổi lịch không thành công. đặt sân giữ giờ cũ.");
        }
      }
    } catch (err) {
      setQuote(null);
      setQuoteError(err.response?.data?.message || 'Không thể tạo yêu cầu đổi lịch.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // UC22: Player chọn hoàn tiền hoặc điểm bồi hoàn cho booking bị ảnh hưởng
  const handleConfirmChoice = async () => {
    if (!choiceTarget || choiceSubmitting) return;
    const { booking, affected, choice } = choiceTarget;
    setChoiceSubmitting(true);
    setFeedbackBanner('');
    setChoiceError('');
    try {
      const result = await submitAffectedChoiceApi(affected.id, choice);
      setAffectedByBooking((current) => ({ ...current, [booking.booking_id]: result }));
      setBookings((prev) =>
        prev.map((item) =>
          item.booking_type !== 'package' && item.booking_id === booking.booking_id
            ? {
                ...item,
                status: 'cancelled_by_facility',
                status_name: 'Sân hủy',
              }
            : item
        )
      );
      const done = result.choice === 'POINTS'
        ? `Đã cộng ${result.compensationPoints ?? ''} điểm bồi hoàn. Điểm và phiếu ưu đãi đã dùng được trả lại.`
        : 'Đã ghi nhận yêu cầu hoàn tiền. Chủ sân sẽ chuyển khoản cho bạn.';
      setFeedbackBanner(booking.booking_code + ' · ' + done + (result.defaultChoice ? ' (đã quá giờ chơi, hệ thống tự cấp điểm)' : ''));
      setAffectedRevision((value) => value + 1);
      setChoiceTarget(null);
    } catch (err) {
      setChoiceError(err.response?.data?.message || 'Không gửi được lựa chọn.');
      if (err.response?.status === 409) setAffectedRevision((value) => value + 1);
    } finally {
      setChoiceSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ returnTo: '/my-bookings' }} replace />;
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Người chơi xem được lịch sử đặt sân cá nhân.</p>;

  return (
    <PublicLayout fullWidth className={styles.pageWrapper}>
      <div className={styles.mainContainer}>
        <PageHeader eyebrow="LỊCH CỦA BẠN" title="Lịch đặt sân"
          subtitle="Theo dõi thanh toán, xem chi tiết và chuẩn bị cho buổi chơi tiếp theo."
          actions={<Button onClick={() => navigate('/locations')}>Tìm sân để đặt</Button>} />
        <div className={styles.historyTools}>
          <Tabs label="Thời gian đặt sân" value={activeTab} onChange={setActiveTab}
            items={[{ value: 'upcoming', label: 'Sắp tới' }, { value: 'past', label: 'Đã qua' }, { value: 'all', label: 'Tất cả' }]} />
          <div className={styles.filterRow}>
            <FormField label="Tìm lịch đặt sân" id="history-search"><Input type="search" placeholder="Mã đặt sân, địa điểm hoặc tên sân"
              value={search} onChange={(event) => setSearch(event.target.value)} /></FormField>
            <FormField label="Trạng thái" id="history-status"><Select value={exactStatus} onChange={(event) => setExactStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_CATALOG.booking).map(([code, entry]) => <option key={code} value={code.toLowerCase()}>{entry.label}</option>)}
            </Select></FormField>
          </div>
          {!loading && !fetchError && <p className={styles.resultCount}>{displayedBookings.filter((item) => item.booking_type !== 'session').length} đơn / gói · {pendingCount} mục chờ thanh toán hoặc xác nhận</p>}
        </div>
        {feedbackBanner && (
          <div className={styles.feedbackBanner} role="status">
            <span>{uiMessage(feedbackBanner)}</span>
            <Button
              type="button"
              variant="ghost" className={styles.closeBannerBtn}
              aria-label="Đóng thông báo"
              onClick={() => setFeedbackBanner('')}
            >
              ✕
            </Button>
          </div>
        )}

        {fetchError && <ErrorState message={uiMessage(fetchError)} onRetry={() => { setFetchError(''); setLoading(true); setReload((value) => value + 1); }} />}
        {affectedError && <ErrorState message={uiMessage(affectedError)} onRetry={() => setAffectedRevision((value) => value + 1)} />}

        <div className={styles.masterDetail}><section aria-label="Danh sách lịch đặt sân" className={styles.listColumn}>
        {loading ? (
          <LoadingState message="Đang tải lịch đặt sân…" />
        ) : fetchError ? null : displayedBookings.length === 0 ? (
          <EmptyState title="Chưa có lịch đặt sân phù hợp" description="Thử bỏ bớt từ khóa hoặc đổi bộ lọc. Bạn cũng có thể tìm sân cho buổi chơi tiếp theo."
            action={<div className={styles.actionGroup}><Button variant="secondary" onClick={() => { setSearch(''); setExactStatus(''); setActiveTab('all'); }}>Xóa bộ lọc</Button><Button onClick={() => navigate('/locations')}>Tìm sân</Button></div>} />
        ) : (
          <div className={styles.bookingList}>
            {displayedBookings.map((item) => {
              const { day, monthLabel } = formatDayBadge(item.booking_date);
              const affected = item.booking_type !== 'package' ? affectedByBooking[item.booking_id] : null;
              const affectedPending = affected?.status === 'PENDING' && item.status === 'confirmed';
              const canChooseAffected = affectedReady && affectedPending && bookingStartsAfter(item.booking_date, item.start_time, nowMs);

              let secondaryLine = item.sub_note || '';
              if (item.status === 'holding') {
                if (Number.isFinite(item.hold_deadline_ms)) {
                  secondaryLine = item.hold_deadline_ms > nowMs
                    ? `${formatCountdown(item.hold_deadline_ms)} còn lại để thanh toán`
                    : 'Đang cập nhật trạng thái giữ chỗ…';
                }
              } else if (item.status === 'resubmit_requested') {
                secondaryLine = 'Nhân viên yêu cầu gửi lại chứng từ.';
              } else if (affectedPending) {
                secondaryLine = canChooseAffected
                  ? `Đặt sân ${item.booking_code} bị ảnh hưởng do ${AFFECTED_CAUSES[affected.cause] || affected.cause}. Chọn đổi khung giờ miễn phí, hoàn tiền hoặc điểm bồi hoàn trước ${item.start_time} ngày ${shortDate(item.booking_date)}. Nếu không chọn, bạn sẽ nhận điểm bồi hoàn.`
                  : "đặt sân bị ảnh hưởng. Hệ thống tự cấp điểm bồi hoàn khi quá giờ chơi.";
              } else if (affected?.status === 'RESOLVED') {
                secondaryLine = `${AFFECTED_CAUSES[affected.cause] || affected.cause} · ${AFFECTED_CHOICES[affected.choice] || affected.choice}`
                  + (affected.choice === 'POINTS' && affected.compensationPoints != null ? ` (+${affected.compensationPoints} điểm)` : '')
                  + (affected.defaultChoice ? ' · tự động do quá giờ chơi' : '');
              }

              return (
                <article key={item.booking_type + '-' + item.booking_id} className={styles.bookingCard + (detailTarget?.booking_type === item.booking_type && detailTarget?.booking_id === item.booking_id ? ' ' + styles.selectedCard : '') + (item.booking_type === 'session' ? ' ' + styles.bookingChild : '')}>
                  {/* Khối trái: Ô lịch Ngày/Tháng + Thông tin sân */}
                  <div className={styles.cardLeft}>
                    <time className={styles.dateBox} dateTime={item.booking_date} aria-label={shortDate(item.booking_date)}>
                      <strong className={styles.dateDay}>{day}</strong>
                      <span className={styles.dateMonth}>{monthLabel}</span>
                    </time>

                    <div className={styles.bookingDetails}>
                      <div className={styles.titleRow}>
                        <h2 className={styles.facilityCourtTitle}>
                          {item.facility_name} · {item.court_name}
                        </h2>
                        <StatusBadge category="booking" status={item.status} />
                      </div>

                      <p className={styles.timeMetaLine}>
                        {item.booking_code} · {item.booking_type === 'package' ? item.time_range.replace(/\d{4}-\d{2}-\d{2}/g, (date) => shortDate(date)) : item.time_range}
                        {item.booker_label ? ` · ${item.booker_label}` : ''}
                      </p>
                      {item.reschedule_changes?.length > 0 && (
                        <ul className={styles.changeList} aria-label="Lịch đã đổi">
                          {item.reschedule_changes.map((change, index) => (
                            <li key={change.bookingId + ':' + index}>
                              <span className={styles.changeTag}>Đã đổi lịch</span>
                              {item.booking_type === 'package' && <span>Buổi {change.bookingCode}:</span>}
                              {change.fromDate && <span className={styles.changeFrom}>{describeSlot(change, 'from')}</span>}
                              {change.fromDate && <span className={styles.changeArrow} aria-label="sang">→</span>}
                              <strong>{describeSlot(change, 'to')}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.day_sessions?.length > 0 && (
                        <ul className={styles.orderRanges}>
                          {item.day_sessions.map((session) => (
                            <li key={session.booking_id}>{session.court_name} · {session.time_range}</li>
                          ))}
                        </ul>
                      )}

                      {secondaryLine && (
                        <p className={item.status === 'holding' ? styles.countdown : styles.subNoteLine} role={item.status === 'holding' ? 'timer' : undefined}>{secondaryLine}</p>
                      )}
                    </div>
                  </div>

                  {/* Khối phải: Giá tiền thực trả (final_amount) + Các nút thao tác theo trạng thái */}
                  <div className={styles.cardRight}>
                    <strong className={styles.priceText}>
                      {formatVnd(item.total_amount ?? item.final_amount)}
                    </strong>
                    {item.reschedule_surcharge > 0 && <span className={styles.subNoteLine}>Gồm phụ thu đổi lịch {formatVnd(item.reschedule_surcharge)}</span>}

                    <div className={styles.actionGroup}>
                      {/* Nút Xem chi tiết (UC17 #3-5, FR35, FR51, FR52, FR57) */}
                      <Button
                        type="button"
                        variant="secondary" className={styles.outlineActionBtn}
                        onClick={() => setDetailTarget(item)}
                      >
                        Xem chi tiết
                      </Button>

                      {/* 1. Trạng thái holding -> Nút Tiếp tục thanh toán */}
                      {item.status === 'holding' && canPayHistoryEntry(item, nowMs) && (
                        <Button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Tiếp tục thanh toán
                        </Button>
                      )}

                      {/* 2. Trạng thái resubmit_requested -> Nút Gửi lại chứng từ */}
                      {item.status === 'resubmit_requested' && canPayHistoryEntry(item, nowMs) && (
                        <Button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Gửi lại chứng từ
                        </Button>
                      )}

                      {/* 3. Trạng thái chờ xác nhận -> Xem thanh toán */}
                      {item.status === 'awaiting_confirmation' && item.booking_type !== 'session' && (
                        <Button type="button" variant="secondary" className={styles.outlineActionBtn} onClick={() => handleGoToPayment(item)}>
                          Xem thanh toán
                        </Button>
                      )}

                      {item.booking_type === 'package' && (item.status === 'confirmed' ||
                        (item.single_order && item.status === 'cancelled_by_player')) && (
                        <>
                          <Button
                            type="button"
                            variant="secondary" className={styles.outlineActionBtn}
                            onClick={() => showPackageSessions(item)}
                            disabled={packageLoading != null}
                            aria-expanded={expandedPackages.includes(item.booking_id)}
                          >
                            {packageLoading === item.booking_id ? 'Đang xử lý…' : expandedPackages.includes(item.booking_id) ? 'Thu gọn lịch' : item.single_order ? 'Xem lịch trong đơn' : 'Xem lịch gói'}
                          </Button>
                        </>
                      )}


                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </section>
        {desktop && !detailTarget && <aside className={styles.detailPlaceholder}><EmptyState title="Chi tiết lịch đặt sân" description="Chọn “Xem chi tiết” ở một thẻ bên trái để xem giá, biên nhận và các thao tác phù hợp." /></aside>}
        {detailTarget && (
          <HistoryDetailDialog key={detailTarget.booking_type + ':' + detailTarget.booking_id}
            presentation={desktop ? 'panel' : 'dialog'}
            item={detailTarget} now={nowMs} onClose={closeDetail} onPayment={handleGoToPayment}
            onReschedule={(booking) => { closeDetail(); handleRescheduleClick(booking); }}
            affected={detailTarget.booking_type !== 'package' ? affectedByBooking[detailTarget.booking_id] : null}
            affectedReady={affectedReady} affectedLoading={affectedLoading}
            onAffected={(booking, id, choice) => { closeDetail(); beginAffectedAction(booking, id, choice); }}
            extraActions={(target) => <>
              {bookings.find((row) => row.booking_type === target.booking_type && row.booking_id === target.booking_id)?.can_review &&
                <Button onClick={() => { closeDetail(); openReviewModal(target); }}>Đánh giá</Button>}
              {target.booking_type !== 'package' && !['holding', 'awaiting_confirmation', 'resubmit_requested', 'expired', 'payment_rejected'].includes(target.status) &&
                <Button variant="secondary" onClick={() => navigate('/my-bookings/' + target.booking_id + '/reschedules')}>Lịch sử đổi lịch</Button>}
              {target.booking_type !== 'package' && target.status !== 'holding' &&
                <Button variant="ghost" onClick={() => navigate('/my-complaints?bookingId=' + target.booking_id)}>Gửi khiếu nại</Button>}
            </>} />
        )}
        </div>
      </div>

      {/* UC21: Modal chọn slot mới & xem chênh lệch đổi lịch */}
      {rescheduleTarget && (
        <Modal labelledBy="reschedule-title" className={styles.rescheduleModal} busy={rescheduleSubmitting} onDismiss={closeRescheduleModal}>
          <div className={styles.modalCard}>
            <h3 id="reschedule-title" className={styles.modalTitle}>
              {rescheduleTarget.affected ? "Đổi khung giờ miễn phí" : 'Đổi lịch đặt sân'} — {rescheduleTarget.booking.booking_code}
            </h3>
            <p className={styles.modalBody} style={{ marginBottom: 14 }}>
              Lịch hiện tại tại <strong>{originalBooking.facility_name}</strong> · {originalBooking.court_name}
              {' · '}{shortDate(originalBooking.booking_date)} · {originalBooking.time_range}
            </p>

            <p className={styles.modalBody}>
              Chọn sân và giờ mới tại <strong>{originalBooking.facility_name}</strong>.
              {rescheduleDeadline && <> Hạn đổi của lịch này là <strong>{formatDeadline(rescheduleDeadline)}</strong>.</>}
            </p>
            {rsLocationId && <>
              <div className={styles.rsDateBar}>
                <Button type="button" variant="secondary" className={styles.rsNavBtn} aria-label="Ngày trước"
                  disabled={rescheduleSubmitting || newPlayDate <= today()} onClick={() => shiftRescheduleDate(-1)}>‹</Button>
                <span className={styles.rsDateLabel}>{newPlayDate && dayLabelFormat.format(new Date(newPlayDate + 'T12:00:00Z'))}</span>
                <Button type="button" variant="secondary" className={styles.rsNavBtn} aria-label="Ngày sau"
                  disabled={rescheduleSubmitting || !rsMaxDate || newPlayDate >= rsMaxDate} onClick={() => shiftRescheduleDate(1)}>›</Button>
                <UiDatePicker className={styles.formInput} aria-label="Chọn ngày chơi mới"
                  style={{ width: 'auto', marginInlineStart: 'auto' }}
                  min={today()} max={rsMaxDate || undefined} value={newPlayDate} disabled={rescheduleSubmitting}
                  onChange={(e) => chooseRescheduleDate(e.target.value)} />
              </div>

              {!rsCurrent && <LoadingState message="Đang tải lịch sân…" />}
              {rsCurrent?.error && <p role="alert" className={styles.errorBanner}>
                {uiMessage(rsCurrent.error)}{' '}
                <Button type="button" className="underline" onClick={() => setRsRevision((v) => v + 1)}>Thử lại</Button>
              </p>}
              {rsCurrent?.data?.time_headers.length === 0 && <p className={styles.modalBody}>Ngày này chưa có khung giờ mở đặt.</p>}
              {rsCurrent?.data?.time_headers.length > 0 && <ScheduleGrid schedule={rsCurrent.data} selected={rsSelected}
                courtsAsColumns initialTime={showingOriginalDate ? originalBooking.start_time.slice(0, 5) : undefined}
                isOriginalSlot={isOriginalSlot}
                allowBooking={!rescheduleSubmitting} showBooker={false} onSlot={pickRescheduleSlot} onInspect={() => {}} />}

              <p className={styles.modalBody} aria-live="polite" style={{ margin: '0 0 12px' }}>
                {rsSelected.length > 0
                  ? <>khung giờ mới: <strong>{rsSelected[0].courtName} · {formatSlotTime(startMin)}–{formatSlotTime(endMin)}</strong>
                    {' '}({(endMin - startMin)} phút · giá niêm yết {formatVnd(rsSelected.reduce((sum, s) => sum + s.price, 0))})</>
                  : "Bấm vào ô trống trên bảng để chọn khung giờ mới. Bấm các ô liền kề cùng sân để kéo dài thời gian."}
              </p>
              {missingSlots > 0 && !rescheduleTarget.affected && (
                <p className={styles.rescheduleWarning} role="status">
                  Khung mới ngắn hơn lịch gốc {originalMinutes - selectedMinutes} phút.
                  {' '}Chọn thêm {missingSlots} ô trống liền kề trên cùng sân để giữ đủ thời lượng.
                  {' '}Nếu khung mới rẻ hơn, phần chênh lệch sẽ không được hoàn lại.
                </p>
              )}
            </>}

            {!rescheduleTarget.affected && <div style={{ marginBottom: 12 }}>
              <Button
                type="button"
                variant="secondary" className={styles.outlineActionBtn}
                style={{ width: '100%' }}
                onClick={handlePreviewQuote}
                disabled={quoteLoading || rsSelected.length === 0 || Boolean(deadlinePassed) || rescheduleSubmitting}
              >
                {quoteLoading ? 'Đang xử lý…' : '🔍 Kiểm tra chênh lệch giá'}
              </Button>
            </div>}

            {(deadlinePassed || quoteError) && <p role="alert" className={styles.errorBanner} style={{ margin: '8px 0' }}>
              {deadlinePassed ? `Đã quá hạn đổi lịch tại ${originalBooking.facility_name}.` : uiMessage(quoteError)}
            </p>}

            {quote && (
              <div className={styles.quoteBox}>
                <div className={styles.quoteRow}>
                  <span>Giá khung giờ cũ:</span>
                  <strong>{formatVnd(Number(quote.oldListAmount || 0))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Giá khung giờ mới:</span>
                  <strong>{formatVnd(Number(quote.newListAmount || 0))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Đã thanh toán:</span>
                  <strong>{formatVnd(Number(quote.amountPaid))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Phụ thu chênh lệch:</span>
                  <strong style={{ color: quote.extraAmount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                    {quote.extraAmount > 0 ? `+${formatVnd(Number(quote.extraAmount))}` : '0đ (Đổi miễn phí)'}
                  </strong>
                </div>
                {quote.noDifferenceRefund && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    khung giờ mới có giá thấp hơn. Phần chênh lệch không được hoàn lại.
                  </p>
                )}
                {quote.extraAmount > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-warning)' }}>
                    Sau khi gửi chứng từ, địa điểm cần xác nhận phụ thu trước {new Date(serverTimestamp(quote.approveDeadline))
                      .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Lịch cũ được giữ trong lúc chờ.
                  </p>
                )}
                {quote.extraAmount === 0 && <p>Lịch mới có hiệu lực ngay khi bạn xác nhận.</p>}
              </div>
            )}

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="secondary" className={styles.outlineActionBtn}
                onClick={closeRescheduleModal}
                disabled={rescheduleSubmitting}
              >
                Đóng
              </Button>
              <Button
                type="button"
                className={styles.primaryActionBtn}
                onClick={() => setReviewReschedule(true)}
                disabled={rsSelected.length === 0 || (!rescheduleTarget.affected && (!quote || Boolean(deadlinePassed))) || rescheduleSubmitting}
              >
                {rescheduleSubmitting ? 'Đang xử lý…' : 'Xem lại yêu cầu'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {reviewReschedule && rsSelected.length > 0 && (
        <ConfirmDialog busy={rescheduleSubmitting} title="Xác nhận yêu cầu đổi lịch"
          onCancel={() => setReviewReschedule(false)} onConfirm={handleConfirmReschedule}>
          Đổi sang {rsSelected[0].courtName} tại {originalBooking.facility_name}, ngày {shortDate(newPlayDate)},
          {' '}từ {formatSlotTime(startMin)} đến {formatSlotTime(endMin)}.
          {quote?.extraAmount > 0
            ? ` Bạn sẽ chuyển sang thanh toán phụ thu ${formatVnd(Number(quote.extraAmount))}.`
            : ' Lịch mới có hiệu lực ngay sau khi xác nhận.'}
        </ConfirmDialog>
      )}

      {/* UC22: Hộp xác nhận lựa chọn cho booking bị ảnh hưởng */}
      {choiceTarget && (
        <Modal labelledBy="affected-choice-title" busy={choiceSubmitting} onDismiss={() => setChoiceTarget(null)}>
          <div className={styles.modalCard}>
            <h3 id="affected-choice-title" className={styles.modalTitle}>
              {choiceTarget.choice === 'REFUND' ? 'Yêu cầu hoàn tiền' : 'Nhận điểm bồi hoàn'} cho {choiceTarget.booking.booking_code}?
            </h3>
            <p className={styles.modalBody}>
              Đặt sân {choiceTarget.booking.booking_code} ({choiceTarget.booking.facility_name} · {choiceTarget.booking.court_name},{' '}
              {choiceTarget.booking.time_range}) sẽ chuyển sang <strong>Sân hủy</strong> và khung giờ được giải phóng. Điểm và phiếu ưu đãi
              đã dùng được trả lại.{' '}
              {choiceTarget.choice === 'REFUND'
                ? "Chủ sân sẽ chuyển khoản thủ công số tiền đã thanh toán; điểm đã tích từ đặt sân này bị thu hồi tương ứng."
                : 'Bạn nhận điểm bồi hoàn tương ứng số tiền đã thanh toán (1 điểm = 500đ) tại địa điểm này.'}{' '}
              Không thể đổi lựa chọn sau khi xác nhận.
            </p>
            {choiceError && <p role="alert" className={styles.errorBanner}>{uiMessage(choiceError)}</p>}
            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="secondary" className={styles.outlineActionBtn}
                onClick={() => setChoiceTarget(null)}
                disabled={choiceSubmitting}
              >
                Quay lại
              </Button>
              <Button
                type="button"
                className={styles.primaryActionBtn}
                onClick={handleConfirmChoice}
                disabled={choiceSubmitting}
              >
                {choiceSubmitting ? 'Đang xử lý…' : 'Xác nhận'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* UC31: Modal Đánh giá sân sau khi hoàn tất buổi chơi */}
      {reviewTarget && (
        <Modal labelledBy="review-booking-title" busy={reviewSubmitting} onDismiss={() => setReviewTarget(null)}>
          <div className={styles.modalCard}>
            <h3 id="review-booking-title" className={styles.modalTitle}>
              Đánh giá buổi chơi — {reviewTarget.booking_code}
            </h3>
            <p className={styles.modalBody} style={{ marginBottom: 12 }}>
              {reviewTarget.facility_name} · {reviewTarget.court_name} ({shortDate(reviewTarget.booking_date)} · {reviewTarget.time_range})
            </p>
            <div className={styles.formGroup}>
              <p id="review-rating-label" className={styles.formLabel}>Số sao đánh giá (1–5 sao)</p>
              <div className={styles.ratingGroup} role="group" aria-labelledby="review-rating-label">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    aria-label={star + ' sao'} aria-pressed={reviewRating === star} disabled={reviewSubmitting}
                    className={reviewRating === star ? styles.ratingSelected : styles.ratingButton}
                  >
                    {star} ★
                  </Button>
                ))}
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="review-comment">
                Nhận xét (không bắt buộc · tối đa 1.000 ký tự)
              </label>
              <textarea
                id="review-comment"
                rows={4}
                maxLength={1000}
                className={styles.formInput}
                disabled={reviewSubmitting} aria-describedby={reviewError ? "review-error review-count" : "review-count"}
                placeholder="Chia sẻ trải nghiệm của bạn về mặt sân, ánh sáng, dịch vụ..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </div>
            <p id="review-count" className={styles.subNoteLine}>{reviewComment.length}/1.000 ký tự</p>
            {reviewError && <p id="review-error" role="alert" className={styles.errorBanner}>{uiMessage(reviewError)}</p>}
            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="secondary" className={styles.outlineActionBtn}
                onClick={() => setReviewTarget(null)}
                disabled={reviewSubmitting}
              >
                Đóng
              </Button>
              <Button
                type="button"
                className={styles.primaryActionBtn}
                onClick={handleSubmitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? 'Đang xử lý…' : 'Gửi đánh giá'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PublicLayout>
  );
}
