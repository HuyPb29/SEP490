import { Button as UiButton, DatePicker as UiDatePicker } from '../../components/ui';
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import { errorMessage, money, today, useResource } from '../workspaceSupport'
import ManagementLayout from '../../components/layout/ManagementLayout'
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Table,
  Tabs,
  Toast,
} from '../../components/common'
import { shortDate } from '../../utils/formatters'
import styles from './OwnerReportPage.module.css'

const vnd = (value) => money(value).replace(/\s*₫/, 'đ')
const percent = (value) => (Number(value) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'
const count = (value) => Number(value).toLocaleString('vi-VN')
const column = (key, label, format = count, kind = 'count') => ({ key, label, format, kind })
const moneyColumn = (key, label) => column(key, label, vnd, 'money')
const rateColumn = (key, label) => column(key, label, percent, 'rate')
const text = (value) => (value === null || value === undefined || value === '' ? '—' : String(value))
const day = column('date', 'Ngày', shortDate, 'text')
const court = column('courtName', 'Sân', String, 'text')

const reports = [
  {
    // FR117, BR37: doanh thu theo ngày xác nhận trừ khoản hoàn theo ngày hoàn; khoản giảm hiển thị riêng,
    // không tính vào doanh thu; có bảng chi tiết khoản hoàn kèm kỳ thanh toán gốc.
    id: 'revenue', name: 'Doanh thu',
    summary: [moneyColumn('netRevenue', 'Doanh thu thuần'), moneyColumn('totalRevenue', 'Tổng thu'),
      moneyColumn('totalRefunds', 'Đã hoàn tiền'), moneyColumn('voucherDiscount', 'Giảm bằng phiếu ưu đãi'),
      moneyColumn('pointDiscount', 'Giảm bằng điểm'), column('paymentCount', 'Lượt thanh toán'), column('refundCount', 'Lượt hoàn')],
    tables: [['daily', 'Doanh thu theo ngày', [day, moneyColumn('revenue', 'Tổng thu'),
      moneyColumn('refunds', 'Hoàn tiền'), moneyColumn('net', 'Doanh thu thuần')]],
    ['refundDetails', 'Chi tiết khoản hoàn', [column('refundDate', 'Ngày hoàn', shortDate, 'text'), column('bookingCode', 'Mã đặt sân', text, 'text'),
      column('customerName', 'Khách hàng', text, 'text'), moneyColumn('amount', 'Số tiền hoàn'),
      column('originalPaymentDate', 'Kỳ thanh toán gốc', (value) => (value ? shortDate(value) : '—'), 'text'), column('reason', 'Lý do', text, 'text')]]],
  },
  {
    id: 'booking', name: 'Đặt sân',
    summary: [column('totalBookings', 'Tổng lượt đặt sân'), column('validBookings', 'Lượt đặt hợp lệ'),
      column('cancelledBookings', 'Lượt đặt đã hủy'), rateColumn('cancellationRate', 'Tỷ lệ hủy')],
    tables: [['daily', 'Theo ngày', [day, column('total', 'Tổng'), column('valid', 'Hợp lệ')]],
      ['byCourt', 'Theo sân', [court, column('total', 'Tổng'), column('valid', 'Hợp lệ')]]],
  },
  {
    id: 'cancellation', name: 'Hủy và hoàn tiền',
    summary: [column('totalCancelled', 'Tổng lượt đặt bị hủy'), column('cancelledByPlayer', 'Khách hủy'),
      column('cancelledByFacility', 'Sân hủy'), moneyColumn('cancelledAmount', 'Giá trị lượt đặt bị hủy'),
      column('refundRequests', 'Yêu cầu hoàn tiền'), moneyColumn('refundedAmount', 'Đã hoàn')],
    tables: [['daily', 'Theo ngày', [day, column('cancelledByPlayer', 'Khách hủy'), column('cancelledByFacility', 'Sân hủy')]]],
  },
  {
    id: 'reschedule', name: 'Đổi lịch',
    summary: [column('totalRequests', 'Tổng yêu cầu'), column('approved', 'Đã duyệt'),
      column('freeRequests', 'Miễn phí'), column('paidRequests', 'Có phụ thu'), moneyColumn('extraAmount', 'Tiền phụ thu')],
    tables: [['daily', 'Theo ngày', [day, column('requests', 'Yêu cầu'), column('approved', 'Đã duyệt')]]],
  },
  {
    id: 'voucher', name: 'Phiếu ưu đãi',
    summary: [column('usedCount', 'Lượt đã dùng'), column('returnedCount', 'Lượt đã trả lại'), moneyColumn('totalDiscount', 'Tổng tiền giảm')],
    tables: [['vouchers', 'Theo phiếu ưu đãi', [column('name', 'Phiếu ưu đãi', String, 'text'), column('code', 'Mã', String, 'text'),
      column('usedCount', 'Lượt dùng'), column('returnedCount', 'Lượt trả lại'), moneyColumn('totalDiscount', 'Tổng giảm')]]],
  },
  {
    id: 'occupancy', name: 'Tỷ lệ sử dụng sân',
    summary: [rateColumn('occupancyRate', 'Tỷ lệ sử dụng'), column('bookedSlots', 'Khung giờ đã đặt'), column('availableSlots', 'Khung giờ mở')],
    tables: [['daily', 'Theo ngày', [day, column('availableSlots', 'Khung giờ mở'), column('bookedSlots', 'Khung giờ đã đặt'),
      rateColumn('occupancyRate', 'Tỷ lệ sử dụng')]],
    ['byCourt', 'Theo sân', [court, column('availableSlots', 'Khung giờ mở'), column('bookedSlots', 'Khung giờ đã đặt'),
      rateColumn('occupancyRate', 'Tỷ lệ sử dụng')]]],
  },
]

const PRESETS = [['today', 'Hôm nay'], ['7d', '7 ngày'], ['month', 'Tháng này'], ['custom', 'Tùy chọn']]

/** Cộng/trừ ngày trên chuỗi yyyy-mm-dd, tính theo UTC để không lệch múi giờ. */
function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function presetRange(preset) {
  const end = today()
  if (preset === 'today') return { from: end, to: end }
  if (preset === '7d') return { from: addDays(end, -6), to: end }
  return { from: end.slice(0, 8) + '01', to: end }
}

/** Kỳ trước có cùng số ngày, nằm ngay trước kỳ đang xem. */
function previousRange(from, to) {
  const length = daysBetween(from, to) + 1
  return { from: addDays(from, -length), to: addDays(from, -1) }
}

function Delta({ item, current, previous }) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null
  const now = Number(current)
  const before = Number(previous)
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null
  let label
  let direction = Math.sign(now - before)
  if (item.kind === 'rate') {
    const points = (now - before) * 100
    label = `${points > 0 ? '+' : ''}${points.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm %`
  } else if (before === 0) {
    if (now === 0) { label = 'Không đổi'; direction = 0 } else label = 'Mới phát sinh'
  } else {
    const change = ((now - before) / Math.abs(before)) * 100
    label = `${change > 0 ? '+' : ''}${change.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
  }
  const arrow = direction > 0 ? '▲' : direction < 0 ? '▼' : '■'
  return (
    <p className={`${styles.delta} ${direction > 0 ? styles.deltaUp : direction < 0 ? styles.deltaDown : ''}`}>
      <span aria-hidden="true">{arrow}</span> {label} <span className={styles.deltaHint}>so với kỳ trước</span>
    </p>
  )
}

function ReportTable({ title, rows = [], columns }) {
  return (
    <section className={styles.card} aria-label={title}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {!rows.length ? <EmptyState title="Chưa có dữ liệu" description="Thử chọn khoảng ngày dài hơn." /> : (
        <Table>
          <thead>
            <tr>{columns.map((field) => (
              <th key={field.key} scope="col" className={field.kind === 'text' ? undefined : styles.numericHead}>{field.label}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.date ?? row.courtId ?? row.voucherId ?? row.status ?? 'row-' + index}>
                {columns.map((field) => (
                  <td key={field.key} className={field.kind === 'text' ? undefined : styles.numeric}>
                    {row[field.key] == null ? '—' : field.format(row[field.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  )
}

function RevenueChart({ daily }) {
  if (!daily.length) return null
  const maximum = Math.max(1, ...daily.map((item) => Math.abs(Number(item.net))))
  const total = daily.reduce((sum, item) => sum + Number(item.net || 0), 0)
  return (
    <section className={styles.card} aria-labelledby="revenue-chart-title">
      <header className={styles.cardHeader}>
        <h3 id="revenue-chart-title" className={styles.cardTitle}>Doanh thu thuần theo ngày</h3>
        <span className={styles.cardHint}>Tổng {vnd(total)} · đơn vị cột: triệu đồng</span>
      </header>
      <div className={styles.chartScroller}>
        <ol className={styles.barChart} style={{ minWidth: Math.max(320, daily.length * 36) }}
          aria-label="Biểu đồ doanh thu thuần theo ngày">
          {daily.map((item) => {
            const value = Number(item.net)
            return (
              <li className={styles.barColumn} key={item.date} title={`${shortDate(item.date)} · ${vnd(value)}`}>
                <span className={styles.barValue}>
                  {(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                </span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span className={`${styles.bar} ${value < 0 ? styles.barNegative : ''}`}
                    style={{ height: `${(Math.abs(value) / maximum) * 100}%` }} />
                </span>
                <span className={styles.barLabel}>{item.date.slice(8)}/{item.date.slice(5, 7)}</span>
                <span className={styles.srOnly}>{shortDate(item.date)}: {vnd(value)}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function CourtUtilization({ courts }) {
  if (!courts.length) return null
  return (
    <section className={styles.card} aria-labelledby="utilization-title">
      <h3 id="utilization-title" className={styles.cardTitle}>Tỷ lệ sử dụng theo sân</h3>
      <ul className={styles.utilizationList}>
        {courts.map((item) => (
          <li key={item.courtId}>
            <div className={styles.courtLabels}><span>{item.courtName}</span><strong>{percent(item.occupancyRate)}</strong></div>
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressBar} style={{ width: Math.min(100, Number(item.occupancyRate) * 100) + '%' }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReportContent({ report, resource }) {
  const result = resource.data
  if (resource.loading) return <LoadingState message="Đang tải báo cáo…" />
  if (resource.error) return <ErrorState message={resource.error} onRetry={resource.reload} />
  if (!result?.current) return null
  const { current: data, previous } = result
  return (
    <div className={styles.reportBody}>
      <div className={styles.statsGrid}>
        {report.summary.map((item, index) => (
          <article className={`${styles.statCard} ${index === 0 ? styles.statCardLead : ''}`} key={item.key}>
            <h3>{item.label}</h3>
            <p className={styles.statValue}>{data[item.key] == null ? '—' : item.format(data[item.key])}</p>
            <Delta item={item} current={data[item.key]} previous={previous?.[item.key]} />
          </article>
        ))}
      </div>
      {report.id === 'revenue' && <RevenueChart daily={data.daily ?? []} />}
      {report.id === 'occupancy' && <CourtUtilization courts={data.byCourt ?? []} />}
      {report.tables.map(([key, title, columns]) => <ReportTable key={key} title={title} rows={data[key]} columns={columns} />)}
      {data.byStatus && <ReportTable title="Theo trạng thái" rows={Object.entries(data.byStatus).map(([status, total]) => ({ status, total }))}
        columns={[column('status', 'Trạng thái', String, 'text'), column('total', 'Số lượng')]} />}
    </div>
  )
}

export default function OwnerReportPage() {
  const locations = useResource(loadOwnerLocations)
  const [locationId, setLocationId] = useState(() => getSelectedLocation() || '')
  const [preset, setPreset] = useState('month')
  const [endDate, setEndDate] = useState(today)
  const [startDate, setStartDate] = useState(() => today().slice(0, 8) + '01')
  const [active, setActive] = useState('revenue')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportDone, setExportDone] = useState(false)
  const venue = locations.data?.find((item) => String(item.id) === String(locationId))
  const validDates = Boolean(startDate && endDate && startDate <= endDate)
  const enabled = venue?.status === 'ACTIVE' && validDates
  const report = reports.find((item) => item.id === active)

  const load = useCallback(async (signal) => {
    if (!enabled) return null
    const fetchRange = (from, to) => api.get('/owner/' + active + '-reports', {
      signal, params: { from, to }, headers: { 'X-Location-Id': locationId },
    }).then(({ data }) => data.data)
    const previous = previousRange(startDate, endDate)
    // Kỳ trước chỉ để so sánh; lỗi thì vẫn hiện số liệu kỳ này.
    const [current, before] = await Promise.all([
      fetchRange(startDate, endDate),
      fetchRange(previous.from, previous.to).catch(() => null),
    ])
    return { current, previous: before }
  }, [active, enabled, endDate, locationId, startDate])
  const data = useResource(load, [active, locationId, startDate, endDate, enabled].join(':'))

  function choosePreset(value) {
    setPreset(value)
    if (value === 'custom') return
    const range = presetRange(value)
    setStartDate(range.from)
    setEndDate(range.to)
  }

  async function exportReport() {
    setExporting(true)
    setExportError('')
    setExportDone(false)
    try {
      await downloadVenueData({ from: startDate, to: endDate })
      setExportDone(true)
    } catch (error) {
      setExportError(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const changeLocation = (nextId) => {
    selectLocation(nextId)
    setLocationId(nextId)
  }

  return (
    <ManagementLayout
      role="owner"
      title="Báo cáo"
      subtitle={venue ? `${venue.name} · Doanh thu, đặt sân, hủy, đổi lịch, phiếu ưu đãi và tỷ lệ sử dụng sân` : 'Doanh thu, đặt sân, hủy, đổi lịch, phiếu ưu đãi và tỷ lệ sử dụng sân'}
      actions={
        <div className={styles.headerActions}>
          <Link className={styles.linkButton} to="/owner/reconciliations">Xem đối soát</Link>
          <Button variant="secondary" onClick={exportReport} loading={exporting} loadingText="Đang tạo file…"
            disabled={!venue || !validDates}>
            Tải Excel
          </Button>
        </div>
      }
      locations={locations.data}
      locationId={locationId}
      onLocationChange={changeLocation}
    >
      <div className={styles.page}>
        {exportError && <Toast tone="danger" onClose={() => setExportError('')}>{exportError}</Toast>}
        {exportDone && <Toast tone="success" onClose={() => setExportDone(false)}>Đã tải file Excel dữ liệu quản lý.</Toast>}

        <section className={styles.filterBar} aria-label="Khoảng thời gian">
          <div className={styles.segmented} role="group" aria-label="Chọn nhanh khoảng thời gian">
            {PRESETS.map(([value, label]) => (
              <UiButton variant="secondary" key={value} type="button" aria-pressed={preset === value} onClick={() => choosePreset(value)}>
                {label}
              </UiButton>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className={styles.dateFields}>
              <FormField label="Từ ngày">
                <UiDatePicker value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
              </FormField>
              <FormField label="Đến ngày" error={!validDates ? 'Ngày kết thúc phải sau ngày bắt đầu.' : undefined}>
                <UiDatePicker value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
              </FormField>
            </div>
          ) : (
            <p className={styles.rangeText}>
              {startDate === endDate ? shortDate(startDate) : `${shortDate(startDate)} – ${shortDate(endDate)}`}
            </p>
          )}
        </section>

        {locations.loading && <LoadingState message="Đang tải địa điểm…" />}
        {locations.error && <ErrorState message={locations.error} onRetry={locations.reload} />}
        {!locations.loading && !locations.error && !venue && (
          <EmptyState title="Chưa chọn địa điểm" description="Chọn địa điểm ở thanh bên trái để xem báo cáo." />
        )}
        {venue && venue.status !== 'ACTIVE' && (
          <p className={styles.notice} role="status">
            Địa điểm đã khóa nên không xem được báo cáo. Bạn vẫn tải được file Excel dữ liệu quản lý trong thời hạn cho phép.
          </p>
        )}

        {enabled && (
          <Tabs
            label="Loại báo cáo"
            value={active}
            onChange={setActive}
            items={reports.map((item) => ({
              value: item.id,
              label: item.name,
              content: item.id === active ? <ReportContent report={report} resource={data} /> : null,
            }))}
          />
        )}
      </div>
    </ManagementLayout>
  )
}
