import { useLayoutEffect, useRef, useState } from 'react'
import { isBookable } from '../../utils/venueSchedule'
import { formatSlotTime, formatVnd, today } from '../../utils/formatters'
import { Button, EmptyState, STATUS_CATALOG } from '../common'
import verticalStyles from '../../pages/location/FacilityDetailPage.module.css'
import styles from './ScheduleGrid.module.css'

const statusKeys = { available: 'FREE', holding: 'HOLDING', booked: 'BOOKED', in_use: 'IN_USE', maintenance: 'MAINTENANCE', closed: 'CLOSED', past: 'PAST' }
const label = Object.fromEntries(Object.entries(statusKeys).map(([key, value]) => [key, STATUS_CATALOG.slot[value]?.label || 'Không khả dụng']))
const colors = { available: styles.available, holding: styles.holding, booked: styles.booked, in_use: styles.inUse, maintenance: styles.maintenance, closed: styles.closed, past: styles.closed }
const icons = { available: '○', holding: '◷', booked: '▣', in_use: '▶', maintenance: '⊘', closed: '—', past: '—' }
const markClass = { conflict: styles.markConflict, package: styles.markPackage }
const MARK_LEGEND = { conflict: 'Buổi bị trùng', package: 'Buổi khác của gói' }
const money = new Intl.NumberFormat('vi-VN')
const keyOf = (courtId, time) => `${courtId}|${time}`
const toMinute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const slotEnd = (time) => formatSlotTime(toMinute(time) + 30)
const shortPrice = (price) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Number(price) / 1000)}k`
const LEGEND = ['available', 'selected', 'holding', 'booked', 'in_use', 'maintenance', 'closed']

function hourGroups(headers) {
  const groups = []
  headers.forEach((time) => {
    const hour = time.slice(0, 2)
    const last = groups.at(-1)
    if (last?.hour === hour) last.span++
    else groups.push({ hour, span: 1 })
  })
  return groups
}

function nowColumn(schedule, headers) {
  if ((schedule.play_date ?? schedule.date) !== today() || !headers.length) return { index: -1, afterClose: false }
  const now = new Date()
  const minute = now.getHours() * 60 + now.getMinutes()
  const index = minute < toMinute(headers[0]) ? -1 : headers.findIndex((time) => minute < toMinute(time) + 30)
  return { index, afterClose: index === -1 && minute >= toMinute(headers[0]) }
}

export function ScheduleLegend({ marks = [] }) {
  return <ul className={styles.legend} aria-label="Chú thích trạng thái khung giờ">
    {LEGEND.map((key) => <li key={key}><i aria-hidden="true" className={`${styles.swatch} ${key === 'selected' ? styles.selected : colors[key]}`}>{key === 'selected' ? '✓' : icons[key]}</i>{key === 'selected' ? STATUS_CATALOG.slot.SELECTED.label : key === 'closed' ? `${label.closed} / ${label.past}` : label[key]}</li>)}
    {marks.map((kind) => <li key={kind}><i aria-hidden="true" className={`${styles.swatch} ${markClass[kind]}`}>!</i>{MARK_LEGEND[kind]}</li>)}
  </ul>
}

/** Keep existing showBooker callers compatible; an explicit viewer role always limits personal data. */
export default function ScheduleGrid({ courtsAsColumns = false, role, showBooker, ...props }) {
  const manager = role == null || ['owner', 'staff'].includes(String(role).toLowerCase())
  const shared = { ...props, showBooker: Boolean(showBooker && manager) }
  return courtsAsColumns ? <VerticalScheduleGrid {...shared} /> : <HorizontalScheduleGrid {...shared} />
}

// keepNowAtLeft: thêm khoảng trống cuối bảng để cột "Bây giờ" nằm sát mép trái (mặc định). Hộp thoại đặt tại quầy tắt đi
// để bảng luôn đầy, không có khoảng trắng.
function HorizontalScheduleGrid({ schedule, selected = [], allowBooking, showBooker, onSlot, onInspect, mark, markLegend = [], legend = true, filters = false, conflictSlots = [], keepNowAtLeft = true }) {
  const [period, setPeriod] = useState('all')
  const [onlyFree, setOnlyFree] = useState(false)
  const [courtFilter, setCourtFilter] = useState('all')
  const [mobileCourt, setMobileCourt] = useState(null)
  const [focused, setFocused] = useState(null)
  const wrapperRef = useRef(null)
  const spacerRef = useRef(null)
  const headers = schedule.time_headers.filter((time) => !filters || period === 'all' || (period === 'morning' ? toMinute(time) < 720 : period === 'afternoon' ? toMinute(time) >= 720 && toMinute(time) < 1080 : toMinute(time) >= 1080))
  const courts = schedule.courts.filter((court) => (!filters || courtFilter === 'all' || String(court.court_id) === courtFilter) && (!filters || !onlyFree || court.slots.some((slot) => headers.includes(slot.time) && isBookable(slot))))
  const activeCourt = courts.find((court) => String(court.court_id) === String(mobileCourt)) || courts[0]
  const { index: nowIdx, afterClose } = nowColumn(schedule, headers)
  const selectedKeys = new Set(selected.map((item) => keyOf(item.courtId, item.time)))
  const conflictKeys = new Set(conflictSlots.map((item) => keyOf(item.courtId, item.time)))
  const canFocus = (court, slot) => Boolean(showBooker && slot.bookingInfo) || Boolean(allowBooking && (selectedKeys.has(keyOf(court.court_id, slot.time)) || (isBookable(slot) && !mark?.(court, slot))))
  const focusable = courts.flatMap((court) => court.slots.filter((slot) => headers.includes(slot.time) && canFocus(court, slot)).map((slot) => keyOf(court.court_id, slot.time)))
  const focusKey = focusable.includes(focused) ? focused : focusable[0]
  const mobileFocusable = activeCourt?.slots.filter((slot) => headers.includes(slot.time) && canFocus(activeCourt, slot)).map((slot) => keyOf(activeCourt.court_id, slot.time)) || []
  const mobileFocusKey = mobileFocusable.includes(focused) ? focused : mobileFocusable[0]

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const courtColumn = wrapper?.querySelector('tbody th')
    if (!wrapper || !courtColumn) return
    if (spacerRef.current) spacerRef.current.style.width = '0px'
    if (afterClose && !wrapper.querySelector('[data-focus="pin"]')) { wrapper.scrollLeft = wrapper.scrollWidth; return }
    const target = wrapper.querySelector('[data-focus="pin"]') || wrapper.querySelector('[data-now]') || wrapper.querySelector('tbody td')
    if (!target) return
    const left = Math.max(0, target.getBoundingClientRect().left - wrapper.getBoundingClientRect().left + wrapper.scrollLeft - courtColumn.offsetWidth)
    const room = wrapper.scrollWidth - wrapper.clientWidth
    if (keepNowAtLeft && target.hasAttribute('data-now') && spacerRef.current && left > room) spacerRef.current.style.width = `${left - room}px`
    wrapper.scrollLeft = left
  }, [schedule, afterClose, period, courtFilter, onlyFree, keepNowAtLeft])

  function moveFocus(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const button = event.target.closest('button[data-slot]')
    if (!button) return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button[data-slot]:not(:disabled)')]
    const row = Number(button.dataset.row), col = Number(button.dataset.col)
    let target
    if (event.key === 'Home' || event.key === 'End') {
      const sameRow = buttons.filter((item) => Number(item.dataset.row) === row)
      target = event.key === 'Home' ? sameRow[0] : sameRow.at(-1)
    } else {
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      target = buttons.filter((item) => horizontal ? Number(item.dataset.row) === row && (Number(item.dataset.col) - col) * direction > 0 : Number(item.dataset.col) === col && (Number(item.dataset.row) - row) * direction > 0)
        .sort((a, b) => horizontal ? Math.abs(Number(a.dataset.col) - col) - Math.abs(Number(b.dataset.col) - col) : Math.abs(Number(a.dataset.row) - row) - Math.abs(Number(b.dataset.row) - row))[0]
    }
    target?.focus()
  }

  function slotButton(court, slot, timeIdx, row, col, mobile = false) {
    const key = keyOf(court.court_id, slot.time)
    const info = showBooker ? slot.bookingInfo : null
    const chosen = selectedKeys.has(key)
    const kind = chosen ? null : mark?.(court, slot) || null
    const bookable = allowBooking && isBookable(slot) && !kind
    const status = chosen ? STATUS_CATALOG.slot.SELECTED.label : kind ? MARK_LEGEND[kind] : label[slot.status] || 'Không khả dụng'
    const price = slot.price == null || ['closed', 'past', 'maintenance'].includes(slot.status) ? '' : formatVnd(slot.price)
    const description = [court.court_name, `${slot.time} đến ${slotEnd(slot.time)}`, price, status, info && [info.name, info.phone, info.note].filter(Boolean).join(' · ')].filter(Boolean).join(', ')
    const tone = chosen ? styles.selected : kind ? markClass[kind] : colors[slot.status] || styles.closed
    return <button type="button" title={description} aria-label={description} data-slot data-row={row} data-col={col}
      data-focus={chosen || kind ? 'pin' : isBookable(slot) ? 'free' : undefined}
      tabIndex={key === (mobile ? mobileFocusKey : focusKey) ? 0 : -1}
      className={`${styles.cell} ${tone} ${info ? styles.inspectable : ''} ${conflictKeys.has(key) ? styles.recentConflict : ''}`}
      aria-pressed={bookable || chosen ? chosen : undefined} disabled={!info && !(allowBooking && (bookable || chosen))}
      onFocus={() => setFocused(key)}
      onClick={() => info ? onInspect?.({ ...info, time: slot.time, status: slot.status, courtName: court.court_name }) : onSlot(court, slot, timeIdx)}>
      {mobile && <span className={styles.mobileTime}>{slot.time}–{slotEnd(slot.time)}</span>}
      <span className={styles.slotValue}><span aria-hidden="true">{chosen ? '✓' : kind ? '!' : icons[slot.status] || '—'}</span>{(isBookable(slot) || chosen) && shortPrice(slot.price)}</span>
      <small>{status}</small>
      {info && <><small>{info.name || '—'}</small><small>{info.phone}</small></>}
    </button>
  }

  return <div className={styles.gridShell}>
    {filters && <div className={styles.filters}>
      <div role="group" aria-label="Lọc theo khung giờ" className={styles.filterGroup}>{[['all', 'Cả ngày'], ['morning', 'Sáng'], ['afternoon', 'Chiều'], ['evening', 'Tối']].map(([value, text]) => <Button key={value} size="sm" variant={period === value ? 'primary' : 'ghost'} aria-pressed={period === value} onClick={() => setPeriod(value)}>{text}</Button>)}</div>
      <label className={styles.checkbox}><input type="checkbox" checked={onlyFree} onChange={(event) => setOnlyFree(event.target.checked)} />Chỉ hiện sân còn trống</label>
      <label className={styles.courtFilter}>Lọc sân<select value={courtFilter} onChange={(event) => setCourtFilter(event.target.value)}><option value="all">Tất cả sân</option>{schedule.courts.map((court) => <option key={court.court_id} value={court.court_id}>{court.court_name}</option>)}</select></label>
    </div>}
    {legend && <ScheduleLegend marks={markLegend} />}
    {!courts.length || !headers.length ? <EmptyState title="Không có sân phù hợp bộ lọc" description="Chọn cả ngày hoặc bỏ bộ lọc sân để xem lại lịch." action={<Button variant="secondary" onClick={() => { setPeriod('all'); setOnlyFree(false); setCourtFilter('all') }}>Bỏ bộ lọc</Button>} /> : <>
      <div ref={wrapperRef} className={`${styles.wrapper} ${styles.desktopGrid} ${showBooker ? styles.wide : ''}`} role="region" aria-label="Bảng chọn khung giờ" tabIndex={0}>
        <table className={styles.table} role="grid" aria-label="Lịch sân theo khung 30 phút" onKeyDown={moveFocus}>
          <thead><tr className={styles.hourRow}><th scope="col" rowSpan={2} className={styles.court}>Sân / Giờ</th>{hourGroups(headers).map((group) => <th scope="colgroup" key={group.hour} colSpan={group.span}>{group.hour}:00</th>)}{nowIdx >= 0 && <th rowSpan={2} aria-hidden="true" className={styles.tailSpacer}><div ref={spacerRef} /></th>}</tr>
            <tr className={styles.halfRow}>{headers.map((time, index) => <th scope="col" key={time} data-now={index === nowIdx ? '' : undefined} className={index === nowIdx ? styles.nowHeader : undefined}>{index === nowIdx ? 'Bây giờ' : `:${time.slice(3, 5)}`}</th>)}</tr></thead>
          <tbody>{courts.map((court, row) => <tr key={court.court_id}><th scope="row" className={styles.court}>{court.court_name}</th>{court.slots.map((slot, timeIdx) => headers.includes(slot.time) && <td key={slot.time} className={headers.indexOf(slot.time) === nowIdx ? styles.nowCell : undefined}>{slotButton(court, slot, timeIdx, row, headers.indexOf(slot.time))}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileGrid}>
        <div className={styles.courtTabs} role="group" aria-label="Chọn sân xem lịch">{courts.map((court) => {
          const count = selected.filter((item) => item.courtId === court.court_id).length
          return <Button key={court.court_id} size="sm" variant={court === activeCourt ? 'primary' : 'secondary'} aria-pressed={court === activeCourt} onClick={() => setMobileCourt(court.court_id)}>{court.court_name}{count > 0 && <span className={styles.count} aria-label={`${count} slot đã chọn`}>{count}</span>}</Button>
        })}</div>
        <p className={styles.mobileCaption}>{activeCourt.court_name} · Mỗi ô 30 phút</p>
        <div role="grid" aria-label={`Khung giờ ${activeCourt.court_name}`} className={styles.mobileSlots} onKeyDown={moveFocus}>
          {Array.from({ length: Math.ceil(headers.length / 3) }, (_, row) => <div role="row" className={styles.mobileRow} key={row}>
            {headers.slice(row * 3, row * 3 + 3).map((time, col) => {
              const timeIdx = activeCourt.slots.findIndex((slot) => slot.time === time)
              return timeIdx >= 0 ? <div role="gridcell" key={time}>{slotButton(activeCourt, activeCourt.slots[timeIdx], timeIdx, row, col, true)}</div> : <div role="gridcell" key={time}>—</div>
            })}
          </div>)}
        </div>
      </div>
      <p className={styles.help}>Mỗi ô là 30 phút. Giá trên ô tính bằng nghìn đồng.{allowBooking ? ' Chọn ô trống hoặc dùng phím mũi tên, Enter và Space.' : ' Bấm ô có thông tin để xem chi tiết.'}</p>
    </>}
  </div>
}
const verticalColors = {
  available: verticalStyles.slotAvailable, holding: verticalStyles.slotHolding, booked: verticalStyles.slotBooked,
  in_use: verticalStyles.slotInUse || verticalStyles.slotBooked, maintenance: verticalStyles.slotMaintenance,
  closed: verticalStyles.slotClosed, past: verticalStyles.slotPast,
}

function VerticalScheduleGrid({ schedule, selected = [], allowBooking, showBooker, onSlot, onInspect, initialTime, isOriginalSlot }) {
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

  return <>
    {isOriginalSlot && <ul className={styles.legend} aria-label="Chú thích màu">
      <li><i className={`${styles.swatch} ${styles.originalSlot}`} />Lịch cũ của bạn</li>
    </ul>}
    <div ref={viewportRef} className={`${verticalStyles.tableWrapper} ${verticalStyles.rescheduleGridViewport}`}
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
          const original = isOriginalSlot?.(court, slot)
          const status = chosen ? 'Đã chọn' : label[slot.status] || 'Không khả dụng'
          const slotClass = chosen ? verticalStyles.slotSelected : verticalColors[slot.status]
          const description = [court.court_name, slot.time, original && 'Lịch cũ của bạn', status].filter(Boolean)
          const price = slot.price == null ? '—' : money.format(slot.price) + ' đ'
          return <td key={court.court_id}>
            <button type="button"
              className={`${verticalStyles.slotBtn} ${slotClass || ''} ${original ? (chosen ? styles.selectedOriginalSlot : styles.originalSlot) : ''}`}
              aria-label={[...description, price].join(', ')}
              aria-pressed={bookable ? chosen : undefined} disabled={!bookable && !info}
              onClick={() => info ? onInspect?.({ ...info, time: slot.time, status: slot.status, courtName: court.court_name }) : onSlot(court, slot, index)}>
              <span>{original && !chosen ? 'Lịch cũ' : status}</span><small className="block">{price}</small>
              {info && <small className="block">{info.name} · {info.phone}</small>}
            </button>
          </td>
        })}
      </tr>)}</tbody>
    </table>
    </div>
  </>
}
