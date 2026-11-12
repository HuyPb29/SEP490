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

export default function ScheduleGrid({ schedule, selected, allowBooking, showBooker, onSlot, onInspect }) {
  return <div className={styles.tableWrapper} role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
    <table className={styles.scheduleTable}>
      <thead><tr><th scope="col" className={styles.courtColHeader}>Sân</th>
        {schedule.time_headers.map((time) => <th scope="col" key={time}>{time}</th>)}
      </tr></thead>
      <tbody>{schedule.courts.map((court) => <tr key={court.court_id}>
        <th scope="row" className={styles.courtNameCell}>{court.court_name}</th>
        {court.slots.map((slot, timeIdx) => {
          const info = showBooker ? slot.bookingInfo : null
          const bookable = allowBooking && isBookable(slot)
          const chosen = selected.some((item) => item.courtId === court.court_id && item.time === slot.time)
          const status = chosen ? 'Đã chọn' : label[slot.status] || 'Không khả dụng'
          const price = slot.price == null ? '—' : money.format(slot.price) + ' đ'
          return <td key={slot.time}><button type="button"
            className={styles.slotBtn + ' ' + (chosen ? styles.slotSelected : colors[slot.status] || '')}
            aria-label={court.court_name + ', ' + slot.time + ', ' + status + ', ' + price}
            aria-pressed={bookable ? chosen : undefined} disabled={!bookable && !info}
            onClick={() => info ? onInspect({ ...info, time: slot.time, courtName: court.court_name }) : onSlot(court, slot, timeIdx)}>
            <span>{status}</span><small className="block">{price}</small>
            {info && <small className="block">{info.name} · {info.phone}</small>}
          </button></td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
}
