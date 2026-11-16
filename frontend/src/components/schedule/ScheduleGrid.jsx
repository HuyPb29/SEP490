import { useEffect, useRef } from 'react'
import { isBookable } from '../../utils/venueSchedule'
import styles from '../../pages/location/FacilityDetailPage.module.css'

const label = {
  available: 'Trống', holding: 'Đang giữ chỗ', booked: 'Đã đặt', in_use: 'Đang sử dụng',
  maintenance: 'Bảo trì', closed: 'Ngoài giờ', past: 'Đã qua',
}
const colors = {
  available: styles.slotAvailable, holding: styles.slotHolding, booked: styles.slotBooked,
  in_use: styles.slotInUse || styles.slotBooked, maintenance: styles.slotMaintenance,
  closed: styles.slotClosed, past: styles.slotPast,
}
const money = new Intl.NumberFormat('vi-VN')

export default function ScheduleGrid({ schedule, selected, allowBooking, showBooker, onSlot, onInspect,
  courtsAsColumns = false, initialTime }) {
  const viewportRef = useRef(null)
  const initialRowRef = useRef(null)
  useEffect(() => {
    const viewport = viewportRef.current
    const row = initialRowRef.current
    if (viewport && row) {
      viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientHeight / 4
    }
  }, [schedule, initialTime])
  const renderSlot = (court, slot, timeIdx) => {
    const info = showBooker ? slot.bookingInfo : null
    const bookable = allowBooking && isBookable(slot)
    const chosen = selected.some((item) => item.courtId === court.court_id && item.time === slot.time)
    const status = chosen ? 'Đã chọn' : label[slot.status] || 'Không khả dụng'
    const price = slot.price == null ? '—' : money.format(slot.price) + ' đ'
    return <button type="button"
      className={styles.slotBtn + ' ' + (chosen ? styles.slotSelected : colors[slot.status] || '')}
      aria-label={court.court_name + ', ' + slot.time + ', ' + status + ', ' + price}
      aria-pressed={bookable ? chosen : undefined} disabled={!bookable && !info}
      onClick={() => info ? onInspect({ ...info, time: slot.time, courtName: court.court_name }) : onSlot(court, slot, timeIdx)}>
      <span>{status}</span><small className="block">{price}</small>
      {info && <small className="block">{info.name} · {info.phone}</small>}
    </button>
  }
  const slotsByCourt = courtsAsColumns && schedule.courts.map((court) =>
    new Map(court.slots.map((slot, index) => [slot.time, { slot, index }]))
  )
  return <div ref={viewportRef} className={`${styles.tableWrapper} ${courtsAsColumns ? styles.rescheduleGridViewport : ''}`}
    role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
    {courtsAsColumns ? <table className={`${styles.scheduleTable} ${styles.scheduleCourtsAsColumns}`}>
      <thead><tr>
        <th scope="col">Giờ</th>
        {schedule.courts.map((court) => <th scope="col" key={court.court_id}>{court.court_name}</th>)}
      </tr></thead>
      <tbody>{schedule.time_headers.map((time) => <tr key={time} ref={time === initialTime ? initialRowRef : null}>
        <th scope="row">{time}</th>
        {schedule.courts.map((court, courtIndex) => {
          const entry = slotsByCourt[courtIndex].get(time)
          return <td key={court.court_id}>{entry ? renderSlot(court, entry.slot, entry.index) : '—'}</td>
        })}
      </tr>)}</tbody>
    </table> : <table className={styles.scheduleTable}>
      <thead><tr><th scope="col" className={styles.courtColHeader}>Sân</th>
        {schedule.time_headers.map((time) => <th scope="col" key={time}>{time}</th>)}
      </tr></thead>
      <tbody>{schedule.courts.map((court) => <tr key={court.court_id}>
        <th scope="row" className={styles.courtNameCell}>{court.court_name}</th>
        {court.slots.map((slot, timeIdx) => <td key={slot.time}>{renderSlot(court, slot, timeIdx)}</td>)}
      </tr>)}</tbody>
    </table>}
  </div>
}
