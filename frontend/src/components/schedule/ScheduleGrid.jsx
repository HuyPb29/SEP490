import { useLayoutEffect, useRef } from 'react'
import { isBookable } from '../../utils/venueSchedule'
import { today } from '../../utils/formatters'
import verticalStyles from '../../pages/location/FacilityDetailPage.module.css'
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

const toMinute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// Lịch hôm nay: index = cột chứa giờ hiện tại (-1 nếu chưa mở cửa hoặc đã đóng cửa), afterClose = đã qua giờ đóng cửa
function nowColumn(schedule, headers) {
  if ((schedule.play_date ?? schedule.date) !== today() || headers.length === 0) return { index: -1, afterClose: false }
  const now = new Date()
  const minute = now.getHours() * 60 + now.getMinutes()
  const index = minute < toMinute(headers[0]) ? -1 : headers.findIndex((time) => minute < toMinute(time) + 30)
  return { index, afterClose: index === -1 && minute >= toMinute(headers[0]) }
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
export default function ScheduleGrid({ courtsAsColumns = false, ...props }) {
  return courtsAsColumns ? <VerticalScheduleGrid {...props} /> : <HorizontalScheduleGrid {...props} />
}

function HorizontalScheduleGrid({
  schedule, selected = [], allowBooking, showBooker, onSlot, onInspect, mark, markLegend = [], legend = true,
}) {
  const headers = schedule.time_headers
  const wrapperRef = useRef(null)
  const spacerRef = useRef(null)
  const { index: nowIdx, afterClose } = nowColumn(schedule, headers)
  // Mở bảng (hoặc đổi ngày) thì cuộn ngang tới ô đã chọn / được đánh dấu. Không có thì với lịch hôm nay
  // kéo cột "Bây giờ" sát cột tên sân (phần đã qua vẫn kéo sang trái để xem), đã đóng cửa thì về cuối ngày;
  // ngày khác tới ô còn trống đầu tiên.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const spacer = spacerRef.current
    const courtColumn = wrapper?.querySelector('tbody th')
    if (!wrapper || !courtColumn) return
    if (spacer) spacer.style.width = '0px'
    const pin = wrapper.querySelector('[data-focus="pin"]')
    if (!pin && afterClose) {
      wrapper.scrollLeft = wrapper.scrollWidth
      return
    }
    const target = pin || wrapper.querySelector('[data-now]') || wrapper.querySelector('[data-focus="free"]')
    if (!target) return
    const isNow = target.hasAttribute('data-now')
    const offset = target.getBoundingClientRect().left - wrapper.getBoundingClientRect().left + wrapper.scrollLeft
    const left = Math.max(0, offset - courtColumn.offsetWidth - (isNow ? 0 : 8))
    // Cuối ngày còn ít cột thì không đủ chỗ cuộn: thêm khoảng trống sau cột cuối để cột "Bây giờ" vẫn sát trái
    const room = wrapper.scrollWidth - wrapper.clientWidth
    if (isNow && spacer && left > room) spacer.style.width = `${left - room}px`
    wrapper.scrollLeft = left
    // chỉ chạy khi đổi lịch được xem, không chạy lại mỗi lần bấm chọn ô
  }, [schedule, afterClose])
  return <>
    {legend && <ScheduleLegend marks={markLegend} />}
    <div ref={wrapperRef} className={styles.wrapper + (showBooker ? ' ' + styles.wide : '')} role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.hourRow}>
            <th scope="col" rowSpan={2} className={styles.court}>Sân</th>
            {hourGroups(headers).map((group, index) =>
              <th scope="colgroup" key={group.hour + ':' + index} colSpan={group.span}>{Number(group.hour)}h</th>)}
            {nowIdx >= 0 && <th rowSpan={2} aria-hidden="true" className={styles.tailSpacer}><div ref={spacerRef} /></th>}
          </tr>
          <tr className={styles.halfRow}>
            {headers.map((time, index) => index === nowIdx
              ? <th scope="col" key={time} data-now className={styles.nowHeader} title="Giờ hiện tại">Bây giờ</th>
              : <th scope="col" key={time}>:{time.slice(3, 5)}</th>)}
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
            const cellClass = [newHour && styles.hourStart, timeIdx === nowIdx && styles.nowCell].filter(Boolean).join(' ')
            return <td key={slot.time} className={cellClass || undefined}>
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

const verticalColors = {
  available: verticalStyles.slotAvailable, holding: verticalStyles.slotHolding, booked: verticalStyles.slotBooked,
  in_use: verticalStyles.slotInUse || verticalStyles.slotBooked, maintenance: verticalStyles.slotMaintenance,
  closed: verticalStyles.slotClosed, past: verticalStyles.slotPast,
}

function VerticalScheduleGrid({ schedule, selected = [], allowBooking, showBooker, onSlot, onInspect, initialTime }) {
  const viewportRef = useRef(null)
  const initialRowRef = useRef(null)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const row = initialRowRef.current
    if (viewport && row) {
      viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientHeight / 4
    }
  }, [schedule, initialTime])

  const slotsByCourt = schedule.courts.map((court) =>
    new Map(court.slots.map((slot, index) => [slot.time, { slot, index }])))

  return <div ref={viewportRef} className={`${verticalStyles.tableWrapper} ${verticalStyles.rescheduleGridViewport}`}
    role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
    <table className={`${verticalStyles.scheduleTable} ${verticalStyles.scheduleCourtsAsColumns}`}>
      <thead><tr>
        <th scope="col">Giờ</th>
        {schedule.courts.map((court) => <th scope="col" key={court.court_id}>{court.court_name}</th>)}
      </tr></thead>
      <tbody>{schedule.time_headers.map((time) => <tr key={time} ref={time === initialTime ? initialRowRef : null}>
        <th scope="row">{time}</th>
        {schedule.courts.map((court, courtIndex) => {
          const entry = slotsByCourt[courtIndex].get(time)
          if (!entry) return <td key={court.court_id}>—</td>
          const { slot, index } = entry
          const info = showBooker ? slot.bookingInfo : null
          const bookable = allowBooking && isBookable(slot)
          const chosen = selected.some((item) => item.courtId === court.court_id && item.time === slot.time)
          const status = chosen ? 'Đã chọn' : label[slot.status] || 'Không khả dụng'
          const price = slot.price == null ? '—' : money.format(slot.price) + ' đ'
          return <td key={court.court_id}>
            <button type="button"
              className={verticalStyles.slotBtn + ' ' + (chosen ? verticalStyles.slotSelected : verticalColors[slot.status] || '')}
              aria-label={court.court_name + ', ' + slot.time + ', ' + status + ', ' + price}
              aria-pressed={bookable ? chosen : undefined} disabled={!bookable && !info}
              onClick={() => info ? onInspect?.({ ...info, time: slot.time, courtName: court.court_name }) : onSlot(court, slot, index)}>
              <span>{status}</span><small className="block">{price}</small>
              {info && <small className="block">{info.name} · {info.phone}</small>}
            </button>
          </td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
}
