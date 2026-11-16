import { formatVnd } from '../../utils/formatters'
import styles from './ScheduleGrid.module.css'

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function dayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${WEEKDAYS[new Date(year, month - 1, day).getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

// Danh sách dải đã chọn trên bảng slot (kết quả của groupRanges); bấm × để bỏ cả dải
export default function SelectedRanges({ ranges, onRemove, showDate = false, showPrice = true }) {
  if (!ranges.length) return null
  return <ul className={styles.chips} aria-label="Các khung giờ đã chọn">
    {ranges.map((range) => {
      const text = [showDate && range.date && dayLabel(range.date), range.courtName,
        `${range.startTime}–${range.endTime}`, showPrice && formatVnd(range.amount)].filter(Boolean).join(' · ')
      return <li key={`${range.date}|${range.courtId}|${range.startMinute}`} className={styles.chip}>
        {text}
        {onRemove && <button type="button" className={styles.chipRemove} aria-label={'Bỏ ' + text}
          onClick={() => onRemove(range)}>×</button>}
      </li>
    })}
  </ul>
}
