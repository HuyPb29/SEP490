import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate, useSearchParams } from 'react-router-dom';
import { loadPayment, loadPaymentImage, submitPaymentProof } from '../../api/bookingPaymentApi';
import { getSavedUser } from '../../api/session';
import { ReschedulePaymentDetail } from './RescheduleHistoryPage';
import styles from './BookingPaymentPage.module.css';

// DR21: Dung lượng ảnh tối đa 5MB & chỉ nhận JPG, PNG
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export default function BookingPaymentPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- VÁ LỖI BUTTERFINGERS ---
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
  const user = getSavedUser();
  const isPlayer = user?.role_code === 'player';
  const [bookingData, setBookingData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    if (!isPlayer || !validId) return undefined;
    const controller = new AbortController();
    let objectUrl;
    loadPayment({ kind, id }, controller.signal).then(async (data) => {
      if (controller.signal.aborted) return;
      setBookingData(data);
      const qrPath = data.instructions?.qrImageUrl;
      if (qrPath) {
        const image = await loadPaymentImage(qrPath, controller.signal).catch(() => null);
        if (!controller.signal.aborted && image) {
          objectUrl = URL.createObjectURL(image);
          setQrUrl(objectUrl);
        }
      }
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(error.response?.data?.message || 'Không tải được thông tin thanh toán.');
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isPlayer, kind, validId]);

  // State chọn file ảnh chứng từ (DR21 / MSG106)
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deadline = bookingData?.deadline;
  useEffect(() => {
    if (!deadline) return undefined;
    const endsAt = Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(deadline) ? deadline : deadline + '+07:00');
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    update();
    const timerId = setInterval(update, 1000);
    return () => clearInterval(timerId);
  }, [deadline]);

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
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isValidType =
      ALLOWED_MIME_TYPES.includes(file.type) || ext === 'jpg' || ext === 'jpeg' || ext === 'png';

    if (!isValidType) {
      setErrorMessage('Invalid file format. Only JPG and PNG images are allowed (DR21).');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File size exceeds the 5MB limit. Please choose a smaller image (DR21).');
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
    event.preventDefault(); // Chặn default để cho phép thả vào dropzone
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault(); // Chặn hành vi mở ảnh mặc định của trình duyệt
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleSubmitPayment = async () => {
    if (submitting || !bookingData?.canPay || remainingSeconds === 0) return;
    setErrorMessage('');
    if (!selectedFile) {
      setErrorMessage('Please attach a payment receipt image (MSG106).');
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
      }));
      if (result.status === 'EXPIRED') {
        setErrorMessage('Đã hết hạn thanh toán. Vui lòng kiểm tra trạng thái booking.');
        return;
      }
      setToastSuccess('Đã gửi chứng từ. Vui lòng chờ xác nhận.');
      if (kind === 'reschedule') {
        const refreshed = await loadPayment({ kind, id }).catch(() => null);
        if (refreshed) setBookingData(refreshed);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng kiểm tra lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!validId) return <Navigate to="/my-bookings" replace />;
  if (!user) return <Navigate to="/login" state={{ returnTo: '/booking/payment?' + params.toString() }} replace />;
  if (!isPlayer) return <p role="alert">Chỉ tài khoản Player được thanh toán booking.</p>;
  if (!bookingData) return <main className={styles.mainContainer}>
    <p role={loadError ? 'alert' : 'status'}>{loadError || 'Đang tải thông tin thanh toán…'}</p>
    {loadError && <Link to="/my-bookings">Quay lại lịch sử booking</Link>}
  </main>;

  const isExpired = bookingData.status === 'EXPIRED' || (bookingData.canPay && remainingSeconds === 0);
  const isConfirmedWait = bookingData.awaiting;
  const finalAmount = bookingData.amount;
  const bankInfo = bookingData.instructions ?? {};

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
            <Link to="/">Find Courts</Link>
            <Link to="/open-matches">Open Matches</Link>
            <Link to="/my-bookings" className={styles.activeLink}>
              My Bookings
            </Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>{user.full_name?.charAt(0)}</span>
            <span className={styles.userName}>{user.full_name}</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        {/* BR03 / P02 / MSG32 / MSG33: Thanh đếm ngược thời gian giữ chỗ 5 phút */}
        {isConfirmedWait ? (
          <div className={styles.confirmedBanner}>
            <span>
              ✅ <strong>MSG48:</strong> {toastSuccess || 'Đang chờ nhân viên xác nhận.'} (Status: <strong>Awaiting Confirmation</strong>)
            </span>
            <button
              type="button"
              className={styles.backHomeBtn}
              onClick={() => navigate('/my-bookings')}
            >
              Go to My Bookings
            </button>
          </div>
        ) : isExpired ? (
          <div className={styles.expiredBanner}>
            <span>
              ⚠️ <strong>Payment deadline:</strong> {bookingData.code}
              has passed its payment deadline. Return to My Bookings to check the current status.
            </span>
            <span className={styles.countdownText}>00:00</span>
          </div>
        ) : bookingData.canPay ? (
          <div className={styles.holdBanner}>
            <div className={styles.holdBannerLeft}>
              <span className={styles.clockIcon}>🕒</span>
              <span>
                {bookingData.reason || 'Please transfer funds and upload the receipt before the deadline.'}
                {bookingData.resubmitting && bookingData.resubmitsLeft != null &&
                  ` · Còn ${bookingData.resubmitsLeft} lượt gửi lại`}
              </span>
            </div>
            {remainingSeconds !== null && <strong className={styles.countdownText}>{formatCountdown(remainingSeconds)}</strong>}
          </div>
        ) : <p role="status">Trạng thái: {bookingData.status}</p>}

        <h1 className={styles.pageTitle}>Payment · {bookingData.code}</h1>
        {kind === 'reschedule' && bookingData.paymentId &&
          <ReschedulePaymentDetail paymentId={bookingData.paymentId} />}

        {bookingData.canPay && !isExpired && <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Mã QR & Thông tin tài khoản nhận (DR28, FR17, FR55) */}
          <section className={styles.qrCard}>
            <span className={styles.amountLabel}>Amount to transfer</span>
            <strong className={styles.amountValue}>
              {finalAmount.toLocaleString('vi-VN')} VND
            </strong>

            {qrUrl && <>
              <div className={styles.qrBox}>
                <img className={styles.qrSvg} src={qrUrl} alt="Mã QR nhận thanh toán" />
              </div>
              <a className={styles.saveQrBtn} href={qrUrl} download={'QR_' + id}>Save QR code to device</a>
            </>}

            <hr className={styles.divider} />

            <div className={styles.bankInfoList}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Bank</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankName || '—'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account number</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankAccountNo || '—'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account holder</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bankAccountHolder || '—'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Transfer content</span>
                <strong className={styles.bankValue}>
                  {bookingData.code}
                </strong>
              </div>
            </div>
          </section>

          {/* CỘT PHẢI: Tải lên ảnh chứng từ chuyển khoản (DR21, MSG106, BR34, P06) */}
          <section className={styles.uploadCard}>
            <h2 className={styles.cardTitle}>Upload transfer receipt</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className={styles.hiddenFileInput}
              onChange={handleFileChange}
            />

            <div
              role="button"
              tabIndex={0}
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <span className={styles.uploadIcon}>↑</span>
              <strong className={styles.dropzoneTitle}>
                Drag and drop or click to select an image
              </strong>
              <span className={styles.dropzoneSub}>Required · JPG, PNG, max 5MB</span>
            </div>

            {/* Hiển thị file đã chọn (hoặc trạng thái trống để người dùng chọn) */}
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
                  onClick={() => setSelectedFile(null)}
                  disabled={isConfirmedWait}
                >
                  Remove
                </button>
              </div>
            )}

            {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

            {/* BR34 / P06: Quy tắc tối đa 3 lần gửi lại chứng từ */}
            <div className={styles.afterSubmitBox}>
              <strong className={styles.afterSubmitTitle}>After submitting</strong>
              <p className={styles.afterSubmitDesc}>
                Facility staff will verify the transfer and confirm your booking. If the receipt is
                unclear, the facility may request a new receipt within the allowed number of
                attempts.
              </p>
            </div>

            <button
              type="button"
              className={styles.submitProofBtn}
              disabled={submitting || isExpired || isConfirmedWait}
              onClick={handleSubmitPayment}
            >
              {submitting
                ? 'Submitting payment proof...'
                : isConfirmedWait
                  ? 'Payment Proof Submitted (Awaiting Confirmation)'
                  : 'Submit Payment Proof'}
            </button>
          </section>
        </div>}
      </main>
    </div>
  );
}
