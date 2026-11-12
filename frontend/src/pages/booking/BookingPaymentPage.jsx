import { bookingTimestamp } from '../../api/bookingHistory';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentActions } from '../../hooks/useBooking';
import { ReschedulePaymentDetail } from './RescheduleHistoryPage';
import styles from './BookingPaymentPage.module.css';
import { formatVnd } from '../../utils/formatters';
import { CheckoutProgress, Feedback } from '../../components/common/WorkspacePrimitives';
import { PublicHeader } from '../../components/layout/PublicLayout';

// DR21: Dung lượng ảnh tối đa 5MB & chỉ nhận JPG, PNG
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const STATUS_LABELS = {
  HOLDING: 'Đang giữ chỗ',
  PENDING_PAYMENT: 'Chờ thanh toán phụ thu',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  RESUBMIT_REQUESTED: 'Chờ gửi lại chứng từ',
  CONFIRMED: 'Đã xác nhận thanh toán',
  APPROVED: 'Đã duyệt đổi lịch',
  IN_USE: 'Đang sử dụng sân',
  COMPLETED: 'Đã hoàn tất',
  EXPIRED: 'Đã hết hạn',
  PAYMENT_REJECTED: 'Thanh toán bị từ chối',
  REJECTED: 'Đã từ chối',
  CANCELLED_BY_PLAYER: 'Người chơi đã hủy',
  CANCELLED_BY_FACILITY: 'Địa điểm đã hủy',
};

