import { useState } from 'react'
import styles from './OwnerReportPage.module.css'

const facilities = [
  { id: 'smash-arena', name: 'Smash Arena' },
  { id: 'green-shuttle-club', name: 'Green Shuttle Club' },
]

const tabs = ['Revenue', 'Bookings', 'Cancellations', 'Reschedules', 'Vouchers', 'Court Utilization']
const baseWeeklyRevenue = [38.2, 41.5, 44.9, 19.7]
const baseCourtUtilization = [82, 76, 71, 64, 58, 31]

function createMockReportData(facilityId, startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('Please select both a start date and an end date.')
  }

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Please select valid report dates.')
  }
  if (start > end) {
    throw new Error('The start date must be on or before the end date.')
  }

  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  const facilityFactor = facilityId === 'green-shuttle-club' ? 0.9 : 1
  const periodFactor = (days / 24) * facilityFactor
  const scaleAmount = (amount) => Math.round(amount * periodFactor)
  const grossRevenue = scaleAmount(152400000)
  const voucherDeductions = scaleAmount(4200000)
  const pointDeductions = scaleAmount(1980000)
  const refunds = scaleAmount(1920000)
  const netRevenue = grossRevenue - voucherDeductions - pointDeductions - refunds
  const weeklyRevenue = []
  let dayOffset = 0

  while (dayOffset < days) {
    const weekDays = Math.min(7, days - dayOffset)
    let value = 0

    for (let day = dayOffset; day < dayOffset + weekDays; day += 1) {
      const baseDay = day % 24
      const baseWeekIndex = baseDay < 7 ? 0 : baseDay < 14 ? 1 : baseDay < 21 ? 2 : 3
      const baseWeekDays = baseWeekIndex === 3 ? 3 : 7
      value += baseWeeklyRevenue[baseWeekIndex] / baseWeekDays
    }

    weeklyRevenue.push({
      label: `W${weeklyRevenue.length + 1} (${dayOffset + 1}–${dayOffset + weekDays})`,
      value: Number((value * facilityFactor).toFixed(1)),
    })
    dayOffset += weekDays
  }

  const weeklyTotal = weeklyRevenue.reduce((total, week) => total + week.value, 0)
  const weeklyScale = weeklyTotal === 0 ? 0 : netRevenue / 1000000 / weeklyTotal

  return {
    grossRevenue,
    voucherDeductions,
    pointDeductions,
    refunds,
    confirmedBookings: Math.round(1024 * periodFactor),
    refundCount: Math.round(9 * periodFactor),
    weeklyRevenue: weeklyRevenue.map((week) => ({
      ...week,
      value: Number((week.value * weeklyScale).toFixed(1)),
    })),
    courtUtilization: baseCourtUtilization.map((utilization, index) => ({
      name: `Court ${index + 1}`,
      value:
        facilityId === 'green-shuttle-club'
          ? [75, 80, 68, 71, 55, 43][index]
          : utilization,
    })),
  }
}

