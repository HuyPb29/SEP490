export default function BookingSelectionSummary({ count, totalPrice, message, disabled, onContinue, styles }) {
  return (
    <div className={styles.summaryBar}>
      <div>
        <div className={styles.summaryMainText}>
          {count} {count === 1 ? 'slot' : 'slots'} selected · {totalPrice.toLocaleString('en-US')} VND
        </div>
        <div className={styles.summarySubText} role="status">{message}</div>
      </div>
      <button
        type="button"
        className={styles.continueBookingBtn}
        disabled={disabled}
        onClick={onContinue}
      >
        Review booking
      </button>
    </div>
  )
}