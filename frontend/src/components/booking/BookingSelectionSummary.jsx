export default function BookingSelectionSummary({ count, totalPrice, message, disabled, onContinue, styles }) {
  return (
    <div className={styles.summaryBar}>
      <div>
        <div className={styles.summaryMainText}>
          {count} khung giờ đã chọn · {totalPrice.toLocaleString('vi-VN')} đồng
        </div>
        <div className={styles.summarySubText} role="status">{message}</div>
      </div>
      <button
        type="button"
        className={styles.continueBookingBtn}
        disabled={disabled}
        onClick={onContinue}
      >
        Xem lại thông tin đặt sân
      </button>
    </div>
  )
}
