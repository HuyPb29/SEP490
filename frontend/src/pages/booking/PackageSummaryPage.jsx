import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { toTimeLabel } from '../../api/bookingApi';
import { CheckoutProgress, ConfirmDialog, Feedback } from '../../components/common/WorkspacePrimitives';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { useAuth } from '../../hooks/useAuth';
import { useBookingActions } from '../../hooks/useBooking';
import { usePackagePreview } from '../../hooks/usePackagePreview';
import { checkoutPointLimit, checkoutPointPercent, checkoutRewardErrorField, pointInputError } from '../../utils/checkoutPoints';
import { formatVnd } from '../../utils/formatters';
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
    getCheckoutVouchers,
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

  // Voucher: mã đã áp được gửi kèm preview gói; backend kiểm tra và tính số giảm
  const [checkoutVouchers, setCheckoutVouchers] = useState({ publicVouchers: [], grants: [] });
  const [voucherInput, setVoucherInput] = useState('');
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');

  // Điểm thưởng tại địa điểm (BR39, BR41, D161)
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsLoadError, setPointsLoadError] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [pointSubmitError, setPointSubmitError] = useState('');

  const [revision, setRevision] = useState(0);
  const [lastPreview, setLastPreview] = useState(null);
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
    getCheckoutVouchers(Number(facilityId)).then((vouchers) => { if (active) setCheckoutVouchers(vouchers); })
      .catch(() => { if (active) setVoucherError('Không tải được danh sách voucher. Bạn vẫn có thể nhập mã.'); });
    return () => { active = false; };
  }, [isPlayer, facilityId, getMyOwnedTeams, getMyPointsAtFacility, getCheckoutVouchers]);

  // Trần điểm tính trên giá niêm yết trừ voucher, không phụ thuộc số điểm đang nhập
  const pointsAllowed = lastPreview
    ? checkoutPointLimit(Number(lastPreview.listAmount) - Number(lastPreview.voucherDiscount ?? 0), availablePoints)
    : 0;
  const requestedPoints = Number(pointsInput);
  const pointValidation = pointInputError(requestedPoints, availablePoints, pointsAllowed);
  const pointsUsed = !pointValidation && requestedPoints > 0 ? requestedPoints : 0;

  // Ghi chú không gửi khi xem trước để không gọi lại preview mỗi lần gõ
  const request = useMemo(() => (draft?.request ? {
    ...draft.request,
    teamId: selectedTeamId,
    voucherCode: appliedVoucher?.code ?? null,
    voucherGrantId: appliedVoucher?.grantId ?? null,
    pointsToUse: pointsUsed,
  } : null), [draft, selectedTeamId, appliedVoucher, pointsUsed]);

  const result = usePackagePreview(isPlayer ? request : null, previewBookingPackage, revision);
  const loading = Boolean(request) && !result;

  // Mỗi kết quả preview mới xử lý một lần: giữ bản giá gần nhất để không nháy trang khi đang tải lại;
  // voucher hoặc điểm không hợp lệ thì gỡ ra và báo dưới đúng trường
  const [handledResult, setHandledResult] = useState(null);
  if (result && result !== handledResult) {
    setHandledResult(result);
    if (result.data) setLastPreview(result.data);
    const field = checkoutRewardErrorField(result.error);
    if (field === 'voucher') {
      setAppliedVoucher(null);
      setVoucherError(result.error);
    } else if (field === 'points') {
      setPointsInput('');
      setPointSubmitError(result.error);
    }
  }

  const previewError = result?.error && !checkoutRewardErrorField(result.error) ? result.error : '';
  const preview = lastPreview;
  const sessions = preview?.sessions ?? [];
  const conflictedSessions = sessions.filter((session) => session.conflict);
  const replacementValues = Object.values(draft?.schedule?.replacements ?? {});
  const isReplacement = (session) => replacementValues.some((value) =>
    value.date === session.date && Number(value.courtId) === Number(session.courtId) && value.startMinute === session.startMinute);
  const validNote = note.length <= 200;
  const canConfirm = Boolean(preview) && !loading && !previewError && conflictedSessions.length === 0 &&
    !pointValidation && validNote && !submitting;

  const handleVoucherAction = () => {
    setVoucherError('');
    setPointSubmitError('');
    if (appliedVoucher) {
      setAppliedVoucher(null);
      return;
    }
    if (!voucherInput.trim() && !selectedGrant) {
      setVoucherError('Vui lòng nhập mã giảm giá hoặc chọn voucher cá nhân. (MSG01)');
      return;
    }
    if (selectedGrant) {
      const grant = checkoutVouchers.grants.find((item) => item.grantId === selectedGrant);
      setAppliedVoucher({ grantId: selectedGrant, label: grant?.voucher?.name || grant?.voucher?.code });
    } else {
      const code = voucherInput.trim().toUpperCase();
      setAppliedVoucher({ code, label: code });
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitError('');
    setPointSubmitError('');
    setSubmitting(true);
    try {
      // UC15 #11: giữ chỗ gói 15 phút (P27) rồi sang thanh toán UC18; voucher, điểm trừ lúc này (D130)
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
      if (field === 'voucher') {
        setAppliedVoucher(null);
        setVoucherError(message);
      } else if (field === 'points') setPointSubmitError(message);
      else setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/package-summary' }} replace />;
  if (!draft) return <Navigate to="/" replace />;
  if (!isPlayer) return <p role="alert">Vui lòng đăng nhập bằng tài khoản Player để đặt sân.</p>;
  if (!preview) {
    return (
      <div className="cw-workspace"><PublicHeader user={user} /><main className={styles.mainContainer}>
        <Feedback tone={previewError ? 'error' : 'info'}>{previewError || 'Đang tải tóm tắt gói…'}
          {previewError && <Link className="cw-secondary" to={editPath}>Quay lại sửa lịch gói</Link>}
        </Feedback>
      </main></div>
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
      }}>Dùng {pointsUsed} điểm để giảm {formatVnd(pointDiscount)}? Điểm bị trừ khi xác nhận đặt sân và không được trả lại nếu bạn tự hủy booking. (MSG39)</ConfirmDialog>}

      <main className={styles.mainContainer}>
        <Link to={editPath} className={styles.backLink}>‹ Sửa lịch gói</Link>

        <CheckoutProgress current={0} />
        <h1 className={styles.pageTitle}>Xác nhận gói đặt nhiều buổi</h1>

        {conflictedSessions.length > 0 && (
          <div className={own.conflictBox}>
            <Feedback tone="error">
              Bạn có {conflictedSessions.length} buổi vừa bị đặt trùng: {conflictedSessions
                .map((session) => `${formatDay(session.date)} ${session.startTime}–${session.endTime} ${session.courtName} (${CONFLICT_LABELS[session.conflict] || session.conflict})`)
                .join('; ')}. Vui lòng quay lại lịch để chọn slot bù hoặc bỏ buổi. (MSG44)
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
                          {isReplacement(session) && <span className={own.replacementTag}>Slot bù</span>}
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

              <div className={styles.noteGroup}>
                <label className={styles.noteLabel} htmlFor="package-note">Ghi chú cho chủ sân (không bắt buộc, tối đa 200 ký tự)</label>
                <textarea rows={3} maxLength={200} id="package-note" className={styles.noteTextarea}
                  placeholder="Ví dụ: Chuẩn bị thêm 2 ống cầu..." value={note} onChange={(event) => setNote(event.target.value)} />
                {!validNote && <p role="alert" className={styles.errorText}>Ghi chú không được vượt quá 200 ký tự (MSG109).</p>}
              </div>
            </section>

            {/* Voucher và điểm thưởng (BR14, BR41, D130, D161) */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Voucher và điểm thưởng</h2>

              <label className={styles.noteLabel} htmlFor="package-voucher-code">Mã voucher</label>
              <div className={styles.voucherRow}>
                <input id="package-voucher-code" type="text" className={styles.voucherInput} value={voucherInput}
                  list="package-public-vouchers" maxLength={20} placeholder="Nhập mã giảm giá"
                  disabled={Boolean(appliedVoucher) || submitting}
                  onChange={(event) => {
                    setVoucherInput(event.target.value.toUpperCase());
                    setSelectedGrant(null);
                    setVoucherError('');
                  }} />
                <datalist id="package-public-vouchers">
                  {checkoutVouchers.publicVouchers.map((voucher) =>
                    <option key={voucher.id} value={voucher.code}>{voucher.name}</option>)}
                </datalist>
                <button type="button" className={styles.voucherBtn} onClick={handleVoucherAction} disabled={submitting}>
                  {appliedVoucher ? 'Bỏ mã' : 'Áp dụng'}
                </button>
              </div>

              {checkoutVouchers.grants.length > 0 && <div className={styles.noteGroup}>
                <label className={styles.noteLabel} htmlFor="package-voucher-grant">Voucher cá nhân</label>
                <select id="package-voucher-grant" className={styles.voucherInput} value={selectedGrant ?? ''}
                  disabled={Boolean(appliedVoucher) || submitting}
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
              {appliedVoucher && !loading && voucherDiscount > 0 && (
                <div className={styles.voucherSuccessBanner}>
                  Đã áp dụng {appliedVoucher.label}: giảm {formatVnd(voucherDiscount)} (MSG36)
                </div>
              )}

              {pointsLoadError && <p role="alert" className={styles.errorText}>{pointsLoadError}</p>}
              <div className={styles.pointsRow}>
                <div className={styles.pointsInfo}>
                  <strong className={styles.pointsTitle}>Dùng điểm thưởng</strong>
                  <span className={styles.pointsSub}>
                    Bạn đang có {availablePoints} điểm tại địa điểm này (1 điểm = 500 VND).{' '}
                    Tối đa {checkoutPointPercent}% {appliedVoucher ? 'số tiền còn lại sau voucher' : 'giá niêm yết'}.
                  </span>
                </div>
                <input type="number" aria-label="Số điểm muốn dùng" min="0" max={pointsAllowed}
                  placeholder="0" value={pointsInput} disabled={submitting}
                  aria-invalid={Boolean(pointValidation || pointSubmitError)}
                  aria-describedby={pointValidation || pointSubmitError ? 'package-point-error' : undefined}
                  onChange={(event) => { setPointsInput(event.target.value); setPointSubmitError(''); }} />
                {(pointValidation || pointSubmitError) && <p id="package-point-error" role="alert" className={styles.errorText}>
                  {pointValidation || pointSubmitError}
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
                <span className={styles.priceLabel}>Voucher</span>
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

              {preview.batchOffer && (
                <p className={`${own.batchNote} ${preview.batchOffer.reached ? '' : own.batchNoteMuted}`}>
                  🎁 {preview.batchOffer.name}: {preview.batchOffer.message}
                </p>
              )}

              {loading && <p role="status" className={styles.holdNotice}>Đang cập nhật giá gói…</p>}
              {previewError && <p role="alert" className={styles.errorText}>{previewError}</p>}
              {submitError && <p role="alert" className={styles.errorText}>{submitError}</p>}

              <button type="button" className={styles.confirmBtn} disabled={!canConfirm}
                onClick={() => pointsUsed > 0 ? setConfirmPoints(true) : handleConfirm()}>
                {submitting ? 'Đang giữ chỗ gói…' : 'Xác nhận và thanh toán'}
              </button>

              <p className={styles.holdNotice}>
                Thanh toán 1 lần cho toàn bộ gói. Bấm xác nhận thì gói được giữ chỗ 15 phút và chuyển sang trang thanh toán (mã QR chuyển khoản).
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