export default function BookingPaymentPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');

  async function copyTransferField(value, label) {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopyStatus('Đã sao chép ' + label + '.');
    } catch {
      setCopyStatus('Không thể sao chép tự động. Bạn có thể chọn và sao chép trực tiếp.');
    }
  }

  // Chặn trình duyệt tự động mở file nếu người dùng lỡ tay thả file ra ngoài vùng dropzone
  useEffect(() => {
    const preventGlobalDrop = (e) => e.preventDefault();
    window.addEventListener('dragover', preventGlobalDrop);
    window.addEventListener('drop', preventGlobalDrop);
    return () => {
      window.removeEventListener('dragover', preventGlobalDrop);
      window.removeEventListener('drop', preventGlobalDrop);
    };
  }, []);

  const [params] = useSearchParams();
  const kind = params.has('rescheduleId') ? 'reschedule' : params.has('packageId') ? 'package' : 'booking';
  const id = params.get(kind + 'Id');
  const validId = /^[1-9]\d*$/.test(id || '');
  const { user } = useAuth();
  const { isLatePaymentEligible, loadPayment, loadPaymentImage, submitPaymentProof } = usePaymentActions();
  const isPlayer = user?.role_code === 'player';
  const [bookingData, setBookingData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [qrImage, setQrImage] = useState(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!isPlayer || !validId) return undefined;
    const controller = new AbortController();
    loadPayment({ kind, id }, controller.signal).then((data) => {
      if (!controller.signal.aborted) setBookingData(data);
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(error.response?.data?.message || 'Không tải được thông tin thanh toán.');
    });
    return () => controller.abort();
  }, [id, isPlayer, kind, reload, validId, loadPayment]);

  const qrPath = bookingData?.instructions?.qrImageUrl;
  useEffect(() => {
    if (!qrPath) return undefined;
    const controller = new AbortController();
    let objectUrl;
    loadPaymentImage(qrPath, controller.signal).then((image) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(image);
      setQrImage({ path: qrPath, url: objectUrl });
    }).catch(() => {});
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [qrPath, loadPaymentImage]);
  const qrUrl = qrImage?.path === qrPath ? qrImage?.url : '';

  // State chọn file ảnh chứng từ (DR21 / MSG106)
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bookingId = bookingData?.bookingId;
  const paymentId = bookingData?.paymentId;
  const awaiting = bookingData?.awaiting;
  const [eligiblePayment, setEligiblePayment] = useState(null);
  useEffect(() => {
    if (!awaiting || !bookingId || !paymentId) return undefined;
    const controller = new AbortController();
    const check = async () => {
      try {
        const eligible = await isLatePaymentEligible(bookingId, paymentId, controller.signal);
        if (!controller.signal.aborted) setEligiblePayment(eligible ? paymentId : null);
      } catch {
        if (!controller.signal.aborted) setEligiblePayment(null);
      }
    };
    check();
    const timerId = setInterval(check, 30_000);
    return () => {
      controller.abort();
      clearInterval(timerId);
    };
  }, [awaiting, bookingId, paymentId, isLatePaymentEligible]);

  const trackStatus = bookingData && ['HOLDING', 'PENDING_PAYMENT', 'AWAITING_CONFIRMATION', 'RESUBMIT_REQUESTED'].includes(bookingData.status);
  useEffect(() => {
    if (!trackStatus || submitting) return undefined;
    const controller = new AbortController();
    let timer;
    const checkStatus = async () => {
      try {
        if (document.visibilityState !== 'hidden') {
          const data = await loadPayment({ kind, id }, controller.signal);
          if (!controller.signal.aborted) setBookingData(data);
        }
      } catch {
        // Keep the last payment state if this refresh fails.
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(checkStatus, 5_000);
      }
    };
    timer = setTimeout(checkStatus, 5_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [trackStatus, submitting, kind, id, loadPayment]);

  const deadline = bookingTimestamp(bookingData?.deadline);
  useEffect(() => {
    if (!Number.isFinite(deadline)) return undefined;
    const update = () => setClock(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const remainingSeconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - clock) / 1000)) : null;

  const formatCountdown = (totalSecs) => {
    const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // DR21: Kiểm tra định dạng JPG/PNG và dung lượng <= 5MB
  const validateAndSetFile = (file) => {
    setErrorMessage('');
    setToastSuccess('');
    if (!file || submitting) return;
    setSelectedFile(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isValidType = ['jpg', 'jpeg', 'png'].includes(ext)
      && (!file.type || ALLOWED_MIME_TYPES.includes(file.type));

    if (!isValidType || file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Ảnh chứng từ không đúng định dạng. Vui lòng chọn ảnh JPG hoặc PNG, tối đa 5 MB. (MSG02)');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    validateAndSetFile(file);
    event.target.value = '';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleSubmitPayment = async () => {
    if (submitting || !bookingData?.canPay || (!Number.isFinite(deadline) || deadline <= Date.now())) return;
    setErrorMessage('');
    if (!selectedFile) {
      setErrorMessage('Vui lòng đính kèm ảnh chứng từ thanh toán. (MSG106)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitPaymentProof({ kind, id }, bookingData, selectedFile);
      setBookingData((current) => ({
        ...current,
        canPay: false,
        awaiting: result.status === 'AWAITING_CONFIRMATION',
        status: result.status,
        paymentId: kind === 'reschedule' ? current.paymentId : (result.id ?? current.paymentId),
      }));
      setSelectedFile(null);
      if (result.status !== 'EXPIRED') {
        setToastSuccess('Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận. (MSG48)');
      }
      const refreshed = await loadPayment({ kind, id }).catch(() => null);
      if (refreshed) setBookingData(refreshed);
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.';
      if (error.response?.status === 409) {
        const refreshed = await loadPayment({ kind, id }).catch(() => null);
        if (refreshed) setBookingData(refreshed);
        if (message.includes('MSG33') || message.includes('MSG52')) {
          setBookingData((current) => ({ ...current, status: 'EXPIRED', canPay: false }));
        }
      }
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!validId) return <Navigate to="/my-bookings" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/payment?' + params.toString() }} replace />;
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Người chơi được thanh toán đặt sân.</p>;
  if (!bookingData) return <div className="cw-workspace"><PublicHeader user={user} /><main className={styles.mainContainer}>
    <Feedback tone={loadError ? 'error' : 'info'}>{loadError || 'Đang tải thông tin thanh toán…'}
      {loadError && <>
        <button className="cw-secondary" type="button" onClick={() => { setLoadError(''); setReload((value) => value + 1); }}>Thử lại</button>
        <Link className="cw-secondary" to="/my-bookings">Về lịch đặt sân</Link>
      </>}
    </Feedback>
  </main></div>;

  const isExpired = bookingData.status === 'EXPIRED' || (bookingData.canPay && remainingSeconds === 0);
  const isConfirmedWait = bookingData.awaiting;
  const isConfirmedDone = ['CONFIRMED', 'APPROVED', 'IN_USE', 'COMPLETED'].includes(bookingData.status);
  const isRejected = ['PAYMENT_REJECTED', 'REJECTED'].includes(bookingData.status);
  const finalAmount = bookingData.amount;
  const bankInfo = bookingData.instructions ?? {};

  return (
    <div className={`${styles.pageWrapper} cw-workspace`}>
      <PublicHeader user={user} />

      <main className={styles.mainContainer}>
        <CheckoutProgress surcharge={kind === 'reschedule'} current={bookingData.canPay || isExpired ? 1 : 2} />
        <h1 className={styles.pageTitle}>{kind === 'reschedule' ? 'Thanh toán phụ thu' : 'Thanh toán đặt sân'}</h1>
        <p className={styles.paymentReference}>Mã giao dịch đặt sân <strong>{bookingData.code}</strong></p>

        {/* BR03 / P02 / MSG32 / MSG33: Thanh đếm ngược hoặc trạng thái giao dịch */}
        {isConfirmedWait ? (
          <div className={styles.confirmedBanner}>
            <span>
              <strong>Chờ xác nhận</strong> · {toastSuccess || 'Nhân viên đang kiểm tra khoản chuyển của bạn.'}
            </span>
            <button
              type="button"
              className={styles.backHomeBtn}
              onClick={() => navigate('/my-bookings')}
            >
              Về lịch đặt sân
            </button>
          </div>
        ) : isConfirmedDone ? (
          <section className={styles.qrCard} style={{ marginBottom: 20 }}>
            <h2 className={styles.cardTitle}>Biên nhận thanh toán</h2>
            <div className={styles.bankInfoList}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Trạng thái</span>
                <strong className={styles.bankValue} style={{ color: '#0d8a52' }}>
                  {STATUS_LABELS[bookingData.status] || bookingData.status} (MSG49)
                </strong>
              </div>
              {bookingData.receiptNo && (
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Mã biên nhận</span>
                  <strong className={styles.bankValue}>{bookingData.receiptNo}</strong>
                </div>
              )}
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Mã đặt sân</span>
                <strong className={styles.bankValue}>{bookingData.code}</strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Số tiền phải thu</span>
                <strong className={styles.bankValue}>{formatVnd(Number(bookingData.amount || 0))}</strong>
              </div>
              {bookingData.receivedAmount != null && (
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Số tiền đã ghi nhận</span>
                  <strong className={styles.bankValue}>{formatVnd(Number(bookingData.receivedAmount))}</strong>
                </div>
              )}
              {bookingData.confirmedAt && (
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Thời gian xác nhận</span>
                  <strong className={styles.bankValue}>{bookingData.confirmedAt.replace('T', ' ')}</strong>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className={styles.backHomeBtn}
                onClick={() => navigate('/my-bookings')}
              >
                Về lịch đặt sân
              </button>
            </div>
          </section>
        ) : isRejected ? (
          <div className={styles.expiredBanner}>
            <span>
              <strong>Thanh toán đã bị từ chối. (MSG51)</strong>
              {bookingData.rejectReason ? ` Lý do: ${bookingData.rejectReason}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {bookingId && (
                <Link className="cw-secondary" to={`/my-complaints?bookingId=${bookingId}`}>
                  Gửi khiếu nại
                </Link>
              )}
              <button
                type="button"
                className={styles.backHomeBtn}
                onClick={() => navigate('/my-bookings')}
              >
                Về lịch đặt sân
              </button>
            </div>
          </div>
        ) : isExpired ? (
          <div className={styles.expiredBanner}>
            <span>{bookingData.resubmitting
                ? 'Đã hết lượt hoặc hết hạn gửi lại chứng từ. (MSG52)'
                : 'Đã hết thời gian giữ chỗ. Slot đã được nhả. (MSG33)'}</span>
            <span className={styles.countdownText}>00:00</span>
          </div>
        ) : bookingData.canPay ? (
          <div className={styles.holdBanner}>
            <div className={styles.holdBannerLeft}>
              <span className={styles.clockIcon}>🕒</span>
              <span>
                {bookingData.reason
                  ? `Yêu cầu bổ sung chứng từ: ${bookingData.reason}`
                  : 'Chuyển khoản và gửi chứng từ trước khi hết hạn.'}
                {bookingData.resubmitting && bookingData.resubmitsLeft != null &&
                  (bookingData.resubmitsLeft > 0 ? ' · Còn ' + bookingData.resubmitsLeft + ' lượt bổ sung'
                    : ' · Yêu cầu bổ sung cuối đang mở')}
                {bookingData.resubmitting && bookingData.deadline &&
                  ` · Hạn gửi lại: ${bookingData.deadline.replace('T', ' ')}`}
              </span>
            </div>
            {remainingSeconds !== null && <strong className={styles.countdownText}>{formatCountdown(remainingSeconds)}</strong>}
          </div>
        ) : <p role="status">Trạng thái: {STATUS_LABELS[bookingData.status] || bookingData.status}</p>}

        {bookingData.resubmitting && bookingData.receivedAmount > 0 &&
          <Feedback tone="warning">
            Đã ghi nhận {formatVnd(Number(bookingData.receivedAmount))} trước đó. Vui lòng chuyển thêm phần còn thiếu{' '}
            <strong>{formatVnd(Number(bookingData.amount))}</strong> và gửi lại chứng từ.
          </Feedback>}
        {awaiting && paymentId && eligiblePayment === paymentId &&
          <p><Link to={`/my-complaints?bookingId=${bookingId}&paymentId=${paymentId}`}>
            Gửi khiếu nại xác nhận thanh toán trễ
          </Link></p>}
        {kind === 'reschedule' && bookingData.paymentId &&
          <ReschedulePaymentDetail paymentId={bookingData.paymentId} />}

        {bookingData.canPay && !isExpired && <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Mã QR & Thông tin tài khoản nhận (DR28, FR17, FR55) */}
          <section className={styles.qrCard}>
            <h2 className={styles.cardTitle}>Thông tin chuyển khoản</h2>
            <span className={styles.amountLabel}>{bookingData.resubmitting && bookingData.receivedAmount > 0 ? 'Số tiền còn thiếu' : 'Số tiền cần chuyển'}</span>
            <strong className={styles.amountValue}>
              {formatVnd(finalAmount)}
            </strong>

            {qrUrl ? (
              <>
                <div className={styles.qrBox}>
                  <img className={styles.qrSvg} src={qrUrl} alt="Mã QR nhận thanh toán" />
                </div>
                <a className={styles.saveQrBtn} href={qrUrl} download={'QR_' + id}>Tải mã QR</a>
              </>
            ) : <p role="status">Mã QR chưa có hoặc không tải được. Dùng thông tin chuyển khoản bên dưới.</p>}

            <hr className={styles.divider} />

            <div className={styles.bankInfoList}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Ngân hàng</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankName || '—'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Số tài khoản</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankAccountNo || '—'}
                </strong>
                {bankInfo.bankAccountNo && <button type="button" className="cw-secondary" aria-label="Sao chép số tài khoản"
                  onClick={() => copyTransferField(bankInfo.bankAccountNo, 'số tài khoản')}>Sao chép</button>}
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Chủ tài khoản</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankAccountHolder || '—'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Nội dung chuyển khoản</span>
                <strong className={styles.bankValue}>
                  {bookingData.code}
                </strong>
                <button type="button" className="cw-secondary" aria-label="Sao chép nội dung chuyển khoản"
                  onClick={() => copyTransferField(bookingData.code, 'nội dung chuyển khoản')}>Sao chép</button>
              </div>
              {copyStatus && <Feedback>{copyStatus}</Feedback>}
            </div>
          </section>

          {/* CỘT PHẢI: Tải lên ảnh chứng từ chuyển khoản (DR21, MSG106, BR34, P06) */}
          <section className={styles.uploadCard}>
            <h2 className={styles.cardTitle}>Gửi chứng từ chuyển khoản</h2>

            <input
              ref={fileInputRef}
              type="file"
              aria-label="Ảnh chứng từ thanh toán"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "proof-error" : undefined}
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className={styles.hiddenFileInput}
              onChange={handleFileChange}
            />

            <button type="button"
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <span className={styles.uploadIcon}>↑</span>
              <strong className={styles.dropzoneTitle}>
                Chọn ảnh hoặc kéo thả vào đây
              </strong>
              <span className={styles.dropzoneSub}>JPG hoặc PNG, tối đa 5 MB</span>
            </button>

            {selectedFile && (
              <div className={styles.fileItemCard}>
                <div className={styles.fileItemLeft}>
                  <div className={styles.fileIconBox}>🖼️</div>
                  <div className={styles.fileMeta}>
                    <strong className={styles.fileName}>{selectedFile.name}</strong>
                    <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.removeFileBtn}
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  disabled={isConfirmedWait}
                >
                  Bỏ ảnh
                </button>
              </div>
            )}

            {errorMessage && <p id="proof-error" className={styles.errorText} role="alert">{errorMessage}</p>}

            <div className={styles.afterSubmitBox}>
              <strong className={styles.afterSubmitTitle}>Sau khi gửi chứng từ</strong>
              <p className={styles.afterSubmitDesc}>
                Nhân viên sẽ đối chiếu khoản chuyển. Nếu cần bổ sung ảnh (tối đa 3 lần khi lỗi từ người chơi), yêu cầu sẽ hiện trong lịch đặt sân.
              </p>
            </div>

            <button
              type="button"
              className={styles.submitProofBtn}
              disabled={submitting || isExpired || isConfirmedWait || remainingSeconds === null}
              onClick={handleSubmitPayment}
            >
              {submitting
                ? 'Đang gửi chứng từ…'
                : bookingData.resubmitting ? 'Gửi lại chứng từ' : 'Báo đã thanh toán'}
            </button>
          </section>
        </div>}
      </main>
    </div>
  );
}