function formatDate(date) {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export default function OwnerReportPage() {
  const [selectedFacilityId, setSelectedFacilityId] = useState('smash-arena')
  const [startDate, setStartDate] = useState('2026-10-01')
  const [endDate, setEndDate] = useState('2026-10-24')
  const [activeTab, setActiveTab] = useState('Revenue')
  const [reportData, setReportData] = useState(() =>
    createMockReportData('smash-arena', '2026-10-01', '2026-10-24'),
  )
  const [errorMessage, setErrorMessage] = useState('')

  const selectedFacility = facilities.find((facility) => facility.id === selectedFacilityId)
  const deductions = reportData.voucherDeductions + reportData.pointDeductions
  const netRevenue = reportData.grossRevenue - deductions - reportData.refunds

  const reloadReportData = (facilityId, nextStartDate, nextEndDate) => {
    try {
      const nextReportData = createMockReportData(facilityId, nextStartDate, nextEndDate)
      setReportData(nextReportData)
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Unable to load report data.',
      )
    }
  }

  const handleFacilityChange = (event) => {
    const nextFacilityId = event.target.value
    setSelectedFacilityId(nextFacilityId)
    reloadReportData(nextFacilityId, startDate, endDate)
  }

  const handleDateChange = (field, value) => {
    const nextStartDate = field === 'startDate' ? value : startDate
    const nextEndDate = field === 'endDate' ? value : endDate

    if (field === 'startDate') setStartDate(value)
    else setEndDate(value)

    reloadReportData(selectedFacilityId, nextStartDate, nextEndDate)
  }

  const handleExport = () => {
    let downloadUrl

    try {
      const rows = [
        ['Report', 'Operational & Revenue Reports'],
        ['Facility', selectedFacility?.name ?? ''],
        ['Start date', startDate],
        ['End date', endDate],
        ['Gross Revenue (VND)', reportData.grossRevenue],
        ['Voucher Deductions (VND)', reportData.voucherDeductions],
        ['Points Deductions (VND)', reportData.pointDeductions],
        ['Refunds (VND)', reportData.refunds],
        ['Net Revenue (VND)', netRevenue],
        ['Confirmed Bookings', reportData.confirmedBookings],
        [],
        ['Weekly Net Revenue (million VND)'],
        ...reportData.weeklyRevenue.map((week) => [week.label, week.value]),
        [],
        ['Court', 'Utilization Rate'],
        ...reportData.courtUtilization.map((court) => [court.name, `${court.value}%`]),
      ]
      const csv = rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
            .join(','),
        )
        .join('\r\n')
      const file = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      downloadUrl = window.URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'courtly-owner-report.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      setErrorMessage('')
    } catch (err) {
      if (downloadUrl) window.URL.revokeObjectURL(downloadUrl)
      setErrorMessage(
        err.response?.data?.message || err.message || 'Unable to export the report.',
      )
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">ϟ</span>
          <span>Courtly</span>
        </div>

        <label className={styles.facilityField}>
          <span className={styles.facilityLabel}>Facility</span>
          <select
            className={styles.facilitySelect}
            value={selectedFacilityId}
            onChange={handleFacilityChange}
            aria-label="Select facility"
          >
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>{facility.name}</option>
            ))}
          </select>
        </label>

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
            'Facility Settings',
          ].map((item) => (
            <button
              className={`${styles.navItem} ${item === 'Reports' ? styles.activeNav : ''}`}
              key={item}
              type="button"
              aria-current={item === 'Reports' ? 'page' : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.pageTitle}>Operational &amp; Revenue Reports</h1>
            <p className={styles.subtitle}>
              {selectedFacility?.name} · {formatDate(startDate)} – {formatDate(endDate)}
            </p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.dateField}>
              <span className={styles.visuallyHidden}>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => handleDateChange('startDate', event.target.value)}
              />
            </label>
            <span className={styles.dateSeparator} aria-hidden="true">–</span>
            <label className={styles.dateField}>
              <span className={styles.visuallyHidden}>End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => handleDateChange('endDate', event.target.value)}
              />
            </label>
            <button className={styles.exportButton} type="button" onClick={handleExport}>
              Export Excel
            </button>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Report categories">
          {tabs.map((tab) => (
            <button
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab}
            </button>
          ))}
        </nav>

        {errorMessage && (
          <p className={styles.errorMessage} role="alert">{errorMessage}</p>
        )}

        <section className={styles.statsGrid} aria-label="Revenue statistics">
          <article className={styles.statCard}>
            <h2 className={styles.statLabel}>Gross Revenue</h2>
            <p className={styles.statValue}>{reportData.grossRevenue.toLocaleString('en-US')} VND</p>
            <p className={styles.statNote}>
              {reportData.confirmedBookings.toLocaleString('en-US')} confirmed bookings
            </p>
          </article>
          <article className={styles.statCard}>
            <h2 className={styles.statLabel}>Deductions</h2>
            <p className={styles.statValue}>-{deductions.toLocaleString('en-US')} VND</p>
            <p className={styles.statNote}>
              Voucher {(reportData.voucherDeductions / 1000000).toLocaleString('en-US')}M · Points{' '}
              {(reportData.pointDeductions / 1000000).toLocaleString('en-US')}M
            </p>
          </article>
          <article className={styles.statCard}>
            <h2 className={styles.statLabel}>Refunds</h2>
            <p className={styles.statValue}>-{reportData.refunds.toLocaleString('en-US')} VND</p>
            <p className={styles.statNote}>
              {reportData.refundCount.toLocaleString('en-US')} items, counted by refund date
            </p>
          </article>
          <article className={styles.statCard}>
            <h2 className={styles.statLabel}>Net Revenue</h2>
            <p className={styles.statValue}>{netRevenue.toLocaleString('en-US')} VND</p>
            <p className={styles.statNote}>Up 8% vs last month</p>
          </article>
        </section>

        <section className={styles.chartsGrid} aria-label="Revenue and utilization charts">
          <article className={`${styles.chartCard} ${styles.revenueCard}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Weekly Net Revenue</h2>
              <span className={styles.chartUnit}>million VND</span>
            </div>
            <div className={styles.revenueChart}>
              {reportData.weeklyRevenue.map((week) => {
                const barHeight = Math.min((week.value / 50) * 100, 100)
                return (
                  <div className={styles.weekColumn} key={week.label}>
                    <div className={styles.barTrack} style={{ '--bar-height': `${barHeight}%` }}>
                      <span className={styles.barValue}>{week.value.toFixed(1)}</span>
                      <div className={styles.chartBar} style={{ height: `${barHeight}%` }} />
                    </div>
                    <span className={styles.weekLabel}>{week.label}</span>
                  </div>
                )
              })}
            </div>
          </article>

          <article className={`${styles.chartCard} ${styles.utilizationCard}`}>
            <h2 className={styles.cardTitle}>Court Utilization Rate</h2>
            <div className={styles.courtList}>
              {reportData.courtUtilization.map((court) => (
                <div className={styles.courtItem} key={court.name}>
                  <div className={styles.courtInfo}>
                    <span className={styles.courtName}>{court.name}</span>
                    <strong className={styles.courtPercentage}>{court.value}%</strong>
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`${court.name} utilization`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={court.value}
                  >
                    <div className={styles.progressBar} style={{ width: `${court.value}%` }} />
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
