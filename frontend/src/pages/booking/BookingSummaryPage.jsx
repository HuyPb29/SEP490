import { NumberInput as UiNumberInput, Slider as UiSlider } from '../../components/ui';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import styles from './BookingSummaryPage.module.css';
import { money, shortDate, uiMessage } from '../../utils/formatters';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, defaultPointRedemptionValue, pointInputError } from '../../utils/checkoutPoints';
import { CheckoutProgress } from '../../components/common/WorkspacePrimitives';
import CheckoutVoucherPicker from '../../components/booking/CheckoutVoucherPicker';
import { useCheckoutVoucherSelection } from '../../hooks/useCheckoutVouchers';
import PublicLayout from '../../components/layout/PublicLayout';
import { Button, FormField, Textarea, PageHeader, LoadingState, ErrorState, EmptyState, ConfirmDialog } from '../../components/common';

const formatVnd = amount => money(amount).replace(/\s*₫/, 'đ');

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
  const submitLock = useRef(false);
  const feedbackRef = useRef(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(true);
  const { user } = useAuth();
  const {
    getMyPointsAtFacility,
    getMyOwnedTeams,
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
      })
      .finally(() => { if (active()) setQuoteLoading(false); });
    getMyOwnedTeams().then((teams) => { if (active()) setOwnedTeams(teams); })
      .catch(() => { if (active()) setTeamError('Không tải được danh sách đội. Bạn vẫn có thể đặt cho cá nhân.'); })
      .finally(() => { if (active()) setTeamsLoading(false); });
    getMyPointsAtFacility(bookingContext.facility.facility_id)
      .then((points) => { if (active()) setAvailablePoints(points); })
      .catch((error) => {
        if (active()) setPointsError(error.response?.data?.message || 'Không tải được số dư điểm.');
      })
      .finally(() => { if (active()) setPointsLoading(false); });
    return () => controller.abort();
  }, [loadAttempt, bookingContext, isOrder, isPlayer, selection, previewDayOrderApi, previewBookingApi, getMyOwnedTeams, getMyPointsAtFacility]);

  const listPrice = Number(quote?.listAmount ?? 0);
  const voucher = useCheckoutVoucherSelection(quote?.locationId, quote?.conflictSessions ? 0 : listPrice);
  const { applied: appliedVoucher, checking: voucherLoading } = voucher;
  useEffect(() => {
    const target = pointSubmitError ? document.getElementById('checkout-points') : submitError ? feedbackRef.current : voucher.error ? document.getElementById('checkout-voucher-code') : null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }, [submitError, pointSubmitError, voucher.error]);
  const pointValue = quote?.pointRedemptionValue || defaultPointRedemptionValue;
  const voucherDiscount = Number(appliedVoucher?.discountAmount ?? 0);
  const remainingAfterVoucher = listPrice - voucherDiscount;
  const pointsAllowed = checkoutPointLimit(remainingAfterVoucher, availablePoints, pointValue);
  const requestedPoints = Number(pointsInput);
  const pointValidation = pointInputError(requestedPoints, availablePoints, pointsAllowed, pointValue);
  const validPoints = !pointValidation;
  const pointsUsed = validPoints ? requestedPoints : 0;
  const pointsDiscount = pointsUsed * pointValue;
  const minimumPoints = Math.max(1, Math.ceil(1000 / pointValue));
  // One stop for zero, then every valid positive amount. Skip discounts below 1,000đ.
  const sliderMax = Math.max(0, pointsAllowed - minimumPoints + 1);
  const sliderValue = validPoints && pointsUsed >= minimumPoints ? pointsUsed - minimumPoints + 1 : 0;
  const pointsDisabled = submitting || voucherLoading || pointsLoading || Boolean(pointsError) || sliderMax === 0;
  const selectPointStop = (stop) => {
    setPointsInput(String(stop > 0 ? Math.min(stop, sliderMax) + minimumPoints - 1 : 0));
    setPointSubmitError('');
  };
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

  const formatDate = dateStr => shortDate(dateStr);

  const validNote = guestNote.length <= 200;

  const [confirmPoints, setConfirmPoints] = useState(false);
  const handleConfirmBooking = async () => {
    if (!quote || quote.conflictSessions || quoteLoading || submitLock.current || submitting || voucherLoading || !validPoints || !validNote) return;
    setSubmitError('');
    setPointSubmitError('');
    submitLock.current = true;
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
        voucher.onRemove();
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
        const detail = message.includes('MSG108') ? message : message.replace(/\s*\(MSG34\)$/, '') + ' (MSG108)';
        voucher.invalidate(detail);
      }
      else if (field === 'points') setPointSubmitError(message);
      else setSubmitError(message || 'Không thể xác nhận đặt sân. Vui lòng thử lại.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!bookingContext) return <Navigate to="/locations" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/summary' }} replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản người chơi để đặt sân.</p>;
  const retryCheckout = () => {
    setQuoteError(''); setTeamError(''); setPointsError('');
    setQuoteLoading(true); setTeamsLoading(true); setPointsLoading(true);
    setLoadAttempt(value => value + 1);
  };
  const backToSchedule = '/facilities/' + (bookingContext.facility?.facility_id || 1);
  if (!quote) return <PublicLayout><PageHeader title="Kiểm tra đơn đặt sân" subtitle="Đang đối chiếu lịch và giá sân của bạn." />
    {quoteError ? <ErrorState message={uiMessage(quoteError)} onRetry={retryCheckout} /> : quoteLoading ? <LoadingState message="Đang tải giá và thông tin đặt sân…" /> : <EmptyState title="Chưa có thông tin báo giá" description="Thử tải lại để kiểm tra lịch và giá sân trước khi giữ chỗ." action={<Button variant="secondary" onClick={retryCheckout}>Thử lại</Button>} />}
    <Link className={styles.backLink} to={backToSchedule}>← Quay lại lịch sân</Link>
  </PublicLayout>;
  const blocked = submitting || quoteLoading || voucherLoading || !validPoints || !validNote || quote.conflictSessions > 0;
  const confirmBooking = () => pointsUsed > 0 ? setConfirmPoints(true) : handleConfirmBooking();
  const conflicted = slotSummary.sessions.filter(item => item.conflict);
  const hasConflict = Boolean(quote.conflictSessions) || /MSG28/.test(submitError);
  const pendingLimit = /MSG29|chờ thanh toán|đơn đang chờ/i.test(submitError);
  const confirmButton = (mobile = false) => <Button loading={submitting} disabled={blocked} onClick={confirmBooking} className={styles.confirmBtn} aria-describedby={mobile ? 'mobile-hold-notice' : 'hold-notice'}>{mobile ? 'Xác nhận' : 'Xác nhận và giữ chỗ'}</Button>;

  return <PublicLayout className={styles.checkoutPage}>
    <div className={styles.container}>
      <Link to={backToSchedule} className={styles.backLink}>← Quay lại lịch sân</Link>
      <CheckoutProgress current={0} />
      <PageHeader eyebrow="Kiểm tra trước khi giữ chỗ" title="Tóm tắt đơn đặt sân" subtitle="Xem lại lịch chơi, chọn ưu đãi và xác nhận thông tin người đặt." />
      {quoteLoading && <LoadingState message="Đang cập nhật thông tin đơn…" />}
      {quoteError && <ErrorState message={uiMessage(quoteError)} onRetry={retryCheckout} />}
      {hasConflict && <section ref={feedbackRef} tabIndex={-1} className={styles.conflict} aria-labelledby="conflict-title" role="alert"><h2 id="conflict-title">Một số khung giờ không còn trống</h2><p>Đơn chưa được tạo. Hãy quay lại lịch và chọn lại những khung giờ bị trùng.</p>
        {conflicted.length > 0 && <ul>{conflicted.map(item => <li key={item.courtId + ':' + item.startMinute}><strong>{item.courtName}</strong> · {item.startTime}–{item.endTime}</li>)}</ul>}
        {submitError && <p>{uiMessage(submitError)}</p>}<Link to={backToSchedule} className={styles.linkButton}>Quay lại lịch để chọn lại</Link>
      </section>}
      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          <section className={styles.card} aria-labelledby="selection-heading"><header className={styles.cardHeader}><div><p className={styles.eyebrow}>Lịch chơi của bạn</p><h2 id="selection-heading">{bookingContext.facility?.facility_name || quote.locationName || 'Địa điểm đã chọn'}</h2></div><span className={styles.countChip}>{ranges.length} booking · {slotSummary.totalSlots} slot</span></header>
            <p className={styles.playDate}>{formatDate(bookingContext.playDate)}</p>
            <p className={styles.helper}>Cùng một ngày, cùng một địa điểm. Mỗi dải giờ liền nhau trên một sân là một booking.</p>
            {!slotSummary.sessions.length ? <EmptyState title="Chưa có chi tiết lịch đặt" description="Thử tải lại thông tin hoặc quay lại lịch để chọn khung giờ." action={<Button variant="secondary" onClick={retryCheckout}>Thử lại</Button>} /> : <ol className={styles.sessions}>{slotSummary.sessions.map((item, index) => {
              const range = ranges.find(range => range.courtId === item.courtId && (range.startMinute === item.startMinute || range.startTime === item.startTime)) || ranges[index];
              const count = range ? (range.endMinute - range.startMinute) / 30 : 0;
              return <li key={item.courtId + ':' + item.startMinute} className={item.conflict ? styles.sessionConflict : ''}>
                <div className={styles.sessionNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</div><div className={styles.sessionBody}><h3>{item.courtName}</h3><p>{item.startTime} – {item.endTime}</p><span>{count} slot · {count * 30} phút</span>{item.conflict && <p className={styles.error}>Không còn trống · Cần chọn lại</p>}</div><strong className={styles.sessionPrice}>{formatVnd(Number(item.listAmount))}</strong>
              </li>;
            })}</ol>}
            <div className={styles.selectionTotal}><span>Tổng giá niêm yết</span><strong>{formatVnd(listPrice)}</strong></div>
          </section>
          <section className={styles.card} aria-labelledby="booker-heading"><header className={styles.cardHeader}><h2 id="booker-heading">Người đặt & đội</h2><span className={styles.readOnly}>Thông tin chỉ đọc</span></header>
            <dl className={styles.booker}><div><dt>Họ và tên</dt><dd>{user.full_name || '—'}</dd></div><div><dt>Số điện thoại</dt><dd>{user.phone_number || '—'}</dd></div></dl>
            <fieldset className={styles.teamGroup}><legend>Đặt sân cho</legend><div className={styles.teamOptions}><Button variant={selectedTeamId === null ? 'primary' : 'secondary'} aria-pressed={selectedTeamId === null} disabled={submitting} onClick={() => setSelectedTeamId(null)}>Đặt cho cá nhân</Button>{ownedTeams.map(team => <Button key={team.id} variant={selectedTeamId === team.id ? 'primary' : 'secondary'} aria-pressed={selectedTeamId === team.id} disabled={submitting} onClick={() => setSelectedTeamId(team.id)}>{team.name}</Button>)}</div></fieldset>
            {teamsLoading ? <LoadingState message="Đang tải đội bạn làm chủ…" /> : teamError ? <ErrorState message={teamError} onRetry={retryCheckout} /> : !ownedTeams.length ? <p className={styles.helper}>Bạn chưa có đội để chọn. Bạn có thể tiếp tục đặt cho cá nhân.</p> : <p className={styles.helper}>Không bắt buộc chọn đội. Chỉ hiện các đội bạn làm chủ.</p>}
          </section>
          <section className={styles.card} aria-labelledby="note-heading"><h2 id="note-heading">Ghi chú cho chủ sân</h2><FormField htmlFor="booking-note" label="Nội dung ghi chú (không bắt buộc)" hint="Ghi chú không sửa được sau khi xác nhận đơn." error={!validNote ? 'Ghi chú không được vượt quá 200 ký tự.' : undefined}>
            <Textarea id="booking-note" rows={4} maxLength={200} value={guestNote} disabled={submitting} placeholder="Ví dụ: Cho mình mượn thêm 2 vợt cầu lông…" onChange={event => setGuestNote(event.target.value)} aria-describedby="booking-note-count" />
          </FormField><p className={styles.noteCount} id="booking-note-count">{guestNote.length}/200 ký tự</p></section>
        </div>
        <aside className={styles.rightColumn} aria-label="Ưu đãi và thanh toán"><div className={styles.paymentCard}>
          <h2>Ưu đãi & thanh toán</h2><p className={styles.helper}>Một voucher áp dụng cho toàn bộ đơn.</p>
          <CheckoutVoucherPicker {...voucher} disabled={submitting || Boolean(quote.conflictSessions) || quoteLoading} />
          <section className={styles.points} aria-labelledby="points-heading"><h3 id="points-heading">Điểm thưởng tại địa điểm</h3>
            {pointsLoading ? <LoadingState message="Đang tải số dư điểm…" /> : pointsError ? <ErrorState message={uiMessage(pointsError)} onRetry={retryCheckout} /> : <p className={styles.pointBalance}>Số dư: <strong>{availablePoints} điểm</strong> · 1 điểm = {formatVnd(pointValue)}</p>}
            <FormField htmlFor="checkout-points" label="Số điểm muốn dùng" error={pointValidation || pointSubmitError ? uiMessage(pointValidation || pointSubmitError) : undefined} hint={`Tối đa ${pointsAllowed} điểm · ${checkoutPointPercent}% ${appliedVoucher ? 'số tiền còn lại sau voucher' : 'giá niêm yết'}.`}>
              <UiNumberInput id="checkout-points" min={0} max={pointsAllowed} placeholder="0" value={pointsInput} disabled={submitting || voucherLoading || pointsLoading || Boolean(pointsError)} onChange={event => { setPointsInput(event.target.value); setPointSubmitError(''); }} />
            </FormField>
            <div className={styles.rangeHeading}><label htmlFor="checkout-points-range" className={styles.rangeLabel}>Điều chỉnh số điểm</label><output htmlFor="checkout-points checkout-points-range" className={styles.pointSaving}>Giảm {formatVnd(pointsDiscount)}</output></div>
            <div className={styles.pointsSlider}>
              <Button variant="secondary" className={styles.pointAdjust} aria-label="Giảm số điểm" disabled={pointsDisabled || sliderValue === 0} onClick={() => selectPointStop(sliderValue - 1)}>−</Button>
              <UiSlider id="checkout-points-range" min={0} max={sliderMax} step={1} value={sliderValue}
                disabled={pointsDisabled}
                onChange={event => selectPointStop(Number(event.target.value))} aria-describedby="point-minimum" aria-valuetext={`${pointsUsed} điểm, giảm ${formatVnd(pointsDiscount)}`} />
              <Button variant="secondary" className={styles.pointAdjust} aria-label="Tăng số điểm" disabled={pointsDisabled || sliderValue >= sliderMax} onClick={() => selectPointStop(sliderValue + 1)}>+</Button>
            </div>
            <div className={styles.rangeLimits}><span>0 điểm</span><Button variant="ghost" size="sm" disabled={pointsDisabled || pointsUsed === pointsAllowed} onClick={() => selectPointStop(sliderMax)}>Dùng tối đa {pointsAllowed} điểm</Button></div>
            <p id="point-minimum" className={styles.helper}>{sliderMax === 0 && !pointsLoading && !pointsError ? 'Chưa đủ điểm hoặc hạn mức để giảm tối thiểu 1.000đ. Bạn có thể tiếp tục không dùng điểm.' : `Thanh kéo chọn 0 hoặc từ ${minimumPoints} điểm (giảm tối thiểu 1.000đ).`}</p>
          </section>
          <dl className={styles.pricing}><div><dt>Tạm tính</dt><dd>{formatVnd(pricingSummary.listPrice)}</dd></div><div><dt>Giảm voucher</dt><dd>{pricingSummary.voucherDiscount > 0 ? '−' : ''}{formatVnd(pricingSummary.voucherDiscount)}</dd></div><div><dt>Giảm điểm ({pointsUsed} điểm)</dt><dd>{pricingSummary.pointsDiscount > 0 ? '−' : ''}{formatVnd(pricingSummary.pointsDiscount)}</dd></div><div className={styles.total}><dt>Phải trả</dt><dd>{formatVnd(pricingSummary.finalAmount)}</dd></div></dl>
          {submitError && !hasConflict && <div ref={feedbackRef} tabIndex={-1} className={styles.submitError} role="alert"><p>{uiMessage(submitError)}</p>{pendingLimit && <Link to="/my-bookings">Lịch đặt sân của tôi →</Link>}</div>}
          <div className={styles.desktopConfirm}>{confirmButton()}<p id="hold-notice" className={styles.holdNotice}>Giữ chỗ 10 phút sau khi xác nhận để bạn chuyển khoản và gửi chứng từ. Chưa giữ chỗ ở bước xem lại này.</p></div>
        </div></aside>
      </div>
      <div className={styles.mobileBar}><div><span>Phải trả</span><strong>{formatVnd(pricingSummary.finalAmount)}</strong></div>{confirmButton(true)}<p id="mobile-hold-notice">Giữ chỗ 10 phút sau khi xác nhận.</p></div>
      {confirmPoints && <ConfirmDialog title="Xác nhận dùng điểm" busy={submitting} onCancel={() => setConfirmPoints(false)} onConfirm={() => { setConfirmPoints(false); handleConfirmBooking(); }} message={`Dùng ${pointsUsed} điểm để giảm ${formatVnd(pointsDiscount)}? Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy lịch.`} />}
    </div>
  </PublicLayout>;
}
