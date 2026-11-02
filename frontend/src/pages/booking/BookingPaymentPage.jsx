import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { uploadPaymentProofApi } from '../../api/bookingApi';
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

  // 1. Load thông tin giữ chỗ từ UC14 (BR03: Giữ nguyên mốc hold_expires_at khi F5 hoặc thoát ra vào lại)
  const [bookingData, setBookingData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('active_holding_booking');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.booking_code && parsed?.hold_expires_at) return parsed;
      }
    } catch {
      // Fallback nếu JSON lỗi
    }

    // Khởi tạo mốc giữ chỗ 5 phút cố định (P02 = 5 phút) nếu mở trực tiếp trang để test
    const fallbackBooking = {
      booking_id: 1005,
      booking_code: 'BK-24102',
      status: 'holding',
      hold_expires_at: new Date(Date.now() + 4 * 60 * 1000 + 12 * 1000).toISOString(), // 04:12 theo Mockup
      resubmit_attempts_left: 3, // P06 = 3 lần
      pricing_summary: {
        final_amount: 80000,
      },
      bank_info: {
        bank_name: 'Vietcombank',
        bank_account_number: '0011 0023 4567',
        bank_account_holder: 'NGUYEN VAN HUNG',
        qr_image_url: null,
        transfer_content: 'BK24102 0987654321',
      },
    };
    sessionStorage.setItem('active_holding_booking', JSON.stringify(fallbackBooking));
    return fallbackBooking;
  });

  // State đếm ngược (BR03 / P02 / MSG33)
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const expiresMs = new Date(bookingData.hold_expires_at).getTime();
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
  });

  // State chọn file ảnh chứng từ (DR21 / MSG106)
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // BR03: Đồng hồ đếm ngược theo mốc thời gian thực hold_expires_at
  useEffect(() => {
    if (bookingData.status === 'awaiting_confirmation') return undefined;

    const updateTimer = () => {
      const expiresMs = new Date(bookingData.hold_expires_at).getTime();
      const secs = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setRemainingSeconds(secs);

      // MSG33: Khi đồng hồ về 0 mà chưa báo thanh toán -> chuyển sang expired & nhả slot
      if (secs === 0 && bookingData.status === 'holding') {
        setBookingData((prev) => {
          const updated = { ...prev, status: 'expired' };
          sessionStorage.setItem('active_holding_booking', JSON.stringify(updated));
          return updated;
        });
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [bookingData.hold_expires_at, bookingData.status]);

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

  // FR55 / D145: Tải mã QR về máy (Đã vá lỗi thiếu xmlns của SVG)
  const handleDownloadQr = () => {
    const svgElement = document.getElementById('bms-vietqr-svg');
    if (!svgElement) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_${bookingData.booking_code}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // UC18: Gửi ảnh chứng từ & Báo đã thanh toán (DR07, BR06 chống bấm lặp)
  const handleSubmitPayment = async () => {
    if (submitting) return;
    setErrorMessage('');
    setToastSuccess('');

    // BR03 / MSG33: Chặn nếu đã hết thời gian giữ chỗ 5 phút
    if (remainingSeconds <= 0 || bookingData.status === 'expired') {
      setErrorMessage(
        `Hold time expired (MSG33): Booking ${bookingData.booking_code} has expired because payment proof was not submitted in time. The slot has been released.`
      );
      return;
    }

    // MSG106: Bắt buộc đính kèm ảnh chứng từ chuyển khoản
    if (!selectedFile) {
      setErrorMessage('Please attach a payment receipt image (MSG106).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await uploadPaymentProofApi({
        bookingId: bookingData.booking_id,
        file: selectedFile,
        resubmitAttemptsLeft: bookingData.resubmit_attempts_left ?? 3,
      });

      if (res?.success) {
        // BR03 / OI02: Chuyển sang awaiting_confirmation (Khóa slot an toàn, dừng đếm ngược)
        const updatedBooking = {
          ...bookingData,
          status: 'awaiting_confirmation',
        };
        setBookingData(updatedBooking);
        sessionStorage.setItem('active_holding_booking', JSON.stringify(updatedBooking));

        // MSG48: Hiển thị thông báo đã gửi chứng từ thành công
        setToastSuccess(
          res.message || 'Payment proof submitted. Please wait for staff verification (MSG48).'
        );
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to upload payment receipt.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isExpired = remainingSeconds <= 0 && bookingData.status !== 'awaiting_confirmation';
  const isConfirmedWait = bookingData.status === 'awaiting_confirmation';
  const finalAmount = bookingData.pricing_summary?.final_amount || 80000;
  const bankInfo = bookingData.bank_info || {};

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
            <Link to="/">Find Courts</Link>
            <a href="#matches">Open Matches</a>
            <Link to="/booking/payment" className={styles.activeLink}>
              My Bookings
            </Link>
          </nav>

          <div className={styles.userProfile}>
            <span className={styles.avatar}>MA</span>
            <span className={styles.userName}>Minh Anh</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        {/* BR03 / P02 / MSG32 / MSG33: Thanh đếm ngược thời gian giữ chỗ 5 phút */}
        {isConfirmedWait ? (
          <div className={styles.confirmedBanner}>
            <span>
              ✅ <strong>MSG48:</strong> {toastSuccess} (Status: <strong>Awaiting Confirmation</strong>)
            </span>
            <button
              type="button"
              className={styles.backHomeBtn}
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        ) : isExpired ? (
          <div className={styles.expiredBanner}>
            <span>
              ⚠️ <strong>Hold time expired (MSG33):</strong> Booking #{bookingData.booking_code} has
              expired because payment proof was not submitted within 5 minutes. Your slot has been
              released and any applied points/vouchers have been refunded.
            </span>
            <span className={styles.countdownText}>00:00</span>
          </div>
        ) : (
          <div className={styles.holdBanner}>
            <div className={styles.holdBannerLeft}>
              <span className={styles.clockIcon}>🕒</span>
              <span>
                Your court is currently being held. Please transfer funds and upload the receipt
                before time runs out.
              </span>
            </div>
            <strong className={styles.countdownText}>{formatCountdown(remainingSeconds)}</strong>
          </div>
        )}

        <h1 className={styles.pageTitle}>Payment for booking #{bookingData.booking_code}</h1>

        <div className={styles.contentGrid}>
          {/* CỘT TRÁI: Mã QR & Thông tin tài khoản nhận (DR28, FR17, FR55) */}
          <section className={styles.qrCard}>
            <span className={styles.amountLabel}>Amount to transfer</span>
            <strong className={styles.amountValue}>
              {finalAmount.toLocaleString('vi-VN')} VND
            </strong>

            <div className={styles.qrBox}>
              <svg
                id="bms-vietqr-svg"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 200 200"
                className={styles.qrSvg}
                aria-label="VietQR Code"
              >
                <rect width="200" height="200" fill="#ffffff" />
                {/* 3 cụm định vị góc chuẩn QR */}
                <path
                  d="M20,20 h50 v50 h-50 z M30,30 v30 h30 v-30 z M38,38 h14 v14 h-14 z"
                  fill="#0b172a"
                />
                <path
                  d="M130,20 h50 v50 h-50 z M140,30 v30 h30 v-30 z M148,38 h14 v14 h-14 z"
                  fill="#0b172a"
                />
                <path
                  d="M20,130 h50 v50 h-50 z M30,140 v30 h30 v-30 z M38,148 h14 v14 h-14 z"
                  fill="#0b172a"
                />
                {/* Các điểm dữ liệu QR mô phỏng */}
                <rect x="82" y="20" width="12" height="24" fill="#0b172a" />
                <rect x="104" y="32" width="14" height="14" fill="#0b172a" />
                <rect x="82" y="56" width="24" height="12" fill="#0b172a" />
                <rect x="20" y="84" width="24" height="12" fill="#0b172a" />
                <rect x="56" y="84" width="14" height="26" fill="#0b172a" />
                <rect x="82" y="82" width="28" height="14" fill="#0b172a" />
                <rect x="122" y="84" width="14" height="28" fill="#0b172a" />
                <rect x="150" y="84" width="30" height="12" fill="#0b172a" />
                <rect x="96" y="108" width="16" height="28" fill="#0b172a" />
                <rect x="136" y="124" width="28" height="14" fill="#0b172a" />
                <rect x="82" y="148" width="14" height="32" fill="#0b172a" />
                <rect x="110" y="152" width="26" height="14" fill="#0b172a" />
                <rect x="136" y="166" width="16" height="14" fill="#0b172a" />
                <rect x="164" y="144" width="16" height="24" fill="#0b172a" />
              </svg>
            </div>

            <button type="button" className={styles.saveQrBtn} onClick={handleDownloadQr}>
              Save QR code to device
            </button>

            <hr className={styles.divider} />

            <div className={styles.bankInfoList}>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Bank</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bank_name || 'Vietcombank'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account number</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bank_account_number || '0011 0023 4567'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Account holder</span>
                <strong className={styles.bankValue}>
                  {bankInfo.bank_account_holder || 'NGUYEN VAN HUNG'}
                </strong>
              </div>
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Transfer content</span>
                <strong className={styles.bankValue}>
                  {bankInfo.transfer_content || `${bookingData.booking_code} 0987654321`}
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
                unclear, you have up to {bookingData.resubmit_attempts_left ?? 3} resubmission
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
        </div>
      </main>
    </div>
  );
}