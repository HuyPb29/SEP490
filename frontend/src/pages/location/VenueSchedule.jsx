import { DatePicker as UiDatePicker } from '../../components/ui';
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BookingSummaryBar from '../../components/booking/BookingSummaryBar'
import ScheduleGrid from '../../components/schedule/ScheduleGrid'
import SelectedRanges from '../../components/schedule/SelectedRanges'
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, Modal } from '../../components/common'
import { groupRanges } from '../../utils/slotRanges'
import { isBookable } from '../../utils/venueSchedule'
import { useVenueSchedule, useVenueSession } from '../../hooks/useVenueSchedule'
import { formatSlotTime, money, shortDate } from '../../utils/formatters'
import styles from './VenueSchedule.module.css'

const loginMessage = 'Vui lòng đăng nhập hoặc đăng ký để dùng chức năng này.'
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const weekdayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' })
const intentKey = 'venue_booking_intent'
const moneyLabel = (value) => money(value).replace(/\s*₫/, 'đ')
const endTime = (time) => formatSlotTime(Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + 30)

function readIntent(id, date) {
  try {
    const data = JSON.parse(sessionStorage.getItem(intentKey))
    return data?.id === id && data.date === date && Array.isArray(data.slots) ? data.slots : []
  } catch { return [] }
}

function readPending(id) {
  try {
    const data = JSON.parse(sessionStorage.getItem('pending_booking_selection'))
    return data?.source === 'backend' && String(data.facility?.facility_id) === String(id) && Array.isArray(data.selectedSlots) ? data : null
  } catch { return null }
}

