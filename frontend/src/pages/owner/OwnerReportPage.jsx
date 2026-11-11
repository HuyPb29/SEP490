import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './OwnerReportPage.module.css'

const FACILITIES = [
  { id: 'smash-arena', name: 'Smash Arena' },
  { id: 'green-shuttle-club', name: 'Green Shuttle Club' },
]

const TABS = ['Revenue', 'Bookings', 'Cancellations', 'Reschedules', 'Vouchers', 'Court Utilization']

const FACILITY_REPORTS = {
  'smash-arena': {
    grossRevenue: 152_400_000,
    voucherDeductions: 4_200_000,
    pointDeductions: 1_980_000,
    refunds: 1_920_000,
    confirmedBookings: 1024,
    weeklyRevenue: [38.2, 41.5, 44.9, 19.7],
    courtUtilization: [82, 76, 71, 64, 58, 31],
  },
  'green-shuttle-club': {
    grossRevenue: 128_600_000,
    voucherDeductions: 3_600_000,
    pointDeductions: 1_540_000,
    refunds: 2_100_000,
    confirmedBookings: 876,
    weeklyRevenue: [32.4, 36.1, 39.8, 15.2],
    courtUtilization: [74, 69, 63, 59, 52, 38],
  },
}

function getDayCount(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay))
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay))
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1

  if (!Number.isFinite(dayCount) || dayCount < 1) {
    throw new Error('The end date must be on or after the start date.')
  }

  return dayCount
}

function formatDisplayDate(date) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function loadReportData(facilityId, startDate, endDate) {
  const facilityReport = FACILITY_REPORTS[facilityId]
  if (!facilityReport) throw new Error('The selected location could not be found.')

  const dayCount = getDayCount(startDate, endDate)
  const periodScale = dayCount / 24
  const utilizationScale = 0.9 + periodScale * 0.1

  return {
    grossRevenue: Math.round(facilityReport.grossRevenue * periodScale),
    voucherDeductions: Math.round(facilityReport.voucherDeductions * periodScale),
    pointDeductions: Math.round(facilityReport.pointDeductions * periodScale),
    refunds: Math.round(facilityReport.refunds * periodScale),
    confirmedBookings: Math.round(facilityReport.confirmedBookings * periodScale),
    weeklyRevenue: facilityReport.weeklyRevenue.map((value) =>
      Number((value * periodScale).toFixed(1)),
    ),
    courtUtilization: facilityReport.courtUtilization.map((value) =>
      Math.min(100, Math.round(value * utilizationScale)),
    ),
  }
}

function formatCurrency(value) {
  return `${value.toLocaleString('en-US')} VND`
}

/**
 * embedded=true  → rendered inside OwnerLayout (no sidebar shell)
 * embedded=false → standalone page (legacy /owner/reports route, keeps sidebar)
 */
