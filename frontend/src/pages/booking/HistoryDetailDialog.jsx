import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage } from '../../api'
import { affectedBookingActions, blocksNormalBookingActions, bookingStatusLabels, bookingStartsAfter, canPayHistoryEntry, canRescheduleBooking, getHistoryDetail, withBookingDeadlines } from '../../api/bookingHistory'
import { createMatch } from '../../api/matchApi'
import { getMyTeams } from '../../api/teamApi'
import { isSkillLevel, NO_SKILL_LABEL, SKILL_LEVELS } from '../../utils/skillLevels'
import { formatVnd, uiMessage } from '../../utils/formatters'
import styles from './MyBookingsPage.module.css'

/** D60: tối đa 8 người tính cả chủ kèo — chủ kèo khai số đang có và số cần thêm. */
const MATCH_MAX_PLAYERS = 8

function CreateMatchForm({ bookingId, teamId, onCreated }) {
  const [currentPlayers, setCurrentPlayers] = useState(4)
  const [neededPlayers, setNeededPlayers] = useState(2)
  // Trình độ của kèo: mặc định theo trình độ của đội; '' = Không yêu cầu. Chỉ là nhãn, không chặn ai xin vào.
  const [skillLevel, setSkillLevel] = useState('')
  const [skillTouched, setSkillTouched] = useState(false)
  const [phoneConsent, setPhoneConsent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (skillTouched) return undefined
    const controller = new AbortController()
    getMyTeams(controller.signal).then((teams) => {
      const team = teams.find((item) => item.id === teamId)
      if (isSkillLevel(team?.skillLevel)) setSkillLevel(team.skillLevel)
    }).catch(() => {})
    return () => controller.abort()
  }, [teamId, skillTouched])

  const submit = async () => {
    if (currentPlayers + neededPlayers > MATCH_MAX_PLAYERS) {
      setError(`Tổng số người tối đa là ${MATCH_MAX_PLAYERS} (kể cả chủ kèo).`)
      return
    }
    if (!phoneConsent) {
      setError('Vui lòng đồng ý chia sẻ số điện thoại với người được duyệt vào kèo.')
      return
    }
    setSaving(true)
    try {
      await createMatch({ bookingId, currentPlayers, neededPlayers, skillLevel, phoneConsent })
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
      <div className="flex flex-wrap gap-4">
        {numberField('Số người đã có (kể cả bạn)', currentPlayers, setCurrentPlayers)}
        {numberField('Số người cần thêm', neededPlayers, setNeededPlayers)}
        <label className="flex flex-col gap-1 text-sm">
          <span>Trình độ của kèo</span>
          <select value={skillLevel} className="rounded border border-gray-300 px-2 py-1"
            onChange={(event) => { setSkillLevel(event.target.value); setSkillTouched(true); setError('') }}>
            {SKILL_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
            <option value="">{NO_SKILL_LABEL}</option>
          </select>
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-500">Trình độ chỉ để người chơi lọc kèo; ai cũng gửi được yêu cầu, bạn là người duyệt.</p>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={phoneConsent}
          onChange={(event) => { setPhoneConsent(event.target.checked); setError('') }} />
        <span>Tôi đồng ý cho người chơi được duyệt vào kèo xem số điện thoại của tôi.</span>
      </label>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{uiMessage(error)}</p>}
      <button type="button" disabled={saving || !phoneConsent} onClick={submit}
        className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? 'Đang mở kèo…' : 'Mở kèo'}
      </button>
    </div>
  )
}

const currency = { format: formatVnd }

const minuteOfDay = (time) => {
  const [hours, minutes] = (time ?? '').split(':').map(Number)
  return hours * 60 + minutes
}

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
            setPayment(withBookingDeadlines(response.data.data, response.data.timestamp))
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

  const seconds = Math.max(0, Math.ceil((detail?.holdDeadlineMs - now) / 1000))
  const currentStatus = detail?.status.toLowerCase()
  const requestOpen = currentStatus === 'resubmit_requested' && payment?.status === 'RESUBMIT_REQUESTED'
  const target = detail && {
    ...item, status: currentStatus, hold_deadline_ms: detail.holdDeadlineMs,
    payment_id: requestOpen ? detail.paymentId : null,
    resubmit_deadline_ms: requestOpen
      ? (payment.resubmitDeadline ? payment.resubmitDeadlineMs : detail.resubmitDeadlineMs) : null,
    reschedule: detail.reschedule, booking_date: detail.playDate ?? item.booking_date,
    start_time: detail.startTime ?? item.start_time,
    end_time: detail.endTime ?? item.end_time,
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
            {detail.voucherDiscount > 0 && <DetailRow label="Giảm bằng phiếu ưu đãi">{currency.format(detail.voucherDiscount)}</DetailRow>}
            {detail.pointDiscount > 0 && <DetailRow label="Giảm bằng điểm">{currency.format(detail.pointDiscount)}</DetailRow>}
            <DetailRow label="Thành tiền">{currency.format(detail.finalAmount ?? 0)}</DetailRow>
            <DetailRow label="Mã biên nhận">{detail.receiptNo}</DetailRow>
            {currentStatus === 'holding' && Number.isFinite(seconds) && <DetailRow label="Thời gian giữ chỗ">
              {seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                : 'Đang cập nhật trạng thái giữ chỗ…'}
            </DetailRow>}
            {currentStatus === 'resubmit_requested' && <DetailRow label="Lý do gửi lại chứng từ">{uiMessage(detail.resubmitReason)}</DetailRow>}
            {currentStatus === 'resubmit_requested' && Number.isFinite(target.resubmit_deadline_ms) && <DetailRow label="Hạn gửi lại chứng từ">
              {new Date(target.resubmit_deadline_ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </DetailRow>}
            {requestOpen && showPayment && <DetailRow label="Lượt bổ sung">
              {payment.resubmitsLeft > 0 ? 'Còn ' + payment.resubmitsLeft + ' lượt' : 'Yêu cầu bổ sung cuối đang mở'}
            </DetailRow>}
          </dl>
          {detail.sessions?.length > 0 && <div className={styles.sessionPriceTable}>
            <table>
              <caption>Chi tiết từng buổi</caption>
              <thead><tr><th scope="col">Ngày chơi</th><th scope="col">Sân và khung giờ</th>
                <th scope="col">Thời lượng</th><th scope="col">Đơn giá bình quân lúc đặt</th>
                <th scope="col">Thành tiền sau ưu đãi</th></tr></thead>
              <tbody>{detail.sessions.map((session) => {
                const duration = minuteOfDay(session.endTime) - minuteOfDay(session.startTime)
                return <tr key={session.id}>
                  <td>{session.playDate}</td>
                  <td>{session.courtName} · {session.startTime} – {session.endTime}</td>
                  <td>{duration > 0 ? duration + ' phút' : '—'}</td>
                  <td>{session.bookedHalfHours > 0 && session.listAmount != null
                    ? currency.format(session.listAmount * 2 / session.bookedHalfHours) + '/giờ' : '—'}</td>
                  <td>{session.finalAmount == null ? '—' : currency.format(session.finalAmount)}</td>
                </tr>
              })}</tbody>
            </table>
          </div>}
        </div>
      )}
      {canCreateMatch && matchFormOpen && (
        <CreateMatchForm
          bookingId={detail.id}
          teamId={detail.teamId}
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
        {target && !error && canCancel(target) && <button type="button"
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
