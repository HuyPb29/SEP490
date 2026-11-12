import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { F1Dialog } from '../../components/F1Feedback'
import ScheduleGrid from '../../components/schedule/ScheduleGrid'
import { isBookable } from '../../utils/venueSchedule'
import { useVenueSchedule, useVenueSession } from '../../hooks/useVenueSchedule'
import { formatVnd } from '../../utils/formatters'
import styles from './FacilityDetailPage.module.css'

const loginMessage = 'Vui lòng đăng nhập hoặc đăng ký để dùng chức năng này.'
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const labelFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: 'UTC' })
const intentKey = 'venue_booking_intent'

function readIntent(id, date) {
  try {
    const data = JSON.parse(sessionStorage.getItem(intentKey))
    return data?.id === id && data.date === date && Array.isArray(data.slots) ? data.slots : []
  } catch {
    return []
  }
}

export default function VenueSchedule({ id, facility, scheduleRef, openPackage, onClosePackage }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { token, user } = useVenueSession()
  const [today] = useState(() => dayFormat.format(new Date()))
  const initialDate = new URLSearchParams(location.search).get('date') || location.state?.playDate || today
  const [requestedDate, setRequestedDate] = useState(initialDate)
  const [revision, setRevision] = useState(0)
  const { date, maxDate, current } = useVenueSchedule(id, requestedDate, today, token, revision)
  const [selection, setSelection] = useState(() => ({
    date: initialDate, slots: user?.role_code === 'player' ? readIntent(id, initialDate) : [],
  }))
  const [inspected, setInspected] = useState(null)
  const [guestPrompt, setGuestPrompt] = useState(false)
  const allowBooking = !user || user.role_code === 'player'
  const isManager = user?.role_code === 'owner' || user?.role_code === 'staff'
  const selected = selection.date === date ? (current?.data?.courts || []).flatMap((court) =>
    court.slots.flatMap((slot, timeIdx) => isBookable(slot) &&
      selection.slots.some((item) => item.courtId === court.court_id && item.time === slot.time)
      ? [{ courtId: court.court_id, courtName: court.court_name, timeIdx, time: slot.time, price: Number(slot.price) }] : [])
  ) : []
  const totalPrice = selected.reduce((total, slot) => total + slot.price, 0)

  function chooseDate(value) {
    if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today && value <= maxDate) {
      setRequestedDate(value)
      setSelection({ date: value, slots: [] })
      setInspected(null)
    }
  }

  function shiftDate(offset) {
    const value = new Date(date + 'T12:00:00Z')
    value.setUTCDate(value.getUTCDate() + offset)
    chooseDate(value.toISOString().slice(0, 10))
  }

  function toggleSlot(court, slot) {
    const currentSlots = selection.date === date ? selection.slots : []
    const match = (item) => item.courtId === court.court_id && item.time === slot.time
    const slots = currentSlots.some(match) ? currentSlots.filter((item) => !match(item)) :
      [...currentSlots, { courtId: court.court_id, time: slot.time }]
    setSelection({ date, slots })
  }

  function continueBooking() {
    if (!selected.length) return
    if (!user) { setGuestPrompt(true); return }
    if (!allowBooking) return
    sessionStorage.removeItem(intentKey)
    sessionStorage.setItem('pending_booking_selection', JSON.stringify({
      facility, playDate: date, selectedSlots: selected, totalPrice, source: 'backend',
    }))
    navigate('/booking/summary')
  }

  function goToLogin() {
    if (!openPackage) sessionStorage.setItem(intentKey, JSON.stringify({ id, date, slots: selected.map(({ courtId, time }) => ({ courtId, time })) }))
    navigate('/login', { state: { returnTo: openPackage ? '/facilities/' + id + '/package-booking' : '/facilities/' + id + '?date=' + date, notice: loginMessage } })
  }

  return <section ref={scheduleRef} className={styles.scheduleCard}>
    <div className={styles.scheduleHeader}>
      <h2 className={styles.sectionTitle}>Lịch sân</h2>
      <div className={styles.dateControls}>
        <button type="button" className={styles.navArrowBtn} aria-label="Ngày trước" disabled={date <= today} onClick={() => shiftDate(-1)}>‹</button>
        <span className={styles.dateDisplay}>{labelFormat.format(new Date(date + 'T12:00:00Z'))}</span>
        <button type="button" className={styles.navArrowBtn} aria-label="Ngày sau" disabled={!maxDate || date >= maxDate} onClick={() => shiftDate(1)}>›</button>
        <input type="date" className={styles.dateInput} aria-label="Chọn ngày chơi" min={today}
          max={maxDate || today} value={date} disabled={!maxDate} onChange={(event) => chooseDate(event.target.value)} />
      </div>
    </div>
    {!current && <p role="status">Đang tải lịch sân…</p>}
    {current?.error && <p role="alert">{current.error} <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></p>}
    {maxDate && requestedDate > maxDate && <p role="status">Ngày đã chọn ngoài giới hạn xem lịch. Đang hiển thị lịch hôm nay.</p>}
    {current?.data?.time_headers.length === 0 && <p>Ngày này chưa có khung giờ mở đặt.</p>}
    {current?.data?.time_headers.length > 0 && <ScheduleGrid schedule={current.data} selected={selected}
      allowBooking={allowBooking} showBooker={isManager} onSlot={toggleSlot}
      onInspect={(info) => setInspected({ info, token, date })} />}
    {isManager && current?.data && inspected?.token === token && inspected.date === date && <div role="status">
      <strong>{inspected.info.courtName} · {inspected.info.time}</strong>
      <p>{inspected.info.name} · SĐT: {inspected.info.phone || '—'}</p>
      <p>Ghi chú: {inspected.info.note || '—'}</p>
      <button type="button" onClick={() => setInspected(null)}>Đóng</button>
    </div>}
    {allowBooking && <div className={styles.summaryBar}>
      <div className={styles.summaryMainText} aria-live="polite">{selected.length} khung giờ đã chọn · {formatVnd(totalPrice)}</div>
      <button type="button" className={styles.continueBookingBtn} disabled={!selected.length} onClick={continueBooking}>Tiếp tục đặt sân</button>
    </div>}
    {(guestPrompt || openPackage) && <F1Dialog title="Đăng nhập để đặt sân" message={loginMessage}
      confirmLabel="Đăng nhập / Đăng ký" onConfirm={goToLogin}
      onClose={() => { setGuestPrompt(false); onClosePackage() }} />}
  </section>
}
