export default function BookingModeSelector({ mode, onChange, styles }) {
  const options = [
    { value: 'single', label: "Đặt sân lẻ trong ngày" },
    { value: 'custom', label: "Đặt nhiều buổi tự chọn" },
    { value: 'recurring', label: "Đặt sân định kỳ" },
  ]

  return (
    <div className={styles.bookingModeSelector} role="group" aria-label="Cách đặt sân">
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