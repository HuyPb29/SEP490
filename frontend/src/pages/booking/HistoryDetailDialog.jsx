import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage } from '../../api'
import { affectedBookingActions, blocksNormalBookingActions, bookingStatusLabels, bookingStartsAfter, bookingTimestamp, canPayHistoryEntry, canRescheduleBooking, getHistoryDetail } from '../../api/bookingHistory'
import { createMatch } from '../../api/matchApi'
import { formatVnd } from '../../utils/formatters'
import styles from './MyBookingsPage.module.css'

/** D60: tối đa 8 người tính cả chủ kèo — chủ kèo khai số đang có và số cần thêm. */
const MATCH_MAX_PLAYERS = 8

function CreateMatchForm({ bookingId, onCreated }) {
  const [currentPlayers, setCurrentPlayers] = useState(4)
  const [neededPlayers, setNeededPlayers] = useState(2)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (currentPlayers + neededPlayers > MATCH_MAX_PLAYERS) {
      setError(`Tổng số người tối đa là ${MATCH_MAX_PLAYERS} (kể cả chủ kèo).`)
      return
    }
    setSaving(true)
    try {
      await createMatch({ bookingId, currentPlayers, neededPlayers })
      onCreated()
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Không mở được kèo.'))
    } finally {
      setSaving(false)
    }
  }

  const numberField = (label, value, setValue) => (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input
        type="number" min={1} max={MATCH_MAX_PLAYERS - 1} value={value}
        className="rounded border border-gray-300 px-2 py-1"
        onChange={(event) => { setValue(Math.max(1, Math.min(MATCH_MAX_PLAYERS - 1, Number(event.target.value) || 1))); setError('') }}
      />
    </label>
  )

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-2 font-semibold">Mở kèo tìm người chơi</h4>
      <div className="flex gap-4">
        {numberField('Số người đã có (kể cả bạn)', currentPlayers, setCurrentPlayers)}
        {numberField('Số người cần thêm', neededPlayers, setNeededPlayers)}
      </div>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      <button type="button" disabled={saving} onClick={submit}
        className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? 'Đang mở kèo…' : 'Mở kèo'}
      </button>
    </div>
  )
}

const currency = { format: formatVnd }

function DetailRow({ label, children }) {
  if (children == null || children === '') return null
  return <div className={styles.quoteRow}><dt>{label}</dt><dd>{children}</dd></div>
}

