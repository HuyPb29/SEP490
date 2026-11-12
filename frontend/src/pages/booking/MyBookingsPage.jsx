import HistoryDetailDialog from './HistoryDetailDialog';
import { bookingStatusLabels, canPayHistoryEntry } from '../../api/bookingHistory';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import {
  getMyBookingsApi,
  cancelBookingApi,
  getPackageSessionsApi,
  getRescheduleDeadlineApi,
  getRescheduleRequestsApi,
  getMyAffectedBookingsApi,
  getAffectedBookingApi,
  submitAffectedChoiceApi,
  previewRescheduleApi,
  createRescheduleApi,
  getLocationCourtsApi,
} from '../../api/bookingChangeApi';
import { getSavedUser } from '../../api/session';
import styles from './MyBookingsPage.module.css';

// Phân nhóm 10 trạng thái chính thức theo chuẩn SRS v18 (Sheet Trang_thai)
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

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (min của ô chọn ngày đổi lịch)
const TODAY_DATE = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const TIME_OPTIONS = [];
for (let min = 360; min <= 1380; min += 30) {
  TIME_OPTIONS.push({ value: min, label: formatSlotTime(min) });
}

function serverTimestamp(value) {
  if (!value) return Number.NaN;
  return Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '+07:00');
}

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const isPlayer = user?.role_code === 'player';

  // Tab: 'all' | 'pending_payment' | 'confirmed' | 'past'
  const [activeTab, setActiveTab] = useState('all');
  const [exactStatus, setExactStatus] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [detailTarget, setDetailTarget] = useState(null);

  // Tick mỗi giây để cập nhật đồng hồ đếm ngược cho các booking 'holding' (BR03)
  const [nowMs, setNowMs] = useState(() => Date.now());

  // State Modal xác nhận Hủy booking theo BR07 / MSG66
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);
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
      // API trả theo id giảm dần, giữ bản ghi mới nhất của mỗi booking
      const latest = {};
      for (const record of affected) {
        if (!latest[record.bookingId]) latest[record.bookingId] = record;
      }
      setAffectedByBooking(latest);
      if (active) setBookings(items);
    }).catch((error) => {
      if (active) setFetchError(error.response?.data?.message || 'Không tải được lịch sử booking.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isPlayer]);

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
  }, [isPlayer, loading, fetchError]);

  // BR03: Đếm lùi thời gian thực cho các booking đang giữ chỗ (holding)
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      // Tự động chuyển sang expired nếu hết 5 phút giữ chỗ mà chưa gửi chứng từ (MSG33)
      setBookings((prev) =>
        prev.map((item) => {
          if (item.status === 'holding' && item.hold_expires_at) {
            const left = serverTimestamp(item.hold_expires_at) - currentNow;
            if (left <= 0) {
              return {
                ...item,
                status: 'expired',
                status_name: 'Expired',
                sub_note: 'Unpaid within holding time',
              };
            }
          }
          return item;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Đếm số lượng đơn Cần thanh toán hiển thị trên Tab "Pending Payment · 3"
  const pendingCount = useMemo(
    () => bookings.filter((b) => PENDING_STATUSES.includes(b.status)).length,
    [bookings]
  );

  // Lọc và giữ nguyên thứ tự ưu tiên: Nhóm chờ thanh toán luôn nằm trên đầu
  const displayedBookings = useMemo(() => {
    const sorted = bookings.filter((item) => !exactStatus || item.status === exactStatus).sort((a, b) => {
      const aPending = PENDING_STATUSES.includes(a.status) ? 1 : 0;
      const bPending = PENDING_STATUSES.includes(b.status) ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    if (activeTab === 'pending_payment') {
      return sorted.filter((b) => PENDING_STATUSES.includes(b.status));
    }
    if (activeTab === 'confirmed') {
      return sorted.filter((b) => CONFIRMED_STATUSES.includes(b.status));
    }
    if (activeTab === 'past') {
      return sorted.filter((b) => PAST_STATUSES.includes(b.status));
    }
    return sorted;
  }, [bookings, activeTab, exactStatus]);

  // VÁ LỖI NGÀY THÁNG: Dùng new Date() thay vì .split('-') để không bị NaN khi Backend trả chuỗi ISO dài
  const formatDayBadge = (dateStr) => {
    if (!dateStr) return { day: '24', monthLabel: 'Oct' };
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      day: String(d.getDate()).padStart(2, '0'),
      monthLabel: months[d.getMonth()] || 'Oct',
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
    setPackageLoading(true);
    setFeedbackBanner('');
    try {
      const sessions = await getPackageSessionsApi(item.booking_id);
      setBookings((current) => [
        ...current.filter((booking) => booking.package_id !== item.booking_id),
        ...sessions,
      ]);
      setFeedbackBanner('Đã hiển thị các buổi của ' + item.booking_code + '.');
    } catch (error) {
      setFeedbackBanner(error.response?.data?.message || 'Không tải được lịch của gói.');
    } finally {
      setPackageLoading(false);
    }
  };

  // BR07 / MSG66: Xác nhận hủy booking (Không hoàn tiền, không trả lại điểm & voucher)
  const handleConfirmCancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setFeedbackBanner('');
    try {
      const res = await cancelBookingApi(cancelTarget.booking_id);
      if (res?.success) {
        setBookings((prev) =>
          prev.map((item) =>
            item.booking_type !== 'package' && item.booking_id === cancelTarget.booking_id
              ? {
                  ...item,
                  status: 'cancelled_by_player',
                  status_name: 'Cancelled by Player',
                  can_cancel: false,
                  sub_note: 'Cancelled by player (non-refundable per BR07)',
                }
              : item
          )
        );
        setFeedbackBanner(
          `Booking ${cancelTarget.booking_code} has been cancelled. Per BR07, payments, points, and vouchers are non-refundable.`
        );
        setCancelTarget(null);
      }
    } catch (err) {
      setFeedbackBanner(err.response?.data?.message || 'Không thể hủy booking.');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const openRescheduleModal = async (booking, affected = null, deadline = null) => {
    setRescheduleTarget({ booking, affected });
    setRescheduleDeadline(deadline);
    setNewPlayDate(booking.booking_date || TODAY_DATE);
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
        await submitAffectedChoiceApi(rescheduleTarget.affected.id, 'RESCHEDULE', slot);
        setFeedbackBanner(`Booking ${rescheduleTarget.booking.booking_code} đã được đổi slot miễn phí thành công.`);
        setRescheduleTarget(null);
        const [items, affectedList] = await Promise.all([getMyBookingsApi(), getMyAffectedBookingsApi()]);
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
                status_name: 'Cancelled by Facility',
                can_cancel: false,
              }
            : item
        )
      );
      const done = result.choice === 'POINTS'
        ? `Đã cộng ${result.compensationPoints ?? ''} điểm bồi hoàn, điểm và voucher đã dùng được trả lại.`
        : 'Đã gửi yêu cầu hoàn tiền tới Owner, điểm và voucher đã dùng được trả lại.';
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
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Player xem được lịch sử booking cá nhân.</p>;

  return (
    <div className={styles.pageWrapper}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.brand} onClick={() => navigate('/')}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </div>

          <nav className={styles.navLinks}>
            <Link to="/">Find Courts</Link>
            <Link to="/open-matches">Open Matches</Link>
            <Link to="/my-bookings" className={styles.activeLink}>
              My Bookings
            </Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>{user.full_name?.charAt(0)}</span>
            <span className={styles.userName}>{user.full_name}</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        {/* Header Row: Tiêu đề + Nút Đặt nhiều buổi */}
        <div className={styles.headerRow}>
          <h1 className={styles.pageTitle}>My Bookings</h1>
          <button
            type="button"
            className={styles.multiBookBtn}
            onClick={() => navigate('/')}
          >
            + Book Multiple Sessions
          </button>
        </div>

        {/* Bộ lọc 4 Tab theo chuẩn UC17 */}
        <div className={styles.filterTabs} role="tablist" aria-label="Booking Status Filter">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`${styles.tabPill} ${activeTab === 'all' ? styles.tabPillActive : ''}`}
            onClick={() => { setExactStatus(''); setActiveTab('all'); }}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending_payment'}
            className={`${styles.tabPill} ${
              activeTab === 'pending_payment' ? styles.tabPillActive : ''
            }`}
            onClick={() => { setExactStatus(''); setActiveTab('pending_payment'); }}
          >
            Pending Payment · {pendingCount}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'confirmed'}
            className={`${styles.tabPill} ${
              activeTab === 'confirmed' ? styles.tabPillActive : ''
            }`}
            onClick={() => { setExactStatus(''); setActiveTab('confirmed'); }}
          >
            Confirmed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'past'}
            className={`${styles.tabPill} ${activeTab === 'past' ? styles.tabPillActive : ''}`}
            onClick={() => { setExactStatus(''); setActiveTab('past'); }}
          >
            Past
          </button>
          <label>
            Trạng thái
            <select value={exactStatus} onChange={(event) => { setExactStatus(event.target.value); setActiveTab('all'); }}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(bookingStatusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
        </div>

        {feedbackBanner && (
          <div className={styles.feedbackBanner}>
            <span>{feedbackBanner}</span>
            <button
              type="button"
              className={styles.closeBannerBtn}
              onClick={() => setFeedbackBanner('')}
            >
              ✕
            </button>
          </div>
        )}

        {fetchError && <div className={styles.errorBanner}>{fetchError}</div>}

        {/* Danh sách các thẻ Booking */}
        {loading ? (
          <div className={styles.loadingState}>Loading your bookings...</div>
        ) : displayedBookings.length === 0 ? (
          <div className={styles.emptyState}>No bookings found in this tab.</div>
        ) : (
          <div className={styles.bookingList}>
            {displayedBookings.map((item) => {
              const { day, monthLabel } = formatDayBadge(item.booking_date);
              const affected = item.booking_type !== 'package' ? affectedByBooking[item.booking_id] : null;
              const affectedPending = affected?.status === 'PENDING' && item.status === 'confirmed';

              // Dòng chú thích thứ 2 dưới tên sân (Đếm ngược giữ chỗ / Số lượt gửi lại / Ghi chú)
              let secondaryLine = item.sub_note || '';
              if (item.status === 'holding') {
                secondaryLine = `${formatCountdown(item.hold_expires_at)} left to pay`;
              } else if (item.status === 'resubmit_requested') {
                secondaryLine =
                  'Staff requested a new payment receipt.';
              } else if (affectedPending) {
                secondaryLine = `${AFFECTED_CAUSES[affected.cause] || affected.cause}: chọn đổi slot, hoàn tiền hoặc điểm bồi hoàn trước giờ chơi. Quá giờ chơi hệ thống tự cấp điểm bồi hoàn.`;
              } else if (affected?.status === 'RESOLVED') {
                secondaryLine = `${AFFECTED_CAUSES[affected.cause] || affected.cause} · ${AFFECTED_CHOICES[affected.choice] || affected.choice}`
                  + (affected.choice === 'POINTS' && affected.compensationPoints != null ? ` (+${affected.compensationPoints} điểm)` : '')
                  + (affected.defaultChoice ? ' · tự động do quá giờ chơi' : '');
              }

              return (
                <article key={item.booking_type + '-' + item.booking_id} className={styles.bookingCard}>
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
                        {item.time_range}
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
                      {item.final_amount.toLocaleString('vi-VN')} VND
                    </strong>

                    <div className={styles.actionGroup}>
                      <button type="button" className={styles.outlineActionBtn} onClick={() => setDetailTarget(item)}>
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

                      {/* 2. Trạng thái resubmit_requested -> Nút Gửi lại chứng từ (kèm kiểm tra P06) */}
                      {item.status === 'resubmit_requested' && canPayHistoryEntry(item, nowMs) && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Gửi lại chứng từ
                        </button>
                      )}

                      {/* 3. Trạng thái confirmed (Gói định kỳ) -> Xem lịch gói */}
                      {item.status === 'confirmed' && item.booking_type === 'package' && (
                        <button
                          type="button"
                          className={styles.outlineActionBtn}
                          onClick={() => showPackageSessions(item)}
                          disabled={packageLoading}
                        >
                          View Package Schedule
                        </button>
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

                      {/* 4. Trạng thái confirmed (Đơn lẻ) -> Mở kèo, Đổi lịch (BR25/BR29), Hủy (BR07/MSG66) */}
                      {item.status === 'confirmed' && item.booking_type !== 'package' && !affectedPending && (
                        <>
                          {item.can_open_match && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() => navigate('/open-matches')}
                            >
                              Open Match
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
                              Cancel
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

            {/* UC21: Modal chọn slot mới & xem chênh lệch đổi lịch */}
      {rescheduleTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 520 }}>
            <h3 className={styles.modalTitle}>
              {rescheduleTarget.affected ? 'Đổi slot miễn phí' : 'Đổi lịch đặt sân'} — {rescheduleTarget.booking.booking_code}
            </h3>
            <p className={styles.modalBody} style={{ marginBottom: 14 }}>
              Cơ sở: <strong>{rescheduleTarget.booking.facility_name}</strong> · Sân hiện tại: {rescheduleTarget.booking.court_name} ({rescheduleTarget.booking.time_range})
            </p>

            {rescheduleDeadline && <p>Hạn đổi lịch: {new Date(serverTimestamp(rescheduleDeadline))
              .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Chọn sân mới</label>
              <select
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
              <label className={styles.formLabel}>Ngày chơi mới</label>
              <input
                type="date"
                className={styles.formInput}
                value={newPlayDate}
                min={TODAY_DATE}
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
                  {TIME_OPTIONS.filter((t) => t.value < 1380).map((t) => (
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
                  <strong>{Number(quote.oldListAmount || 0).toLocaleString('vi-VN')} VND</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Giá slot mới:</span>
                  <strong>{Number(quote.newListAmount || 0).toLocaleString('vi-VN')} VND</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Đã thanh toán:</span>
                  <strong>{Number(quote.amountPaid).toLocaleString('vi-VN')} VND</strong>
                </div>
                <div className={styles.quoteRow}>
                  <span>Phụ thu chênh lệch:</span>
                  <strong style={{ color: quote.extraAmount > 0 ? '#b45309' : '#0d8a52' }}>
                    {quote.extraAmount > 0 ? `+${Number(quote.extraAmount).toLocaleString('vi-VN')} VND` : '0 VND (Đổi miễn phí)'}
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
        </div>
      )}

      {/* UC22: Hộp xác nhận lựa chọn cho booking bị ảnh hưởng */}
      {choiceTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>
              {choiceTarget.choice === 'REFUND' ? 'Yêu cầu hoàn tiền' : 'Nhận điểm bồi hoàn'} cho {choiceTarget.booking.booking_code}?
            </h3>
            <p className={styles.modalBody}>
              Booking {choiceTarget.booking.booking_code} ({choiceTarget.booking.facility_name} · {choiceTarget.booking.court_name},{' '}
              {choiceTarget.booking.time_range}) sẽ chuyển sang <strong>Sân hủy</strong> và slot được giải phóng. Điểm và voucher
              đã dùng được trả lại.{' '}
              {choiceTarget.choice === 'REFUND'
                ? 'Owner sẽ chuyển khoản thủ công số tiền đã thanh toán; điểm đã tích từ booking này bị thu hồi tương ứng.'
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
        </div>
      )}

      {/* Hộp xác nhận Hủy booking theo chuẩn BR07 / MSG66 */}
      {detailTarget && (
        <HistoryDetailDialog key={detailTarget.booking_type + ':' + detailTarget.booking_id}
          item={detailTarget} now={nowMs} onClose={() => setDetailTarget(null)} onPayment={handleGoToPayment} />
      )}

      {cancelTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>
              Cancel booking {cancelTarget.booking_code}?
            </h3>
            <p className={styles.modalBody}>
              <strong>MSG66 (BR07):</strong> Cancel booking {cancelTarget.booking_code} (
              {cancelTarget.facility_name} · {cancelTarget.court_name}, {cancelTarget.time_range})?
              You will <strong>not be refunded</strong>; any used loyalty points and discount
              vouchers will <strong>not be returned</strong>.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.outlineActionBtn}
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className={styles.dangerActionBtn}
                onClick={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
