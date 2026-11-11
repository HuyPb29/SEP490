import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import {
  getMyPointsAtFacility,
  getMyOwnedTeams,
  getCheckoutVouchers,
  applyVoucherApi,
  createBookingApi,
  previewBookingApi,
} from '../../api/bookingApi';
import { getSavedUser } from '../../api/session';
import styles from './BookingSummaryPage.module.css';

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export default function BookingSummaryPage() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const [bookingContext] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('pending_booking_selection'));
      return saved?.source === 'backend' && saved.selectedSlots?.length ? saved : null;
    } catch {
      return null;
    }
  });
  const selection = useMemo(() => {
    if (!bookingContext) return null;
    const slots = bookingContext.selectedSlots;
    return {
      courtId: slots[0].courtId,
      date: bookingContext.playDate,
      startMinute: toMinutes(slots[0].time),
      endMinute: toMinutes(slots[slots.length - 1].time) + 30,
    };
  }, [bookingContext]);
  const isPlayer = user?.role_code === 'player';
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [pointsError, setPointsError] = useState('');

  // State Đội bóng (DR03 / BR09)
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null); // null = Cá nhân

  // State Ghi chú cho chủ sân (DR20: tối đa 200 ký tự)
  const [guestNote, setGuestNote] = useState('');

  // Sửa lại thành chuỗi rỗng và null
  const [voucherInput, setVoucherInput] = useState('');
  const [checkoutVouchers, setCheckoutVouchers] = useState({ publicVouchers: [], grants: [] });
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  // State Điểm thưởng tại cơ sở (FR89, P10, P11, P13, BR15, BR41)
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsInput, setPointsInput] = useState('');

  // State thông báo khi chốt đơn
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!isPlayer || !selection) return undefined;
    const controller = new AbortController();
    const active = () => !controller.signal.aborted;
    previewBookingApi(selection, controller.signal)
      .then((data) => { if (active()) setQuote(data); })
      .catch((error) => {
        if (active()) setQuoteError(error.response?.data?.message || 'Không tải được giá đặt sân.');
      });
    getMyOwnedTeams().then((teams) => { if (active()) setOwnedTeams(teams); })
      .catch(() => { if (active()) setOwnedTeams([]); });
    getMyPointsAtFacility(bookingContext.facility.facility_id)
      .then((points) => { if (active()) setAvailablePoints(points); })
      .catch((error) => {
        if (active()) setPointsError(error.response?.data?.message || 'Không tải được số dư điểm.');
      });
    getCheckoutVouchers(bookingContext.facility.facility_id)
      .then((vouchers) => { if (active()) setCheckoutVouchers(vouchers); })
      .catch(() => { if (active()) setCheckoutVouchers({ publicVouchers: [], grants: [] }); });
    return () => controller.abort();
  }, [bookingContext, isPlayer, selection]);

  const listPrice = quote?.listAmount ?? 0;
  const voucherDiscount = appliedVoucher?.discountAmount ?? 0;
  const remainingAfterVoucher = listPrice - voucherDiscount;
  const pointsAllowed = Math.min(availablePoints, Math.floor(remainingAfterVoucher / 1000));
  const requestedPoints = Number(pointsInput);
  const validPoints = Number.isInteger(requestedPoints) &&
    (requestedPoints === 0 || (requestedPoints >= 2 && requestedPoints <= pointsAllowed));
  const pointsUsed = validPoints ? requestedPoints : 0;
  const pointsDiscount = pointsUsed * 500;
  const pricingSummary = { listPrice, voucherDiscount, remainingAfterVoucher, pointsUsed, pointsDiscount,
    finalAmount: remainingAfterVoucher - pointsDiscount };
  const slotSummary = {
    courtName: quote?.courtName,
    totalSlots: quote?.slots?.length ?? 0,
    timeRangeText: quote ? quote.startTime + ' – ' + quote.endTime : '',
  };

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

    if (!voucherInput.trim() && !selectedGrant) {
      setVoucherError('Please enter a voucher code before applying.');
      return;
    }

    setVoucherLoading(true);
    try {
      const code = voucherInput.trim().toUpperCase();
      const selection = selectedGrant ? { grantId: selectedGrant } : { code };
      const checked = await applyVoucherApi({ locationId: quote.locationId, orderAmount: quote.listAmount, selection });
      setAppliedVoucher({ ...checked, selection, label: selectedGrant
        ? checkoutVouchers.grants.find((grant) => grant.grantId === selectedGrant)?.voucher.name : code });
    } catch (err) {
      const message = err.response?.data?.message;
      setVoucherError(
        message && message !== 'No message available'
          ? message
          : 'Mã giảm giá không đủ điều kiện hoặc có lỗi xảy ra. Vui lòng kiểm tra lại.'
      );
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!quote || submitting || voucherLoading || !validPoints) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = {
        ...selection,
        teamId: selectedTeamId,
        note: guestNote.trim() || null,
        voucherCode: appliedVoucher?.selection.code ?? null,
        voucherGrantId: appliedVoucher?.selection.grantId ?? null,
        pointsToUse: pointsUsed,
      };
      const checked = await previewBookingApi(payload);
      if (checked.listAmount !== listPrice || checked.voucherDiscount !== voucherDiscount ||
          checked.pointDiscount !== pointsDiscount || checked.finalAmount !== pricingSummary.finalAmount) {
        setAppliedVoucher(null);
        setQuote(checked);
        setPointsInput('');
        setSubmitError('Giá hoặc ưu đãi đã thay đổi. Vui lòng kiểm tra lại trước khi xác nhận.');
        return;
      }
      const booking = await createBookingApi(payload);
      sessionStorage.removeItem('pending_booking_selection');
      navigate('/booking/payment?bookingId=' + booking.id, { replace: true });
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Không thể xác nhận đặt sân. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingContext) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/summary' }} replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản Player để đặt sân.</p>;
  if (!quote) return <main className={styles.mainContainer}>
    <p role={quoteError ? 'alert' : 'status'}>{quoteError || 'Đang tải giá đặt sân…'}</p>
    {quoteError && <Link to={'/facilities/' + bookingContext.facility.facility_id}>Quay lại lịch sân</Link>}
  </main>;

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
            <span className={styles.avatar}>{user.full_name?.charAt(0)}</span>
            <span className={styles.userName}>{user.full_name}</span>
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
                    key={team.id}
                    type="button"
                    className={`${styles.teamPill} ${selectedTeamId === team.id ? styles.teamPillActive : ''
                      }`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    {team.name}
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
                  <strong className={styles.infoValue}>{quote.bookerName}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Phone Number</span>
                  <strong className={styles.infoValue}>{quote.bookerPhone}</strong>
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

              <label className={styles.noteLabel} htmlFor="voucher-code">Voucher Code</label>
              <div className={styles.voucherRow}>
                <input
                  id="voucher-code"
                  type="text"
                  className={styles.voucherInput}
                  value={voucherInput}
                  list="public-vouchers"
                  maxLength={20}
                  disabled={Boolean(appliedVoucher) || voucherLoading || submitting}
                  onChange={(e) => {
                    setVoucherInput(e.target.value.toUpperCase());
                    setSelectedGrant(null);
                    setVoucherError('');
                  }}
                  placeholder="Enter discount code"
                />
                <datalist id="public-vouchers">
                  {checkoutVouchers.publicVouchers.map((voucher) =>
                    <option key={voucher.id} value={voucher.code}>{voucher.name}</option>)}
                </datalist>
                <button
                  type="button"
                  className={styles.voucherBtn}
                  onClick={handleVoucherAction}
                  disabled={voucherLoading || submitting}
                >
                  {appliedVoucher ? 'Remove' : voucherLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {checkoutVouchers.grants.length > 0 && <div className={styles.noteGroup}>
                <label className={styles.noteLabel} htmlFor="voucher-grant">Voucher cá nhân</label>
                <select id="voucher-grant" className={styles.voucherInput} value={selectedGrant ?? ''}
                  disabled={Boolean(appliedVoucher) || voucherLoading || submitting}
                  onChange={(event) => {
                    setSelectedGrant(Number(event.target.value) || null);
                    setVoucherInput('');
                    setVoucherError('');
                  }}>
                  <option value="">Chọn voucher cá nhân</option>
                  {checkoutVouchers.grants.map(({ grantId, voucher }) =>
                    <option key={grantId} value={grantId}>{voucher.name} · {voucher.code}</option>)}
                </select>
              </div>}

              {voucherError && <p className={styles.errorText}>{voucherError}</p>}

              {pointsError && <p role="alert" className={styles.errorText}>{pointsError}</p>}

              {appliedVoucher && (
                <div className={styles.voucherSuccessBanner}>
                  Applied {appliedVoucher.label}: {appliedVoucher.discountAmount.toLocaleString('vi-VN') + ' VND'}
                </div>
              )}

              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Use Points</strong>
                  <span className={styles.pointsSub}>
                    You have {availablePoints} points (1 point = 500 VND). Max 50% of the remaining amount after voucher.
                  </span>
                </div>

                <input type="number" aria-label="Số điểm muốn dùng" min="0" max={pointsAllowed}
                  placeholder="0" value={pointsInput} disabled={submitting || voucherLoading}
                  onChange={(event) => setPointsInput(event.target.value)} />
                {!validPoints && <p role="alert" className={styles.errorText}>
                  {pointsAllowed < 2 ? 'Booking này chưa đủ điều kiện dùng điểm.' : `Nhập 0 hoặc từ 2 đến ${pointsAllowed} điểm.`}
                </p>}
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: Thanh toán & Xác nhận đặt sân */}
          <aside className={styles.rightColumn}>
            <div className={styles.paymentCard}>
              <h2 className={styles.cardTitle}>Payment</h2>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>
                  Court Fee ({slotSummary.totalSlots} slots)
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
                disabled={submitting || voucherLoading || !validPoints}
                onClick={handleConfirmBooking}
              >
                {submitting ? 'Holding slot...' : 'Confirm Booking'}
              </button>

              <p className={styles.holdNotice}>
                The payment page will show the deadline for transferring funds and uploading the receipt.
              </p>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
