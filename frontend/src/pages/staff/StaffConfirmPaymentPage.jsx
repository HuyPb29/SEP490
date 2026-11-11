import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './StaffConfirmPaymentPage.module.css'

const initialTransactions = [
  {
    id: 'BK-24087',
    customer: 'Le Hoang',
    court: 'Court 2',
    playDate: '24/10',
    playTime: '19:00 – 20:00',
    listTime: '19:00',
    phone: '0903 111 222',
    transferContent: 'BK24087 0903111222',
    amountDue: 160000,
    actualAmount: 160000,
    waiting: '17 mins',
    overdue: true,
    attempt: 1,
    resubmissionsLeft: 2,
    note: 'Please prepare 1 extra tube of shuttlecocks.',
  },
  {
    id: 'BK-24095',
    customer: 'Ngoc Mai',
    court: 'Court 5',
    playDate: '24/10',
    playTime: '19:00 – 21:00',
    listTime: '19:00',
    phone: '0908 222 333',
    transferContent: 'BK24095 0908222333',
    amountDue: 320000,
    actualAmount: 320000,
    waiting: '6 mins',
    overdue: false,
    attempt: 1,
    resubmissionsLeft: 2,
    note: '',
  },
  {
    id: 'BK-24102',
    customer: 'Minh Anh',
    court: 'Court 2',
    playDate: '25/10',
    playTime: '19:00 – 20:00',
    listTime: '25/10',
    phone: '0912 333 444',
    transferContent: 'BK24102 0912333444',
    amountDue: 80000,
    actualAmount: 80000,
    waiting: '1 min',
    overdue: false,
    attempt: 1,
    resubmissionsLeft: 2,
    note: '',
  },
]

const reasons = [
  'Money not yet received in bank account',
  'Blurry or unreadable receipt image',
  'Incorrect transfer amount or content',
]

function getInitialBookingId(search) {
  const requestedId = new URLSearchParams(search).get('booking')
  return initialTransactions.some((transaction) => transaction.id === requestedId)
    ? requestedId
    : initialTransactions[0].id
}

