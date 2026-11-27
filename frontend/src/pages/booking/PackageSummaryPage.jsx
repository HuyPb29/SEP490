import { NumberInput as UiNumberInput } from '../../components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { toTimeLabel } from '../../api/bookingApi';
import CheckoutVoucherPicker from '../../components/booking/CheckoutVoucherPicker';
import { Button, ConfirmDialog, EmptyState, ErrorState, FormField, FormStepper, LoadingState, PageHeader, StatusBadge, Table, Textarea, STATUS_CATALOG } from '../../components/common';
import PublicLayout from '../../components/layout/PublicLayout';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import { useCheckoutVoucherSelection } from '../../hooks/useCheckoutVouchers';
import { usePackagePreview } from '../../hooks/usePackagePreview';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, defaultPointRedemptionValue, pointInputError } from '../../utils/checkoutPoints';
import { money, uiMessage } from '../../utils/formatters';
import { clearPackageDraft, readPackageDraft } from '../../utils/packageDraft';
import styles from './BookingSummaryPage.module.css';
import own from './PackageSummaryPage.module.css';
const formatVnd = value => money(value).replace(/\s*₫/, 'đ');
const PACKAGE_STEPS = ['Thiết lập lịch', 'Xử lý buổi trùng', 'Tóm tắt & xác nhận'];

// Backend: 1 = Thứ 2 … 7 = Chủ nhật; Date.getDay(): 0 = Chủ nhật
const BACKEND_DAY_LABELS = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
const JS_DAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const CONFLICT_LABELS = {
  TAKEN: STATUS_CATALOG.slot.BOOKED.label,
  MAINTENANCE: STATUS_CATALOG.slot.MAINTENANCE.label,
  CLOSED: STATUS_CATALOG.slot.CLOSED.label,
  STARTED: STATUS_CATALOG.slot.PAST.label,
};

