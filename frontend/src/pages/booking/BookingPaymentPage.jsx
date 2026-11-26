import { subscribeLiveRefresh } from '../../utils/liveRefresh';
import { bookingTimestamp } from '../../api/bookingHistory';
import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentActions } from '../../hooks/useBooking';
import { ReschedulePaymentDetail } from './RescheduleHistoryPage';
import styles from './BookingPaymentPage.module.css';
import { money, uiMessage } from '../../utils/formatters';
import { CheckoutProgress } from '../../components/common/WorkspacePrimitives';
import PublicLayout from '../../components/layout/PublicLayout';
import { Button, PageHeader, StatusBadge, LoadingState, ErrorState, EmptyState } from '../../components/common';
import ImageProofUpload from '../../components/upload/ImageProofUpload';

// DR21: Dung lượng ảnh tối đa 5MB & chỉ nhận JPG, PNG
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const formatVnd = value => money(value).replace(/\s*₫/, 'đ');
const formatDateTime = value => value ? new Date(bookingTimestamp(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';

export default function BookingPaymentPage() {
  const fileInputRef = useRef(null);
  const submitLock = useRef(false);
  const feedbackRef = useRef(null);
  const proofRef = useRef(null);
  const [proofStarted, setProofStarted] = useState(false);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [qrError, setQrError] = useState('');
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
  const qrActive = bookingData?.canPay === true;
  useEffect(() => {
    if (!qrPath || !qrActive) return undefined;
    const controller = new AbortController();
    let objectUrl;
    loadPaymentImage(qrPath, controller.signal).then((image) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(image);
      setQrImage({ path: qrPath, url: objectUrl, type: image.type });
      setQrError('');
    }).catch(() => { if (!controller.signal.aborted) setQrError(qrPath); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [qrPath, qrActive, qrAttempt, loadPaymentImage]);
  const qrUrl = qrImage?.path === qrPath ? qrImage?.url : '';

  // State chọn file ảnh chứng từ (DR21 / MSG106)
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (errorMessage || toastSuccess) {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      feedbackRef.current?.focus({ preventScroll: true });
    }
  }, [errorMessage, toastSuccess]);

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
    const stop = subscribeLiveRefresh(check, 5000, true);
    return () => {
      controller.abort();
      stop();
    };
  }, [awaiting, bookingId, paymentId, isLatePaymentEligible]);

  const trackStatus = bookingData && ['HOLDING', 'PENDING_PAYMENT', 'AWAITING_CONFIRMATION', 'RESUBMIT_REQUESTED'].includes(bookingData.status);
  useEffect(() => {
    if (!trackStatus || submitting) return undefined;
    const controller = new AbortController();
    const checkStatus = async () => {
      try {
        if (document.visibilityState !== 'hidden') {
          const data = await loadPayment({ kind, id }, controller.signal);
          if (!controller.signal.aborted) setBookingData(data);
        }
      } catch {
        // Keep the last payment state if this refresh fails.
      }
    };
    const stop = subscribeLiveRefresh(checkStatus);
    return () => { controller.abort(); stop(); };
  }, [trackStatus, submitting, kind, id, loadPayment]);

  const deadline = bookingData?.deadlineMs;
  useEffect(() => {
    if (!Number.isFinite(deadline)) return undefined;
    const update = () => setClock(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const remainingSeconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - clock) / 1000)) : null;

  const formatCountdown = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = String(Math.floor(totalSecs / 60) % 60).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return hours > 0 ? `${String(hours).padStart(2, '0')}:${mins}:${secs}` : `${mins}:${secs}`;
  };

  // DR21: Kiểm tra định dạng JPG/PNG và dung lượng <= 5MB
  const validateAndSetFile = (file) => {
    setErrorMessage('');
    setToastSuccess('');
    if (!file || submitting) return;
    setProofStarted(true);
    setSelectedFile(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isValidType = ['jpg', 'jpeg', 'png'].includes(ext)
      && (!file.type || ALLOWED_MIME_TYPES.includes(file.type));

    if (!isValidType || file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Ảnh chứng từ không đúng định dạng. Vui lòng chọn ảnh JPG hoặc PNG, tối đa 5 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    validateAndSetFile(file);
    event.target.value = '';
  };

  const handleSubmitPayment = async () => {
    if (submitLock.current || submitting || !bookingData?.canPay || (!Number.isFinite(deadline) || deadline <= Date.now())) return;
    setErrorMessage('');
    if (!selectedFile) {
      setProofStarted(true);
      setErrorMessage('Vui lòng đính kèm ảnh chứng từ thanh toán.');
      return;
    }
    submitLock.current = true;
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
        setToastSuccess(kind === 'reschedule'
          ? 'Đã gửi chứng từ.'
          : 'Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận.');
      }
      const refreshed = await loadPayment({ kind, id }).catch(() => null);
      if (refreshed) setBookingData(refreshed);
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.';
      if (error.response?.status === 409) {
        const refreshed = await loadPayment({ kind, id }).catch(() => null);
        if (refreshed) setBookingData(refreshed);
        if (!refreshed && (message.includes('MSG33') || message.includes('MSG52'))) {
          setBookingData((current) => ({ ...current, status: 'EXPIRED', canPay: false }));
        }
      }
      setErrorMessage(message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!validId) return <Navigate to="/my-bookings" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/payment?' + params.toString() }} replace />;
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Người chơi được thanh toán đặt sân.</p>;
  const retryPayment = () => { setLoadError(''); setReload(value => value + 1); };
  if (!bookingData) return <PublicLayout><PageHeader title="Thanh toán chuyển khoản" />{loadError ? <ErrorState message={uiMessage(loadError)} onRetry={retryPayment} /> : <LoadingState message="Đang tải thông tin thanh toán…" />}<Link to="/my-bookings" className={styles.textLink}>Về lịch đặt sân</Link></PublicLayout>;

  const isExpired = bookingData.status === 'EXPIRED';
  const deadlineElapsed = bookingData.canPay && remainingSeconds === 0;
  const isConfirmedWait = bookingData.awaiting;
  const isConfirmedDone = ['CONFIRMED', 'APPROVED', 'IN_USE', 'COMPLETED'].includes(bookingData.status);
  const isRejected = ['PAYMENT_REJECTED', 'REJECTED'].includes(bookingData.status);
  const finalAmount = bookingData.amount;
  const bankInfo = bookingData.instructions ?? {};
  const canSubmit = bookingData.canPay && !isExpired && !deadlineElapsed && Number.isFinite(deadline);
  const proofSent = Boolean(isConfirmedWait || isConfirmedDone);
  const proofStep = selectedFile || submitting ? 2 : proofStarted || bookingData.resubmitting ? 1 : 0;
  const proofSteps = ['Chuyển khoản', 'Chọn chứng từ', 'Gửi chứng từ'];
  const proofNote = proofSent
    ? isConfirmedDone ? 'Sân đã xác nhận thanh toán.' : 'Đã gửi chứng từ. Chờ sân xác nhận khoản chuyển.'
    : submitting ? 'Đang gửi chứng từ, vui lòng đợi…'
    : proofStep === 2 ? errorMessage ? 'Chưa gửi thành công. Kiểm tra lỗi bên dưới rồi thử lại.' : 'Ảnh đã sẵn sàng. Kiểm tra lại và bấm gửi chứng từ.'
    : proofStep === 1 ? 'Chọn ảnh chuyển khoản rõ số tiền, tài khoản nhận và nội dung.'
    : 'Chuyển khoản trong ứng dụng ngân hàng, sau đó chọn ảnh chứng từ để gửi.';
  const title = kind === 'reschedule' ? 'Thanh toán chênh lệch đổi lịch' : kind === 'package' ? 'Thanh toán đơn / gói đặt sân' : 'Thanh toán đơn đặt lẻ';
  const status = bookingData.resubmitting && bookingData.canPay ? 'RESUBMIT_REQUESTED' : bookingData.status;
  const statusCategory = kind === 'reschedule' && ['PENDING_PAYMENT', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(status) ? 'reschedule' : 'booking';
  const badge = <StatusBadge status={status} category={statusCategory} />;
  const timer = () => <div className={`${styles.timer} ${remainingSeconds !== null && remainingSeconds < 120 ? styles.timerWarning : ''} ${isExpired || deadlineElapsed ? styles.timerExpired : ''}`}>
    <div><span>{bookingData.resubmitting ? 'Hạn gửi lại chứng từ' : 'Thời gian giữ chỗ còn lại'}</span><strong role="timer" aria-live="off">{isExpired ? '00:00' : remainingSeconds === null ? '—' : formatCountdown(remainingSeconds)}</strong></div>
    <p>{isExpired ? 'Đã hết hạn. Không thể gửi chứng từ cho giao dịch này.' : deadlineElapsed ? 'Đã hết thời gian gửi chứng từ. Đang kiểm tra trạng thái với máy chủ.' : remainingSeconds !== null && remainingSeconds < 120 ? 'Còn dưới 2 phút. Hãy kiểm tra và gửi chứng từ đúng hạn.' : 'Hạn được giữ nguyên khi tải lại trang.'}</p>
  </div>;
  const transferRows = [
    ['Ngân hàng', bankInfo.bankName, 'ngân hàng'], ['Số tài khoản', bankInfo.bankAccountNo, 'số tài khoản'],
    ['Tên chủ tài khoản', bankInfo.bankAccountHolder, 'tên chủ tài khoản'], ['Nội dung chuyển khoản', bankInfo.transferContent || bookingData.code, 'nội dung chuyển khoản'],
  ];
  return <PublicLayout>
    <div className={styles.container}>
      {(bookingData.canPay || isExpired) && <div className={styles.mobileTimer}>{timer()}</div>}
      <CheckoutProgress surcharge={kind === 'reschedule'} current={bookingData.canPay || isExpired ? 1 : 2} />
      <PageHeader eyebrow="Thanh toán chuyển khoản" title={title} subtitle={`Mã giao dịch: ${bookingData.code}`}
        breadcrumbs={[{ label: 'Lịch đặt sân của tôi', to: '/my-bookings' }, { label: 'Thanh toán' }]} actions={badge} />
      {toastSuccess && <p ref={feedbackRef} tabIndex={-1} className={styles.success} role="status">✓ {uiMessage(toastSuccess)}</p>}
      {(canSubmit || proofSent) && <section className={styles.proofProgress} aria-label="Tiến trình gửi chứng từ">
        <ol className={styles.steps} aria-label="Các bước chuyển khoản">
          {proofSteps.map((label, index) => {
            const done = proofSent || index < proofStep;
            const active = !proofSent && index === proofStep;
            return <li key={label} data-state={done ? 'complete' : active ? 'current' : 'upcoming'} aria-current={active ? 'step' : undefined}>
              <span className={styles.progressNumber} aria-hidden="true">{done ? '✓' : index + 1}</span>
              <span><strong>{label}</strong><small>{done ? 'Đã hoàn tất bước' : active ? submitting ? 'Đang gửi…' : 'Bước hiện tại' : 'Bước tiếp theo'}</small></span>
            </li>;
          })}
        </ol>
        <p className={styles.progressNote} role="status">{proofNote}</p>
      </section>}
      {bookingData.resubmitting && <section className={styles.resubmit} aria-labelledby="resubmit-heading"><h2 id="resubmit-heading">Nhân viên yêu cầu bổ sung chứng từ</h2><p>Lý do: <strong>{uiMessage(bookingData.reason) || 'Vui lòng gửi lại ảnh rõ thông tin chuyển khoản.'}</strong></p><p>{bookingData.resubmitsLeft != null && (bookingData.resubmitsLeft > 0 ? `Còn ${bookingData.resubmitsLeft} lượt gửi lại.` : 'Yêu cầu bổ sung cuối đang mở.')} {Number.isFinite(deadline) && `Hạn gửi lại: ${formatDateTime(new Date(deadline).toISOString())}.`}</p>{bookingData.receivedAmount > 0 && <p>Đã ghi nhận <strong>{formatVnd(bookingData.receivedAmount)}</strong>. Số tiền còn thiếu: <strong>{formatVnd(bookingData.amount)}</strong>.</p>}</section>}
      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          {canSubmit ? <section className={styles.card} aria-labelledby="transfer-heading"><header className={styles.cardHeader}><span className={styles.stepNumber}>1</span><h2 id="transfer-heading">Chuyển khoản đến tài khoản sân</h2></header><p className={styles.amountLabel}>{bookingData.resubmitting && bookingData.receivedAmount > 0 ? 'Số tiền còn thiếu' : 'Số tiền cần chuyển'}</p>
            <div className={styles.amountRow}><strong>{formatVnd(finalAmount)}</strong><Button variant="ghost" aria-label="Sao chép số tiền" onClick={() => copyTransferField(finalAmount, 'số tiền')}>Sao chép</Button></div>
            <div className={styles.qrArea}>{qrPath ? qrUrl && qrError !== qrPath ? <><img src={qrUrl} className={styles.qrImage} alt="Mã QR nhận thanh toán" onError={() => setQrError(qrPath)} /><a className={styles.outlineLink} href={qrUrl} download={'QR_' + id + (qrImage?.type === 'image/jpeg' ? '.jpg' : qrImage?.type === 'image/svg+xml' ? '.svg' : '.png')}>Lưu ảnh QR</a></> : qrError === qrPath ? <ErrorState message="Không tải được mã QR. Bạn vẫn có thể dùng thông tin chuyển khoản bên dưới." onRetry={() => { setQrImage(null); setQrError(''); setQrAttempt(value => value + 1); }} /> : <LoadingState message="Đang tải mã QR…" /> : <EmptyState title="Chưa có mã QR" description="Dùng thông tin tài khoản bên dưới để chuyển khoản thủ công." action={<Button variant="secondary" onClick={() => document.getElementById('bank-details')?.focus()}>Xem thông tin tài khoản</Button>} />}</div>
            <dl className={styles.bankDetails} id="bank-details" tabIndex={-1}>{transferRows.map(([label, value, copyLabel]) => <div key={label}><div><dt>{label}</dt><dd>{value || '—'}</dd></div><Button variant="secondary" size="sm" disabled={!value} aria-label={'Sao chép ' + copyLabel} onClick={() => copyTransferField(value, copyLabel)}>Sao chép</Button></div>)}</dl>
            {copyStatus && <p className={copyStatus.startsWith('Không thể') ? styles.errorBanner : styles.copyNotice} role="status">{copyStatus}</p>}
            <p className={styles.helper}>Chuyển đúng số tiền và nội dung để nhân viên dễ đối chiếu.</p>
            <Button variant="secondary" disabled={submitting} onClick={() => {
              setProofStarted(true);
              proofRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.getElementById('proof-heading')?.focus({ preventScroll: true });
            }}>Đã chuyển khoản, chọn chứng từ</Button>
          </section> : <section className={styles.card} aria-labelledby="payment-status-heading"><h2 id="payment-status-heading">Tình trạng thanh toán</h2><div className={styles.statusLine}>{badge}</div>
            {isConfirmedWait ? <div role="status" className={styles.pending}><h3>Chứng từ đang chờ xác nhận</h3><p>{kind === 'reschedule' ? 'Cơ sở đang kiểm tra phụ thu. Lịch cũ được giữ trong lúc chờ.' : 'Nhân viên đang kiểm tra khoản chuyển. Bạn không cần gửi lại chứng từ trong lúc chờ.'}</p>{kind === 'reschedule' && bookingData.approveDeadline && <p>Hạn xử lý: {formatDateTime(bookingData.approveDeadline)}</p>}</div> : isConfirmedDone ? <section className={styles.receipt} aria-labelledby="receipt-heading"><span className={styles.receiptIcon} aria-hidden="true">✓</span><h3 id="receipt-heading">Biên nhận thanh toán</h3><dl className={styles.details}><dt>Mã biên nhận</dt><dd>{bookingData.receiptNo || 'Chưa có mã biên nhận'}</dd><dt>Mã đặt sân</dt><dd>{bookingData.code}</dd><dt>Số tiền phải thu</dt><dd>{formatVnd(bookingData.amount)}</dd>{bookingData.receivedAmount != null && <><dt>Đã ghi nhận</dt><dd>{formatVnd(bookingData.receivedAmount)}</dd></>}{bookingData.confirmedAt && <><dt>Xác nhận lúc</dt><dd>{formatDateTime(bookingData.confirmedAt)}</dd></>}</dl></section> : isRejected ? <div className={styles.errorBanner} role="alert"><h3>Thanh toán bị từ chối</h3>{bookingData.rejectReason && <p>Lý do: {uiMessage(bookingData.rejectReason)}</p>}</div> : isExpired || deadlineElapsed ? <div className={styles.errorBanner} role="alert"><h3>{isExpired ? 'Đơn đã hết hạn' : 'Đã hết hạn gửi chứng từ'}</h3><p>{bookingData.resubmitting ? 'Đã hết lượt hoặc hết hạn gửi lại chứng từ.' : deadlineElapsed ? 'Form đã khóa. Hệ thống đang kiểm tra trạng thái đơn từ máy chủ.' : 'Đã hết thời gian giữ chỗ. Khung giờ đã được nhả.'}</p></div> : bookingData.canPay && !Number.isFinite(deadline) ? <ErrorState message="Chưa tải được hạn thanh toán hợp lệ. Vui lòng tải lại thông tin trước khi chuyển khoản." onRetry={retryPayment} /> : <p className={styles.helper}>Hiện không có thao tác gửi chứng từ cho trạng thái này.</p>}
            <div className={styles.statusActions}><Link to="/my-bookings" className={styles.linkButton}>Về lịch đặt sân</Link>{isRejected && bookingId && <Link className={styles.outlineLink} to={`/my-complaints?bookingId=${bookingId}`}>Gửi khiếu nại</Link>}</div>
          </section>}
          {kind === 'reschedule' && bookingData.paymentId && <ReschedulePaymentDetail paymentId={bookingData.paymentId} />}
          {awaiting && paymentId && eligiblePayment === paymentId && <Link className={styles.textLink} to={`/my-complaints?bookingId=${bookingId}&paymentId=${paymentId}`}>Gửi khiếu nại xác nhận thanh toán trễ</Link>}
        </div>
        <aside className={styles.rightColumn} aria-label="Tóm tắt và chứng từ"><section className={styles.card} aria-labelledby="summary-heading"><h2 id="summary-heading">Tóm tắt giao dịch</h2><dl className={styles.details}><dt>Thanh toán cho</dt><dd>{kind === 'reschedule' ? 'Chênh lệch đổi lịch' : kind === 'package' ? 'Đơn / gói đặt sân' : 'Đơn đặt lẻ'}</dd><dt>Mã giao dịch</dt><dd>{bookingData.code}</dd><dt>Số tiền</dt><dd><strong>{formatVnd(finalAmount)}</strong></dd><dt>Trạng thái</dt><dd>{badge}</dd></dl></section>
          {(bookingData.canPay || isExpired) && <div className={styles.desktopTimer}>{timer()}</div>}
          {bookingData.canPay && !isExpired && <section ref={proofRef} className={styles.card} aria-labelledby="proof-heading" onFocusCapture={() => { if (canSubmit) setProofStarted(true); }} onPointerDownCapture={() => { if (canSubmit) setProofStarted(true); }}><header className={styles.cardHeader}><span className={styles.stepNumber}>2</span><h2 id="proof-heading" tabIndex={-1}>Tải chứng từ chuyển khoản</h2></header><ImageProofUpload file={selectedFile} inputRef={fileInputRef} onChange={handleFileChange} onDropFile={validateAndSetFile} onClear={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} error={errorMessage ? uiMessage(errorMessage) : undefined} disabled={submitting || !canSubmit} />
            <div className={styles.afterSubmit}><strong>Sau khi gửi chứng từ</strong><p>Nhân viên sẽ đối chiếu khoản chuyển. Nếu cần bổ sung ảnh, lý do và hạn gửi lại sẽ hiện tại đây và trong lịch đặt sân.</p></div>
            <div ref={!toastSuccess ? feedbackRef : undefined} tabIndex={-1} className={styles.submitArea}><Button className={styles.submitButton} loading={submitting} disabled={!canSubmit || isConfirmedWait || remainingSeconds === null} onClick={handleSubmitPayment}>{bookingData.resubmitting ? 'Gửi lại chứng từ' : 'Gửi chứng từ'}</Button><p className={styles.helper}>Bước 3 · Chỉ gửi sau khi bạn đã hoàn tất chuyển khoản.</p></div>
          </section>}
        </aside>
      </div>
    </div>
  </PublicLayout>;
}