export default function StaffConfirmPaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState(initialTransactions)
  const [selectedBookingId, setSelectedBookingId] = useState(() => getInitialBookingId(location.search))
  const [actualAmount, setActualAmount] = useState(() => {
    const bookingId = getInitialBookingId(location.search)
    return String(initialTransactions.find((transaction) => transaction.id === bookingId)?.actualAmount ?? '')
  })
  const [reason, setReason] = useState(reasons[0])
  const [processedBookings, setProcessedBookings] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isProofOpen, setIsProofOpen] = useState(false)

  const selectedBooking = transactions.find((transaction) => transaction.id === selectedBookingId) ?? null

  const selectBooking = (transaction) => {
    setSelectedBookingId(transaction.id)
    setActualAmount(String(transaction.actualAmount))
    setMessage('')
    setErrorMessage('')
  }

  const removeSelectedBooking = (status, successMessage, resubmissionsLeft, metadata = {}) => {
    if (!selectedBooking) return
    const remaining = transactions.filter((transaction) => transaction.id !== selectedBooking.id)
    setProcessedBookings((current) => ({
      ...current,
      [selectedBooking.id]: { status, ...metadata, ...(resubmissionsLeft == null ? {} : { resubmissionsLeft }) },
    }))
    setTransactions(remaining)
    const nextBooking = remaining[0] ?? null
    setSelectedBookingId(nextBooking?.id ?? null)
    setActualAmount(nextBooking ? String(nextBooking.actualAmount) : '')
    setMessage(successMessage)
  }

  const confirmPayment = async () => {
    try {
      if (!selectedBooking) return
      const amountReceived = Number(actualAmount)
      if (!Number.isFinite(amountReceived) || amountReceived < 0) {
        throw new Error('Enter a valid amount received.')
      }

      const confirmed = window.confirm(
        `Confirm that you have received ${amountReceived.toLocaleString()} VND for booking ${selectedBooking.id}?`,
      )
      if (!confirmed) return

      setIsProcessing(true)
      setErrorMessage('')
      const receivedNote = amountReceived > selectedBooking.amountDue
        ? ` Customer transferred ${(amountReceived - selectedBooking.amountDue).toLocaleString()} VND extra; only ${selectedBooking.amountDue.toLocaleString()} VND was recorded.`
        : ''
      removeSelectedBooking(
        'payment_confirmed',
        `Payment confirmed for ${selectedBooking.id}.${receivedNote}`,
        null,
        { revenue: selectedBooking.amountDue, amountReceived },
      )
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const requestResubmission = async () => {
    try {
      if (!selectedBooking) return
      setIsProcessing(true)
      setErrorMessage('')
      const resubmissionsLeft = reason === reasons[0]
        ? selectedBooking.resubmissionsLeft
        : Math.max(0, selectedBooking.resubmissionsLeft - 1)

      if (resubmissionsLeft === 0) {
        removeSelectedBooking(
          'payment_rejected',
          `MSG52: ${selectedBooking.id} has no resubmissions left. Payment was rejected.`,
          resubmissionsLeft,
        )
      } else {
        removeSelectedBooking(
          'resubmit_requested',
          `MSG50: Resubmission requested for ${selectedBooking.id}.`,
          resubmissionsLeft,
        )
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const rejectPayment = async () => {
    try {
      if (!selectedBooking) return
      setIsProcessing(true)
      setErrorMessage('')
      removeSelectedBooking(
        'payment_rejected',
        `MSG51: ${selectedBooking.id} was rejected. The slot was released and points/voucher were refunded.`,
        selectedBooking.resubmissionsLeft,
      )
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">ϟ</span>
          <span>Courtly</span>
        </div>
        <div className={styles.facility}>
          <span>Staff at</span>
          <strong>Smash Arena</strong>
        </div>
        <nav className={styles.navigation} aria-label="Staff navigation">
          <button className={styles.navItem} type="button" onClick={() => navigate('/staff/dashboard')}>Dashboard</button>
          <button className={styles.navItem} type="button">Court Schedule</button>
          <button className={styles.navItem} type="button">Counter Booking</button>
          <button
            className={`${styles.navItem} ${styles.activeNav}`}
            type="button"
            onClick={() => navigate('/staff/confirm-payments')}
          >
            Confirm Payments
          </button>
          <button className={styles.navItem} type="button">Daily Reconciliation</button>
          <button className={styles.navItem} type="button">Maintenance Requests</button>
          <button className={styles.navItem} type="button">Complaints</button>
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Confirm Payments</h1>
        {message && <p className={styles.actionMessage} role="status">{message}</p>}
        <div className={styles.workspace}>
          <section className={styles.bookingList} aria-label="Bookings awaiting confirmation">
            {transactions.map((transaction) => (
              <button
                className={`${styles.bookingItem} ${selectedBookingId === transaction.id ? styles.bookingSelected : ''}`}
                key={transaction.id}
                type="button"
                onClick={() => selectBooking(transaction)}
              >
                <span className={styles.bookingTopline}>
                  <strong>{transaction.id}</strong>
                  <strong>{transaction.amountDue.toLocaleString()} VND</strong>
                </span>
                <span className={styles.bookingMeta}>
                  {transaction.customer} · {transaction.court}, {transaction.listTime}
                </span>
                <span className={transaction.overdue ? styles.overdue : styles.waiting}>
                  Waiting {transaction.waiting}{transaction.overdue ? ' · overdue' : ''}
                </span>
              </button>
            ))}
            {transactions.length === 0 && (
              <div className={styles.emptyList}>No payments awaiting confirmation.</div>
            )}
          </section>

          {selectedBooking && (
            <section className={styles.detailCard} aria-label="Selected payment details">
              <header className={styles.detailHeader}>
                <h2>{selectedBooking.id} · {selectedBooking.customer}</h2>
                <span className={styles.statusBadge}>
                  Awaiting confirmation · attempt {selectedBooking.attempt}/3
                </span>
              </header>

              <div className={styles.detailBody}>
                <button
                  className={styles.proofPreview}
                  type="button"
                  onClick={() => setIsProofOpen(true)}
                  aria-label="Open payment proof"
                >
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <rect x="4" y="5" width="24" height="22" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="m6 24 7-7 4 4 4-5 5 7" />
                  </svg>
                  <strong>Payment Proof</strong>
                  <small>Click to zoom</small>
                </button>

                <div className={styles.paymentInfo}>
                  <dl className={styles.infoList}>
                    <div><dt>Court</dt><dd>{selectedBooking.court}</dd></div>
                    <div>
                      <dt>Play Time</dt>
                      <dd>{selectedBooking.playDate} · {selectedBooking.playTime}</dd>
                    </div>
                    <div><dt>Phone Number</dt><dd>{selectedBooking.phone}</dd></div>
                    <div><dt>Transfer Content</dt><dd>{selectedBooking.transferContent}</dd></div>
                    <div>
                      <dt>Amount Due</dt>
                      <dd>{selectedBooking.amountDue.toLocaleString()} VND</dd>
                    </div>
                  </dl>

                  {selectedBooking.note && (
                    <p className={styles.ownerNote}>
                      <strong>Note to location owner:</strong> {selectedBooking.note}
                    </p>
                  )}

                  <label className={styles.amountLabel} htmlFor="actual-amount">
                    Actual amount received (if customer overpaid)
                  </label>
                  <input
                    className={styles.amountInput}
                    id="actual-amount"
                    type="text"
                    inputMode="numeric"
                    value={actualAmount === '' || !Number.isFinite(Number(actualAmount))
                      ? ''
                      : Number(actualAmount).toLocaleString()}
                    onChange={(event) => setActualAmount(event.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <section className={styles.reasonBox}>
                <label htmlFor="payment-reason">Reason (when requesting resubmission or rejecting)</label>
                <select id="payment-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
                  {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <p>
                  Customer has {processedBookings[selectedBooking.id]?.resubmissionsLeft ?? selectedBooking.resubmissionsLeft} resubmissions left,
                  {' '}deadline until end of play time ({selectedBooking.playTime.split('–')[1]?.trim().split(' ')[0]}).
                </p>
              </section>

              {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}

              <div className={styles.actions}>
                <button className={styles.rejectButton} type="button" disabled={isProcessing} onClick={rejectPayment}>
                  Reject
                </button>
                <button className={styles.resubmitButton} type="button" disabled={isProcessing} onClick={requestResubmission}>
                  Request Resubmission
                </button>
                <button className={styles.confirmButton} type="button" disabled={isProcessing} onClick={confirmPayment}>
                  Confirm Payment Received
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {isProofOpen && selectedBooking && (
        <div
          className={styles.proofOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsProofOpen(false)
          }}
        >
          <section className={styles.proofModal} role="dialog" aria-modal="true" aria-label="Payment proof">
            <button className={styles.closeProof} type="button" onClick={() => setIsProofOpen(false)}>Close</button>
            <div className={styles.proofLarge}>
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <rect x="4" y="5" width="24" height="22" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="m6 24 7-7 4 4 4-5 5 7" />
              </svg>
              <strong>Payment Proof · {selectedBooking.id}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