export default function VenueSchedule({ id, facility, scheduleRef, openPackage, onClosePackage }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { token, user } = useVenueSession()
  const [today] = useState(() => dayFormat.format(new Date()))
  const [pendingSelection] = useState(() => user?.role_code === 'player' ? readPending(id) : null)
  const initialDate = new URLSearchParams(location.search).get('date') || location.state?.playDate || pendingSelection?.playDate || today
  const [requestedDate, setRequestedDate] = useState(initialDate)
  const [revision, setRevision] = useState(0)
  const { date, maxDate, current } = useVenueSchedule(id, requestedDate, today, token, revision)
  const [selection, setSelection] = useState(() => {
    const intent = user?.role_code === 'player' ? readIntent(id, initialDate) : []
    return { date: initialDate, slots: intent.length ? intent : pendingSelection?.playDate === initialDate ? pendingSelection.selectedSlots : [] }
  })
  const [inspected, setInspected] = useState(null)
  const [guestPrompt, setGuestPrompt] = useState(false)
  const [pendingDate, setPendingDate] = useState(null)
  const [checkedData, setCheckedData] = useState(null)
  const [conflicts, setConflicts] = useState(null)
  const [feedback, setFeedback] = useState('')
  const allowBooking = !user || user.role_code === 'player'
  const isManager = user?.role_code === 'owner' || user?.role_code === 'staff'
  const selected = selection.date === date ? (current?.data?.courts || []).flatMap((court) =>
    court.slots.flatMap((slot, timeIdx) => isBookable(slot) &&
      selection.slots.some((item) => item.courtId === court.court_id && item.time === slot.time)
      ? [{ courtId: court.court_id, courtName: court.court_name, timeIdx, time: slot.time, price: Number(slot.price) }] : [])
  ) : []
  const totalPrice = selected.reduce((total, slot) => total + slot.price, 0)
  const ranges = groupRanges(selected)
  const schedule = current?.data

  // Reconcile only a new external schedule snapshot, before rendering stale selections.
  if (schedule && checkedData !== schedule) {
    setCheckedData(schedule)
    const dropped = selection.date === date ? selection.slots.filter((item) => {
      const court = schedule.courts.find((entry) => entry.court_id === item.courtId)
      const slot = court?.slots.find((entry) => entry.time === item.time)
      return !slot || !isBookable(slot)
    }) : []
    if (dropped.length) {
      setConflicts({ date, slots: dropped.map((item) => ({ ...item, courtName: item.courtName || schedule.courts.find((court) => court.court_id === item.courtId)?.court_name || `Sân ${item.courtId}` })) })
      setSelection({ date, slots: selection.slots.filter((item) => !dropped.includes(item)) })
    }
  }

  function removeRange(range) {
    const dropped = (item) => range.items.some((slot) => slot.courtId === item.courtId && slot.time === item.time)
    setSelection({ date, slots: (selection.date === date ? selection.slots : []).filter((item) => !dropped(item)) })
    setFeedback('Đã bỏ khung giờ khỏi lựa chọn.')
  }

  function applyDate(value) {
    setRequestedDate(value)
    setSelection({ date: value, slots: [] })
    setInspected(null)
    setConflicts(null)
    setPendingDate(null)
    setFeedback('')
  }

  function chooseDate(value) {
    if (value === date) return
    if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today && value <= maxDate) {
      if (selection.date === date && selection.slots.length) setPendingDate(value)
      else applyDate(value)
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
      [...currentSlots, { courtId: court.court_id, courtName: court.court_name, time: slot.time }]
    setSelection({ date, slots })
    setFeedback('')
    if (!user) setGuestPrompt(true)
  }

  function continueBooking() {
    if (!selected.length) return
    if (!user) { setGuestPrompt(true); return }
    if (!allowBooking) return
    sessionStorage.removeItem(intentKey)
    sessionStorage.setItem('pending_booking_selection', JSON.stringify({ facility, playDate: date, selectedSlots: selected, totalPrice, source: 'backend' }))
    navigate('/booking/summary')
  }

  function goToLogin() {
    if (!openPackage) sessionStorage.setItem(intentKey, JSON.stringify({ id, date, slots: selected.map(({ courtId, time }) => ({ courtId, time })) }))
    navigate('/login', { state: { returnTo: openPackage ? '/facilities/' + id + '/package-booking' : '/facilities/' + id + '?date=' + date, notice: loginMessage } })
  }

  const dateTitle = `${weekdayFormat.format(new Date(date + 'T12:00:00Z'))}, ${shortDate(date)}`
  const lostSlots = conflicts?.date === date ? conflicts.slots : []
  const refresh = () => { setRevision((value) => value + 1); setFeedback('') }

  return <section ref={scheduleRef} className={styles.card} aria-labelledby="venue-schedule-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Chọn giờ ra sân</p><h2 id="venue-schedule-title">Lịch sân</h2><p className={styles.subtitle}>Xem cả ngày, chọn giờ trống theo lịch của bạn.</p></div>
      <Button variant="secondary" loading={!current} onClick={refresh}>↻ Làm mới</Button>
    </div>
    <div className={styles.dateToolbar}>
      <div className={styles.dayNav}><span title={date <= today ? 'Không thể chọn ngày đã qua' : 'Xem ngày trước'}><Button variant="secondary" aria-label="Ngày trước" disabled={date <= today || !maxDate} onClick={() => shiftDate(-1)}>‹</Button></span>
        <div className={styles.dateLabel}><strong>{dateTitle}</strong><span>Mỗi ô lịch tương ứng 30 phút</span></div>
        <span title={date >= maxDate ? 'Đã đến giới hạn xem lịch của địa điểm' : 'Xem ngày sau'}><Button variant="secondary" aria-label="Ngày sau" disabled={!maxDate || date >= maxDate} onClick={() => shiftDate(1)}>›</Button></span>
      </div>
      <div className={styles.dateActions}><label htmlFor="venue-play-date"><span id="venue-play-date-label">Chọn ngày</span><UiDatePicker id="venue-play-date" aria-labelledby="venue-play-date-label" min={today} max={maxDate || today} value={date} disabled={!maxDate} onChange={(event) => chooseDate(event.target.value)} aria-describedby="venue-date-limit" /></label><Button variant="ghost" disabled={!maxDate || date === today} onClick={() => chooseDate(today)}>Hôm nay</Button></div>
    </div>
    <p id="venue-date-limit" className={styles.limit}>{maxDate ? `Xem lịch đến ${shortDate(maxDate)}. Giới hạn theo cấu hình địa điểm và vai trò của bạn.` : 'Đang lấy giới hạn xem lịch từ địa điểm…'}</p>
    {maxDate && requestedDate > maxDate && <p role="status" className={styles.notice}>Ngày đã chọn ngoài giới hạn xem lịch. Đang hiển thị lịch hôm nay.</p>}
    {lostSlots.length > 0 && <div role="alert" className={styles.conflictNotice}><strong>Một số khung giờ không còn trống và đã được bỏ chọn:</strong><ul>{lostSlots.map((slot) => <li key={`${slot.courtId}|${slot.time}`}>{slot.courtName} · {slot.time}–{endTime(slot.time)}</li>)}</ul><Button variant="ghost" size="sm" onClick={() => setConflicts(null)}>Đã hiểu</Button></div>}
    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
    {!current && <div className={styles.skeleton}><LoadingState message="Đang tải lịch sân…" /><LoadingState message="Đang cập nhật khung giờ và giá…" /></div>}
    {current?.error && <ErrorState message={current.error} onRetry={refresh} />}
    {schedule && (!schedule.courts.length || !schedule.time_headers.length) && <EmptyState title="Địa điểm không mở cửa ngày này" description="Chọn ngày khác để xem lịch sân hoặc thử làm mới dữ liệu." action={<Button variant="secondary" onClick={refresh}>Làm mới lịch</Button>} />}
    {schedule?.courts.length > 0 && schedule.time_headers.length > 0 && <ScheduleGrid schedule={schedule} selected={selected} filters
      role={user?.role_code || 'guest'} allowBooking={allowBooking} showBooker={isManager} onSlot={toggleSlot}
      conflictSlots={lostSlots} onInspect={(info) => setInspected({ info, token, date })} />}
    {allowBooking && <BookingSummaryBar sticky expandable
      title={!current ? 'Đang cập nhật lựa chọn…' : `Đã chọn ${selected.length} slot · ${ranges.length} booking · Tổng ${moneyLabel(totalPrice)}`}
      hint={selected.length ? undefined : 'Chọn tùy ý các slot trống trên một hoặc nhiều sân trong cùng ngày.'}
      note="Chỗ chỉ được giữ 10 phút sau khi bạn bấm Xác nhận ở bước tóm tắt."
      disabled={!selected.length} onContinue={continueBooking} onClear={() => { setSelection({ date, slots: [] }); setFeedback('Đã xóa các khung giờ đang chọn.') }}>
      {ranges.length > 0 && <SelectedRanges ranges={ranges} onRemove={removeRange} />}
    </BookingSummaryBar>}
    <ConfirmDialog open={Boolean(pendingDate)} title="Bỏ các slot đã chọn?" message={`Chuyển sang ngày ${shortDate(pendingDate)} sẽ bỏ ${selection.slots.length} slot đang chọn. Một đơn chỉ gồm các khung giờ trong cùng ngày.`} confirmText="Bỏ chọn và đổi ngày" onClose={() => setPendingDate(null)} onConfirm={() => applyDate(pendingDate)} />
    <ConfirmDialog open={guestPrompt || Boolean(openPackage)} title="Đăng nhập để đặt sân" message={loginMessage} confirmText="Đăng nhập / Đăng ký" onConfirm={goToLogin} onClose={() => { setGuestPrompt(false); onClosePackage?.() }} />
    {isManager && schedule && inspected?.token === token && inspected.date === date && <Modal title={`${inspected.info.courtName} · ${inspected.info.time}`} onClose={() => setInspected(null)} footer={<Button onClick={() => setInspected(null)}>Đóng</Button>}>
      <dl className={styles.bookerFacts}><div><dt>Người đặt</dt><dd>{inspected.info.name || '—'}</dd></div><div><dt>Số điện thoại</dt><dd>{inspected.info.phone || '—'}</dd></div><div><dt>Ghi chú cho chủ sân</dt><dd>{inspected.info.note || '—'}</dd></div></dl>
    </Modal>}
  </section>
}
