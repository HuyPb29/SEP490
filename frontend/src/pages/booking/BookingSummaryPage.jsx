import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import styles from './BookingSummaryPage.module.css';
import { formatVnd } from '../../utils/formatters';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, pointInputError } from '../../utils/checkoutPoints';
import { CheckoutProgress, ConfirmDialog, Feedback } from '../../components/common/WorkspacePrimitives';
import { PublicHeader } from '../../components/layout/PublicLayout';

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinute(minute) {
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// BR01, BR64: Gộp các slot 30 phút liền nhau trên cùng 1 sân thành từng dải (range)
function groupSlotsIntoRanges(selectedSlots) {
  const sorted = [...selectedSlots].sort(
    (a, b) => a.courtId - b.courtId || toMinutes(a.time) - toMinutes(b.time)
  );
  const ranges = [];
  for (const slot of sorted) {
    const startMinute = toMinutes(slot.time);
    const endMinute = startMinute + 30;
    const prev = ranges[ranges.length - 1];
    if (prev && prev.courtId === slot.courtId && prev.endMinute === startMinute) {
      prev.endMinute = endMinute;
      prev.endTime = formatMinute(endMinute);
      prev.listAmount += Number(slot.price || 0);
    } else {
      ranges.push({
        courtId: slot.courtId,
        courtName: slot.courtName,
        startMinute,
        endMinute,
        startTime: formatMinute(startMinute),
        endTime: formatMinute(endMinute),
        listAmount: Number(slot.price || 0),
      });
    }
  }
  return ranges;
}

export default function BookingSummaryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getMyPointsAtFacility,
    getMyOwnedTeams,
    getCheckoutVouchers,
    applyVoucherApi,
    previewBookingApi,
    createBookingApi,
    createDayOrderApi,
    previewDayOrderApi,
  } = useBookingActions();
  const [bookingContext] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('pending_booking_selection'));
      return saved?.source === 'backend' && saved.selectedSlots?.length ? saved : null;
    } catch {
      return null;
    }
  });
  const ranges = useMemo(
    () => (bookingContext ? groupSlotsIntoRanges(bookingContext.selectedSlots) : []),
    [bookingContext]
  );
  const isOrder = ranges.length > 1;
  const selection = useMemo(() => {
    if (!bookingContext || !ranges.length) return null;
    if (!isOrder) {
      return {
        courtId: ranges[0].courtId,
        date: bookingContext.playDate,
        startMinute: ranges[0].startMinute,
        endMinute: ranges[0].endMinute,
      };
    }
    return {
      date: bookingContext.playDate,
      ranges: ranges.map((r) => ({
        courtId: r.courtId,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
    };
  }, [bookingContext, isOrder, ranges]);
  const isPlayer = user?.role_code === 'player';
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [pointSubmitError, setPointSubmitError] = useState('');

  // State Đội bóng (DR03 / BR09)
  const [teamError, setTeamError] = useState('');
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
    const previewFn = isOrder ? previewDayOrderApi : previewBookingApi;
    previewFn(selection, controller.signal)
      .then((data) => { if (active()) setQuote(data); })
      .catch((error) => {
        if (active()) setQuoteError(error.response?.data?.message || 'Không tải được giá đặt sân.');
      });
    getMyOwnedTeams().then((teams) => { if (active()) setOwnedTeams(teams); })
      .catch(() => { if (active()) setTeamError('Không tải được danh sách đội. Bạn vẫn có thể đặt cho cá nhân.'); });
    getMyPointsAtFacility(bookingContext.facility.facility_id)
      .then((points) => { if (active()) setAvailablePoints(points); })
      .catch((error) => {
        if (active()) setPointsError(error.response?.data?.message || 'Không tải được số dư điểm.');
      });
    getCheckoutVouchers(bookingContext.facility.facility_id)
      .then((vouchers) => { if (active()) setCheckoutVouchers(vouchers); })
      .catch(() => { if (active()) setVoucherError('Không tải được danh sách voucher. Bạn vẫn có thể nhập mã.'); });
    return () => controller.abort();
  }, [bookingContext, isOrder, isPlayer, selection, previewDayOrderApi, previewBookingApi, getMyOwnedTeams, getMyPointsAtFacility, getCheckoutVouchers]);

  const listPrice = Number(quote?.listAmount ?? 0);
  const voucherDiscount = Number(appliedVoucher?.discountAmount ?? 0);
  const remainingAfterVoucher = listPrice - voucherDiscount;
  const pointsAllowed = checkoutPointLimit(remainingAfterVoucher, availablePoints);
  const requestedPoints = Number(pointsInput);
  const pointValidation = pointInputError(requestedPoints, availablePoints, pointsAllowed);
  const validPoints = !pointValidation;
  const pointsUsed = validPoints ? requestedPoints : 0;
  const pointsDiscount = pointsUsed * 500;
  const pricingSummary = { listPrice, voucherDiscount, remainingAfterVoucher, pointsUsed, pointsDiscount,
    finalAmount: remainingAfterVoucher - pointsDiscount };
  const slotSummary = {
    totalSlots: bookingContext?.selectedSlots.length ?? 0,
    sessions: isOrder
      ? (quote?.sessions ?? [])
      : quote
        ? [{
            courtId: quote.courtId ?? ranges[0]?.courtId,
            courtName: quote.courtName ?? ranges[0]?.courtName,
            startMinute: ranges[0]?.startMinute ?? 0,
            startTime: quote.startTime ?? ranges[0]?.startTime,
            endTime: quote.endTime ?? ranges[0]?.endTime,
            listAmount: quote.listAmount,
            conflict: null,
          }]
        : [],
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dayName}, ${dd}/${mm}/${yyyy}`;
  };

  const validNote = guestNote.length <= 200;

  // Xử lý Áp dụng hoặc Bỏ mã Voucher
  const handleVoucherAction = async () => {
    setVoucherError('');
    setPointSubmitError('');

    // Nếu đang có mã được áp dụng -> bấm nút sẽ Bỏ mã
    if (appliedVoucher) {
      setAppliedVoucher(null);
      return;
    }

    if (!voucherInput.trim() && !selectedGrant) {
      setVoucherError('Vui lòng nhập mã giảm giá hoặc chọn voucher cá nhân. (MSG01)');
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
      const reason = message && message !== 'No message available' ? message : 'Vui lòng kiểm tra lại.';
      setVoucherError(checkoutRewardErrorField(reason) === 'voucher' ? reason : `Mã giảm giá không dùng được: ${reason} (MSG34)`);
    } finally {
      setVoucherLoading(false);
    }
  };

  const [confirmPoints, setConfirmPoints] = useState(false);
  const handleConfirmBooking = async () => {
    if (!quote || quote.conflictSessions || submitting || voucherLoading || !validPoints || !validNote) return;
    setSubmitError('');
    setVoucherError('');
    setPointSubmitError('');
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
      const previewFn = isOrder ? previewDayOrderApi : previewBookingApi;
      const checked = await previewFn(payload);
      if (checked.conflictSessions) {
        setQuote(checked);
        setSubmitError('Có khung giờ vừa bị giữ hoặc đặt. Vui lòng chọn lại các khung giờ được đánh dấu. (MSG28)');
        return;
      }
      if (Number(checked.listAmount) !== listPrice || Number(checked.voucherDiscount) !== voucherDiscount ||
          Number(checked.pointDiscount) !== pointsDiscount || Number(checked.finalAmount) !== pricingSummary.finalAmount) {
        setAppliedVoucher(null);
        setQuote(checked);
        setPointsInput('');
        setSubmitError('Giá hoặc ưu đãi đã thay đổi. Vui lòng kiểm tra lại trước khi xác nhận.');
        return;
      }
      if (isOrder) {
        const bookingOrder = await createDayOrderApi(payload);
        sessionStorage.removeItem('pending_booking_selection');
        navigate('/booking/payment?packageId=' + bookingOrder.id, { replace: true });
      } else {
        const booking = await createBookingApi(payload);
        sessionStorage.removeItem('pending_booking_selection');
        navigate('/booking/payment?bookingId=' + booking.id, { replace: true });
      }
    } catch (error) {
      const message = error.response?.data?.message;
      if (message?.includes('MSG28') || error.response?.status === 409) {
        const refreshed = await (isOrder ? previewDayOrderApi : previewBookingApi)(selection).catch(() => null);
        if (refreshed) setQuote(refreshed);
      }
      const field = checkoutRewardErrorField(message);
      if (field === 'voucher') {
        setAppliedVoucher(null);
        setVoucherError(message);
      } else if (field === 'points') setPointSubmitError(message);
      else setSubmitError(message || 'Không thể xác nhận đặt sân. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingContext) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/summary' }} replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản Player để đặt sân.</p>;
  if (!quote) return <div className="cw-workspace"><PublicHeader user={user} /><main className={styles.mainContainer}>
    <Feedback tone={quoteError ? 'error' : 'info'}>{quoteError || 'Đang tải giá đặt sân…'}
      {quoteError && <Link className="cw-secondary" to={'/facilities/' + bookingContext.facility.facility_id}>Quay lại lịch sân</Link>}
    </Feedback>
  </main></div>;

  return (
    <div className={`${styles.pageWrapper} cw-workspace`}>
      <PublicHeader user={user} />
      {confirmPoints && <ConfirmDialog title="Xác nhận dùng điểm" onCancel={() => setConfirmPoints(false)} onConfirm={() => {
        setConfirmPoints(false);
        handleConfirmBooking();
      }}>Dùng {pointsUsed} điểm để giảm {formatVnd(pointsDiscount)}? Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy booking. (MSG39)</ConfirmDialog>}

      <main className={styles.mainContainer}>
        {/* Nút quay lại lịch sân */}
        <Link
          to={`/facilities/${bookingContext.facility?.facility_id || 1}`}
          className={styles.backLink}
        >
          ‹ Quay lại lịch sân
        </Link>

        <CheckoutProgress current={0} />
        <h1 className={styles.pageTitle}>Xác nhận lịch đặt sân</h1>

        <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Đặt cho + Thông tin booking + Ưu đãi */}
          <div className={styles.leftColumn}>
            {/* Card 1: Đặt cho (DR03 / BR09) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Đặt cho</h2>
              <div className={styles.teamPillGroup}>
                <button
                  type="button"
                  className={`${styles.teamPill} ${selectedTeamId === null ? styles.teamPillActive : ''
                    }`}
                  aria-pressed={selectedTeamId === null}
                  onClick={() => setSelectedTeamId(null)}
                >
                  Cá nhân
                </button>
                {ownedTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    className={`${styles.teamPill} ${selectedTeamId === team.id ? styles.teamPillActive : ''
                      }`}
                    aria-pressed={selectedTeamId === team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
              <p className={styles.helperText}>
                Chọn đội nếu bạn đặt sân thay cho đội mình quản lý.
              </p>
            </section>

            {/* Card 2: Thông tin booking (UC14) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Thông tin đặt sân</h2>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Địa điểm</span>
                  <strong className={styles.infoValue}>
                    {bookingContext.facility?.facility_name || quote.locationName || '—'}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Sân</span>
                  <strong className={styles.infoValue}>{[...new Set(slotSummary.sessions.map((item) => item.courtName))].join(', ')}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Ngày chơi</span>
                  <strong className={styles.infoValue}>
                    {formatDate(bookingContext.playDate)}
                  </strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Giờ chơi</span>
                  <ul>{slotSummary.sessions.map((item) => <li key={item.courtId + ':' + item.startMinute}>
                    {item.courtName} · {item.startTime}–{item.endTime} · {item.conflict
                      ? 'Không còn trống' : formatVnd(Number(item.listAmount))}
                  </li>)}</ul>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Người đặt</span>
                  <strong className={styles.infoValue}>{user.full_name}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Số điện thoại</span>
                  <strong className={styles.infoValue}>{user.phone_number}</strong>
                </div>
              </div>

              <div className={styles.noteGroup}>
                <label className={styles.noteLabel} htmlFor="booking-note">Ghi chú cho chủ sân (không bắt buộc, tối đa 200 ký tự)</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  id="booking-note" className={styles.noteTextarea}
                  placeholder="Ví dụ: Cho mình mượn thêm 2 vợt cầu lông..."
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                />
                {!validNote && <p role="alert" className={styles.errorText}>Ghi chú không được vượt quá 200 ký tự (MSG109).</p>}
              </div>
            </section>

            {teamError && <p role="alert" className={styles.errorText}>{teamError}</p>}
            {/* Card 3: Ưu đãi (Voucher & Điểm thưởng - DR08, BR41, P10, P13) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Voucher và điểm thưởng</h2>

              <label className={styles.noteLabel} htmlFor="voucher-code">Mã voucher</label>
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
                  placeholder="Nhập mã giảm giá"
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
                  {appliedVoucher ? 'Bỏ mã' : voucherLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
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

              {voucherError && <p className={styles.errorText} role="alert">{voucherError}</p>}

              {pointsError && <p role="alert" className={styles.errorText}>{pointsError}</p>}

              {appliedVoucher && (
                <div className={styles.voucherSuccessBanner}>
                  Đã áp dụng {appliedVoucher.label}: giảm {formatVnd(appliedVoucher.discountAmount)} (MSG36)
                </div>
              )}

              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Dùng điểm thưởng</strong>
                  <span className={styles.pointsSub}>
                    Bạn đang có {availablePoints} điểm tại địa điểm này (1 điểm = 500 VND).{' '}
                    Tối đa {checkoutPointPercent}% {appliedVoucher ? 'số tiền còn lại sau voucher' : 'giá niêm yết'}.
                  </span>
                </div>

                <input type="number" aria-label="Số điểm muốn dùng" min="0" max={pointsAllowed}
                  placeholder="0" value={pointsInput} disabled={submitting || voucherLoading}
                  aria-invalid={Boolean(pointValidation || pointSubmitError)}
                  aria-describedby={pointValidation || pointSubmitError ? 'checkout-point-error' : undefined}
                  onChange={(event) => { setPointsInput(event.target.value); setPointSubmitError(''); }} />
                {(pointValidation || pointSubmitError) && <p id="checkout-point-error" role="alert" className={styles.errorText}>
                  {pointValidation || pointSubmitError}
                </p>}
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: Thanh toán & Xác nhận đặt sân */}
          <aside className={styles.rightColumn}>
            <div className={styles.paymentCard}>
              <h2 className={styles.cardTitle}>Chi phí đặt sân</h2>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>
                  Tiền sân ({slotSummary.totalSlots} slot{isOrder ? `, ${ranges.length} dải` : ''})
                </span>
                <strong className={styles.priceValue}>
                  {formatVnd(pricingSummary.listPrice)}
                </strong>
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Voucher</span>
                <strong className={styles.discountValue}>
                  –{formatVnd(pricingSummary.voucherDiscount)}
                </strong>
              </div>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Điểm thưởng</span>
                <strong className={styles.discountValue}>
                  –{formatVnd(pricingSummary.pointsDiscount)} (
                  {pricingSummary.pointsUsed} điểm)
                </strong>
              </div>

              <hr className={styles.divider} />

              <div className={styles.totalLine}>
                <span className={styles.totalLabel}>Cần thanh toán</span>
                <strong className={styles.totalValue}>
                  {formatVnd(pricingSummary.finalAmount)}
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
                disabled={submitting || voucherLoading || !validPoints || !validNote || quote.conflictSessions > 0}
                onClick={() => pointsUsed > 0 ? setConfirmPoints(true) : handleConfirmBooking()}
              >
                {submitting ? 'Đang giữ chỗ…' : 'Xác nhận và thanh toán'}
              </button>

              <p className={styles.holdNotice}>
                Trang thanh toán sẽ hiển thị mã QR chuyển khoản và giữ chỗ trong 10 phút để bạn gửi chứng từ (BR03).
              </p>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
