import { useLayoutEffect, useRef } from 'react'
import { isBookable } from '../../utils/venueSchedule'
import styles from './ScheduleGrid.module.css'

// Bảng slot dùng chung (UC13): đặt lẻ, gói nhiều buổi, slot bù, đổi lịch, đặt tại quầy.
// Mỗi hàng một sân, mỗi cột một khung 30 phút; trạng thái thể hiện bằng màu, ô trống ghi giá.
const label = {
  available: 'Trống', holding: 'Đang giữ chỗ', booked: 'Đã đặt', in_use: 'Đang sử dụng',
  maintenance: 'Bảo trì', closed: 'Ngoài giờ', past: 'Đã qua',
}
const short = { holding: 'Giữ', booked: 'Đặt', in_use: 'Đang chơi' }
const colors = {
  available: styles.available, holding: styles.holding, booked: styles.booked, in_use: styles.inUse,
  maintenance: styles.maintenance, closed: styles.closed, past: styles.closed,
}
const markClass = { conflict: styles.markConflict, package: styles.markPackage }
const markText = { conflict: 'Trùng', package: 'Gói' }
const money = new Intl.NumberFormat('vi-VN')

const LEGEND = [
  { key: 'available', text: 'Trống (ghi giá, nghìn đồng)', className: styles.available },
  { key: 'selected', text: 'Đã chọn', className: styles.selected },
  { key: 'holding', text: 'Đang giữ chỗ', className: styles.holding },
  { key: 'booked', text: 'Đã đặt', className: styles.booked },
  { key: 'in_use', text: 'Đang sử dụng', className: styles.inUse },
  { key: 'maintenance', text: 'Bảo trì', className: styles.maintenance },
  { key: 'closed', text: 'Ngoài giờ / đã qua', className: styles.closed },
]
const MARK_LEGEND = { conflict: 'Buổi bị trùng', package: 'Buổi khác của gói' }

function shortPrice(price) {
  const thousands = Number(price) / 1000
  return (Number.isInteger(thousands) ? thousands : thousands.toFixed(1).replace('.', ',')) + 'k'
}

// Gộp các cột cùng giờ thành một ô tiêu đề (ví dụ 19:00 và 19:30 dưới "19h")
function hourGroups(headers) {
  const groups = []
  headers.forEach((time) => {
    const hour = time.slice(0, 2)
    const last = groups[groups.length - 1]
    if (last?.hour === hour) last.span += 1
    else groups.push({ hour, span: 1 })
  })
  return groups
}

export function ScheduleLegend({ marks = [] }) {
  return <ul className={styles.legend} aria-label="Chú thích màu">
    {LEGEND.map((item) => <li key={item.key}><i className={styles.swatch + ' ' + item.className} />{item.text}</li>)}
    {marks.map((kind) => <li key={kind}><i className={styles.swatch + ' ' + markClass[kind]} />{MARK_LEGEND[kind]}</li>)}
  </ul>
}

/**
 * selected: [{ courtId, time }]; onSlot(court, slot, timeIdx) khi bấm ô trống;
 * showBooker: Owner/Staff thấy tên, SĐT người đặt (FR34), bấm ô đã đặt gọi onInspect;
 * mark(court, slot): 'conflict' | 'package' | null — đánh dấu thêm, ô được đánh dấu không chọn được;
 * markLegend: các loại đánh dấu cần thêm vào chú thích.
 */
export default function ScheduleGrid({
  schedule, selected = [], allowBooking, showBooker, onSlot, onInspect, mark, markLegend = [], legend = true,
}) {
  const headers = schedule.time_headers
  const wrapperRef = useRef(null)
  // Mở bảng (hoặc đổi ngày) thì cuộn ngang tới ô đã chọn / được đánh dấu, không có thì tới ô còn trống đầu tiên
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const target = wrapper?.querySelector('[data-focus="pin"]') || wrapper?.querySelector('[data-focus="free"]')
    const courtColumn = wrapper?.querySelector('tbody th')
    if (!target || !courtColumn) return
    const offset = target.getBoundingClientRect().left - wrapper.getBoundingClientRect().left + wrapper.scrollLeft
    wrapper.scrollLeft = Math.max(0, offset - courtColumn.offsetWidth - 8)
    // chỉ chạy khi đổi lịch được xem, không chạy lại mỗi lần bấm chọn ô
  }, [schedule])
  return <>
    {legend && <ScheduleLegend marks={markLegend} />}
    <div ref={wrapperRef} className={styles.wrapper + (showBooker ? ' ' + styles.wide : '')} role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.hourRow}>
            <th scope="col" rowSpan={2} className={styles.court}>Sân</th>
            {hourGroups(headers).map((group, index) =>
              <th scope="colgroup" key={group.hour + ':' + index} colSpan={group.span}>{Number(group.hour)}h</th>)}
          </tr>
          <tr className={styles.halfRow}>
            {headers.map((time) => <th scope="col" key={time}>:{time.slice(3, 5)}</th>)}
          </tr>
        </thead>
        <tbody>{schedule.courts.map((court) => <tr key={court.court_id}>
          <th scope="row" className={styles.court}>{court.court_name}</th>
          {court.slots.map((slot, timeIdx) => {
            const info = showBooker ? slot.bookingInfo : null
            const chosen = selected.some((item) => item.courtId === court.court_id && item.time === slot.time)
            const kind = chosen ? null : mark?.(court, slot) || null
            const bookable = allowBooking && isBookable(slot) && !kind
            const status = chosen ? 'Đã chọn' : kind ? MARK_LEGEND[kind] : label[slot.status] || 'Không khả dụng'
            const price = slot.price == null ? null : money.format(slot.price) + ' đ'
            const tone = chosen ? styles.selected : kind ? markClass[kind] : colors[slot.status] || styles.closed
            const text = chosen ? '✓' : kind ? markText[kind]
              : isBookable(slot) ? shortPrice(slot.price) : short[slot.status] || ''
            const newHour = timeIdx === 0 || headers[timeIdx - 1]?.slice(0, 2) !== slot.time.slice(0, 2)
            const description = [court.court_name, slot.time, status, price,
              info && [info.name, info.phone].filter(Boolean).join(' · ')].filter(Boolean).join(', ')
            const focus = chosen || kind ? 'pin' : isBookable(slot) ? 'free' : undefined
            return <td key={slot.time} className={newHour ? styles.hourStart : undefined}>
              <button type="button" title={description} aria-label={description} data-focus={focus}
                className={styles.cell + ' ' + tone + (info ? ' ' + styles.inspectable : '')}
                aria-pressed={bookable || chosen ? chosen : undefined}
                disabled={!info && !(allowBooking && (bookable || chosen))}
                onClick={() => info ? onInspect?.({ ...info, time: slot.time, courtName: court.court_name })
                  : onSlot(court, slot, timeIdx)}>
                {info ? <><span>{text}</span><small>{info.name || '—'}</small><small>{info.phone}</small></> : text}
              </button>
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </>
}
