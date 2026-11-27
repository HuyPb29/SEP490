import { Button as UiButton, DatePicker as UiDatePicker } from '../../components/ui';
import { useId, useMemo, useState } from 'react'
import ManagementLayout from '../../components/layout/ManagementLayout'
import ScheduleGrid from '../../components/schedule/ScheduleGrid'
import { usePublicVenue } from '../../hooks/usePublicVenue'
import { useLocationContext } from '../../hooks/useLocation'
import { useVenueSchedule, useVenueSession } from '../../hooks/useVenueSchedule'
import { pickRangeTo } from '../../utils/slotRanges'
import { Modal } from '../WorkspaceLayout'
import WalkInBookingDialog from './WalkInBookingDialog'
import styles from './StaffSchedulePage.module.css'

/**
 * UC13 – Lịch sân của Staff: lịch theo ngày, xem trước tới 12 tháng (D175, FR32); ô đã đặt hiện tên, SĐT và ghi chú
 * cho chủ sân (FR34, FR35). Chọn một hoặc nhiều ô trống liền nhau trên một sân để đặt tại quầy (UC16, D183).
 */

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const money = new Intl.NumberFormat('vi-VN')
const SLOT = 30

const STATUS_TEXT = {
  booked: 'Đã đặt', in_use: 'Đang sử dụng', holding: 'Đang giữ chỗ', maintenance: 'Bảo trì', past: 'Đã qua',
}