function formatDay(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = JS_DAY_LABELS[new Date(year, month - 1, day).getDay()];
  return `${weekday}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function describePattern(request) {
  if (request?.packageType !== 'RECURRING') return 'Tự chọn ngày';
  const slots = [...(request.weeklySlots || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return 'Định kỳ · ' + slots
    .map((slot) => `${BACKEND_DAY_LABELS[slot.dayOfWeek]} ${toTimeLabel(slot.startMinute)}–${toTimeLabel(slot.endMinute)}`)
    .join(', ');
}

// UC15: màn tóm tắt gói đặt nhiều buổi — đội, ghi chú, voucher, điểm rồi xác nhận giữ chỗ (D130, D163)
export default function PackageSummaryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getMyOwnedTeams,
    getMyPointsAtFacility,
    previewBookingPackage,
    createBookingPackage,
  } = useBookingActions();

  const [draft] = useState(() => readPackageDraft());
  const facilityId = draft?.facilityId;
  const editPath = `/facilities/${facilityId}/package-booking`;
  const isPlayer = user?.role_code === 'player';

  // Đội (DR03 / BR09)
  const [ownedTeams, setOwnedTeams] = useState([]);
  const [teamError, setTeamError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Ghi chú cho chủ sân (DR20: tối đa 200 ký tự)
  const [note, setNote] = useState('');

  // Điểm thưởng tại địa điểm (BR39, BR41, D161)
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsLoadError, setPointsLoadError] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [pointSubmitError, setPointSubmitError] = useState('');

  const [revision, setRevision] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmPoints, setConfirmPoints] = useState(false);
  const [contactRevision, setContactRevision] = useState(0);
  const submitLock = useRef(false);
  useEffect(() => { window.scrollTo({ top: 0 }) }, []);

  useEffect(() => {
    if (!isPlayer || !facilityId) return undefined;
    let active = true;
    getMyOwnedTeams().then((teams) => { if (active) setOwnedTeams(teams); })
      .catch(() => { if (active) setTeamError('Không tải được danh sách đội. Bạn vẫn có thể đặt cho cá nhân.'); });
    getMyPointsAtFacility(facilityId).then((points) => { if (active) setAvailablePoints(Number(points || 0)); })
      .catch((error) => { if (active) setPointsLoadError(apiErrorMessage(error, 'Không tải được số dư điểm.')); });
    return () => { active = false; };
  }, [isPlayer, facilityId, getMyOwnedTeams, getMyPointsAtFacility, contactRevision]);

  const baseRequest = useMemo(() => isPlayer && draft?.request
    ? { ...draft.request, teamId: selectedTeamId }
    : null, [isPlayer, draft, selectedTeamId]);
  const baseResult = usePackagePreview(baseRequest, previewBookingPackage, revision);
  const [lastBaseQuote, setLastBaseQuote] = useState(null);
  if (baseResult?.data && baseResult.data !== lastBaseQuote) {
    setLastBaseQuote(baseResult.data);
  }
  const baseQuote = baseResult?.data ?? lastBaseQuote;
  const listAmount = Number(baseQuote?.listAmount ?? 0);
  const voucher = useCheckoutVoucherSelection(facilityId, baseQuote?.conflictSessions ? 0 : listAmount);
  const appliedVoucher = voucher.applied;
  const pointValue = baseQuote?.pointRedemptionValue || defaultPointRedemptionValue;
  const afterVoucher = listAmount - Number(appliedVoucher?.discountAmount ?? 0);
  const pointsAllowed = checkoutPointLimit(afterVoucher, availablePoints, pointValue);
  const requestedPoints = Number(pointsInput);
  const pointValidation = pointInputError(requestedPoints, availablePoints, pointsAllowed, pointValue);
  const pointsUsed = !pointValidation && requestedPoints > 0 ? requestedPoints : 0;

  const rewardRequest = useMemo(() => baseResult?.data && !baseResult.data.conflictSessions && (appliedVoucher || pointsUsed > 0) ? {
    ...baseRequest,
    voucherCode: appliedVoucher?.selection.code ?? null,
    voucherGrantId: appliedVoucher?.selection.grantId ?? null,
    pointsToUse: pointsUsed,
  } : null, [baseRequest, baseResult, appliedVoucher, pointsUsed]);

  const rewardResult = usePackagePreview(rewardRequest, previewBookingPackage, revision);
  const request = rewardRequest ?? baseRequest;
  const result = rewardRequest ? rewardResult : baseResult;
  const loading = Boolean(request) && !result;
  const rewardErrorField = checkoutRewardErrorField(result?.error);
  const previewError = rewardErrorField ? '' : result?.error;
  const voucherError = rewardErrorField === 'voucher' ? result.error : voucher.error;
  const pointError = pointValidation || pointSubmitError || (rewardErrorField === 'points' ? result.error : '');
  const preview = result?.data ?? baseQuote;
  const sessions = preview?.sessions ?? [];
  const conflictedSessions = sessions.filter((session) => session.conflict);
  const replacementValues = Object.values(draft?.schedule?.replacements ?? {});
  const isReplacement = (session) => replacementValues.some((value) =>
    value.date === session.date && Number(value.courtId) === Number(session.courtId) && value.startMinute === session.startMinute);
  const validNote = note.length <= 200;
  const canConfirm = Boolean(result?.data) && conflictedSessions.length === 0 &&
    !voucher.checking && !pointValidation && validNote && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm || submitLock.current) return;
    submitLock.current = true;
    setSubmitError('');
    setPointSubmitError('');
    setSubmitting(true);
    try {
      // UC15 #11: giữ chỗ gói 10 phút (P27) rồi sang thanh toán UC18; voucher, điểm trừ lúc này (D130)
      const pkg = await createBookingPackage({ ...request, note: note.trim() || null });
      const packageId = pkg?.id ?? pkg?.booking_id ?? pkg?.data?.booking_id;
      sessionStorage.setItem('active_holding_booking', JSON.stringify(pkg));
      clearPackageDraft();
      navigate(`/booking/payment?packageId=${packageId}`, { replace: true });
    } catch (error) {
      const message = apiErrorMessage(error, 'Không thể tạo gói đặt sân.');
      // Buổi vừa bị người khác giữ/đặt: xem trước lại để hiện danh sách buổi trùng (D158, MSG44)
      if (error.response?.status === 409 || message.includes('MSG44')) setRevision((value) => value + 1);
      const field = checkoutRewardErrorField(message);
      if (field === 'voucher') voucher.invalidate(message);
      else if (field === 'points') setPointSubmitError(message);
      else setSubmitError(message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/package-summary' }} replace />;
  if (!draft) return <Navigate to="/locations" replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản người chơi để đặt sân.</p>;

  const editLink = <Link className={own.actionLink} to={editPath} state={{ reviewConflicts: true }}>Quay lại lịch để chọn lại</Link>;
  const validSessions = preview ? preview.totalSessions - preview.conflictSessions : 0;
  const voucherDiscount = Number(preview?.voucherDiscount ?? 0);
  const pointDiscount = Number(preview?.pointDiscount ?? 0);
  const confirm = () => pointsUsed > 0 ? setConfirmPoints(true) : handleConfirm();
  const retryContact = () => { setTeamError(''); setPointsLoadError(''); setContactRevision(value => value + 1); };

  return <PublicLayout fullWidth className={own.page}>
    <div className={`${styles.container} ${own.container}`}>
      <PageHeader title="Tóm tắt gói đặt nhiều buổi" subtitle="Kiểm tra lịch, chọn ưu đãi và xác nhận trước khi chuyển khoản."
        backTo={{ to: editPath, label: 'Sửa lịch gói' }} />
      <FormStepper steps={PACKAGE_STEPS} current={2} disabled={submitting} onChange={index => { if (index < 2) navigate(editPath, { state: { reviewConflicts: index === 1 } }); }} />
      {!preview ? previewError
        ? <ErrorState message={uiMessage(previewError)} onRetry={() => setRevision(value => value + 1)} />
        : <LoadingState message="Đang tải tóm tắt gói…" /> : <>
      {conflictedSessions.length > 0 && <section className={own.conflictBox} role="alert" aria-labelledby="package-conflict-title">
        <h2 id="package-conflict-title">Có {conflictedSessions.length} buổi không còn trống</h2>
        <p>Chưa thể xác nhận gói. Chọn khung giờ bù hoặc bỏ các buổi sau để tiếp tục.</p>
        <ul>{conflictedSessions.map(session => <li key={session.date + '|' + session.courtId + '|' + session.startMinute}>
          {formatDay(session.date)} · {session.courtName} · {session.startTime}–{session.endTime} · {CONFLICT_LABELS[session.conflict] || session.conflict}
        </li>)}</ul>{editLink}
      </section>}
      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2>Lịch chơi của bạn</h2><span className={styles.countChip}>{validSessions} buổi</span></div>
            <h3 className={own.venueName}>{draft.facilityName || preview.locationName || 'Địa điểm đã chọn'}</h3>
            <p className={own.pattern}>{describePattern(draft.request)}</p>
            <p className={own.dateRange}>{formatDay(preview.startDate)} – {formatDay(preview.endDate)}</p>
            {sessions.length ? <Table className={own.tableWrap}>
              <caption>Chi tiết {sessions.length} buổi trong gói</caption>
              <thead><tr><th scope="col">Ngày chơi</th><th scope="col">Sân</th><th scope="col">Khung giờ</th><th scope="col">Giá niêm yết</th></tr></thead>
              <tbody>{sessions.map(session => <tr key={session.date + '|' + session.courtId + '|' + session.startMinute} className={session.conflict ? own.conflictRow : undefined}>
                <td>{formatDay(session.date)}</td><td>{session.courtName}{isReplacement(session) && <span className={own.replacementTag}>Khung giờ bù</span>}</td>
                <td>{session.startTime}–{session.endTime}</td><td>{session.conflict ? <StatusBadge category="slot" status={({ TAKEN: 'BOOKED', STARTED: 'PAST' })[session.conflict] || session.conflict} /> : formatVnd(session.listAmount)}</td>
              </tr>)}</tbody>
            </Table> : <EmptyState title="Chưa có buổi trong gói" description="Quay lại lịch để chọn buổi trên ít nhất hai ngày khác nhau." action={editLink} />}
          </section>
          <section className={styles.card}>
            <h2>Thông tin người đặt</h2>
            <dl className={styles.booker}><div><dt>Họ tên</dt><dd>{user.full_name || '—'}</dd></div><div><dt>Số điện thoại</dt><dd>{user.phone_number || '—'}</dd></div></dl>
            <fieldset className={styles.teamGroup} disabled={submitting}><legend>Đặt cho</legend><div className={styles.teamOptions}>
              <Button variant={selectedTeamId === null ? 'primary' : 'secondary'} aria-pressed={selectedTeamId === null} onClick={() => setSelectedTeamId(null)}>Cá nhân</Button>
              {ownedTeams.map(team => <Button key={team.id} variant={selectedTeamId === team.id ? 'primary' : 'secondary'} aria-pressed={selectedTeamId === team.id} onClick={() => setSelectedTeamId(team.id)}>{team.name}</Button>)}
            </div></fieldset>
            <p className={styles.helper}>Có thể chọn một đội do bạn quản lý hoặc tiếp tục đặt cho cá nhân.</p>
            {teamError && <ErrorState message={teamError} onRetry={retryContact} />}
          </section>
          <section className={styles.card}>
            <FormField label="Ghi chú cho chủ sân" htmlFor="package-note" hint="Không bắt buộc. Không sửa được sau khi xác nhận." error={!validNote ? 'Ghi chú không được vượt quá 200 ký tự.' : undefined}>
              <Textarea rows={4} maxLength={200} placeholder="Ví dụ: Chuẩn bị thêm 2 ống cầu…" value={note} disabled={submitting} onChange={event => setNote(event.target.value)} />
            </FormField><p className={styles.noteCount}>{note.length}/200 ký tự</p>
          </section>
        </div>
        <aside className={styles.rightColumn} aria-label="Chi phí và xác nhận gói">
          <section className={styles.paymentCard}>
            <h2>Ưu đãi & thanh toán</h2>
            <CheckoutVoucherPicker {...voucher} error={voucherError} disabled={submitting || !baseResult?.data || conflictedSessions.length > 0} />
            <div className={styles.points}>
              <h3>Dùng điểm tại địa điểm</h3><p className={styles.helper}>Số dư: <strong>{availablePoints} điểm</strong> · 1 điểm = {formatVnd(pointValue)}. Tối đa {checkoutPointPercent}% {appliedVoucher ? 'số tiền sau voucher' : 'giá niêm yết'}.</p>
              {pointsLoadError && <ErrorState message={pointsLoadError} onRetry={retryContact} />}
              <FormField label="Số điểm muốn dùng" htmlFor="package-points" error={uiMessage(pointError)} hint={'Được dùng tối đa ' + pointsAllowed + ' điểm cho gói này.'}>
                <UiNumberInput min="0" max={pointsAllowed} placeholder="0" value={pointsInput} disabled={submitting}
                  onChange={event => { setPointsInput(event.target.value); setPointSubmitError(''); }} />
              </FormField>
            </div>
            <dl className={styles.pricing}>
              <div><dt>Tạm tính ({validSessions} buổi)</dt><dd>{formatVnd(preview.listAmount)}</dd></div>
              <div><dt>Giảm voucher</dt><dd>−{formatVnd(voucherDiscount)}</dd></div>
              <div><dt>Giảm điểm ({preview.pointsUsed ?? 0})</dt><dd>−{formatVnd(pointDiscount)}</dd></div>
              <div className={styles.total}><dt>Phải trả</dt><dd>{formatVnd(preview.finalAmount)}</dd></div>
            </dl>
            {loading && <p role="status" className={styles.helper}>Đang cập nhật giá gói…</p>}
            {previewError && <ErrorState message={uiMessage(previewError)} onRetry={() => setRevision(value => value + 1)} />}
            {submitError && <div role="alert" className={styles.submitError}><p>{uiMessage(submitError)}</p>{/MSG29|chờ thanh toán/i.test(submitError) && <Link to="/my-bookings">Lịch đặt sân của tôi →</Link>}</div>}
            <div className={styles.desktopConfirm}><Button className={styles.confirmBtn} loading={submitting} disabled={!canConfirm} onClick={confirm}>Xác nhận lịch</Button></div>
            <p className={styles.holdNotice}>Gói được giữ chỗ <strong>10 phút</strong> sau khi xác nhận. Thanh toán một lần cho toàn bộ gói bằng chuyển khoản.</p>
          </section>
        </aside>
      </div>
      <div className={styles.mobileBar}><div><span>Phải trả</span><strong>{formatVnd(preview.finalAmount)}</strong></div><Button loading={submitting} disabled={!canConfirm} onClick={confirm}>Xác nhận lịch</Button><p>Giữ chỗ 10 phút sau khi xác nhận.</p></div>
      </>}
    </div>
    {confirmPoints && <ConfirmDialog title="Xác nhận dùng điểm" busy={submitting} onCancel={() => setConfirmPoints(false)} onConfirm={() => { setConfirmPoints(false); handleConfirm(); }}>
      Dùng {pointsUsed} điểm để giảm {formatVnd(pointDiscount)}? Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy đặt sân.
    </ConfirmDialog>}
  </PublicLayout>;
}
