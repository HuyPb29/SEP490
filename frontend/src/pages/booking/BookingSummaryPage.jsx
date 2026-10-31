import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMyPointsAtFacility,
  getMyOwnedTeams,
  applyVoucherApi,
  createBookingApi,
} from '../../api/bookingApi';
import styles from './BookingSummaryPage.module.css';

// FIX: Cinderella Bug (Chặn lỗi 24:00:00 của SQL Server)
function addThirtyMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const totalMins = hh * 60 + mm + 30;
  
  // Nếu chạm mốc 24:00 (1440 phút), ép về 23:59 để DB không bị crash
  if (totalMins >= 1440) return '23:59';
  
  const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const nextM = String(totalMins % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
}

export default function BookingSummaryPage() {
  const navigate = useNavigate();

  // 1. Load dữ liệu các slot đã chọn từ UC13 (hoặc khởi tạo chuẩn theo Mockup để dễ test)
  const [bookingContext] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pending_booking_selection');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedSlots?.length > 0) return parsed;
      }
    } catch {
      // Fallback nếu JSON lỗi
    }
    return {
      facility: {
        facility_id: 1,
        facility_name: 'Smash Arena',
        address: '12 Tran Thai Tong, Cau Giay, Hanoi',
      },
      playDate: '2026-10-24',
      selectedSlots: [
        { courtId: 2, courtName: 'Court 2', timeIdx: 4, time: '19:00', price: 80000 },
        { courtId: 2, courtName: 'Court 2', timeIdx: 5, time: '19:30', price: 80000 },
      ],
    };
  });

  // 2. Load thông tin Player đăng nhập (DR24, DR01)
  const [playerInfo] = useState(() => {
    try {
      const savedUser = localStorage.getItem('bms_user_info');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return {
          full_name: parsed.full_name || 'Nguyen Minh Anh',
          phone_number: parsed.phone_number || '0987 654 321',
          email: parsed.email || 'minhanh@gmail.com',
        };
      }
    } catch {
      // Fallback
    }
    return {
      full_name: 'Nguyen Minh Anh',
      phone_number: '0987 654 321',
      email: 'minhanh@gmail.com',
    };
  });

  // State Đội bóng (DR03 / BR09)
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null); // null = Cá nhân

  // State Ghi chú cho chủ sân (DR20: tối đa 200 ký tự)
  const [guestNote, setGuestNote] = useState('');

  // State Voucher (DR08) - Khởi tạo sẵn mã DISC20K để khớp giao diện mẫu, bấm "Remove" được ngay
  const [voucherInput, setVoucherInput] = useState('DISC20K');
  const [appliedVoucher, setAppliedVoucher] = useState({
    voucher_code: 'DISC20K',
    discount_amount: 20000,
    description: '20,000 VND off for orders from 100,000 VND.',
  });
  const [voucherError, setVoucherError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  // State Điểm thưởng tại cơ sở (FR89, P10, P11, P13, BR15, BR41)
  const [availablePoints, setAvailablePoints] = useState(120);
  const [usePoints, setUsePoints] = useState(true);

  // State thông báo khi chốt đơn
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const facilityId = bookingContext.facility?.facility_id || 1;
      const [pointsRes, teamsRes] = await Promise.all([
        getMyPointsAtFacility(facilityId),
        getMyOwnedTeams(),
      ]);
      if (pointsRes?.success) {
        setAvailablePoints(pointsRes.data.available_points);
      }
      if (teamsRes?.success) {
        setOwnedTeams(teamsRes.data);
      }
    };
    fetchInitialData();
  }, [bookingContext.facility?.facility_id]);

  // Tính toán thông tin hiển thị khung giờ & tiền sân niêm yết (DR05)
  const slotSummary = useMemo(() => {
    const slots = bookingContext.selectedSlots || [];
    const totalSlots = slots.length;
    const unitPrice = slots[0]?.price || 80000;
    const totalListPrice = slots.reduce((sum, s) => sum + s.price, 0);
    const courtId = slots[0]?.courtId || 2;
    const courtName = slots[0]?.courtName || 'Court 2';
    const startTime = slots[0]?.time || '19:00';
    const endTime = slots.length > 0 ? addThirtyMinutes(slots[slots.length - 1].time) : '20:00';

    return {
      totalSlots,
      unitPrice,
      totalListPrice,
      courtId,
      courtName,
      timeRangeText: `${startTime} – ${endTime} (${totalSlots} slot)`,
    };
  }, [bookingContext.selectedSlots]);

  // Thuật toán tính thứ tự trừ tiền (Discount Calculation Order - BR15, BR41, P10, P11, P13):
  // Giá niêm yết -> Trừ Voucher -> Trừ Điểm thưởng (tối đa 50% phần còn lại) -> Thực trả (> 0đ)
  const pricingSummary = useMemo(() => {
    const listPrice = slotSummary.totalListPrice;
    const voucherDiscount = appliedVoucher ? appliedVoucher.discount_amount : 0;
    const remainingAfterVoucher = Math.max(0, listPrice - voucherDiscount);

    let pointsUsed = 0;
    let pointsDiscount = 0;

    if (usePoints && availablePoints >= 2 && remainingAfterVoucher > 1000) {
      // P13 / BR41: Tối đa 50% số tiền còn lại sau khi trừ Voucher
      const maxAllowedDiscountByRatio = Math.floor(remainingAfterVoucher * 0.5);
      // BR15: Không có booking 0 đồng (giữ lại ít nhất 1.000đ thực trả)
      const maxAllowedDiscountByNonZero = Math.max(0, remainingAfterVoucher - 1000);
      const maxDiscountVnd = Math.min(maxAllowedDiscountByRatio, maxAllowedDiscountByNonZero);

      // Quy đổi sang số điểm tối đa được phép dùng (P10: 1 điểm = 500đ)
      const maxPointsByRule = Math.floor(maxDiscountVnd / 500);
      const candidatePoints = Math.min(availablePoints, maxPointsByRule);

      // P11 / BR15: Mỗi lần dùng điểm phải giảm tối thiểu 1.000đ (tức >= 2 điểm)
      if (candidatePoints >= 2) {
        pointsUsed = candidatePoints;
        pointsDiscount = pointsUsed * 500;
      }
    }

    const finalAmount = Math.max(0, remainingAfterVoucher - pointsDiscount);

    return {
      listPrice,
      voucherDiscount,
      remainingAfterVoucher,
      pointsUsed,
      pointsDiscount,
      finalAmount,
    };
  }, [slotSummary.totalListPrice, appliedVoucher, usePoints, availablePoints]);

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
      const res = await applyVoucherApi({
        facility_id: bookingContext.facility?.facility_id || 1,
        total_list_price: slotSummary.totalListPrice,
        voucher_code: voucherInput.trim(),
      });
      if (res?.success) {
        setAppliedVoucher(res.data);
      }
    } catch (err) {
      setVoucherError(err.response?.data?.message || err.message);
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

    // Format danh sách slot chuẩn "HH:mm:00" cho Backend
    const formattedSlots = (bookingContext.selectedSlots || []).map((s) => ({
      start_time: `${s.time}:00`,
      end_time: `${addThirtyMinutes(s.time)}:00`,
    }));

    const payload = {
      facility_id: bookingContext.facility?.facility_id || 1,
      court_id: slotSummary.courtId,
      booking_date: bookingContext.playDate,
      booking_type: 'single',
      slots: formattedSlots,
      team_id: selectedTeamId,
      voucher_code: appliedVoucher ? appliedVoucher.voucher_code : null,
      points_used: pricingSummary.pointsUsed,
      guest_note: guestNote.trim() || null,
      // Các trường hỗ trợ hiển thị Mock Response
      total_list_price: pricingSummary.listPrice,
      voucher_discount_amount: pricingSummary.voucherDiscount,
      final_amount: pricingSummary.finalAmount,
    };

    setSubmitting(true);
    try {
      const res = await createBookingApi(payload);
      if (res?.success) {
        // Lưu thông tin giữ chỗ 5 phút (BR03) và VietQR vào sessionStorage cho màn UC18 (Thanh toán)
        sessionStorage.setItem('active_holding_booking', JSON.stringify(res.data));
        setCreatedBooking(res.data);
        navigate('/booking/payment');
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.message ||
          err.message ||
          'Slot is currently held or booked. Please choose another slot (MSG28).'
      );
    } finally {
      setSubmitting(false);
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
                  className={`${styles.teamPill} ${
                    selectedTeamId === null ? styles.teamPillActive : ''
                  }`}
                  onClick={() => setSelectedTeamId(null)}
                >
                  Personal
                </button>
                {ownedTeams.map((team) => (
                  <button
                    key={team.team_id}
                    type="button"
                    className={`${styles.teamPill} ${
                      selectedTeamId === team.team_id ? styles.teamPillActive : ''
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

              {submitError && <p className={styles.errorText}>{submitError}</p>}

              <button
                type="button"
                className={styles.confirmBtn}
                disabled={submitting}
                onClick={handleConfirmBooking}
              >
                {submitting ? 'Holding slot...' : 'Confirm Booking'}
              </button>

              <p className={styles.holdNotice}>
                After confirmation, the slot will be held for 5 minutes for you to transfer funds and upload the receipt.
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