function shiftDay(iso, days) {
  const date = new Date(iso + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return dayFormat.format(date)
}

const viDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const timeLabel = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const toMinute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

function dayTitle(iso) {
  const text = new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function BookerDialog({ info, onClose }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} onDismiss={onClose}>
    <div className={styles.booker}>
      <header>
        <h2 id={titleId}>{info.name || 'Khách đã đặt'}</h2>
        {STATUS_TEXT[info.status] && <span className={`${styles.badge} ${styles['badge_' + info.status] || ''}`}>{STATUS_TEXT[info.status]}</span>}
      </header>
      <dl>
        <dt>Sân · giờ</dt><dd>{info.courtName} · {info.time}–{timeLabel(toMinute(info.time) + SLOT)}</dd>
        <dt>Người đặt</dt><dd>{info.name || '—'}</dd>
        <dt>Số điện thoại</dt><dd>{info.phone ? <a href={'tel:' + info.phone}>{info.phone}</a> : '—'}</dd>
      </dl>
      {info.note && <p className={styles.note}><strong>Ghi chú cho chủ sân:</strong> {info.note}</p>}
      <div className={styles.bookerActions}>
        <UiButton variant="secondary" type="button" className={styles.secondary} onClick={onClose}>Đóng</UiButton>
      </div>
    </div>
  </Modal>
}

function PriceTable({ facility }) {
  if (facility.price_error) return <p className={styles.muted}>Chưa tải đủ bảng giá của mọi sân.</p>
  if (facility.price_table.length === 0) return <p className={styles.muted}>Chưa có bảng giá.</p>
  return <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead><tr><th>Sân</th><th>Ngày áp dụng</th><th>Khung giờ</th><th>Hiệu lực</th><th>Đơn giá</th></tr></thead>
      <tbody>{facility.price_table.map((row, index) => <tr key={row.id + ':' + index}>
        <td>{row.court_name}</td><td>{row.days_label}</td><td>{row.time_range}</td>
        <td>{row.valid_from || '—'} đến {row.valid_to || '—'}</td><td>{row.price_label}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

export default function StaffSchedulePage() {
  const { token, user } = useVenueSession()
  const { locationId: ctxLocationId } = useLocationContext()
  const locationId = String(ctxLocationId || user?.facility_id || '')

  const [today] = useState(() => dayFormat.format(new Date()))
  const [requestedDate, setRequestedDate] = useState(today)
  const [revision, setRevision] = useState(0)
  const [inspecting, setInspecting] = useState(null)
  const [range, setRange] = useState(null)
  const [walkIn, setWalkIn] = useState(null)

  const venue = usePublicVenue(locationId, revision)
  const facility = venue?.data
  const { date, maxDate, current } = useVenueSchedule(locationId, requestedDate, today, token, revision)
  const schedule = current?.data
  const reload = () => setRevision((value) => value + 1)

  function goTo(next) {
    if (next >= today && (!maxDate || next <= maxDate)) {
      setRange(null)
      setRequestedDate(next)
    }
  }

  const court = schedule?.courts.find((item) => item.court_id === range?.courtId)
  const slotAt = (target, minute) => target?.slots.find((slot) => slot.time === timeLabel(minute))
  const selected = useMemo(() => (range
    ? Array.from({ length: (range.endMinute - range.startMinute) / SLOT }, (_, i) => ({ courtId: range.courtId, time: timeLabel(range.startMinute + i * SLOT) }))
    : []), [range])
  const rangePrice = range ? selected.reduce((sum, item) => sum + Number(slotAt(court, toMinute(item.time))?.price || 0), 0) : 0

  // Chọn ô trống: bấm ô bắt đầu rồi bấm ô kết thúc cùng sân, hoặc bấm từng ô liền kề; bấm ô đầu/cuối để bớt (D183).
  const pickSlot = (row, slot) => {
    const isFreeAt = (minute) => {
      const cell = slotAt(row, minute)
      return cell?.status === 'available' && cell.price != null
    }
    setRange((current) => pickRangeTo(current, row.court_id, slot.time, isFreeAt))
  }

  return <ManagementLayout
    role="staff"
    title="Lịch sân"
    subtitle="Xem lịch đến 12 tháng tới. Ô đã đặt hiện họ tên, số điện thoại và ghi chú cho chủ sân; chọn ô trống liền nhau để đặt tại quầy."
    actions={<>
      <UiButton variant="secondary" type="button" className={styles.secondary} onClick={reload}>Tải lại</UiButton>
      <UiButton variant="secondary" type="button" className={styles.secondary} disabled={date === today} onClick={() => goTo(today)}>Về hôm nay</UiButton>
    </>}
  >
    {!locationId && <p className={styles.error} role="alert">Tài khoản chưa gắn với địa điểm nào.</p>}

    <section className={styles.panel} aria-label="Lịch sân theo ngày">
      <div className={styles.dateBar}>
        <div className={styles.dayNav}>
          <UiButton variant="secondary" type="button" aria-label="Ngày trước" disabled={date <= today} onClick={() => goTo(shiftDay(date, -1))}>‹</UiButton>
          <strong>{dayTitle(date)}</strong>
          <UiButton variant="secondary" type="button" aria-label="Ngày sau" disabled={!!maxDate && date >= maxDate} onClick={() => goTo(shiftDay(date, 1))}>›</UiButton>
        </div>
        <UiDatePicker className={styles.dateInput} aria-label="Chọn ngày xem lịch" value={date} min={today} max={maxDate || undefined}
          onChange={(event) => event.target.value && goTo(event.target.value)} />
        {maxDate && <span className={styles.muted}>Xem được đến {viDate(maxDate)}</span>}
      </div>

      <div className={styles.gridArea}>
        {!current && <p className={styles.muted} role="status">Đang tải lịch sân…</p>}
        {current?.error && <p className={styles.error} role="alert">{current.error} <UiButton variant="ghost" type="button" className={styles.link} onClick={reload}>Thử lại</UiButton></p>}
        {schedule && (schedule.courts.length === 0
          ? <p className={styles.muted}>Địa điểm chưa có sân hoạt động.</p>
          : <ScheduleGrid schedule={schedule} selected={selected} allowBooking showBooker filters
            role={user?.role_code || 'staff'} onSlot={pickSlot} onInspect={setInspecting} keepNowAtLeft={false} />)}
      </div>

      <div className={`${styles.selectionBar} ${range && court ? '' : styles.idle}`} aria-live="polite">
        {range && court ? <>
          <div>
            <strong>Đã chọn: {court.court_name} · {timeLabel(range.startMinute)}–{timeLabel(range.endMinute)}</strong>
            <span> · {selected.length} slot · {money.format(rangePrice)} đ · {viDate(date)}</span>
          </div>
          <div className={styles.barActions}>
            <UiButton variant="custom" type="button" className={styles.ghostDark} onClick={() => setRange(null)}>Bỏ chọn</UiButton>
            <UiButton variant="primary" type="button" className={styles.primary}
              onClick={() => setWalkIn({ court: range.courtId, date, start: range.startMinute, end: range.endMinute })}>
              Đặt tại quầy ›
            </UiButton>
          </div>
        </> : <span className={styles.hint}>Bấm ô trống để chọn; bấm ô kết thúc cùng sân để chọn nhiều slot liền nhau. Bấm ô đã đặt để xem người đặt.</span>}
      </div>
    </section>

    {facility && <details className={styles.panel}>
      <summary className={styles.summary}>Bảng giá của địa điểm</summary>
      <PriceTable facility={facility} />
    </details>}

    {inspecting && <BookerDialog info={inspecting} onClose={() => setInspecting(null)} />}
    {walkIn && <WalkInBookingDialog initialCourt={walkIn.court} initialDate={walkIn.date}
      initialStart={walkIn.start} initialEnd={walkIn.end}
      onClose={() => { setWalkIn(null); setRange(null); reload() }} onChanged={reload} />}
  </ManagementLayout>
}
