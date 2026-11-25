import { toMinutes, toTimeLabel } from '../api/bookingApi'

const SLOT = 30

// Gộp các ô 30 phút liền nhau trên cùng sân, cùng ngày thành một dải (BR01, BR64).
// items: [{ date?, courtId, courtName?, time, price? }]
export function groupRanges(items) {
  const sorted = [...items].sort((a, b) =>
    String(a.date ?? '').localeCompare(String(b.date ?? '')) || a.courtId - b.courtId || toMinutes(a.time) - toMinutes(b.time))
  const ranges = []
  sorted.forEach((item) => {
    const start = toMinutes(item.time)
    const last = ranges[ranges.length - 1]
    if (last && last.date === item.date && last.courtId === item.courtId && last.endMinute === start) {
      last.endMinute += SLOT
      last.amount += Number(item.price || 0)
      last.items.push(item)
    } else {
      ranges.push({
        date: item.date, courtId: item.courtId, courtName: item.courtName,
        startMinute: start, endMinute: start + SLOT, amount: Number(item.price || 0), items: [item],
      })
    }
  })
  return ranges.map((range) => ({ ...range, startTime: toTimeLabel(range.startMinute), endTime: toTimeLabel(range.endMinute) }))
}

// Chọn một dải liền nhau trên một sân (đổi lịch, đặt tại quầy): bấm ô liền kề để kéo dài,
// bấm ô đầu/cuối để bớt, bấm ô khác sân hoặc không liền kề để chọn lại từ ô đó.
// range: { courtId, startMinute, endMinute } | null
export function pickRange(range, courtId, time) {
  const t = toMinutes(time)
  if (range && range.courtId === courtId) {
    if (t === range.endMinute) return { ...range, endMinute: t + SLOT }
    if (t + SLOT === range.startMinute) return { ...range, startMinute: t }
    if (t === range.startMinute && t + SLOT === range.endMinute) return null
    if (t === range.startMinute) return { ...range, startMinute: t + SLOT }
    if (t + SLOT === range.endMinute) return { ...range, endMinute: t }
  }
  return { courtId, startMinute: t, endMinute: t + SLOT }
}

// Như pickRange, thêm cách bấm ô bắt đầu rồi bấm ô kết thúc cùng sân: lấy cả dải nếu mọi ô ở giữa
// còn trống (đặt tại quầy, D183). isFreeAt(minute) cho biết ô bắt đầu ở phút đó có còn trống không.
export function pickRangeTo(range, courtId, time, isFreeAt) {
  const t = toMinutes(time)
  if (range && range.courtId === courtId && (t > range.endMinute || t + SLOT < range.startMinute)) {
    const from = Math.min(range.startMinute, t)
    const to = Math.max(range.endMinute, t + SLOT)
    let allFree = true
    for (let minute = from; minute < to; minute += SLOT) {
      if (minute >= range.startMinute && minute < range.endMinute) continue
      if (!isFreeAt(minute)) { allFree = false; break }
    }
    if (allFree) return { courtId, startMinute: from, endMinute: to }
  }
  return pickRange(range, courtId, time)
}
