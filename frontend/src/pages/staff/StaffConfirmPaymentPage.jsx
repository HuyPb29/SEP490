import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  confirmPaymentApi,
  listPendingPaymentsApi,
  rejectPaymentApi,
  requestResubmissionApi,
} from '../../api/bookingApi'
import { apiErrorMessage, fetchProtectedImage } from '../../api'
import styles from './StaffConfirmPaymentPage.module.css'

// Lý do đầu tiên là lỗi phía sân (tiền về chậm) nên không trừ lượt gửi lại của Player (BR34)
const reasons = [
  'Money not yet received in bank account',
  'Blurry or unreadable receipt image',
  'Incorrect transfer amount or content',
]

export default function StaffConfirmPaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [selectedBookingId, setSelectedBookingId] = useState(null)
  const [actualAmount, setActualAmount] = useState('')
  const [reason, setReason] = useState(reasons[0])
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isProofOpen, setIsProofOpen] = useState(false)
  const [proofUrl, setProofUrl] = useState(null)

  const selectedBooking = transactions.find((transaction) => transaction.id === selectedBookingId) ?? null

  const selectBooking = (transaction) => {
    setSelectedBookingId(transaction?.id ?? null)
    setActualAmount(transaction ? String(transaction.actualAmount) : '')
    setErrorMessage('')
  }

  // UC19 #1–#2: giao dịch chờ xác nhận của địa điểm; ?booking=<mã> chọn sẵn một giao dịch
  const loadTransactions = useCallback(async () => {
    try {
      const items = await listPendingPaymentsApi()
      setTransactions(items)
      const requested = new URLSearchParams(location.search).get('booking')
      const initial = items.find((item) => item.code === requested) ?? items[0] ?? null
      setSelectedBookingId(initial?.id ?? null)
      setActualAmount(initial ? String(initial.actualAmount) : '')
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Could not load payments awaiting confirmation.'))
    }
  }, [location.search])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Ảnh chứng từ cần JWT nên tải thành object URL
  const proofImageUrl = selectedBooking?.proofImageUrl
  useEffect(() => {
    if (!proofImageUrl) {
      setProofUrl(null)
      return undefined
    }
    let objectUrl = null
    let cancelled = false
    fetchProtectedImage(proofImageUrl)
      .then((url) => {
        objectUrl = url
        if (cancelled) URL.revokeObjectURL(url)
        else setProofUrl(url)
      })
      .catch(() => setProofUrl(null))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [proofImageUrl])

  // Giao dịch đã xử lý thì rời danh sách chờ; chọn giao dịch kế tiếp
  const removeSelectedBooking = (successMessage) => {
    if (!selectedBooking) return
    const remaining = transactions.filter((transaction) => transaction.id !== selectedBooking.id)
    setTransactions(remaining)
    selectBooking(remaining[0] ?? null)
    setMessage(successMessage)
  }

  const runAction = async (action, fallback) => {
    if (!selectedBooking) return
    setIsProcessing(true)
    setErrorMessage('')
    try {
      const res = await action()
      removeSelectedBooking(res?.message || fallback)
    } catch (err) {
      setErrorMessage(apiErrorMessage(err))
    } finally {
      setIsProcessing(false)
    }
  }

  // UC19 #3: xác nhận; nhập số thực nhận khi khách chuyển thừa (BR51)
  const confirmPayment = async () => {
    if (!selectedBooking) return
    const amountReceived = Number(actualAmount)
    if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
      setErrorMessage('Enter a valid amount received.')
      return
    }
    const confirmed = window.confirm(
      `Confirm that you have received ${amountReceived.toLocaleString()} VND for booking ${selectedBooking.code}?`,
    )
    if (!confirmed) return
    await runAction(
      () => confirmPaymentApi(selectedBooking.id, amountReceived),
      `Payment confirmed for ${selectedBooking.code}.`,
    )
  }

  // UC19 #4: yêu cầu bổ sung (BR34)
  const requestResubmission = () =>
    runAction(
      () => requestResubmissionApi(selectedBooking.id, reason, reason !== reasons[0]),
      `Resubmission requested for ${selectedBooking?.code}.`,
    )

  // UC19 #5: từ chối; slot được nhả, voucher và điểm được trả (BR40, BR45)
  const rejectPayment = () => {
    if (!selectedBooking || !window.confirm(`Reject payment for ${selectedBooking.code}?`)) return
    return runAction(
      () => rejectPaymentApi(selectedBooking.id, reason),
      `${selectedBooking.code} was rejected.`,
    )
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
        {errorMessage && !selectedBooking && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
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
                  <strong>{transaction.code}</strong>
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
                <h2>{selectedBooking.code} · {selectedBooking.customer}</h2>
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
                      <strong>Note to facility owner:</strong> {selectedBooking.note}
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
                  Customer has {selectedBooking.resubmissionsLeft} resubmissions left,
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
              {proofUrl ? (
                <img src={proofUrl} alt={`Payment proof ${selectedBooking.code}`} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
              ) : (
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <rect x="4" y="5" width="24" height="22" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="m6 24 7-7 4 4 4-5 5 7" />
                </svg>
              )}
              <strong>Payment Proof · {selectedBooking.code}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
