import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getMyBookingsApi, cancelBookingApi } from '../../api/bookingApi';
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

export default function MyBookingsPage() {
  const navigate = useNavigate();

  // Tab: 'all' | 'pending_payment' | 'confirmed' | 'past'
  const [activeTab, setActiveTab] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // Tick mỗi giây để cập nhật đồng hồ đếm ngược cho các booking 'holding' (BR03)
  const [nowMs, setNowMs] = useState(() => Date.now());

  // State Modal xác nhận Hủy booking theo BR07 / MSG66
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // State theo dõi các booking đã đánh giá (DR13 / BR21: chỉ đánh giá 1 lần)
  const [reviewedIds, setReviewedIds] = useState([]);

  const loadBookings = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await getMyBookingsApi({ tab: 'all' });
      if (res?.success) {
        // VÁ LỖI HOLDING FLASH: Ép trạng thái expired ngay từ lúc nhận dữ liệu nếu đã quá giờ
        const currentNow = Date.now();
        const sanitizedItems = (res.data.items || []).map((item) => {
          if (item.status === 'holding' && item.hold_expires_at) {
            const left = Math.floor((new Date(item.hold_expires_at).getTime() - currentNow) / 1000);
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
        });
        setBookings(sanitizedItems);
      } else {
        setFetchError('Could not load your bookings.');
      }
    } catch (err) {
      setFetchError(err.response?.data?.message || err.message || 'Error loading bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // BR03: Đếm lùi thời gian thực cho các booking đang giữ chỗ (holding)
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      // Tự động chuyển sang expired nếu hết 5 phút giữ chỗ mà chưa gửi chứng từ (MSG33)
      setBookings((prev) =>
        prev.map((item) => {
          if (item.status === 'holding' && item.hold_expires_at) {
            const left = Math.floor((new Date(item.hold_expires_at).getTime() - currentNow) / 1000);
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
    const sorted = [...bookings].sort((a, b) => {
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
  }, [bookings, activeTab]);

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
    const secs = Math.max(0, Math.floor((new Date(expiresIso).getTime() - nowMs) / 1000));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Điều hướng sang UC18 khi bấm "Continue Payment" (holding) hoặc "Resubmit Receipt" (resubmit_requested)
  const handleGoToPayment = (booking) => {
    setFeedbackBanner('');

    // BR34 / P06 / MSG52: Chặn nếu đã hết lượt gửi lại chứng từ
    if (booking.status === 'resubmit_requested' && (booking.resubmit_attempts_left ?? 0) <= 0) {
      setFeedbackBanner('MSG52: You have reached the maximum resubmission attempts or the deadline has passed.');
      return;
    }

    const payloadForPayment = {
      booking_id: booking.booking_id,
      booking_code: booking.booking_code,
      status: booking.status,
      hold_expires_at:
        booking.hold_expires_at || new Date(Date.now() + 4 * 60 * 1000).toISOString(),
      resubmit_attempts_left: booking.resubmit_attempts_left ?? 3,
      pricing_summary: {
        final_amount: booking.final_amount,
      },
      bank_info: booking.bank_info || {
        bank_name: 'Vietcombank',
        bank_account_number: '0011 0023 4567',
        bank_account_holder: 'NGUYEN VAN HUNG',
        qr_image_url: null,
        transfer_content: `${booking.booking_code} 0987654321`,
      },
    };

    sessionStorage.setItem('active_holding_booking', JSON.stringify(payloadForPayment));
    navigate('/booking/payment');
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
            item.booking_id === cancelTarget.booking_id
              ? {
                  ...item,
                  status: 'cancelled_by_player',
                  status_name: 'Cancelled by Player',
                  can_cancel: false,
                  can_reschedule: false,
                  can_open_match: false,
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
      setFeedbackBanner(err.response?.data?.message || err.message || 'Could not cancel booking.');
    } finally {
      setCancelling(false);
    }
  };

  // Xử lý bấm Đổi lịch (BR25, BR29 / MSG62)
  const handleRescheduleClick = (booking) => {
    if (!booking.can_reschedule) {
      setFeedbackBanner(
        'MSG62: Reschedule is unavailable (past the deadline or maximum 1 reschedule limit reached).'
      );
      return;
    }
    setFeedbackBanner(
      `Proceeding to reschedule booking ${booking.booking_code} (BR25 / BR29: max 1 reschedule allowed before deadline).`
    );
  };

  // Xử lý bấm Đánh giá sân (DR13 / BR21 / MSG80)
  const handleReviewClick = (booking) => {
    if (reviewedIds.includes(booking.booking_id)) {
      setFeedbackBanner('MSG80: You have already submitted a review for this booking (DR13 / BR21).');
      return;
    }
    setReviewedIds((prev) => [...prev, booking.booking_id]);
    setFeedbackBanner(`Thank you! Your review for ${booking.facility_name} (${booking.booking_code}) has been recorded.`);
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
            <Link to="/">Find Courts</Link>
            <a href="#matches">Open Matches</a>
            <Link to="/my-bookings" className={styles.activeLink}>
              My Bookings
            </Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>MA</span>
            <span className={styles.userName}>Minh Anh</span>
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
            onClick={() => setActiveTab('all')}
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
            onClick={() => setActiveTab('pending_payment')}
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
            onClick={() => setActiveTab('confirmed')}
          >
            Confirmed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'past'}
            className={`${styles.tabPill} ${activeTab === 'past' ? styles.tabPillActive : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past
          </button>
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
              const isReviewed = reviewedIds.includes(item.booking_id);

              // Dòng chú thích thứ 2 dưới tên sân (Đếm ngược giữ chỗ / Số lượt gửi lại / Ghi chú)
              let secondaryLine = item.sub_note || '';
              if (item.status === 'holding') {
                secondaryLine = `${formatCountdown(item.hold_expires_at)} left to pay`;
              } else if (item.status === 'resubmit_requested') {
                secondaryLine =
                  item.resubmit_reason ||
                  `Receipt image is blurry, ${item.resubmit_attempts_left ?? 2} attempts left`;
              } else if (item.status === 'completed' && isReviewed) {
                secondaryLine = 'Reviewed';
              }

              return (
                <article key={item.booking_id} className={styles.bookingCard}>
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
                      {/* 1. Trạng thái holding -> Nút Tiếp tục thanh toán */}
                      {item.status === 'holding' && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Continue Payment
                        </button>
                      )}

                      {/* 2. Trạng thái resubmit_requested -> Nút Gửi lại chứng từ (kèm kiểm tra P06) */}
                      {item.status === 'resubmit_requested' && (
                        <button
                          type="button"
                          className={styles.primaryActionBtn}
                          onClick={() => handleGoToPayment(item)}
                        >
                          Resubmit Receipt
                        </button>
                      )}

                      {/* 3. Trạng thái confirmed (Gói định kỳ) -> Xem lịch gói */}
                      {item.status === 'confirmed' && item.booking_type === 'recurring' && (
                        <button
                          type="button"
                          className={styles.outlineActionBtn}
                          onClick={() =>
                            setFeedbackBanner(
                              `Viewing recurring schedule for package ${item.booking_code} (24 sessions).`
                            )
                          }
                        >
                          View Package Schedule
                        </button>
                      )}

                      {/* 4. Trạng thái confirmed (Đơn lẻ) -> Mở kèo, Đổi lịch (BR25/BR29), Hủy (BR07/MSG66) */}
                      {item.status === 'confirmed' && item.booking_type !== 'recurring' && (
                        <>
                          {item.can_open_match && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() =>
                                setFeedbackBanner(
                                  `Opening match recruitment for booking ${item.booking_code}.`
                                )
                              }
                            >
                              Open Match
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            onClick={() => handleRescheduleClick(item)}
                          >
                            Reschedule
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

                      {/* 5. Trạng thái completed -> Đánh giá (DR13/BR21) & Khiếu nại (BR49/P23) */}
                      {item.status === 'completed' && (
                        <>
                          <button
                            type="button"
                            className={styles.outlineActionBtn}
                            disabled={isReviewed}
                            onClick={() => handleReviewClick(item)}
                          >
                            {isReviewed ? 'Reviewed' : 'Review'}
                          </button>
                          {item.can_complain && (
                            <button
                              type="button"
                              className={styles.outlineActionBtn}
                              onClick={() =>
                                setFeedbackBanner(
                                  `Opening complaint form (UC33) for booking ${item.booking_code} (within 24h window per BR49).`
                                )
                              }
                            >
                              Complain
                            </button>
                          )}
                        </>
                      )}

                      {/* 6. Trạng thái bị từ chối hoặc sân hủy -> Khiếu nại (BR49) */}
                      {(item.status === 'payment_rejected' ||
                        item.status === 'cancelled_by_facility') && (
                        <button
                          type="button"
                          className={styles.outlineActionBtn}
                          onClick={() =>
                            setFeedbackBanner(
                              `Opening complaint form (UC33) for booking ${item.booking_code}.`
                            )
                          }
                        >
                          Complain
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Hộp xác nhận Hủy booking theo chuẩn BR07 / MSG66 */}
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