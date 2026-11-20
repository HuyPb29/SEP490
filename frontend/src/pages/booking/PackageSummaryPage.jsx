import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { toTimeLabel } from '../../api/bookingApi';
import CheckoutVoucherPicker from '../../components/booking/CheckoutVoucherPicker';
import { CheckoutProgress, ConfirmDialog, Feedback } from '../../components/common/WorkspacePrimitives';
import { PublicHeader } from '../../components/layout/PublicLayout';
import PublicFooter from '../../components/layout/PublicFooter';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import { useCheckoutVoucherSelection } from '../../hooks/useCheckoutVouchers';
import { usePackagePreview } from '../../hooks/usePackagePreview';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, defaultPointRedemptionValue, pointInputError } from '../../utils/checkoutPoints';
import { formatVnd, uiMessage } from '../../utils/formatters';
import { clearPackageDraft, readPackageDraft } from '../../utils/packageDraft';
import styles from './BookingSummaryPage.module.css';
import own from './PackageSummaryPage.module.css';

// Backend: 1 = Thứ 2 … 7 = Chủ nhật; Date.getDay(): 0 = Chủ nhật
const BACKEND_DAY_LABELS = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
const JS_DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const CONFLICT_LABELS = {
  TAKEN: 'Đã có người đặt',
  MAINTENANCE: 'Đang bảo trì',
  CLOSED: 'Ngoài giờ mở cửa',
  STARTED: 'Đã qua giờ bắt đầu',
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

  useEffect(() => {
    if (!isPlayer || !facilityId) return undefined;
    let active = true;
    getMyOwnedTeams().then((teams) => { if (active) setOwnedTeams(teams); })
      .catch(() => { if (active) setTeamError('Không tải được danh sách đội. Bạn vẫn có thể đặt cho cá nhân.'); });
    getMyPointsAtFacility(facilityId).then((points) => { if (active) setAvailablePoints(Number(points || 0)); })
      .catch((error) => { if (active) setPointsLoadError(apiErrorMessage(error, 'Không tải được số dư điểm.')); });
    return () => { active = false; };
  }, [isPlayer, facilityId, getMyOwnedTeams, getMyPointsAtFacility]);

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
    if (!canConfirm) return;
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
      setSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/package-summary' }} replace />;
  if (!draft) return <Navigate to="/locations" replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản người chơi để đặt sân.</p>;
  if (!preview) {
    return (
      <div className="cw-workspace"><PublicHeader user={user} /><main className={styles.mainContainer}>
        <Feedback tone={previewError ? 'error' : 'info'}>{previewError || 'Đang tải tóm tắt gói…'}
          {previewError && <Link className="cw-secondary" to={editPath}>Quay lại sửa lịch gói</Link>}
        </Feedback>
      </main><PublicFooter /></div>
    );
  }

  const validSessions = preview.totalSessions - preview.conflictSessions;
  const voucherDiscount = Number(preview.voucherDiscount ?? 0);
  const pointDiscount = Number(preview.pointDiscount ?? 0);

  return (
    <div className={`${styles.pageWrapper} cw-workspace`}>
      <PublicHeader user={user} />
      {confirmPoints && <ConfirmDialog title="Xác nhận dùng điểm" onCancel={() => setConfirmPoints(false)} onConfirm={() => {
        setConfirmPoints(false);
        handleConfirm();
      }}>Dùng {pointsUsed} điểm để giảm {formatVnd(pointDiscount)}? Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy đặt sân. (MSG39)</ConfirmDialog>}

      <main className={styles.mainContainer}>
        <Link to={editPath} className={styles.backLink}>‹ Sửa lịch gói</Link>

        <CheckoutProgress current={0} />
        <h1 className={styles.pageTitle}>Xác nhận gói đặt nhiều buổi</h1>

        {conflictedSessions.length > 0 && (
          <div className={own.conflictBox}>
            <Feedback tone="error">
              Bạn có {conflictedSessions.length} buổi vừa bị đặt trùng: {conflictedSessions
                .map((session) => `${formatDay(session.date)} ${session.startTime}–${session.endTime} ${session.courtName} (${CONFLICT_LABELS[session.conflict] || session.conflict})`)
                .join('; ')}. Vui lòng quay lại lịch để chọn khung giờ bù hoặc bỏ buổi. (MSG44)
              <Link className="cw-secondary" to={editPath}>Quay lại sửa lịch gói</Link>
            </Feedback>
          </div>
        )}

        <div className={styles.contentGrid}>
          <div className={styles.leftColumn}>
            {/* Đặt cho (DR03 / BR09) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Đặt cho</h2>
              <div className={styles.teamPillGroup}>
                <button type="button" aria-pressed={selectedTeamId === null}
                  className={`${styles.teamPill} ${selectedTeamId === null ? styles.teamPillActive : ''}`}
                  onClick={() => setSelectedTeamId(null)}>
                  Cá nhân
                </button>
                {ownedTeams.map((team) => (
                  <button key={team.id} type="button" aria-pressed={selectedTeamId === team.id}
                    className={`${styles.teamPill} ${selectedTeamId === team.id ? styles.teamPillActive : ''}`}
                    onClick={() => setSelectedTeamId(team.id)}>
                    {team.name}
                  </button>
                ))}
              </div>
              <p className={styles.helperText}>Chọn đội nếu bạn đặt sân thay cho đội mình quản lý.</p>
              {teamError && <p role="alert" className={styles.errorText}>{teamError}</p>}
            </section>

            {/* Thông tin gói (UC15) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Thông tin gói</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Địa điểm</span>
                  <strong className={styles.infoValue}>{draft.facilityName || preview.locationName || '—'}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Cách đặt</span>
                  <strong className={styles.infoValue}>{describePattern(draft.request)}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Thời gian gói</span>
                  <strong className={styles.infoValue}>{formatDay(preview.startDate)} – {formatDay(preview.endDate)}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Số buổi</span>
                  <strong className={styles.infoValue}>{validSessions} buổi</strong>
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

              <div className={own.tableWrap}>
                <table className={own.sessionTable}>
                  <thead>
                    <tr><th>Ngày</th><th>Sân</th><th>Giờ</th><th className={own.amount}>Giá</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={`${session.date}|${session.courtId}|${session.startMinute}`}
                        className={session.conflict ? own.conflictRow : undefined}>
                        <td>{formatDay(session.date)}</td>
                        <td>
                          {session.courtName}
                          {isReplacement(session) && <span className={own.replacementTag}>khung giờ bù</span>}
                        </td>
                        <td>{session.startTime}–{session.endTime}</td>
                        <td className={own.amount}>
                          {session.conflict ? (CONFLICT_LABELS[session.conflict] || 'Trùng lịch') : formatVnd(Number(session.listAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sessions.length > 10 && <p className={own.tableCaption}>Cuộn trong bảng để xem đủ {sessions.length} buổi.</p>}

              <div className={`${styles.noteGroup} ${own.noteSpacing}`}>
                <label className={styles.noteLabel} htmlFor="package-note">Ghi chú cho chủ sân (không bắt buộc, tối đa 200 ký tự)</label>
                <textarea rows={3} maxLength={200} id="package-note" className={styles.noteTextarea}
                  placeholder="Ví dụ: Chuẩn bị thêm 2 ống cầu..." value={note} onChange={(event) => setNote(event.target.value)} />
                {!validNote && <p role="alert" className={styles.errorText}>Ghi chú không được vượt quá 200 ký tự (MSG109).</p>}
              </div>
            </section>

            {/* Voucher và điểm thưởng (BR14, BR41, D130, D161) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>phiếu ưu đãi và điểm thưởng</h2>

              <CheckoutVoucherPicker {...voucher} error={voucherError}
                disabled={submitting || !baseResult?.data || conflictedSessions.length > 0} />

              {pointsLoadError && <p role="alert" className={styles.errorText}>{pointsLoadError}</p>}
              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Dùng điểm thưởng</strong>
                  <span className={styles.pointsSub}>
                    Bạn đang có {availablePoints} điểm tại địa điểm này (1 điểm = {formatVnd(pointValue)}).{' '}
                    Tối đa {checkoutPointPercent}% {appliedVoucher ? "số tiền còn lại sau phiếu ưu đãi" : 'giá niêm yết'}.
                  </span>
                </div>
                <input type="number" aria-label="Số điểm muốn dùng" min="0" max={pointsAllowed}
                  placeholder="0" value={pointsInput} disabled={submitting}
                  aria-invalid={Boolean(pointError)}
                  aria-describedby={pointError ? 'package-point-error' : undefined}
                  onChange={(event) => { setPointsInput(event.target.value); setPointSubmitError(''); }} />
                {pointError && <p id="package-point-error" role="alert" className={styles.errorText}>
                  {uiMessage(pointError)}
                </p>}
              </div>
            </section>
          </div>

          {/* Chi phí gói và xác nhận */}
          <aside className={styles.rightColumn}>
            <div className={styles.paymentCard}>
              <h2 className={styles.cardTitle}>Chi phí gói</h2>

              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Tiền sân ({validSessions} buổi)</span>
                <strong className={styles.priceValue}>{formatVnd(preview.listAmount)}</strong>
              </div>
              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Phiếu ưu đãi</span>
                <strong className={styles.discountValue}>–{formatVnd(voucherDiscount)}</strong>
              </div>
              <div className={styles.priceLine}>
                <span className={styles.priceLabel}>Điểm thưởng</span>
                <strong className={styles.discountValue}>–{formatVnd(pointDiscount)} ({preview.pointsUsed ?? 0} điểm)</strong>
              </div>

              <hr className={styles.divider} />

              <div className={styles.totalLine}>
                <span className={styles.totalLabel}>Cần thanh toán</span>
                <strong className={styles.totalValue}>{formatVnd(preview.finalAmount)}</strong>
              </div>

              {loading && <p role="status" className={styles.holdNotice}>Đang cập nhật giá gói…</p>}
              {previewError && <p role="alert" className={styles.errorText}>{previewError}</p>}
              {submitError && <p role="alert" className={styles.errorText}>{submitError}</p>}

              <button type="button" className={styles.confirmBtn} disabled={!canConfirm}
                onClick={() => pointsUsed > 0 ? setConfirmPoints(true) : handleConfirm()}>
                {submitting ? 'Đang giữ chỗ gói…' : 'Xác nhận và thanh toán'}
              </button>

              <p className={styles.holdNotice}>
                Thanh toán 1 lần cho toàn bộ gói. Bấm xác nhận thì gói được giữ chỗ 10 phút và chuyển sang trang thanh toán (mã QR chuyển khoản).
              </p>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
