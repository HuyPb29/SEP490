import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getSavedUser, getSelectedLocation } from '../../api/session'
import {
  decideReschedulePayment,
  getLatestRescheduleProof,
  listPendingReschedulePayments,
  listPendingStaffBookingPayments,
  getStaffBookingProofImage,
  decideStaffBookingPayment,
} from '../../api/bookingPaymentApi'
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
  const surcharge = new URLSearchParams(location.search).get('type') === 'reschedule'
  return <PaymentDesk key={surcharge ? 'reschedule' : 'booking'} surcharge={surcharge} />
}

function PaymentDesk({ surcharge }) {
  const location = useLocation()
  const navigate = useNavigate()
  const staff = getSavedUser()
  const isStaff = staff?.role_code === 'staff' || (staff?.role_code === 'owner' && Boolean(getSelectedLocation()))
  const [transactions, setTransactions] = useState(() => (isStaff ? [] : (surcharge ? [] : initialTransactions)))
  const [selectedBookingId, setSelectedBookingId] = useState(() => (surcharge || isStaff ? null : getInitialBookingId(location.search)))
  const [actualAmount, setActualAmount] = useState(() => {
    if (surcharge || isStaff) return ''
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

  const [loading, setLoading] = useState(Boolean(isStaff))
  const [proofUrl, setProofUrl] = useState('')
  const [proofError, setProofError] = useState('')

  useEffect(() => {
    if (!isStaff) return undefined
    const controller = new AbortController()
    if (surcharge) {
      listPendingReschedulePayments(controller.signal).then((payments) => {
        if (controller.signal.aborted) return
        const mapped = payments.map((payment) => ({
          id: payment.id,
          requestId: payment.rescheduleRequestId,
          amountDue: payment.amountDue,
          actualAmount: payment.amountDue,
          submittedAt: payment.submittedAt,
          resubmissionsLeft: Math.max(0, 3 - payment.resubmitCount),
        }))
        setTransactions(mapped)
        setSelectedBookingId(mapped[0]?.id ?? null)
        setActualAmount(String(mapped[0]?.actualAmount ?? ''))
      }).catch((error) => {
        if (!controller.signal.aborted) setErrorMessage(error.response?.data?.message || 'Không tải được phụ thu chờ xác nhận.')
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    } else {
      listPendingStaffBookingPayments(controller.signal).then((payments) => {
        if (controller.signal.aborted) return
        const mapped = payments.map((item) => ({
          id: item.payment.id,
          bookingId: item.payment.bookingId,
          bookingCode: item.payment.bookingCode || (item.payment.packageId ? ('Package #' + item.payment.packageId) : ('Booking #' + item.payment.id)),
          customer: item.customerName || 'Khách đặt online',
          court: item.courtName || (item.sessions?.length ? (item.sessions.length + ' sessions') : 'Court'),
          playDate: item.playDate || item.sessions?.[0]?.playDate || '',
          playTime: item.startTime ? (item.startTime + ' – ' + item.endTime) : (item.sessions?.[0] ? (item.sessions[0].startTime + ' – ' + item.sessions[0].endTime) : ''),
          listTime: item.startTime || '',
          phone: item.customerPhone || '',
          transferContent: item.payment.bookingCode || ('PK' + (item.payment.packageId || item.payment.id)),
          amountDue: item.payment.amountDue,
          actualAmount: item.payment.amountDue,
          waiting: 'Waiting',
          overdue: false,
          attempt: Math.max(1, 4 - (item.payment.resubmitsLeft ?? 3)),
          resubmissionsLeft: item.payment.resubmitsLeft ?? 3,
          note: item.note || '',
          proofs: item.proofs || [],
        }))
        setTransactions(mapped)
        setSelectedBookingId(mapped[0]?.id ?? null)
        setActualAmount(String(mapped[0]?.actualAmount ?? ''))
      }).catch((error) => {
        if (!controller.signal.aborted) setErrorMessage(error.response?.data?.message || 'Không tải được giao dịch chờ xác nhận.')
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    }
    return () => controller.abort()
  }, [isStaff, surcharge])

  useEffect(() => {
    if (!isProofOpen || selectedBookingId == null) return undefined
    const controller = new AbortController()
    let url
    const fetchProof = surcharge
      ? getLatestRescheduleProof(selectedBookingId, controller.signal)
      : (async () => {
          const proofs = selectedBooking?.proofs || []
          const latestProof = proofs[proofs.length - 1]
          if (!latestProof) return null
          return getStaffBookingProofImage(selectedBookingId, latestProof.id, controller.signal)
        })()

    fetchProof.then((image) => {
      if (controller.signal.aborted) return
      if (!image) {
        setProofError('Giao dịch chưa có ảnh chứng từ.')
        return
      }
      url = URL.createObjectURL(image)
      setProofUrl(url)
    }).catch((error) => {
      if (!controller.signal.aborted) setProofError(error.response?.data?.message || 'Không tải được ảnh chứng từ.')
    })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [isProofOpen, selectedBookingId, surcharge, selectedBooking])

  const processSurcharge = async (decision, payload, successMessage) => {
    const result = await decideReschedulePayment(selectedBooking.id, decision, payload)
    if (result.status === 'EXPIRED') {
      removeSelectedBooking('expired', 'Yêu cầu đã hết hạn. Booking giữ lịch cũ.')
    } else if (result.status === 'REJECTED') {
      removeSelectedBooking('payment_rejected', 'Phụ thu bị từ chối. Booking giữ lịch cũ.')
    } else {
      removeSelectedBooking(result.status, successMessage)
    }
  }

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
      if (surcharge) {
        await processSurcharge('confirm', { receivedAmount: amountReceived }, 'Đã xác nhận phụ thu và hoàn tất đổi lịch.')
        return
      }
      if (isStaff) {
        await decideStaffBookingPayment(selectedBooking.id, 'confirm', { receivedAmount: amountReceived })
        const receivedNote = amountReceived > selectedBooking.amountDue
          ? ` Khách chuyển thừa ${(amountReceived - selectedBooking.amountDue).toLocaleString()} VND; hệ thống ghi nhận ${selectedBooking.amountDue.toLocaleString()} VND.`
          : ''
        removeSelectedBooking(
          'payment_confirmed',
          `Đã xác nhận thanh toán cho ${selectedBooking.bookingCode || selectedBooking.id}.${receivedNote}`,
          null,
          { revenue: selectedBooking.amountDue, amountReceived },
        )
        return
      }
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
      if (surcharge) {
        await processSurcharge('request-resubmission', { reason, playerAtFault: reason !== reasons[0] }, 'Đã yêu cầu bổ sung chứng từ phụ thu.')
        return
      }
      if (isStaff) {
        await decideStaffBookingPayment(selectedBooking.id, 'request-resubmission', {
          reason,
          playerAtFault: reason !== reasons[0],
        })
        removeSelectedBooking(
          'resubmit_requested',
          `Đã yêu cầu bổ sung chứng từ cho ${selectedBooking.bookingCode || selectedBooking.id}.`,
          selectedBooking.resubmissionsLeft - 1,
        )
        return
      }
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
      if (surcharge) {
        if (!window.confirm('Từ chối phụ thu? Booking sẽ giữ lịch cũ.')) return
        await processSurcharge('reject', { reason }, '')
        return
      }
      if (isStaff) {
        if (!window.confirm('Từ chối thanh toán booking? Slot sẽ bị giải phóng, ưu đãi được hoàn lại.')) return
        await decideStaffBookingPayment(selectedBooking.id, 'reject', { reason })
        removeSelectedBooking(
          'payment_rejected',
          `MSG51: ${selectedBooking.bookingCode || selectedBooking.id} đã bị từ chối. Slot đã được giải phóng và ưu đãi được hoàn lại.`,
          selectedBooking.resubmissionsLeft,
        )
        return
      }
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
          <strong>{surcharge ? staff?.full_name || "Staff" : "Smash Arena"}</strong>
        </div>
        <nav className={styles.navigation} aria-label="Staff navigation">
          <button className={styles.navItem} type="button" onClick={() =>
            navigate(staff?.role_code === 'owner' ? '/owner/workspace' : '/staff/dashboard')}>
            {staff?.role_code === 'owner' ? 'Địa điểm' : 'Dashboard'}
          </button>
          {staff?.role_code === 'staff' && <button className={styles.navItem} type="button" onClick={() => navigate('/staff/complaints')}>Khiếu nại</button>}
          {staff && <button className={styles.navItem} type="button" onClick={() => navigate('/notifications')}>Thông báo</button>}
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
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>{surcharge ? 'Phụ thu đổi lịch' : 'Xác nhận thanh toán'}</h1>
        <div className={styles.actions}>
          <button type="button" className={styles.resubmitButton} disabled={isProcessing}
            onClick={() => navigate('/staff/confirm-payments')}>{isStaff ? 'Thanh toán booking' : 'Booking payments · Demo'}</button>
          <button type="button" className={styles.confirmButton} disabled={isProcessing}
            onClick={() => navigate('/staff/confirm-payments?type=reschedule')}>Phụ thu đổi lịch</button>
        </div>
        {surcharge && !isStaff && <p role="alert">
          Cần đăng nhập Staff để xem phụ thu.{' '}
          <button type="button" onClick={() => navigate('/login', { state: { returnTo: '/staff/confirm-payments?type=reschedule' } })}>Đăng nhập</button>
        </p>}
        {loading && <p role="status">Đang tải giao dịch…</p>}
        {!selectedBooking && errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
        {message && <p className={styles.actionMessage} role="status">{message}</p>}
        <div className={styles.workspace}>
          <section className={styles.bookingList} aria-label="Bookings awaiting confirmation">
            {transactions.map((transaction) => (
              <button
                className={`${styles.bookingItem} ${selectedBookingId === transaction.id ? styles.bookingSelected : ''}`}
                key={transaction.id}
                type="button"
                onClick={() => selectBooking(transaction)}
                disabled={isProcessing}
              >
                <span className={styles.bookingTopline}>
                  <strong>{transaction.id}</strong>
                  <strong>{transaction.amountDue.toLocaleString()} VND</strong>
                </span>
                <span className={styles.bookingMeta}>
                  {surcharge ? 'Yêu cầu đổi lịch #' + transaction.requestId : transaction.customer + ' · ' + transaction.court + ', ' + transaction.listTime}
                </span>
                <span className={transaction.overdue ? styles.overdue : styles.waiting}>
                  {surcharge ? transaction.submittedAt?.replace('T', ' ') : 'Waiting ' + transaction.waiting + (transaction.overdue ? ' · overdue' : '')}
                </span>
              </button>
            ))}
            {transactions.length === 0 && !loading && (!surcharge || isStaff) && !errorMessage && (
              <div className={styles.emptyList}>No payments awaiting confirmation.</div>
            )}
          </section>

          {selectedBooking && (
            <section className={styles.detailCard} aria-label="Selected payment details">
              <header className={styles.detailHeader}>
                <h2>{surcharge ? 'Phụ thu #' + selectedBooking.id : selectedBooking.id + ' · ' + selectedBooking.customer}</h2>
                <span className={styles.statusBadge}>
                  {surcharge ? 'Chờ xác nhận' : 'Awaiting confirmation · attempt ' + selectedBooking.attempt + '/3'}
                </span>
              </header>

              <div className={styles.detailBody}>
                <button
                  className={styles.proofPreview}
                  type="button"
                  onClick={() => {
                    setProofUrl('')
                    setProofError('')
                    setIsProofOpen(true)
                  }}
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
                    {surcharge ? <div><dt>Yêu cầu đổi lịch</dt><dd>#{selectedBooking.requestId}</dd></div> : <>
                    <div><dt>Court</dt><dd>{selectedBooking.court}</dd></div>
                    <div>
                      <dt>Play Time</dt>
                      <dd>{selectedBooking.playDate} · {selectedBooking.playTime}</dd>
                    </div>
                    <div><dt>Phone Number</dt><dd>{selectedBooking.phone}</dd></div>
                    <div><dt>Transfer Content</dt><dd>{selectedBooking.transferContent}</dd></div>
                    </>}
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
                  Customer has {processedBookings[selectedBooking.id]?.resubmissionsLeft ?? selectedBooking.resubmissionsLeft} resubmissions left,
                  {surcharge ? ' theo hạn của yêu cầu đổi lịch.' : ' deadline until end of play time (' + selectedBooking.playTime.split('–')[1]?.trim().split(' ')[0] + ').'}
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
              {surcharge
                ? proofUrl ? <img src={proofUrl} alt="Chứng từ phụ thu" style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} />
                  : <p role={proofError ? 'alert' : 'status'}>{proofError || 'Đang tải ảnh chứng từ…'}</p>
                : (
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <rect x="4" y="5" width="24" height="22" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="m6 24 7-7 4 4 4-5 5 7" />
              </svg>
                )}
              <strong>Payment Proof · {selectedBooking.id}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