export default function OwnerReportPage({ embedded = false }) {
  // When embedded, use URL :id to pick the report; fall back to 'smash-arena'
  const { id: urlId } = embedded ? useParams() : { id: undefined }
  const derivedFacilityId = urlId === '2' ? 'green-shuttle-club' : 'smash-arena'

  const [selectedFacilityId, setSelectedFacilityId] = useState(
    embedded ? derivedFacilityId : 'smash-arena',
  )
  const [startDate, setStartDate] = useState('2026-10-01')
  const [endDate, setEndDate] = useState('2026-10-24')
  const [activeTab, setActiveTab] = useState('Revenue')
  const [reportData, setReportData] = useState(() =>
    loadReportData('smash-arena', '2026-10-01', '2026-10-24'),
  )
  const [reportError, setReportError] = useState('')

  const selectedFacility = FACILITIES.find((facility) => facility.id === selectedFacilityId)
  const netRevenue =
    reportData.grossRevenue -
    reportData.voucherDeductions -
    reportData.pointDeductions -
    reportData.refunds

  const updateReport = (facilityId, nextStartDate, nextEndDate) => {
    try {
      const nextReportData = loadReportData(facilityId, nextStartDate, nextEndDate)
      setReportData(nextReportData)
      setReportError('')
    } catch (err) {
      setReportError(err.response?.data?.message || err.message)
    }
  }

  const handleExport = () => {
    try {
      const rows = [
        ['Report', 'Operational & Revenue Reports'],
        ['Location', selectedFacility?.name ?? ''],
        ['Start date', startDate],
        ['End date', endDate],
        ['Tab', activeTab],
        ['Gross Revenue (VND)', reportData.grossRevenue],
        ['Voucher Deductions (VND)', reportData.voucherDeductions],
        ['Points Deductions (VND)', reportData.pointDeductions],
        ['Refunds (VND)', reportData.refunds],
        ['Net Revenue (VND)', netRevenue],
        ['Confirmed Bookings', reportData.confirmedBookings],
        ...reportData.weeklyRevenue.map((revenue, index) => [
          `Week ${index + 1} Net Revenue (million VND)`,
          revenue,
        ]),
        ...reportData.courtUtilization.map((utilization, index) => [
          `Court ${index + 1} Utilization`,
          `${utilization}%`,
        ]),
      ]
      const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
      const file = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(file)
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = 'courtly-owner-report.csv'
      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setReportError(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className={embedded ? styles.embeddedPage : styles.page}>
      {!embedded && (
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandBolt} aria-hidden="true">⚡</span>
          <span>Courtly</span>
        </div>

        <label className={styles.facilityLabel} htmlFor="owner-facility">Location</label>
        <select
          className={styles.facilitySelect}
          id="owner-facility"
          value={selectedFacilityId}
          onChange={(event) => {
            const nextFacilityId = event.target.value
            setSelectedFacilityId(nextFacilityId)
            updateReport(nextFacilityId, startDate, endDate)
          }}
        >
          {FACILITIES.map((facility) => (
            <option key={facility.id} value={facility.id}>{facility.name}</option>
          ))}
        </select>

        <nav className={styles.navigation} aria-label="Owner navigation">
          {[
            'Reports',
            'Courts & Pricing',
            'Opening Hours',
            'Staff',
            'Vouchers & Offers',
            'Complaints',
            'Refunds',
            'Maintenance Approval',
            'Reviews',
            'Location Settings',
          ].map((item) => (
            item === 'Reports' || item === 'Courts & Pricing' ? (
              <Link
                className={`${styles.navItem} ${item === 'Reports' ? styles.navItemActive : ''}`}
                to={item === 'Reports' ? '/owner/reports' : '/owner/courts-pricing'}
                key={item}
                aria-current={item === 'Reports' ? 'page' : undefined}
              >
                {item}
              </Link>
            ) : (
              <a
                className={styles.navItem}
                href="#"
                key={item}
                onClick={(event) => event.preventDefault()}
              >
                {item}
              </a>
            )
          ))}
        </nav>
      </aside>
      )}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1>Operational &amp; Revenue Reports</h1>
            <p>
              {selectedFacility?.name} · {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
            </p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.visuallyHidden} htmlFor="report-start-date">Start date</label>
            <input
              className={styles.dateInput}
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(event) => {
                const nextStartDate = event.target.value
                setStartDate(nextStartDate)
                updateReport(selectedFacilityId, nextStartDate, endDate)
              }}
            />
            <span className={styles.dateSeparator} aria-hidden="true">–</span>
            <label className={styles.visuallyHidden} htmlFor="report-end-date">End date</label>
            <input
              className={styles.dateInput}
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(event) => {
                const nextEndDate = event.target.value
                setEndDate(nextEndDate)
                updateReport(selectedFacilityId, startDate, nextEndDate)
              }}
            />
            <button className={styles.exportButton} type="button" onClick={handleExport}>
              Export Excel
            </button>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Report categories">
          {TABS.map((tab) => (
            <button
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              type="button"
              key={tab}
              aria-current={activeTab === tab ? 'page' : undefined}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {reportError && <p className={styles.errorMessage} role="alert">{reportError}</p>}

        <section className={styles.statsGrid} aria-label="Revenue summary">
          <article className={styles.statCard}>
            <h2>Gross Revenue</h2>
            <p className={styles.statValue}>{formatCurrency(reportData.grossRevenue)}</p>
            <p className={styles.statNote}>
              {reportData.confirmedBookings.toLocaleString('en-US')} confirmed bookings
            </p>
          </article>
          <article className={styles.statCard}>
            <h2>Deductions</h2>
            <p className={styles.statValue}>
              -{formatCurrency(reportData.voucherDeductions + reportData.pointDeductions)}
            </p>
            <p className={styles.statNote}>
              Voucher {(reportData.voucherDeductions / 1_000_000).toLocaleString('en-US')}M
              {' · '}Points {(reportData.pointDeductions / 1_000_000).toLocaleString('en-US')}M
            </p>
          </article>
          <article className={styles.statCard}>
            <h2>Refunds</h2>
            <p className={styles.statValue}>-{formatCurrency(reportData.refunds)}</p>
            <p className={styles.statNote}>9 items, counted by refund date</p>
          </article>
          <article className={styles.statCard}>
            <h2>Net Revenue</h2>
            <p className={styles.statValue}>{formatCurrency(netRevenue)}</p>
            <p className={styles.statNote}>Up 8% vs last month</p>
          </article>
        </section>

        <section className={styles.chartsGrid} aria-label="Revenue and court utilization charts">
          <article className={`${styles.chartCard} ${styles.revenueCard}`}>
            <div className={styles.cardHeader}>
              <h2>Weekly Net Revenue</h2>
              <span>million VND</span>
            </div>
            <div className={styles.barChart} role="img" aria-label="Weekly net revenue in million VND">
              {reportData.weeklyRevenue.map((revenue, index) => (
                <div className={styles.barColumn} key={index}>
                  <span className={styles.barValue}>{revenue.toFixed(1)}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.bar}
                      style={{ height: `${(revenue / 50) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barLabel}>
                    {['W1 (1–7)', 'W2 (8–14)', 'W3 (15–21)', 'W4 (22–24)'][index]}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className={`${styles.chartCard} ${styles.utilizationCard}`}>
            <div className={styles.cardHeader}>
              <h2>Court Utilization Rate</h2>
            </div>
            <div className={styles.utilizationList}>
              {reportData.courtUtilization.map((utilization, index) => (
                <div className={styles.courtRow} key={index}>
                  <div className={styles.courtLabels}>
                    <span>Court {index + 1}</span>
                    <strong>{utilization}%</strong>
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`Court ${index + 1} utilization`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={utilization}
                  >
                    <div className={styles.progressBar} style={{ width: `${utilization}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
