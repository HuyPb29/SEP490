import { useCallback, useState } from 'react'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import { errorMessage, money, today, useResource } from '../workspaceSupport'
import ManagementLayout from '../../components/layout/ManagementLayout'
import styles from './OwnerReportPage.module.css'

const percent = (value) => (Number(value) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%'
const count = (value) => Number(value).toLocaleString('vi-VN')
const column = (key, label, format = count) => ({ key, label, format })
const day = column('date', 'Ngày', String)
const court = column('courtName', 'Sân', String)

const reports = [
  {
    id: 'revenue', name: 'Doanh thu',
    summary: [column('totalRevenue', 'Tổng thu', money), column('totalRefunds', 'Tiền đã hoàn', money),
      column('netRevenue', 'Doanh thu ròng', money), column('paymentCount', 'Lượt thanh toán'), column('refundCount', 'Lượt hoàn')],
    tables: [['daily', 'Theo ngày', [day, column('revenue', 'Tổng thu', money),
      column('refunds', 'Hoàn tiền', money), column('net', 'Doanh thu ròng', money)]]],
  },
  {
    id: 'booking', name: 'Đặt sân',
    summary: [column('totalBookings', 'Tổng booking'), column('validBookings', 'Booking hợp lệ'),
      column('cancelledBookings', 'Booking đã hủy'), column('cancellationRate', 'Tỷ lệ hủy', percent)],
    tables: [['daily', 'Theo ngày', [day, column('total', 'Tổng'), column('valid', 'Hợp lệ')]],
      ['byCourt', 'Theo sân', [court, column('total', 'Tổng'), column('valid', 'Hợp lệ')]]],
  },
  {
    id: 'cancellation', name: 'Hủy và hoàn tiền',
    summary: [column('totalCancelled', 'Tổng booking hủy'), column('cancelledByPlayer', 'Player hủy'),
      column('cancelledByFacility', 'Địa điểm hủy'), column('cancelledAmount', 'Giá trị booking hủy', money),
      column('refundRequests', 'Yêu cầu hoàn tiền'), column('refundedAmount', 'Đã hoàn', money)],
    tables: [['daily', 'Theo ngày', [day, column('cancelledByPlayer', 'Player hủy'), column('cancelledByFacility', 'Địa điểm hủy')]]],
  },
  {
    id: 'reschedule', name: 'Đổi lịch',
    summary: [column('totalRequests', 'Tổng yêu cầu'), column('approved', 'Đã duyệt'),
      column('freeRequests', 'Miễn phí'), column('paidRequests', 'Có phụ thu'), column('extraAmount', 'Phụ thu', money)],
    tables: [['daily', 'Theo ngày', [day, column('requests', 'Yêu cầu'), column('approved', 'Đã duyệt')]]],
  },
  {
    id: 'voucher', name: 'Voucher',
    summary: [column('usedCount', 'Lượt đã dùng'), column('returnedCount', 'Lượt đã trả'), column('totalDiscount', 'Tổng giảm', money)],
    tables: [['vouchers', 'Theo voucher', [column('name', 'Voucher', String), column('code', 'Mã', String),
      column('usedCount', 'Lượt dùng'), column('returnedCount', 'Lượt trả'), column('totalDiscount', 'Tổng giảm', money)]]],
  },
  {
    id: 'occupancy', name: 'Lấp đầy sân',
    summary: [column('availableSlots', 'Slot mở'), column('bookedSlots', 'Slot đã đặt'), column('occupancyRate', 'Tỷ lệ lấp đầy', percent)],
    tables: [['daily', 'Theo ngày', [day, column('availableSlots', 'Slot mở'), column('bookedSlots', 'Slot đã đặt'),
      column('occupancyRate', 'Tỷ lệ lấp đầy', percent)]],
    ['byCourt', 'Theo sân', [court, column('availableSlots', 'Slot mở'), column('bookedSlots', 'Slot đã đặt'),
      column('occupancyRate', 'Tỷ lệ lấp đầy', percent)]]],
  },
]

function ReportTable({ title, rows = [], columns }) {
  return <section className={styles.chartCard}>
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    {!rows.length ? <p>Chưa có dữ liệu trong khoảng ngày đã chọn.</p> : <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead><tr>{columns.map((field) => <th key={field.key} className="px-3 py-2" scope="col">{field.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr className="border-t border-slate-200" key={row.date ?? row.courtId ?? row.voucherId ?? row.status}>
          {columns.map((field) => <td key={field.key} className="px-3 py-2">
            {row[field.key] == null ? '—' : field.format(row[field.key])}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}

function RevenueChart({ daily }) {
  const recent = daily.slice(-7)
  if (!recent.length) return null
  const maximum = Math.max(1, ...recent.map((item) => Math.abs(Number(item.net))))
  return <section className={styles.chartCard}>
    <header className={styles.cardHeader}><h2>Doanh thu ròng · {recent.length} ngày cuối kỳ</h2><span>Triệu đồng</span></header>
    <div className="overflow-x-auto">
      <div className={`${styles.barChart} min-w-[360px]`}>
        {recent.map((item) => <div className={styles.barColumn} key={item.date} title={item.date + ' · ' + money(item.net)}>
          <span className={styles.barValue}>{(Number(item.net) / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</span>
          <div className={styles.barTrack} aria-hidden="true">
            <div className={styles.bar} style={{ height: Math.abs(Number(item.net)) / maximum * 100 + '%',
              backgroundColor: Number(item.net) < 0 ? '#b91c1c' : undefined }} />
          </div>
          <span className={styles.barLabel}>{item.date.slice(8) + '/' + item.date.slice(5, 7)}</span>
        </div>)}
      </div>
    </div>
  </section>
}

function CourtUtilization({ courts }) {
  if (!courts.length) return null
  return <section className={`${styles.chartCard} ${styles.utilizationCard}`}>
    <header className={styles.cardHeader}><h2>Tỷ lệ lấp đầy theo sân</h2></header>
    <ul className={styles.utilizationList}>{courts.map((item) => <li key={item.courtId}>
      <div className={styles.courtLabels}><span>{item.courtName}</span><strong>{percent(item.occupancyRate)}</strong></div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressBar} style={{ width: Math.min(100, Number(item.occupancyRate) * 100) + '%' }} />
      </div>
    </li>)}</ul>
  </section>
}

function ReportContent({ report, resource }) {
  const data = resource.data
  if (resource.loading) return <p role="status">Đang tải báo cáo…</p>
  if (resource.error) return <p role="alert" className={styles.errorMessage}>{resource.error} <button onClick={resource.reload}>Thử lại</button></p>
  if (!data) return null
  return <div className="space-y-5">
    <div className={styles.statsGrid}>{report.summary.map((item) => <article className={styles.statCard} key={item.key}>
      <h2>{item.label}</h2>
      <p className={styles.statValue}>{item.format(data[item.key])}</p>
    </article>)}</div>
    {report.id === 'revenue' && <RevenueChart daily={data.daily ?? []} />}
    {report.id === 'occupancy' && <CourtUtilization courts={data.byCourt ?? []} />}
    {report.tables.map(([key, title, columns]) => <ReportTable key={key} title={title} rows={data[key]} columns={columns} />)}
    {data.byStatus && <ReportTable title="Theo trạng thái" rows={Object.entries(data.byStatus).map(([status, total]) => ({ status, total }))}
      columns={[column('status', 'Trạng thái', String), column('total', 'Số lượng')]} />}
  </div>
}

export default function OwnerReportPage() {
  const locations = useResource(loadOwnerLocations)
  const [locationId, setLocationId] = useState(() => getSelectedLocation() || '')
  const [endDate, setEndDate] = useState(today)
  const [startDate, setStartDate] = useState(() => today().slice(0, 8) + '01')
  const [active, setActive] = useState('revenue')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const venue = locations.data?.find((item) => String(item.id) === locationId)
  const validDates = Boolean(startDate && endDate && startDate <= endDate)
  const enabled = venue?.status === 'ACTIVE' && validDates
  const report = reports.find((item) => item.id === active)
  const load = useCallback(async (signal) => {
    if (!enabled) return null
    const { data } = await api.get('/owner/' + active + '-reports', {
      signal, params: { from: startDate, to: endDate }, headers: { 'X-Location-Id': locationId },
    })
    return data.data
  }, [active, enabled, endDate, locationId, startDate])
  const data = useResource(load, [active, locationId, startDate, endDate, enabled].join(':'))

  async function exportReport() {
    setExporting(true)
    setExportError('')
    try {
      await downloadVenueData({ from: startDate, to: endDate })
    } catch (error) {
      setExportError(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <ManagementLayout
      role="owner"
      title="Báo cáo vận hành và doanh thu"
      subtitle="Thống kê doanh thu, tỷ lệ lấp đầy, hủy sân và xuất dữ liệu Excel (UC35)"
      actions={
        <div className={styles.headerActions}>
          <label className={styles.facilityLabel}>Địa điểm
            <select className={styles.facilitySelect} value={locationId} onChange={(event) => {
              selectLocation(event.target.value)
              setLocationId(event.target.value)
            }}>
              <option value="">Chọn địa điểm</option>
              {locations.data?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}
            </select>
          </label>
          <label>Từ ngày <input type="date" className={styles.dateInput} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>Đến ngày <input type="date" className={styles.dateInput} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <button className={styles.exportButton} type="button" disabled={!venue || !validDates || exporting} onClick={exportReport}>
            {exporting ? 'Đang tải…' : 'Tải Excel'}
          </button>
        </div>
      }
      locations={locations.data}
      locationId={locationId}
      onLocationChange={(nextId) => {
        selectLocation(nextId)
        setLocationId(nextId)
      }}
    >
      {locations.loading && <p role="status">Đang tải địa điểm…</p>}
      {locations.error && <p role="alert">{locations.error}</p>}
      {exportError && <p role="alert" className={styles.errorMessage}>{exportError}</p>}
      {!validDates && <p role="alert" className={styles.errorMessage}>Chọn khoảng ngày hợp lệ.</p>}
      {venue && venue.status !== 'ACTIVE' && <p>Địa điểm đã khóa. Có thể tải dữ liệu trong thời hạn được phép.</p>}
      {enabled && <>
        <nav className={styles.tabs} aria-label="Loại báo cáo">
          {reports.map((item) => <button type="button" className={`${styles.tab} ${item.id === active ? styles.tabActive : ''}`}
            key={item.id} aria-pressed={item.id === active} onClick={() => setActive(item.id)}>{item.name}</button>)}
        </nav>
        <ReportContent report={report} resource={data} />
      </>}
    </ManagementLayout>
  )
}
