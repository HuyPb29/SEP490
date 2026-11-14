import { useId, useState } from 'react'
import ScheduleGrid from '../../components/schedule/ScheduleGrid'
import { usePublicVenue } from '../../hooks/usePublicVenue'
import { useLocationContext } from '../../hooks/useLocation'
import { useVenueSchedule, useVenueSession } from '../../hooks/useVenueSchedule'
import WorkspaceLayout, { Feedback, Modal, Section } from '../WorkspaceLayout'
import styles from '../location/FacilityDetailPage.module.css'

/**
 * UC13 – Xem lịch sân, màn của Staff: hình sân và thông tin địa điểm → bảng giá → lịch theo ngày.
 * Staff chỉ xem, không đặt ở đây (đặt tại quầy nằm ở bảng điều hành, UC16).
 * Staff thấy tên và SĐT người đặt trên slot đã có booking, xem trước tới 3 tháng (D110, D140, FR32, FR34).
 */

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })

function shiftDay(iso, days) {
  const date = new Date(iso + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return dayFormat.format(date)
}

const legend = [
  ['slotAvailable', 'Trống'], ['slotHolding', 'Đang giữ chỗ'], ['slotBooked', 'Đã đặt'],
  ['slotInUse', 'Đang sử dụng'], ['slotMaintenance', 'Bảo trì'], ['slotClosed', 'Ngoài giờ / đã qua'],
]

function CourtPicture({ facility }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20, alignItems: 'center' }}>
    <div className={styles.courtVisualCard} aria-hidden="true">
      <svg viewBox="0 0 400 200" className={styles.courtSvg}>
        <rect x="20" y="15" width="360" height="170" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
        <line x1="200" y1="15" x2="200" y2="185" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
        <line x1="65" y1="15" x2="65" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="335" y1="15" x2="335" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="145" y1="15" x2="145" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="255" y1="15" x2="255" y2="185" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="20" y1="100" x2="380" y2="100" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </svg>
    </div>
    <div style={{ display: 'grid', gap: 6 }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 750 }}>{facility.facility_name}</h3>
      <p>Địa chỉ: {facility.address}</p>
      <p>{facility.courts_count} sân hoạt động · Liên hệ: {facility.contact_phone || 'Chưa cập nhật'}</p>
      <p className="cw-muted">Giờ mở cửa: {facility.open_hours}</p>
    </div>
  </div>
}

function PriceTable({ facility }) {
  if (facility.price_error) return <Feedback tone="error">Chưa tải đủ bảng giá của mọi sân.</Feedback>
  if (facility.price_table.length === 0) return <p>Chưa có bảng giá.</p>
  return <div className="overflow-auto">
    <table className={styles.priceTable}>
      <thead><tr><th>Sân</th><th>Ngày áp dụng</th><th>Khung giờ</th><th>Hiệu lực</th><th>Đơn giá</th></tr></thead>
      <tbody>{facility.price_table.map((row, index) => <tr key={row.id + ':' + index}>
        <td>{row.court_name}</td><td>{row.days_label}</td><td>{row.time_range}</td>
        <td>{row.valid_from || '—'} đến {row.valid_to || '—'}</td><td>{row.price_label}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

function BookerDialog({ info, onClose }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} onDismiss={onClose}>
    <div className="cw-modal-content">
      <h2 id={titleId}>{info.courtName} · {info.time}</h2>
      <p>Người đặt: <strong>{info.name || '—'}</strong></p>
      <p>Số điện thoại: <strong>{info.phone || '—'}</strong></p>
      {info.note && <p>Ghi chú cho chủ sân: {info.note}</p>}
      <div className="cw-modal-actions"><button type="button" className="action" onClick={onClose}>Đóng</button></div>
    </div>
  </Modal>
}

export default function StaffSchedulePage() {
  const { token, user } = useVenueSession()
  const { locationId: ctxLocationId } = useLocationContext()
  const locationId = String(ctxLocationId || user?.facility_id || '')

  const [today] = useState(() => dayFormat.format(new Date()))
  const [requestedDate, setRequestedDate] = useState(today)
  const [revision, setRevision] = useState(0)
  const [inspecting, setInspecting] = useState(null)

  const venue = usePublicVenue(locationId, revision)
  const facility = venue?.data
  const { date, maxDate, current } = useVenueSchedule(locationId, requestedDate, today, token, revision)
  const schedule = current?.data

  const venueResource = { loading: !venue, error: venue?.error, reload: () => setRevision((value) => value + 1) }
  const scheduleResource = { loading: !current, error: current?.error, reload: venueResource.reload }

  function goTo(next) {
    if (next >= today && (!maxDate || next <= maxDate)) setRequestedDate(next)
  }

  return <WorkspaceLayout role="staff" title="Lịch sân">
    {!locationId && <Feedback tone="error">Tài khoản chưa gắn với địa điểm nào.</Feedback>}

    <Section title="Sân của địa điểm" resource={venueResource}>
      {facility && <CourtPicture facility={facility} />}
    </Section>

    <Section title="Bảng giá" resource={venueResource}>
      {facility && <PriceTable facility={facility} />}
    </Section>

    <Section title="Lịch sân" resource={scheduleResource}
      actions={<button type="button" className="cw-secondary" onClick={venueResource.reload}>Tải lại</button>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
        <button type="button" className="cw-secondary" style={{ minHeight: 44 }} disabled={date <= today}
          onClick={() => goTo(shiftDay(date, -1))}>‹ Ngày trước</button>
        <label className="cw-field">
          <span>Ngày</span>
          <input type="date" value={date} min={today} max={maxDate || undefined}
            onChange={(event) => event.target.value && goTo(event.target.value)} />
        </label>
        <button type="button" className="cw-secondary" style={{ minHeight: 44 }} disabled={!!maxDate && date >= maxDate}
          onClick={() => goTo(shiftDay(date, 1))}>Ngày sau ›</button>
        <button type="button" className="cw-secondary" style={{ minHeight: 44 }} disabled={date === today}
          onClick={() => setRequestedDate(today)}>Hôm nay</button>
      </div>
      {maxDate && <p className="cw-muted">Xem được đến ngày {maxDate}. Bấm vào ô đã đặt để xem người đặt và số điện thoại.</p>}
      <div className={styles.legendRow}>
        {legend.map(([className, text]) => <span key={className} className={styles.legendItem}>
          <span className={styles.legendBox + ' ' + (styles[className] || '')} />{text}
        </span>)}
      </div>
      {schedule && (schedule.courts.length === 0
        ? <p>Địa điểm chưa có sân hoạt động.</p>
        : <ScheduleGrid schedule={schedule} selected={[]} allowBooking={false} showBooker
          onSlot={() => {}} onInspect={setInspecting} />)}
    </Section>

    {inspecting && <BookerDialog info={inspecting} onClose={() => setInspecting(null)} />}
  </WorkspaceLayout>
}