export default function HistoryDetailDialog({ item, now, onClose, onPayment, onReschedule, affected, affectedReady,
  affectedLoading, canCancel, onCancelBooking, onAffected }) {
  const ref = useRef(null)
  const [detail, setDetail] = useState(null)
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [revision, setRevision] = useState(0)
  const [matchFormOpen, setMatchFormOpen] = useState(false)
  const [matchCreated, setMatchCreated] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    let timer
    async function load() {
      try {
        const data = await getHistoryDetail(item, signal)
        if (signal.aborted) return
        setDetail(data)
        setError('')
        if (data.status === 'RESUBMIT_REQUESTED' && data.paymentId) {
          try {
            const response = await api.get('/payments/' + data.paymentId, { signal })
            if (signal.aborted) return
            setPayment(response.data.data)
            setPaymentError('')
          } catch (cause) {
            if (signal.aborted) return
            setPayment(null)
            setPaymentError(apiErrorMessage(cause, 'Không tải được thông tin bổ sung chứng từ.'))
          }
        } else {
          setPayment(null)
          setPaymentError('')
        }
      } catch (cause) {
        if (!signal.aborted) setError(apiErrorMessage(cause, 'Không tải được chi tiết lịch đặt sân.'))
      } finally {
        if (!signal.aborted) timer = setTimeout(load, 10_000)
      }
    }
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [item, revision])

  const seconds = Math.max(0, Math.ceil((bookingTimestamp(detail?.holdExpiresAt) - now) / 1000)) || 0
  const status = detail?.status.toLowerCase()
  const currentStatus = status === 'holding' && !seconds ? 'expired' : status
  const requestOpen = status === 'resubmit_requested' && payment?.status === 'RESUBMIT_REQUESTED'
  const target = detail && {
    ...item, status: currentStatus, hold_expires_at: detail.holdExpiresAt,
    payment_id: requestOpen ? detail.paymentId : null,
    resubmit_deadline: requestOpen ? payment.resubmitDeadline ?? detail.resubmitDeadline : null,
    reschedule: detail.reschedule, booking_date: detail.playDate ?? item.booking_date,
    start_time: detail.startTime ?? item.start_time,
    court_name: detail.courtName ?? item.court_name,
    time_range: detail.startTime ? `${detail.startTime} – ${detail.endTime}` : item.time_range,
  }
  const showPayment = !error && canPayHistoryEntry(target, now)
  const showReschedule = !error && currentStatus === 'confirmed' && !blocksNormalBookingActions(affected)
    && (detail?.reschedule?.pendingRequestId || canRescheduleBooking(detail?.reschedule, now))
  const showAffected = !error && affectedReady && affected?.status === 'PENDING' && currentStatus === 'confirmed'
    && bookingStartsAfter(target?.booking_date, target?.start_time, now)
  const viewPayment = !error && item.booking_type !== 'session' && detail?.paymentId
    && ['awaiting_confirmation', 'confirmed', 'in_use', 'completed', 'payment_rejected'].includes(currentStatus)
  // BR55, D112: chỉ booking đã xác nhận, đặt dưới tên đội và chưa tới giờ chơi mới mở được kèo.
  const canCreateMatch = !error && !matchCreated && currentStatus === 'confirmed' && detail?.teamId
    && affectedReady && !blocksNormalBookingActions(affected)
    && bookingStartsAfter(detail.playDate, detail.startTime, now)

  return (
    <dialog ref={ref} aria-labelledby="booking-detail-title"
      className="m-auto max-h-[85dvh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <h3 id="booking-detail-title" className={styles.modalTitle}>Chi tiết đặt sân · {item.booking_code}</h3>
      {!detail && !error && <p role="status">Đang tải chi tiết…</p>}
      {(error || paymentError) && <p className={styles.errorBanner} role="alert">{error || paymentError}{' '}
        <button type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
      </p>}
      {detail && (
        <div className={styles.quoteBox}>
          <dl>
            <DetailRow label="Trạng thái">{bookingStatusLabels[currentStatus] || detail.status}</DetailRow>
            <DetailRow label="Địa điểm">{detail.locationName}</DetailRow>
            <DetailRow label="Địa chỉ">{detail.locationAddress}</DetailRow>
            <DetailRow label="Sân">{detail.courtName}</DetailRow>
            {detail.playDate && <DetailRow label="Ngày và giờ chơi">{detail.playDate} · {detail.startTime} – {detail.endTime}</DetailRow>}
            {detail.startDate && <DetailRow label="Ngày chơi">
              {detail.startDate === detail.endDate ? detail.startDate : detail.startDate + ' – ' + detail.endDate}
            </DetailRow>}
            <DetailRow label="Đặt cho">{detail.teamName || 'Cá nhân'}</DetailRow>
            <DetailRow label="Ghi chú cho chủ sân">{detail.note}</DetailRow>
            <DetailRow label="Giá niêm yết">{currency.format(detail.listAmount ?? 0)}</DetailRow>
            {detail.voucherDiscount > 0 && <DetailRow label="Giảm bằng voucher">{currency.format(detail.voucherDiscount)}</DetailRow>}
            {detail.pointDiscount > 0 && <DetailRow label="Giảm bằng điểm">{currency.format(detail.pointDiscount)}</DetailRow>}
            <DetailRow label="Thành tiền">{currency.format(detail.finalAmount ?? 0)}</DetailRow>
            <DetailRow label="Mã biên nhận">{detail.receiptNo}</DetailRow>
            {currentStatus === 'holding' && <DetailRow label="Thời gian giữ chỗ còn lại">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </DetailRow>}
            {status === 'resubmit_requested' && <DetailRow label="Lý do gửi lại chứng từ">{detail.resubmitReason}</DetailRow>}
            {status === 'resubmit_requested' && detail.resubmitDeadline && <DetailRow label="Hạn gửi lại chứng từ">
              {new Date(bookingTimestamp(detail.resubmitDeadline)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </DetailRow>}
            {requestOpen && showPayment && <DetailRow label="Lượt bổ sung">
              {payment.resubmitsLeft > 0 ? 'Còn ' + payment.resubmitsLeft + ' lượt' : 'Yêu cầu bổ sung cuối đang mở'}
            </DetailRow>}
          </dl>
          {detail.sessions?.length > 0 && <ul>
            {detail.sessions.map((session) => <li key={session.id}>
              {session.courtName} · {session.playDate} ({session.startTime} – {session.endTime})
            </li>)}
          </ul>}
        </div>
      )}
      {canCreateMatch && matchFormOpen && (
        <CreateMatchForm
          bookingId={detail.id}
          onCreated={() => { setMatchFormOpen(false); setMatchCreated(true) }}
        />
      )}
      {matchCreated && (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          Đã mở kèo thành công. Theo dõi và duyệt yêu cầu tham gia ở trang{' '}
          <Link to="/open-matches" className="underline">Kèo đang tìm người chơi</Link>.
        </p>
      )}
      <div className={styles.modalActions}>
        <button type="button" className={styles.outlineActionBtn} onClick={onClose}>Đóng</button>
        {showReschedule && <button type="button" className={styles.outlineActionBtn} onClick={() => onReschedule(target)}>
          {detail.reschedule.pendingRequestId ? 'Xem phụ thu đổi lịch' : 'Đổi lịch'}
        </button>}
        {!error && currentStatus === 'confirmed' && canCancel(target) && <button type="button"
          className={styles.outlineActionBtn} onClick={() => onCancelBooking(target)}>
          {target.single_order ? 'Hủy đơn' : 'Hủy lịch'}
        </button>}
        {showAffected && affectedBookingActions.map(([choice, label]) => <button key={choice} type="button"
          disabled={affectedLoading} className={styles.outlineActionBtn} onClick={() => onAffected(target, affected.id, choice)}>
          {label}
        </button>)}
        {canCreateMatch && !matchFormOpen && (
          <button type="button" className={styles.primaryActionBtn} onClick={() => setMatchFormOpen(true)}>
            Tạo kèo
          </button>
        )}
        {showPayment && <button type="button" className={styles.primaryActionBtn} onClick={() => onPayment(target)}>
          {currentStatus === 'holding' ? 'Tiếp tục thanh toán' : 'Gửi lại chứng từ'}
        </button>}
        {viewPayment && <button type="button" className={styles.outlineActionBtn} onClick={() => onPayment(target)}>
          {detail.receiptNo ? 'Xem biên nhận' : 'Xem thanh toán'}
        </button>}
      </div>
    </dialog>
  )
}
