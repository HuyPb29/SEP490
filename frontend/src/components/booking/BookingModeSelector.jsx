export default function BookingModeSelector({ mode, onChange, styles }) {
  const options = [
    { value: 'single', label: 'Single-Day Booking (Đặt lẻ - UC14)' },
    { value: 'custom', label: 'Custom Multi-Session (Đặt nhiều buổi tự chọn - UC15 CUSTOM)' },
    { value: 'recurring', label: 'Recurring Booking (Đặt định kỳ - UC15 RECURRING)' },
  ]

  return (
    <div className={styles.bookingModeSelector} role="group" aria-label="Booking mode">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          className={`${styles.bookingModeButton} ${mode === option.value ? styles.bookingModeButtonActive : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}