import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api'
import { mapSchedule } from '../../api/facilityApi'
import { fieldError, normalizeName, validName, validPhone } from '../../api/f1Rules'
import { F1Dialog, F1Toast } from '../../components/F1Feedback'
import ScheduleGrid from '../../components/schedule/ScheduleGrid'
import { pickRange } from '../../utils/slotRanges'
import styles from './StaffDashboardPage.module.css'

const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
const expiredMessage = "Đã hết thời gian giữ chỗ. khung giờ đã được nhả. (MSG33)"
const timeLabel = (minute) =>
  String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')
const isFree = (slot) => slot.status === 'AVAILABLE' && slot.price != null

function loadSchedule(venue, date, signal) {
  return api.get('/locations/' + venue + '/schedules', {
    params: { date }, signal, skipAuth: true,
  }).then(({ data }) => data.data)
}

function secondsLeft(expiresAt) {
  if (!expiresAt) return 0
  const timestamp = /(?:Z|[+-]\d\d:\d\d)$/.test(expiresAt) ? expiresAt : expiresAt + '+07:00'
  return Math.max(0, Math.ceil((Date.parse(timestamp) - Date.now()) / 1000)) || 0
}

export default function WalkInBookingDialog({ initialCourt, onClose, onChanged }) {
  const [today] = useState(() => dateFormat.format(new Date()))
  const [date, setDate] = useState(today)
  const [court, setCourt] = useState(initialCourt ? String(initialCourt) : '')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [maxDate, setMaxDate] = useState(today)
  const [loadError, setLoadError] = useState('')
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [booking, setBooking] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      try {
        const { data } = await api.get('/staff/dashboards/me', { signal })
        const venue = data.data.locationId
        if (!venue) throw new Error('Bạn chưa được phân công địa điểm.')
        const base = await loadSchedule(venue, today, signal)
        const latest = base.maxDate || today
        if (signal.aborted) return
        setMaxDate(latest)
        if (!date || date < today || date > latest) {
          setLoadError('Ngày chơi nằm ngoài giới hạn đặt trước.')
          return
        }
        const result = date === today ? base : await loadSchedule(venue, date, signal)
        if (signal.aborted) return
        setSchedule(result)
        setCourt((current) => result.courts.some(({ courtId }) => String(courtId) === current)
          ? current
          : String(result.courts[0]?.courtId ?? ''))
      } catch (cause) {
        if (!signal.aborted) setLoadError(apiErrorMessage(cause, 'Không tải được lịch sân.'))
      }
    }
    load()
    return () => controller.abort()
  }, [today, date, revision])

  useEffect(() => {
    if (booking?.status !== 'HOLDING') return undefined
    const timer = setInterval(() => setRemaining(secondsLeft(booking.holdExpiresAt)), 1000)
    return () => clearInterval(timer)
  }, [booking])

  const courts = schedule?.date === date ? schedule.courts : null
  const slots = courts?.find(({ courtId }) => String(courtId) === court)?.slots || []
  const starts = slots.filter(isFree).map(({ startMinute }) => startMinute)
  const ends = []
  if (start !== '') {
    const free = new Set(starts)
    for (let minute = Number(start); free.has(minute); minute += 30) ends.push(minute + 30)
  }

  // Bảng slot cả địa điểm trong ngày; booking tại quầy là một dải liền nhau trên một sân (BR43)
  const gridSchedule = courts ? mapSchedule(schedule) : null
  const range = court && start !== '' && end !== ''
    ? { courtId: Number(court), startMinute: Number(start), endMinute: Number(end) } : null
  const gridSelected = range ? Array.from({ length: (range.endMinute - range.startMinute) / 30 }, (_, index) =>
    ({ courtId: range.courtId, time: timeLabel(range.startMinute + index * 30) })) : []
  const rangePrice = range ? slots.filter(({ startMinute }) => startMinute >= range.startMinute && startMinute < range.endMinute)
    .reduce((total, slot) => total + Number(slot.price || 0), 0) : 0
  const courtName = gridSchedule?.courts.find((item) => String(item.court_id) === court)?.court_name

  const pickSlot = (row, slot) => {
    const next = pickRange(range, row.court_id, slot.time)
    setFields((current) => ({ ...current, courtId: undefined, startMinute: undefined, endMinute: undefined }))
    setCourt(String(row.court_id))
    setStart(next ? String(next.startMinute) : '')
    setEnd(next ? String(next.endMinute) : '')
  }

  const clearSlots = () => {
    setStart('')
    setEnd('')
  }
  const reload = () => {
    setSchedule(null)
    setLoadError('')
    clearSlots()
    setRevision((value) => value + 1)
  }

  const create = async (event) => {
    event.preventDefault()
    if (busy || booking) return
    setError('')
    const next = {
      customerName: fieldError(name, 'tên khách hàng', validName),
      customerPhone: fieldError(phone, 'số điện thoại khách', validPhone),
      courtId: !court ? 'Vui lòng chọn sân.' : undefined,
      date: !date || date < today || date > maxDate ? 'Vui lòng chọn ngày trong giới hạn đặt trước.' : undefined,
      startMinute: start === '' || !starts.includes(Number(start)) ? 'Vui lòng bấm chọn khung giờ còn trống trên bảng.' : undefined,
      endMinute: start !== '' && (end === '' || !ends.includes(Number(end))) ? 'Khung giờ đã chọn không còn trống liên tục.' : undefined,
    }
    setFields(next)
    if (Object.values(next).some(Boolean)) return
    setBusy(true)
    try {
      const { data } = await api.post('/staff/bookings', {
        courtId: Number(court), date, startMinute: Number(start), endMinute: Number(end),
        customerName: normalizeName(name), customerPhone: phone.trim(),
      })
      setBooking(data.data)
      setRemaining(secondsLeft(data.data.holdExpiresAt))
      onChanged?.()
    } catch (cause) {
      const message = apiErrorMessage(cause, 'Không thể giữ chỗ tại quầy.')
      if (cause.response?.data?.errors) {
        const { validSlot, ...validation } = cause.response.data.errors
        setFields({ ...validation, endMinute: validation.endMinute || validSlot })
      } else if (message.includes('MSG28') || cause.response?.status === 409) {
        setFields({ startMinute: message })
        reload()
      } else if (message.includes('MSG31')) {
        setFields({ date: message })
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setConfirming(false)
    if (busy || booking?.status !== 'HOLDING') return
    if (!secondsLeft(booking.holdExpiresAt)) {
      setRemaining(0)
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/staff/bookings/' + booking.id + '/confirm')
      setBooking(data.data)
      onChanged?.()
    } catch (cause) {
      const message = apiErrorMessage(cause, 'Không thể xác nhận đã nhận tiền.')
      if (message.includes('MSG33')) setBooking((current) => ({ ...current, status: 'EXPIRED' }))
      else {
        setError(message)
        if (message.includes('MSG54')) {
          setBooking((current) => ({ ...current, status: 'PROCESSED' }))
          onChanged?.()
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const fieldMessage = (key) => fields[key] && <span className={styles.errorMessage} role="alert">{fields[key]}</span>

  return (
    <div className={styles.modalOverlay}>
      <section className={styles.modal + ' ' + styles.modalWide} role="dialog" aria-modal="true" aria-labelledby="walk-in-title">
        <h2 id="walk-in-title" className={styles.modalTitle}>Đặt sân tại quầy</h2>
        {booking ? (
          <div className={styles.bookingForm}>
            <p role="status">Đơn {booking.bookingCode} · {money.format(booking.finalAmount)}</p>
            {booking.status === 'CONFIRMED' && <p role="status">Đã xác nhận thanh toán. Biên nhận {booking.receiptNo}</p>}
            {booking.status === 'HOLDING' && remaining > 0 && (
              <p>Đang giữ chỗ · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
            )}
            {(booking.status === 'EXPIRED' || (booking.status === 'HOLDING' && remaining === 0)) && (
              <p className={styles.errorMessage} role="alert">{expiredMessage}</p>
            )}
            {error && <p className={styles.errorMessage} role="alert">{error}</p>}
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={busy}>Đóng</button>
              {booking.status === 'HOLDING' && remaining > 0 && (
                <button className={styles.primaryButton} type="button" onClick={() => setConfirming(true)} disabled={busy}>
                  {busy ? 'Đang xác nhận…' : 'Xác nhận đã nhận tiền'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form className={styles.bookingForm} onSubmit={create} noValidate>
            <label className={styles.formField}>
              Tên khách hàng
              <input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />
              {fieldMessage('customerName')}
            </label>
            <label className={styles.formField}>
              Số điện thoại
              <input required type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              {fieldMessage('customerPhone')}
            </label>
            <label className={styles.formField}>
              Ngày chơi
              <input required type="date" min={today} max={maxDate} value={date} onChange={(event) => {
                setSchedule(null)
                setLoadError('')
                clearSlots()
                setDate(event.target.value)
              }} />
              {fieldMessage('date')}
            </label>
            {!courts && !loadError && <p role="status">Đang tải lịch sân…</p>}
            {loadError && <p role="alert">{loadError} <button type="button" onClick={reload}>Tải lại</button></p>}
            {courts?.length === 0 && <p role="status">Địa điểm chưa có sân đang hoạt động.</p>}
            {gridSchedule?.time_headers.length === 0 && <p role="status">Ngày này địa điểm không mở cửa.</p>}
            {gridSchedule?.time_headers.length > 0 && (
              <div className={styles.formField}>
                <span>Khung giờ · bấm ô trống để chọn, bấm ô liền kề cùng sân để kéo dài</span>
                <ScheduleGrid schedule={gridSchedule} selected={gridSelected} allowBooking={!busy} onSlot={pickSlot} />
                <span aria-live="polite">
                  {range
                    ? <>Đã chọn <strong>{courtName} · {timeLabel(range.startMinute)}–{timeLabel(range.endMinute)}</strong> · {money.format(rangePrice)}</>
                    : 'Chưa chọn khung giờ.'}
                </span>
                {fieldMessage('courtId')}
                {fieldMessage('startMinute')}
                {fieldMessage('endMinute')}
              </div>
            )}
            {error && <p className={styles.errorMessage} role="alert">{error}</p>}
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={busy}>Đóng</button>
              <button className={styles.primaryButton} type="submit" disabled={busy || !courts?.length}>
                {busy ? 'Đang giữ chỗ…' : 'Giữ chỗ 10 phút'}
              </button>
            </div>
          </form>
        )}
      </section>
      {booking?.status === 'HOLDING' && remaining > 0 && (
        <F1Toast>Đã giữ chỗ tại quầy trong 10 phút. (MSG45)</F1Toast>
      )}
      {booking?.status === 'CONFIRMED' && (
        <F1Toast>Đã xác nhận thanh toán. (MSG46)</F1Toast>
      )}
      {confirming && (
        <F1Dialog
          title="Xác nhận đã nhận tiền"
          message={'Xác nhận đã nhận đủ ' + money.format(booking.finalAmount) + ' cho đơn ' + booking.bookingCode + '?'}
          onClose={() => setConfirming(false)}
          onConfirm={confirm}
        />
      )}
    </div>
  )
}
