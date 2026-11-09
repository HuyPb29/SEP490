import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMyPointsAtFacility,
  getMyOwnedTeams,
  applyVoucherApi,
  createBookingApi,
  previewBookingSummaryApi,
  toMinutes,
  toTimeLabel,
} from '../../api/bookingApi';
import { apiErrorMessage } from '../../api';
import styles from './BookingSummaryPage.module.css';

const EMPTY_CONTEXT = { facility: null, playDate: '', selectedSlots: [] };

export default function BookingSummaryPage() {
  const navigate = useNavigate();

  // 1. Các slot đã chọn ở lịch sân (UC13), lưu trong sessionStorage
  const [bookingContext] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pending_booking_selection');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedSlots?.length > 0) return parsed;
      }
    } catch {
      // JSON lỗi thì coi như chưa chọn slot
    }
    return EMPTY_CONTEXT;
  });
  const hasSelection = bookingContext.selectedSlots.length > 0;

  // 2. Thông tin Player đăng nhập (FR38: họ tên, số điện thoại)
  const [playerInfo] = useState(() => {
    try {
      const savedUser = localStorage.getItem('bms_user_info');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return {
          full_name: parsed.full_name || '',
          phone_number: parsed.phone_number || '',
          email: parsed.email || '',
        };
      }
    } catch {
      // Chưa đăng nhập hoặc dữ liệu lỗi
    }
    return { full_name: '', phone_number: '', email: '' };
  });

  // State Đội bóng (DR03 / BR09)
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null); // null = Cá nhân

  // State Ghi chú cho chủ sân (DR20: tối đa 200 ký tự)
  const [guestNote, setGuestNote] = useState('');

  // Sửa lại thành chuỗi rỗng và null
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  // State Điểm thưởng tại cơ sở (FR89, P10, P11, P13, BR15, BR41)
  const [availablePoints, setAvailablePoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);

  // State thông báo khi chốt đơn
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  // Số tiền backend tính (POST /api/bookings/summary); null khi chưa tính xong hoặc lỗi
  const [serverPricing, setServerPricing] = useState(null);
  const [pricingError, setPricingError] = useState('');

  useEffect(() => {
    const facilityId = bookingContext.facility?.facility_id;
    if (!facilityId) return;
    const fetchInitialData = async () => {
      try {
        const [pointsRes, teamsRes] = await Promise.all([
          getMyPointsAtFacility(facilityId),
          getMyOwnedTeams(),
        ]);
        setAvailablePoints(pointsRes.data.available_points);
        setOwnedTeams(teamsRes.data);
      } catch (err) {
        setPricingError(apiErrorMessage(err, 'Không tải được điểm và đội của bạn.'));
      }
    };
    fetchInitialData();
  }, [bookingContext.facility?.facility_id]);

  // Tính toán thông tin hiển thị khung giờ & tiền sân niêm yết (DR05)
  const slotSummary = useMemo(() => {
    const slots = bookingContext.selectedSlots || [];
    const totalSlots = slots.length;
    const unitPrice = slots[0]?.price || 0;
    const totalListPrice = slots.reduce((sum, s) => sum + s.price, 0);
    const courtId = slots[0]?.courtId;
    const courtName = slots[0]?.courtName || '';
    const startTime = slots[0]?.time || '';
    // Giờ kết thúc = slot cuối + 30 phút; slot 23:30 kết thúc lúc 24:00 (endMinute 1440)
    const endTime = slots.length > 0 ? toTimeLabel(toMinutes(slots[slots.length - 1].time) + 30) : '';

    return {
      totalSlots,
      unitPrice,
      totalListPrice,
      courtId,
      courtName,
      startTime,
      endTime,
      timeRangeText: `${startTime} – ${endTime} (${totalSlots} slot)`,
    };
  }, [bookingContext.selectedSlots]);

  // Lựa chọn gửi backend: một sân, các slot liền nhau (BR01)
  const selection = useMemo(
    () => ({
      courtId: slotSummary.courtId,
      date: bookingContext.playDate,
      startTime: slotSummary.startTime,
      endTime: slotSummary.endTime,
    }),
    [slotSummary, bookingContext.playDate]
  );

  // Thứ tự trừ tiền (BR41, D161): giá niêm yết → voucher → điểm, điểm tối đa 50% số còn lại sau voucher
  // (P10: 1 điểm = 500 đồng). Ở đây chỉ chọn số điểm dùng tối đa; số tiền hiển thị lấy từ backend.
  const pointsToUse = useMemo(() => {
    if (!usePoints) return 0;
    const voucherDiscount = appliedVoucher ? appliedVoucher.discount_amount : 0;
    const remainingAfterVoucher = Math.max(0, slotSummary.totalListPrice - voucherDiscount);
    return Math.min(availablePoints, Math.floor((remainingAfterVoucher * 0.5) / 500));
  }, [usePoints, appliedVoucher, availablePoints, slotSummary.totalListPrice]);

  // UC14 #3–#5: backend tính lại tiền mỗi khi đổi voucher hoặc điểm
  useEffect(() => {
    if (!hasSelection) return undefined;
    let cancelled = false;
    previewBookingSummaryApi({
      selection,
      voucherCode: appliedVoucher?.voucher_code,
      pointsToUse,
    })
      .then((res) => {
        if (cancelled) return;
        setServerPricing(res.data);
        setPricingError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setServerPricing(null);
        setPricingError(apiErrorMessage(err, 'Không tính được tiền booking.'));
      });
    return () => {
      cancelled = true;
    };
  }, [hasSelection, selection, appliedVoucher, pointsToUse]);

  const pricingSummary = useMemo(() => {
    if (serverPricing) {
      return {
        listPrice: serverPricing.listAmount,
        voucherDiscount: serverPricing.voucherDiscount,
        pointsUsed: pointsToUse,
        pointsDiscount: serverPricing.pointDiscount,
        finalAmount: serverPricing.finalAmount,
      };
    }
    return {
      listPrice: slotSummary.totalListPrice,
      voucherDiscount: appliedVoucher ? appliedVoucher.discount_amount : 0,
      pointsUsed: pointsToUse,
      pointsDiscount: pointsToUse * 500,
      finalAmount: Math.max(
        0,
        slotSummary.totalListPrice - (appliedVoucher ? appliedVoucher.discount_amount : 0) - pointsToUse * 500
      ),
    };
  }, [serverPricing, slotSummary.totalListPrice, appliedVoucher, pointsToUse]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dayName}, ${dd}/${mm}/${yyyy}`;
  };

  // Xử lý Áp dụng hoặc Bỏ mã Voucher
  const handleVoucherAction = async () => {
    setVoucherError('');

    // Nếu đang có mã được áp dụng -> bấm nút sẽ Bỏ mã
    if (appliedVoucher) {
      setAppliedVoucher(null);
      return;
    }

    if (!voucherInput.trim()) {
      setVoucherError('Please enter a voucher code before applying.');
      return;
    }

    setVoucherLoading(true);
    try {
      const res = await applyVoucherApi({ selection, voucher_code: voucherInput.trim() });
      if (res?.success) {
        setAppliedVoucher(res.data);
      }
    } catch (err) {
      setVoucherError(
        apiErrorMessage(err, 'Mã giảm giá không đủ điều kiện hoặc có lỗi xảy ra. Vui lòng kiểm tra lại.')
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  // Xử lý bấm "Xác nhận đặt sân" (POST /api/v1/bookings)
  const handleConfirmBooking = async () => {
    setSubmitError('');

    if (guestNote.length > 200) {
      setSubmitError('Note to facility owner cannot exceed 200 characters (MSG109).');
      return;
    }

    if (pricingSummary.finalAmount <= 0) {
      setSubmitError('Total payment after discount must be greater than 0 VND (BR15).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBookingApi({
        selection,
        voucherCode: appliedVoucher?.voucher_code,
        pointsToUse,
        note: guestNote.trim(),
        teamId: selectedTeamId,
      });
      if (res?.success) {
        // Dữ liệu giữ chỗ (BR03) và tài khoản nhận cho màn thanh toán UC18
        sessionStorage.setItem('active_holding_booking', JSON.stringify(res.data));
        sessionStorage.removeItem('pending_booking_selection');
        setCreatedBooking(res.data);
        navigate('/booking/payment');
      }
    } catch (err) {
      setSubmitError(
        apiErrorMessage(err, 'Không thể xác nhận đặt sân. Vui lòng kiểm tra lại thông tin và thử lại.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasSelection) {
    return (
      <div className={styles.pageWrapper}>
        <main className={styles.mainContainer}>
          <h1 className={styles.pageTitle}>Booking Summary</h1>
          <p>No slots selected. Please choose slots on a court schedule first.</p>
          <Link to="/" className={styles.backLink}>
            ‹ Find courts
          </Link>
        </main>
      </div>
    );
  }

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
            <Link to="/" className={styles.activeLink}>
              Find Courts
            </Link>
            <Link to="/open-matches">Open Matches</Link>
            <Link to="/my-bookings">My Bookings</Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>MA</span>
            <span className={styles.userName}>Minh Anh</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        {/* Nút quay lại lịch sân */}
        <Link
          to={`/facilities/${bookingContext.facility?.facility_id || 1}`}
          className={styles.backLink}
        >
          ‹ Back to schedule
        </Link>

        <h1 className={styles.pageTitle}>Booking Summary</h1>

        <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Đặt cho + Thông tin booking + Ưu đãi */}
          <div className={styles.leftColumn}>
            {/* Card 1: Đặt cho (DR03 / BR09) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Book for</h2>
              <div className={styles.teamPillGroup}>
                <button
                  type="button"
                  className={`${styles.teamPill} ${selectedTeamId === null ? styles.teamPillActive : ''
                    }`}
                  onClick={() => setSelectedTeamId(null)}
                >
                  Personal
                </button>
                {ownedTeams.map((team) => (
                  <button
                    key={team.team_id}
                    type="button"
                    className={`${styles.teamPill} ${selectedTeamId === team.team_id ? styles.teamPillActive : ''
                      }`}
                    onClick={() => setSelectedTeamId(team.team_id)}
                  >
                    {team.team_name}
                  </button>
                ))}
              </div>
              <p className={styles.helperText}>
                Team selection is optional. Only teams you manage are shown.
              </p>
            </section>

            {/* Card 2: Thông tin booking (UC14) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Booking Information</h2>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Facility</span>
                  <strong className={styles.infoValue}>
                    {bookingContext.facility?.facility_name || 'Smash Arena'}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Court</span>
                  <strong className={styles.infoValue}>{slotSummary.courtName}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Date</span>
                  <strong className={styles.infoValue}>
                    {formatDate(bookingContext.playDate)}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Play Time</span>
                  <strong className={styles.infoValue}>{slotSummary.timeRangeText}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Booker</span>
                  <strong className={styles.infoValue}>{playerInfo.full_name}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Phone Number</span>
                  <strong className={styles.infoValue}>{playerInfo.phone_number}</strong>
                </div>
              </div>

              <div className={styles.noteGroup}>
                <label className={styles.noteLabel}>Note to facility owner (optional)</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  className={styles.noteTextarea}
                  placeholder="Can I borrow 2 extra rackets?"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                />
              </div>
            </section>

            {/* Card 3: Ưu đãi (Voucher & Điểm thưởng - DR08, BR41, P10, P13) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Promotions</h2>

              <label className={styles.noteLabel}>Voucher Code</label>
              <div className={styles.voucherRow}>
                <input
                  type="text"
                  className={styles.voucherInput}
                  value={voucherInput}
                  disabled={Boolean(appliedVoucher)}
                  onChange={(e) => {
                    setVoucherInput(e.target.value.toUpperCase());
                    setVoucherError('');
                  }}
                  placeholder="Enter discount code (e.g., DISC20K)"
                />
                <button
                  type="button"
                  className={styles.voucherBtn}
                  onClick={handleVoucherAction}
                  disabled={voucherLoading}
                >
                  {appliedVoucher ? 'Remove' : voucherLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {voucherError && <p className={styles.errorText}>{voucherError}</p>}

              {appliedVoucher && (
                <div className={styles.voucherSuccessBanner}>
                  Applied {appliedVoucher.voucher_code}: {appliedVoucher.description}
                </div>
              )}

              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Use Points</strong>
                  <span className={styles.pointsSub}>
                    You have {availablePoints} points (1 point = 500 VND). Max 50% of the remaining amount after voucher.
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={usePoints}
                  className={`${styles.switchToggle} ${usePoints ? styles.switchOn : ''}`}
                  onClick={() => setUsePoints((prev) => !prev)}
                >
                  <span className={styles.switchThumb} />
                </button>
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: Thanh toán & Xác nhận đặt sân */}
          <aside className={styles.rightColumn}>
            <div className={styles.paymentCard}>
              <h2 className={styles.cardTitle}>Payment</h2>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>
                  Court Fee ({slotSummary.totalSlots} ×{' '}
                  {slotSummary.unitPrice.toLocaleString('vi-VN')} VND)
                </span>
                <strong className={styles.priceValue}>
                  {pricingSummary.listPrice.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Voucher</span>
                <strong className={styles.discountValue}>
                  –{pricingSummary.voucherDiscount.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Points</span>
                <strong className={styles.discountValue}>
                  –{pricingSummary.pointsDiscount.toLocaleString('vi-VN')} VND (
                  {pricingSummary.pointsUsed} points)
                </strong>
              </div>

              <hr className={styles.divider} />

              <div className={styles.totalLine}>
                <span className={styles.totalLabel}>Total Payment</span>
                <strong className={styles.totalValue}>
                  {pricingSummary.finalAmount.toLocaleString('vi-VN')} VND
                </strong>
              </div>

              {pricingError && !submitError && <p className={styles.errorText}>{pricingError}</p>}

              {submitError && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  borderLeft: '4px solid #ef4444',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="button"
                className={styles.confirmBtn}
                disabled={submitting}
                onClick={handleConfirmBooking}
              >
                {submitting ? 'Holding slot...' : 'Confirm Booking'}
              </button>

              <p className={styles.holdNotice}>
                After confirmation, the slot will be held for 10 minutes for you to transfer funds and upload the receipt.
              </p>

              {/* Hiển thị thông báo xác nhận giữ chỗ thành công (Chuẩn bị nối sang UC18) */}
              {createdBooking && (
                <div className={styles.holdingSuccessBox}>
                  <strong>✅ Slot held with code {createdBooking.booking_code}!</strong>
                  <span>
                    Please transfer:{' '}
                    {createdBooking.pricing_summary.final_amount.toLocaleString('vi-VN')} VND to{' '}
                    {createdBooking.bank_info.bank_name} ({createdBooking.bank_info.bank_account_number}).
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}