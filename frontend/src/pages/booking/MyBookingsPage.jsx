import HistoryDetailDialog from './HistoryDetailDialog';
import { bookingStatusLabels, canPayHistoryEntry } from '../../api/bookingHistory';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import styles from './MyBookingsPage.module.css';
import { formatVnd } from '../../utils/formatters';
import { EmptyState, Feedback, Field, Modal } from '../../components/common/WorkspacePrimitives';
import { PublicHeader } from '../../components/layout/PublicLayout';

// Phân nhóm 10 trạng thái chính thức theo chuẩn SRS (Sheet Trang_thai)
const PENDING_STATUSES = ['holding', 'resubmit_requested', 'awaiting_confirmation'];
const CONFIRMED_STATUSES = ['confirmed', 'in_use'];
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
  RESCHEDULE: 'Đã đổi slot miễn phí',
  REFUND: 'Đã chọn hoàn tiền',
  POINTS: 'Đã nhận điểm bồi hoàn',
};

function formatSlotTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const TIME_OPTIONS = [];
for (let min = 0; min <= 1440; min += 30) {
  TIME_OPTIONS.push({ value: min, label: formatSlotTime(min) });
}

function serverTimestamp(value) {
  if (!value) return Number.NaN;
  return Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+07:00');
}

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getMyBookingsApi,
    cancelBookingApi,
    cancelDayOrderApi,
    createBookingReviewApi,
    getPackageSessionsApi,
    getRescheduleDeadlineApi,
    getRescheduleRequestsApi,
    getMyAffectedBookingsApi,
    getAffectedBookingApi,
    submitAffectedChoiceApi,
    previewRescheduleApi,
    createRescheduleApi,
    getLocationCourtsApi,
  } = useBookingActions();
  const isPlayer = user?.role_code === 'player';

  // Tab: 'all' | 'pending_payment' | 'confirmed' | 'past'
  const [activeTab, setActiveTab] = useState('all');
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
  const [detailTarget, setDetailTarget] = useState(null);

  // State Modal xác nhận Hủy booking theo BR07 / MSG66
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // UC31: State Modal đánh giá sân sau khi hoàn tất buổi chơi
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState([]);
  // UC22: Bản ghi affected mới nhất theo booking và hộp xác nhận lựa chọn
  const [affectedByBooking, setAffectedByBooking] = useState({});
  const [affectedLoading, setAffectedLoading] = useState(false);
  const [choiceTarget, setChoiceTarget] = useState(null);
  const [choiceSubmitting, setChoiceSubmitting] = useState(false);

  // UC21: State cho Modal đổi lịch (chọn slot mới, xem chênh lệch và xác nhận)
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDeadline, setRescheduleDeadline] = useState(null);
  const [availableCourts, setAvailableCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [newPlayDate, setNewPlayDate] = useState('');
  const [startMin, setStartMin] = useState(1080); // 18:00
  const [endMin, setEndMin] = useState(1140);   // 19:00
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  useEffect(() => {
    if (!isPlayer) return undefined;
    let active = true;
    Promise.all([getMyBookingsApi(), getMyAffectedBookingsApi().catch(() => [])]).then(([items, affected]) => {
      if (!active) return;
      const latest = {};
      for (const record of affected) {
        if (!latest[record.bookingId]) latest[record.bookingId] = record;
      }
      setAffectedByBooking(latest);
      if (active) {
        setExpandedPackages([]);
        setBookings(items);
      }
    }).catch((error) => {
      if (active) setFetchError(error.response?.data?.message || 'Không tải được lịch sử đặt sân.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isPlayer, reload, getMyBookingsApi, getMyAffectedBookingsApi]);

  useEffect(() => {
    if (!isPlayer || loading || fetchError) return undefined;
    let active = true;
    let updating = false;
    const timer = setInterval(async () => {
      if (updating || document.visibilityState === 'hidden') return;
      updating = true;
      try {
        const items = await getMyBookingsApi();
        if (active) setBookings((current) => [...items, ...current.filter((item) => item.booking_type === 'session')]);
      } catch {
        // Keep the last successful list while polling.
      } finally {
        updating = false;
      }
    }, 12_000);
    return () => { active = false; clearInterval(timer); };
  }, [isPlayer, loading, fetchError, reload, getMyBookingsApi]);

  // BR03: Đếm lùi thời gian thực cho các booking đang giữ chỗ (holding)
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      // Tự động chuyển sang expired nếu hết thời gian giữ chỗ mà chưa gửi chứng từ (MSG33)
      setBookings((prev) =>
        prev.map((item) => {
          if (item.status === 'holding' && item.hold_expires_at) {
            const left = serverTimestamp(item.hold_expires_at) - currentNow;
            if (left <= 0) {
              return {
                ...item,
                status: 'expired',
                status_name: 'Hết hạn',
                sub_note: 'Đã hết thời gian giữ chỗ mà chưa gửi chứng từ.',
              };
            }
          }
          return item;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const pendingCount = useMemo(
    () => bookings.filter((b) => PENDING_STATUSES.includes(b.status)).length,
    [bookings]
  );

  // Lọc và giữ nguyên thứ tự ưu tiên: Nhóm chờ thanh toán luôn nằm trên đầu
  const displayedBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    const statusGroup = { pending_payment: PENDING_STATUSES, confirmed: CONFIRMED_STATUSES, past: PAST_STATUSES }[activeTab];
    const matches = (item) => (!exactStatus || item.status === exactStatus) &&
      (!statusGroup || statusGroup.includes(item.status)) &&
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

  const formatCountdown = (expiresIso) => {
    if (!expiresIso) return '00:00';
    const secs = Math.max(0, Math.floor((serverTimestamp(expiresIso) - nowMs) / 1000));
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

  // BR07 / BR64 / MSG66: Xác nhận hủy booking hoặc hủy cả đơn đặt lẻ trong ngày
  const handleConfirmCancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setFeedbackBanner('');
    try {
      const isWholeOrder = cancelTarget.booking_type === 'package' && cancelTarget.single_order;
      const res = isWholeOrder
        ? await cancelDayOrderApi(cancelTarget.booking_id)
        : await cancelBookingApi(cancelTarget.booking_id);
      if (res?.success) {
        if (cancelTarget.single_order) {
          const orderPkgId = isWholeOrder ? cancelTarget.booking_id : cancelTarget.package_id;
          setCancelTarget(null);
          setFeedbackBanner('Đã hủy các booking chưa đến giờ chơi trong đơn. Tiền, điểm và voucher đã dùng không được hoàn lại.');
          const [items, sessions] = await Promise.all([
            getMyBookingsApi(),
            getPackageSessionsApi(orderPkgId).catch(() => []),
          ]);
          setExpandedPackages([orderPkgId]);
          setBookings([...items, ...sessions]);
          return;
        }
        setBookings((prev) =>
          prev.map((item) =>
            item.booking_type !== 'package' && item.booking_id === cancelTarget.booking_id
              ? {
                  ...item,
                  status: 'cancelled_by_player',
                  status_name: 'Người chơi đã hủy',
                  can_cancel: false,
                  sub_note: 'Hủy tự nguyện. Tiền và ưu đãi đã dùng không được hoàn lại.',
                }
              : item
          )
        );
        setFeedbackBanner(
          `Đã hủy ${cancelTarget.booking_code}. Tiền, điểm và voucher đã dùng không được hoàn lại.`
        );
        setCancelTarget(null);
      }
    } catch (err) {
      setFeedbackBanner(err.response?.data?.message || 'Không tải được trạng thái mới. Vui lòng mở lại lịch sử đặt sân để kiểm tra.');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
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

  const openRescheduleModal = async (booking, affected = null, deadline = null) => {
    setRescheduleTarget({ booking, affected });
    setRescheduleDeadline(deadline);
    setNewPlayDate(booking.booking_date || today());
    setStartMin(1080);
    setEndMin(1140);
    setQuote(null);
    setQuoteError('');
    setAvailableCourts([]);
    setSelectedCourtId('');
    try {
      if (booking.location_id) {
        const courts = await getLocationCourtsApi(booking.location_id);
        setAvailableCourts(courts);
        if (courts.length > 0) setSelectedCourtId(String(courts[0].id));
      }
    } catch (error) {
      setQuoteError(error.response?.data?.message || 'Không tải được danh sách sân.');
    }
  };

  const beginAffectedAction = async (booking, affectedId, choice) => {
    if (affectedLoading) return;
    setAffectedLoading(true);
    setFeedbackBanner('');
    try {
      const affected = await getAffectedBookingApi(affectedId);
      setAffectedByBooking((current) => ({ ...current, [booking.booking_id]: affected }));
      if (affected.status !== 'PENDING') {
        setFeedbackBanner('Booking bị ảnh hưởng đã được xử lý.');
      } else if (choice === 'RESCHEDULE') {
        await openRescheduleModal(booking, affected);
      } else {
        setChoiceTarget({ booking, affected, choice });
      }
    } catch (error) {
      setFeedbackBanner(error.response?.data?.message || 'Không tải được chi tiết booking bị ảnh hưởng.');
    } finally {
      setAffectedLoading(false);
    }
  };

  const handleRescheduleClick = async (booking) => {
    setRescheduleLoading(true);
    setFeedbackBanner('');
    try {
      const [latest] = await getRescheduleRequestsApi(booking.booking_id);
      if (latest?.status === 'PENDING_PAYMENT' && serverTimestamp(latest.holdExpiresAt) > Date.now()) {
        navigate('/booking/payment?rescheduleId=' + latest.id);
        return;
      }
      if (latest?.status === 'AWAITING_CONFIRMATION') {
        navigate('/booking/payment?rescheduleId=' + latest.id);
        return;
      }
      const deadline = await getRescheduleDeadlineApi(booking.booking_id);
      await openRescheduleModal(booking, null, deadline);
    } catch (error) {
      setFeedbackBanner(error.response?.data?.message || 'Không tải được yêu cầu đổi lịch.');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handlePreviewQuote = async () => {
    if (!rescheduleTarget || !selectedCourtId || !newPlayDate) return;
    setQuoteLoading(true);
    setQuoteError('');
    try {
      const slot = {
        courtId: Number(selectedCourtId),
        date: newPlayDate,
        startMinute: Number(startMin),
        endMinute: Number(endMin),
      };
      const result = await previewRescheduleApi(rescheduleTarget.booking.booking_id, slot);
      setQuote(result);
    } catch (err) {
      setQuote(null);
      setQuoteError(err.response?.data?.message || 'Slot mới không hợp lệ hoặc không khả dụng.');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || !selectedCourtId || !newPlayDate || rescheduleSubmitting) return;
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
          ? `Booking ${rescheduleTarget.booking.booking_code} đã được đổi slot miễn phí.`
          : `Đã quá giờ chơi. Hệ thống tự cộng ${result.compensationPoints ?? 0} điểm bồi hoàn.`);
        setRescheduleTarget(null);
        const [items, affectedList] = await Promise.all([getMyBookingsApi(), getMyAffectedBookingsApi()]);
        setExpandedPackages([]);
        setBookings(items);
        const latest = {};
        for (const r of affectedList) {
          if (!latest[r.bookingId]) latest[r.bookingId] = r;
        }
        setAffectedByBooking(latest);
      } else {
        // UC21: Đổi lịch bình thường
        const req = await createRescheduleApi(rescheduleTarget.booking.booking_id, slot);
        if (req.extraAmount === 0 || req.status === 'APPROVED') {
          setFeedbackBanner(`Đổi lịch thành công cho booking ${rescheduleTarget.booking.booking_code}!`);
          setRescheduleTarget(null);
          const items = await getMyBookingsApi();
          setExpandedPackages([]);
          setBookings(items);
        } else {
          setRescheduleTarget(null);
          navigate('/booking/payment?rescheduleId=' + req.id);
        }
      }
    } catch (err) {
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
    try {
      const result = await submitAffectedChoiceApi(affected.id, choice);
      setAffectedByBooking((current) => ({ ...current, [booking.booking_id]: result }));
      setBookings((prev) =>
        prev.map((item) =>
          item.booking_type !== 'package' && item.booking_id === booking.booking_id
            ? {
                ...item,
                status: 'cancelled_by_facility',
                status_name: 'Địa điểm đã hủy',
                can_cancel: false,
              }
            : item
        )
      );
      const done = result.choice === 'POINTS'
        ? `Đã cộng ${result.compensationPoints ?? ''} điểm bồi hoàn, điểm và voucher đã dùng được trả lại.`
        : 'Đã gửi yêu cầu hoàn tiền tới Chủ sân, điểm và voucher đã dùng được trả lại.';
      setFeedbackBanner(booking.booking_code + ' · ' + done + (result.defaultChoice ? ' (đã quá giờ chơi, hệ thống tự cấp điểm)' : ''));
      setChoiceTarget(null);
    } catch (err) {
      setFeedbackBanner(err.response?.data?.message || 'Không gửi được lựa chọn.');
      setChoiceTarget(null);
    } finally {
      setChoiceSubmitting(false);
    }
  };

  const getBadgeClass = (status) => {
    switch (status) {
      case 'holding':
        return styles.badgeHolding;
      case 'resubmit_requested':
        return styles.badgeResubmit;
      case 'awaiting_confirmation':
        return styles.badgeAwaiting;
      case 'confirmed':
      case 'in_use':
        return styles.badgeConfirmed;
      case 'completed':
      case 'expired':
      case 'cancelled_by_player':
      case 'cancelled_by_facility':
      case 'payment_rejected':
      default:
        return styles.badgePast;
    }
  };

  if (!user) return <Navigate to="/login" state={{ returnTo: '/my-bookings' }} replace />;
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Người chơi xem được lịch sử đặt sân cá nhân.</p>;

  return (
    <div className={`${styles.pageWrapper} cw-workspace`}>
      <PublicHeader user={user} />

      <main className={styles.mainContainer}>
        {/* Header Row: Tiêu đề + Nút Tìm sân để đặt */}
        <div className={styles.headerRow}>
          <h1 className={styles.pageTitle}>Lịch đặt sân</h1>
          <button
            type="button"
            className={styles.multiBookBtn}
            onClick={() => navigate('/')}
          >
            Tìm sân để đặt
          </button>
        </div>

        {/* Bộ lọc 4 Tab theo chuẩn UC17 */}
        <div className={styles.historyTools}>
          <Field label="Tìm lịch đặt sân" type="search" placeholder="Mã đặt sân, địa điểm hoặc tên sân"
            value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className={styles.filterTabs} role="group" aria-label="Trạng thái đặt sân">
          <button
            type="button"
            aria-pressed={activeTab === 'all'}
            className={`${styles.tabPill} ${activeTab === 'all' ? styles.tabPillActive : ''}`}
            onClick={() => { setExactStatus(''); setActiveTab('all'); }}
          >
            Tất cả
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'pending_payment'}
            className={`${styles.tabPill} ${
              activeTab === 'pending_payment' ? styles.tabPillActive : ''
            }`}
            onClick={() => { setExactStatus(''); setActiveTab('pending_payment'); }}
          >
            Thanh toán · {pendingCount}
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'confirmed'}
            className={`${styles.tabPill} ${
              activeTab === 'confirmed' ? styles.tabPillActive : ''
            }`}
            onClick={() => { setExactStatus(''); setActiveTab('confirmed'); }}
          >
            Đã xác nhận
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'past'}
            className={`${styles.tabPill} ${activeTab === 'past' ? styles.tabPillActive : ''}`}
            onClick={() => { setExactStatus(''); setActiveTab('past'); }}
          >
            Đã qua
          </button>
          <label>
            Trạng thái
            <select value={exactStatus} onChange={(event) => { setExactStatus(event.target.value); setActiveTab('all'); }}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(bookingStatusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
        </div>

        </div>
        {feedbackBanner && (
          <div className={styles.feedbackBanner} role="status">
            <span>{feedbackBanner}</span>
            <button
              type="button"
              className={styles.closeBannerBtn}
              aria-label="Đóng thông báo"
              onClick={() => setFeedbackBanner('')}
            >
              ✕
            </button>
          </div>
        )}

        {fetchError && <Feedback tone="error">{fetchError}<button className="cw-secondary" type="button" onClick={() => { setFetchError(''); setLoading(true); setReload((value) => value + 1); }}>Thử lại</button></Feedback>}

        {/* Danh sách các thẻ Booking */}
        {loading ? (
          <Feedback>Đang tải lịch đặt sân…</Feedback>
        ) : fetchError ? null : displayedBookings.length === 0 ? (
          <EmptyState action={search ? <button type="button" className="cw-secondary" onClick={() => setSearch('')}>Xóa từ khóa</button>
            : activeTab === 'all' ? <Link to="/" className="cw-secondary">Tìm sân</Link> : null}>
            {search ? 'Không tìm thấy lịch đặt sân phù hợp.' : 'Chưa có lịch đặt sân trong mục này.'}
          </EmptyState>
        ) : (
          <div className={styles.bookingList}>
            {displayedBookings.map((item) => {
              const { day, monthLabel } = formatDayBadge(item.booking_date);
              const affected = item.booking_type !== 'package' ? affectedByBooking[item.booking_id] : null;
              const affectedPending = affected?.status === 'PENDING' && item.status === 'confirmed';

              let secondaryLine = item.sub_note || '';
              if (item.status === 'holding') {
                secondaryLine = `${formatCountdown(item.hold_expires_at)} còn lại để thanh toán`;
              } else if (item.status === 'resubmit_requested') {
                secondaryLine = 'Nhân viên yêu cầu gửi lại chứng từ.';
              } else if (affectedPending) {
                secondaryLine = `${AFFECTED_CAUSES[affected.cause] || affected.cause}: chọn đổi slot, hoàn tiền hoặc điểm bồi hoàn trước giờ chơi. Quá giờ chơi hệ thống tự cấp điểm bồi hoàn.`;
              } else if (affected?.status === 'RESOLVED') {
                secondaryLine = `${AFFECTED_CAUSES[affected.cause] || affected.cause} · ${AFFECTED_CHOICES[affected.choice] || affected.choice}`
                  + (affected.choice === 'POINTS' && affected.compensationPoints != null ? ` (+${affected.compensationPoints} điểm)` : '')
                  + (affected.defaultChoice ? ' · tự động do quá giờ chơi' : '');
              }

              return (
                <article key={item.booking_type + '-' + item.booking_id} className={styles.bookingCard + (item.booking_type === 'session' ? ' ' + styles.bookingChild : '')}>
                  {/* Khối trái: Ô lịch Ngày/Tháng + Thông tin sân */}
                  <div className={styles.cardLeft}>
                    <div className={styles.dateBox}>
                      <strong className={styles.dateDay}>{day}</strong>
                      <span className={styles.dateMonth}>{monthLabel}</span>
                    </div>

                    <div className={styles.bookingDetails}>
                      <div className={styles.titleRow}>
                        <h2 className={styles.facilityCourtTitle}>
                          {item.facility_name} · {item.court_name}
                        </h2>
                        <span className={`${styles.statusBadge} ${getBadgeClass(item.status)}`}>
                          {item.status_name}
                        </span>
                      </div>

                      <p className={styles.timeMetaLine}>
                        {item.booking_code} · {item.time_range}
                        {item.booker_label ? ` · ${item.booker_label}` : ''}
                      </p>

                      {secondaryLine && (
                        <p className={styles.subNoteLine}>{secondaryLine}</p>
                      )}
                    </div>
                  </div>

                  {/* Khối phải: Giá tiền thực trả (final_amount) + Các nút thao tác theo trạng thái */}
                  <div className={styles.cardRight}>
                    <strong className={styles.priceText}>
                      {formatVnd(item.final_amount)}
                    </strong>

                    <div className={styles.actionGroup}>
                      {/* Nút Xem chi tiết (UC17 #3-5, FR35, FR51, FR52, FR57) */}
                      <button
                        type="button"
                        className={styles.outlineActionBtn}
                        onClick={() => setDetailTarget(item)}
                      >
                        Xem chi tiết
                      </button>

                      {/* 1. Trạng thái holding -> Nút Tiếp tục thanh toán */}
                      {item.status === 'holding' && canPayHistoryEntry(item, nowMs) && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Tiếp tục thanh toán
                        </button>
                      )}

                      {/* 2. Trạng thái resubmit_requested -> Nút Gửi lại chứng từ */}
                      {item.status === 'resubmit_requested' && canPayHistoryEntry(item, nowMs) && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Gửi lại chứng từ
                        </button>
                      )}

                      {/* 3. Trạng thái chờ xác nhận -> Xem thanh toán */}
                      {item.status === 'awaiting_confirmation' && item.booking_type !== 'session' && (
                        <button type="button" className={styles.outlineActionBtn} onClick={() => handleGoToPayment(item)}>
                          Xem thanh toán
                        </button>
                      )}

                      {item.booking_type === 'package' && (item.status === 'confirmed' ||
                        (item.single_order && item.status === 'cancelled_by_player')) && (
                        <>
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            onClick={() => showPackageSessions(item)}
                            disabled={packageLoading != null}
                            aria-expanded={expandedPackages.includes(item.booking_id)}
                          >
                            {packageLoading === item.booking_id ? 'Đang tải…' : expandedPackages.includes(item.booking_id) ? 'Thu gọn lịch' : item.single_order ? 'Xem lịch trong đơn' : 'Xem lịch gói'}
                          </button>
                          {item.single_order && item.status === 'confirmed' && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() => setCancelTarget(item)}
                            >
                              Hủy đơn
                            </button>
                          )}
                        </>
                      )}

                      {/* UC22: Booking bị ảnh hưởng -> Player chọn đổi slot miễn phí, hoàn tiền hoặc điểm bồi hoàn */}
                      {affectedPending && (
                        <>
                          <button
                            type="button"
                            className={styles.primaryActionBtn}
                            disabled={affectedLoading}
                            onClick={() => beginAffectedAction(item, affected.id, 'RESCHEDULE')}
                          >
                            Đổi slot miễn phí
                          </button>
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            disabled={affectedLoading}
                            onClick={() => beginAffectedAction(item, affected.id, 'POINTS')}
                          >
                            Nhận điểm
                          </button>
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            disabled={affectedLoading}
                            onClick={() => beginAffectedAction(item, affected.id, 'REFUND')}
                          >
                            Hoàn tiền
                          </button>
                        </>
                      )}

                      {item.booking_type !== 'package' && !['holding', 'awaiting_confirmation', 'resubmit_requested', 'expired', 'payment_rejected'].includes(item.status) && (
                        <button type="button" className={styles.outlineActionBtn}
                          onClick={() => navigate('/my-bookings/' + item.booking_id + '/reschedules')}>
                          Lịch sử đổi lịch
                        </button>
                      )}

                      {item.booking_type !== 'package' && item.status !== 'holding' && (
                        <button type="button" className={styles.outlineActionBtn}
                          onClick={() => navigate('/my-complaints?bookingId=' + item.booking_id)}>Khiếu nại</button>
                      )}

                      {/* Đánh giá sân sau khi hoàn tất buổi chơi (UC31) */}
                      {item.can_review && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => openReviewModal(item)}
                        >
                          Đánh giá
                        </button>
                      )}

                      {/* 4. Trạng thái confirmed (Đơn lẻ) -> Mở kèo, Đổi lịch, Hủy lịch */}
                      {item.status === 'confirmed' && item.booking_type !== 'package' && !affectedPending && (
                        <>
                          {item.can_open_match && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() => navigate('/open-matches')}
                            >
                              Mở kèo
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            onClick={() => handleRescheduleClick(item)}
                            disabled={rescheduleLoading}
                          >
                            Đổi lịch
                          </button>
                          {item.can_cancel && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() => setCancelTarget(item)}
                            >
                              Hủy lịch
                            </button>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {detailTarget && (
        <HistoryDetailDialog key={detailTarget.booking_type + ':' + detailTarget.booking_id}
          item={detailTarget} now={nowMs} onClose={() => setDetailTarget(null)} onPayment={handleGoToPayment} />
      )}

      {/* UC21: Modal chọn slot mới & xem chênh lệch đổi lịch */}
      {rescheduleTarget && (
        <Modal labelledBy="reschedule-title" busy={rescheduleSubmitting} onDismiss={() => setRescheduleTarget(null)}>
          <div className={styles.modalCard}>
            <h3 id="reschedule-title" className={styles.modalTitle}>
              {rescheduleTarget.affected ? 'Đổi slot miễn phí' : 'Đổi lịch đặt sân'} — {rescheduleTarget.booking.booking_code}
            </h3>
            <p className={styles.modalBody} style={{ marginBottom: 14 }}>
              Cơ sở: <strong>{rescheduleTarget.booking.facility_name}</strong> · Sân hiện tại: {rescheduleTarget.booking.court_name} ({rescheduleTarget.booking.time_range})
            </p>

            {rescheduleDeadline && <p>Hạn đổi lịch: {new Date(serverTimestamp(rescheduleDeadline))
              .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="new-court">Chọn sân mới</label>
              <select id="new-court"
                className={styles.formInput}
                value={selectedCourtId}
                onChange={(e) => { setSelectedCourtId(e.target.value); setQuote(null); }}
              >
                {availableCourts.length > 0 ? (
                  availableCourts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || ('Sân ' + c.id)}</option>
                  ))
                ) : (
                  <option value="">Không có sân khả dụng</option>
                )}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="new-play-date">Ngày chơi mới</label>
              <input
                type="date" id="new-play-date"
                className={styles.formInput}
                value={newPlayDate}
                min={today()}
                onChange={(e) => { setNewPlayDate(e.target.value); setQuote(null); }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Giờ bắt đầu</label>
                <select
                  className={styles.formInput}
                  value={startMin}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    setStartMin(nextStart);
                    if (endMin <= nextStart) setEndMin(nextStart + 30);
                    setQuote(null);
                  }}
                >
                  {TIME_OPTIONS.filter((t) => t.value < 1440).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Giờ kết thúc</label>
                <select
                  className={styles.formInput}
                  value={endMin}
                  onChange={(e) => { setEndMin(Number(e.target.value)); setQuote(null); }}
                >
                  {TIME_OPTIONS.filter((t) => t.value > startMin).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {!rescheduleTarget.affected && <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                style={{ width: '100%' }}
                onClick={handlePreviewQuote}
                disabled={quoteLoading || !selectedCourtId}
              >
                {quoteLoading ? 'Đang kiểm tra...' : '🔍 Kiểm tra chênh lệch giá'}
              </button>
            </div>}

            {quoteError && <p className={styles.errorBanner} style={{ margin: '8px 0' }}>{quoteError}</p>}

            {quote && (
              <div className={styles.quoteBox}>
                <div className={styles.quoteRow}>
                  <span>Giá slot cũ:</span>
                  <strong>{formatVnd(Number(quote.oldListAmount || 0))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Giá slot mới:</span>
                  <strong>{formatVnd(Number(quote.newListAmount || 0))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Đã thanh toán:</span>
                  <strong>{formatVnd(Number(quote.amountPaid))}</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Phụ thu chênh lệch:</span>
                  <strong style={{ color: quote.extraAmount > 0 ? '#b45309' : '#0d8a52' }}>
                    {quote.extraAmount > 0 ? `+${formatVnd(Number(quote.extraAmount))}` : '0 VND (Đổi miễn phí)'}
                  </strong>
                </div>
                {quote.noDifferenceRefund && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    * Slot mới rẻ hơn: Hệ thống không hoàn lại tiền chênh lệch theo quy định BR08.
                  </p>
                )}
                {quote.extraAmount > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b45309' }}>
                    * Cần hoàn tất chuyển khoản phụ thu trong vòng 5 phút sau khi bấm xác nhận (BR32).
                  </p>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduleSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                className={styles.primaryActionBtn}
                onClick={handleConfirmReschedule}
                disabled={!selectedCourtId || !newPlayDate || (!rescheduleTarget.affected && !quote) || rescheduleSubmitting}
              >
                {rescheduleSubmitting ? 'Đang xử lý...' : (rescheduleTarget.affected ? 'Xác nhận đổi slot' : (quote?.extraAmount > 0 ? 'Tiếp tục thanh toán phụ thu' : 'Xác nhận đổi lịch'))}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* UC22: Hộp xác nhận lựa chọn cho booking bị ảnh hưởng */}
      {choiceTarget && (
        <Modal labelledBy="affected-choice-title" busy={choiceSubmitting} onDismiss={() => setChoiceTarget(null)}>
          <div className={styles.modalCard}>
            <h3 id="affected-choice-title" className={styles.modalTitle}>
              {choiceTarget.choice === 'REFUND' ? 'Yêu cầu hoàn tiền' : 'Nhận điểm bồi hoàn'} cho {choiceTarget.booking.booking_code}?
            </h3>
            <p className={styles.modalBody}>
              Booking {choiceTarget.booking.booking_code} ({choiceTarget.booking.facility_name} · {choiceTarget.booking.court_name},{' '}
              {choiceTarget.booking.time_range}) sẽ chuyển sang <strong>Địa điểm đã hủy</strong> và slot được giải phóng. Điểm và voucher
              đã dùng được trả lại.{' '}
              {choiceTarget.choice === 'REFUND'
                ? 'Chủ sân sẽ chuyển khoản thủ công số tiền đã thanh toán; điểm đã tích từ booking này bị thu hồi tương ứng.'
                : 'Bạn nhận điểm bồi hoàn tương ứng số tiền đã thanh toán (1 điểm = 500đ) tại địa điểm này.'}{' '}
              Không thể đổi lựa chọn sau khi xác nhận.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                onClick={() => setChoiceTarget(null)}
                disabled={choiceSubmitting}
              >
                Quay lại
              </button>
              <button
                type="button"
                className={styles.primaryActionBtn}
                onClick={handleConfirmChoice}
                disabled={choiceSubmitting}
              >
                {choiceSubmitting ? 'Đang gửi...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Hộp xác nhận Hủy booking theo chuẩn BR07 / MSG66 */}
      {cancelTarget && (
        <Modal labelledBy="cancel-booking-title" busy={cancelling} onDismiss={() => setCancelTarget(null)}>
          <div className={styles.modalCard}>
            <h3 id="cancel-booking-title" className={styles.modalTitle}>
              {cancelTarget.single_order ? 'Hủy đơn đặt sân?' : `Hủy lịch ${cancelTarget.booking_code}?`}
            </h3>
            <p className={styles.modalBody}>
              {cancelTarget.single_order
                ? 'Tất cả booking chưa đến giờ chơi trong đơn sẽ bị hủy. Tiền, điểm và voucher đã dùng không được hoàn lại.'
                : `Hủy lịch ${cancelTarget.booking_code} (${cancelTarget.facility_name} · ${cancelTarget.court_name}, ${cancelTarget.time_range})? Tiền, điểm và voucher đã dùng không được hoàn lại.`}
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Giữ lịch đặt
              </button>
              <button
                type="button"
                className={styles.dangerActionBtn}
                onClick={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}
              </button>
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
              {reviewTarget.facility_name} · {reviewTarget.court_name} ({reviewTarget.booking_date} · {reviewTarget.time_range})
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Số sao đánh giá (1–5 sao)</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: reviewRating === star ? '1.5px solid #0d8a52' : '1px solid #cbd5e1',
                      background: reviewRating === star ? '#e8f5ee' : '#fff',
                      color: reviewRating >= star ? '#f59e0b' : '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {star} ★
                  </button>
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
                placeholder="Chia sẻ trải nghiệm của bạn về mặt sân, ánh sáng, dịch vụ..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </div>
            {reviewError && <p className={styles.errorBanner}>{reviewError}</p>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                onClick={() => setReviewTarget(null)}
                disabled={reviewSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                className={styles.primaryActionBtn}
                onClick={handleSubmitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? 'Đang gửi…' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
