import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import WalkInBookingDialog from './WalkInBookingDialog'
import ReconciliationDialog from './ReconciliationDialog'
import styles from './StaffDashboardPage.module.css'

const initialTransactions = [
  {
    id: 'BK-24087',
    customer: 'Le Hoang',
    court: 'Court 2',
    time: '19:00 – 20:00',
    amount: 160000,
    waiting: '17 mins',
    overdue: true,
  },
  {
    id: 'BK-24095',
    customer: 'Ngoc Mai',
    court: 'Court 5',
    time: '19:00 – 21:00',
    amount: 320000,
    waiting: '6 mins',
    overdue: false,
  },
  {
    id: 'BK-24102',
    customer: 'Minh Anh',
    court: 'Court 2',
    time: '19:00 – 20:00 (25/10)',
    amount: 80000,
    waiting: '1 min',
    overdue: false,
  },
]

const courts = [
  { name: 'Court 1', status: 'In use', detail: 'until 20:00', type: 'inUse' },
  { name: 'Court 2', status: 'Available', detail: 'booking 19:00', type: 'available' },
  { name: 'Court 3', status: 'In use', detail: 'until 19:00', type: 'inUse' },
  { name: 'Court 4', status: 'In use', detail: 'until 21:00', type: 'inUse' },
  { name: 'Court 5', status: 'Awaiting player', detail: 'holding 19:00', type: 'awaiting' },
  { name: 'Court 6', status: 'Maintenance', detail: 'all day', type: 'maintenance' },
  { name: 'Court 7', status: 'In use', detail: 'until 19:30', type: 'inUse' },
  { name: 'Court 8', status: 'In use', detail: 'until 20:30', type: 'inUse' },
]

const initialStats = {
  courtsInUse: 5,
  totalCourts: 8,
  bookingsToday: 42,
  bookingsRemaining: 18,
  awaitingConfirmation: 3,
  overdueTransactions: 1,
  confirmedToday: 6240000,
}

export default function StaffDashboardPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [showReconciliation, setShowReconciliation] = useState(() => new URLSearchParams(search).get('modal') === 'reconciliation')
  const [transactions] = useState(initialTransactions)
  const [stats] = useState(initialStats)
  const [banners] = useState({ urgent: true, courtEnding: true })
  const [showCounterBooking, setShowCounterBooking] = useState(false)

  const openCounterBooking = () => setShowCounterBooking(true)

  const openPaymentConfirmation = (bookingId) => {
    navigate(`/staff/confirm-payments${bookingId ? `?booking=${encodeURIComponent(bookingId)}` : ''}`)
  }

  const statCards = [
    {
      label: 'Courts in Use',
      value: `${stats.courtsInUse}/${stats.totalCourts}`,
      note: `${stats.totalCourts - stats.courtsInUse} courts available now`,
    },
    {
      label: 'Bookings Today',
      value: stats.bookingsToday.toLocaleString(),
      note: `${stats.bookingsRemaining} bookings remaining`,
    },
    {
      label: 'Awaiting Confirmation',
      value: stats.awaitingConfirmation.toLocaleString(),
      note: `${stats.overdueTransactions} transaction${stats.overdueTransactions === 1 ? '' : 's'} over 15 mins`,
    },
    {
      label: 'Confirmed Today',
      value: `${stats.confirmedToday.toLocaleString()} VND`,
      note: 'Before reconciliation',
    },
  ]

  return (
    <div className={styles.dashboard}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">ϟ</span>
          <span>Courtly</span>
        </div>

        <div className={styles.facility}>
          <span className={styles.facilityLabel}>Staff at</span>
          <strong>Smash Arena</strong>
        </div>

        <nav className={styles.navigation} aria-label="Staff navigation">
          <button className={`${styles.navItem} ${styles.activeNav}`} type="button" onClick={() => navigate('/staff/dashboard')}>Dashboard</button>
          <button className={styles.navItem} type="button">Court Schedule</button>
          <button className={styles.navItem} type="button" onClick={() => openCounterBooking()}>
            Counter Booking
          </button>
          <button
            className={styles.navItem}
            type="button"
            onClick={() => openPaymentConfirmation(transactions[0]?.id)}
          >
            <span>Confirm Payments</span>
            <span className={styles.paymentBadge}>{stats.awaitingConfirmation}</span>
          </button>
          <button className={styles.navItem} type="button" onClick={() => setShowReconciliation(true)}>Đối soát cuối ngày</button>
          <button className={styles.navItem} type="button">Maintenance Requests</button>
          <button className={styles.navItem} type="button" onClick={() => navigate('/staff/complaints')}>Khiếu nại</button>
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.dateText}>Saturday, 24/10/2026 · 18:52</p>
          </div>
          <button className={styles.primaryButton} type="button" onClick={() => openCounterBooking()}>
            + Counter Booking
          </button>
        </header>

        <section className={styles.alerts} aria-label="Alerts">
          {banners.urgent && (
            <div className={styles.urgentBanner} role="alert">
              <span>Urgent: transaction BK-24087 has been awaiting confirmation for 17 mins</span>
              <button
                className={styles.handleButton}
                type="button"
                onClick={() => openPaymentConfirmation('BK-24087')}
              >
                Handle now
              </button>
            </div>
          )}
          {banners.courtEnding && (
            <div className={styles.warningBanner} role="status">
              Court 3 ends at 19:00 (5 mins left)
            </div>
          )}
        </section>

        <section className={styles.statsGrid} aria-label="Daily statistics">
          {statCards.map((card) => (
            <article className={styles.statCard} key={card.label}>
              <h2 className={styles.statLabel}>{card.label}</h2>
              <p className={styles.statValue}>{card.value}</p>
              <p className={styles.statNote}>{card.note}</p>
            </article>
          ))}
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Court Status</h2>
            <div className={styles.courtGrid}>
              {courts.map((court) => (
                court.type === 'available' ? (
                  <button
                    className={`${styles.courtTile} ${styles[court.type]}`}
                    key={court.name}
                    type="button"
                    onClick={() => openCounterBooking()}
                  >
                    <strong>{court.name}</strong>
                    <span>{court.status}</span>
                    <small>{court.detail}</small>
                  </button>
                ) : (
                  <div className={`${styles.courtTile} ${styles[court.type]}`} key={court.name}>
                    <strong>{court.name}</strong>
                    <span>{court.status}</span>
                    <small>{court.detail}</small>
                  </div>
                )
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Awaiting Payment Confirmation</h2>
              <button
                className={styles.viewAllButton}
                type="button"
                onClick={() => openPaymentConfirmation(transactions[0]?.id)}
              >
                View all
              </button>
            </div>
            <div className={styles.transactionList}>
              {transactions.map((transaction) => (
                <button
                  className={styles.transactionRow}
                  key={transaction.id}
                  type="button"
                  onClick={() => openPaymentConfirmation(transaction.id)}
                >
                  <span className={styles.transactionDetails}>
                    <strong>{transaction.id} · {transaction.customer}</strong>
                    <small>{transaction.court} · {transaction.time}</small>
                  </span>
                  <span className={styles.transactionAmount}>
                    <strong>{transaction.amount.toLocaleString()} VND</strong>
                    <small className={transaction.overdue ? styles.overdueText : ''}>
                      Waiting {transaction.waiting}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>
      </main>

      {showReconciliation && <ReconciliationDialog onClose={() => setShowReconciliation(false)} />}

      {showCounterBooking && (
        <WalkInBookingDialog onClose={() => setShowCounterBooking(false)} />
      )}
    </div>
  )
}
