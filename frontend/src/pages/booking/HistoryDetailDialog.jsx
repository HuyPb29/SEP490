import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage } from '../../api'
import { affectedBookingActions, blocksNormalBookingActions, bookingStartsAfter, canPayHistoryEntry, canRescheduleBooking, getHistoryDetail, withBookingDeadlines } from '../../api/bookingHistory'
import { createMatch } from '../../api/matchApi'
import { getMyTeams } from '../../api/teamApi'
import { isSkillLevel, NO_SKILL_LABEL, SKILL_LEVELS } from '../../utils/skillLevels'
import { money, shortDate, uiMessage } from '../../utils/formatters'
import styles from './MyBookingsPage.module.css'
import { Button, Modal, LoadingState, ErrorState, StatusBadge, Table, FormField, Input, Select } from '../../components/common'

/** D60: tối đa 8 người tính cả chủ kèo — chủ kèo khai số đang có và số cần thêm. */
const MATCH_MAX_PLAYERS = 8

function CreateMatchForm({ bookingId, teamId, onCreated, onSaving }) {
  const [currentPlayers, setCurrentPlayers] = useState(4)
  const [neededPlayers, setNeededPlayers] = useState(2)
  // Trình độ của kèo: mặc định theo trình độ của đội; '' = Không yêu cầu. Chỉ là nhãn, không chặn ai xin vào.
  const [skillLevel, setSkillLevel] = useState('')
  const [skillTouched, setSkillTouched] = useState(false)
  const [phoneConsent, setPhoneConsent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitLock = useRef(false)

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
    if (submitLock.current) return
    submitLock.current = true
    setSaving(true)
    onSaving?.(true)
    try {
      await createMatch({ bookingId, currentPlayers, neededPlayers, skillLevel, phoneConsent })
      onCreated()
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Không mở được kèo.'))
    } finally {
      submitLock.current = false
      setSaving(false)
      onSaving?.(false)
    }
  }

  const numberField = (label, value, setValue) => (
    <FormField label={label}>
      <Input type="number" min={1} max={MATCH_MAX_PLAYERS - 1} value={value} disabled={saving} aria-describedby={error ? "create-match-error" : undefined}
        onChange={(event) => { setValue(Math.max(1, Math.min(MATCH_MAX_PLAYERS - 1, Number(event.target.value) || 1))); setError('') }} />
    </FormField>
  )

  return (
    <div className={styles.matchForm}>
      <h4 className={styles.modalTitle}>Mở kèo tìm người chơi</h4>
      <div className={styles.matchFields}>
        {numberField('Số người đã có (kể cả bạn)', currentPlayers, setCurrentPlayers)}
        {numberField('Số người cần thêm', neededPlayers, setNeededPlayers)}
        <FormField label="Trình độ của kèo">
          <Select value={skillLevel} disabled={saving} aria-describedby={error ? "create-match-error" : undefined}
            onChange={(event) => { setSkillLevel(event.target.value); setSkillTouched(true); setError('') }}>
            {SKILL_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
            <option value="">{NO_SKILL_LABEL}</option>
          </Select>
        </FormField>
      </div>
      <p className={styles.subNoteLine}>Trình độ chỉ để người chơi lọc kèo; ai cũng gửi được yêu cầu, bạn là người duyệt.</p>
      <label className={styles.consent}>
        <input type="checkbox" disabled={saving} aria-describedby={error ? "create-match-error" : undefined} checked={phoneConsent}
          onChange={(event) => { setPhoneConsent(event.target.checked); setError('') }} />
        <span>Tôi đồng ý cho người chơi được duyệt vào kèo xem số điện thoại của tôi.</span>
      </label>
      {error && <p id="create-match-error" className={styles.errorBanner} role="alert">{uiMessage(error)}</p>}
      <Button loading={saving} disabled={!phoneConsent} onClick={submit}>Mở kèo</Button>
    </div>
  )
}

const currency = { format: (value) => money(value).replace(/\s*₫/, 'đ') }

const minuteOfDay = (time) => {
  const [hours, minutes] = (time ?? '').split(':').map(Number)
  return hours * 60 + minutes
}

function DetailRow({ label, children }) {
  if (children == null || children === '') return null
  return <div className={styles.quoteRow}><dt>{label}</dt><dd>{children}</dd></div>
}

export default function HistoryDetailDialog({ item, now, onClose, onPayment, onReschedule, affected, affectedReady,
  affectedLoading, onAffected, presentation = 'dialog', extraActions }) {
  const [detail, setDetail] = useState(null)
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [revision, setRevision] = useState(0)
  const [matchFormOpen, setMatchFormOpen] = useState(false)
  const [matchCreated, setMatchCreated] = useState(false)
  const [matchSaving, setMatchSaving] = useState(false)
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }) }, [presentation])

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
    ...item, facility_name: detail.locationName ?? item.facility_name, status: currentStatus, hold_deadline_ms: detail.holdDeadlineMs,
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

  const Container = presentation === 'panel' ? 'section' : Modal
  return (
    <Container {...(presentation === 'panel' ? { 'aria-labelledby': 'booking-detail-title' } : { labelledBy: 'booking-detail-title', onClose, busy: matchSaving })}
      className={presentation === 'panel' ? styles.detailPanel : styles.detailDialog}>
      <div className={styles.detailHeader}><span className={styles.subNoteLine}>Vé chơi của bạn</span>
      <h3 ref={titleRef} tabIndex={-1} id="booking-detail-title" className={styles.modalTitle}>Chi tiết đặt sân · {item.booking_code}</h3></div>
      <div className={styles.detailBody}>
      {!detail && !error && <LoadingState message="Đang tải chi tiết…" />}
      {(error || paymentError) && <ErrorState message={uiMessage(error || paymentError)} onRetry={() => setRevision((value) => value + 1)} />}
      {detail && (
        <div className={styles.quoteBox}>
          <dl>
            <DetailRow label="Trạng thái"><StatusBadge category="booking" status={currentStatus} /></DetailRow>
            <DetailRow label="Địa điểm">{detail.locationName}</DetailRow>
            <DetailRow label="Địa chỉ">{detail.locationAddress}</DetailRow>
            <DetailRow label="Sân">{detail.courtName}</DetailRow>
            {detail.playDate && <DetailRow label="Ngày và giờ chơi">{shortDate(detail.playDate)} · {detail.startTime} – {detail.endTime}</DetailRow>}
            {detail.startDate && <DetailRow label="Ngày chơi">
              {detail.startDate === detail.endDate ? shortDate(detail.startDate) : shortDate(detail.startDate) + ' – ' + shortDate(detail.endDate)}
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
            <Table>
              <caption>Chi tiết từng buổi</caption>
              <thead><tr><th scope="col">Ngày chơi</th><th scope="col">Sân và khung giờ</th>
                <th scope="col">Thời lượng</th><th scope="col">Đơn giá bình quân lúc đặt</th>
                <th scope="col">Thành tiền sau ưu đãi</th></tr></thead>
              <tbody>{detail.sessions.map((session) => {
                const duration = minuteOfDay(session.endTime) - minuteOfDay(session.startTime)
                return <tr key={session.id}>
                  <td>{shortDate(session.playDate)}</td>
                  <td>{session.courtName} · {session.startTime} – {session.endTime}</td>
                  <td>{duration > 0 ? duration + ' phút' : '—'}</td>
                  <td>{session.bookedHalfHours > 0 && session.listAmount != null
                    ? currency.format(session.listAmount * 2 / session.bookedHalfHours) + '/giờ' : '—'}</td>
                  <td>{session.finalAmount == null ? '—' : currency.format(session.finalAmount)}</td>
                </tr>
              })}</tbody>
            </Table>
          </div>}
        </div>
      )}
      {canCreateMatch && matchFormOpen && (
        <CreateMatchForm
          bookingId={detail.id}
          teamId={detail.teamId}
          onSaving={setMatchSaving}
          onCreated={() => { setMatchFormOpen(false); setMatchCreated(true) }}
        />
      )}
      {matchCreated && (
        <p className={styles.successNote} role="status">
          Đã mở kèo thành công. Theo dõi và duyệt yêu cầu tham gia ở trang{' '}
          <Link to="/open-matches" className={styles.textLink}>Kèo đang tìm người chơi</Link>.
        </p>
      )}
      </div>
      <fieldset disabled={matchSaving} className={styles.detailActions} aria-label="Thao tác với lịch đặt sân">
        {target && !error && extraActions?.(target)}
        <Button type="button" variant="secondary" onClick={onClose}>Đóng</Button>
        {showReschedule && <Button type="button" variant="secondary" onClick={() => onReschedule(target)}>
          {detail.reschedule.pendingRequestId ? 'Xem phụ thu đổi lịch' : 'Đổi lịch'}
        </Button>}
        {showAffected && affectedBookingActions.map(([choice, label]) => <Button key={choice} type="button"
          loading={affectedLoading} variant="secondary" onClick={() => onAffected(target, affected.id, choice)}>
          {label}
        </Button>)}
        {canCreateMatch && !matchFormOpen && (
          <Button type="button"  onClick={() => setMatchFormOpen(true)}>
            Tạo kèo
          </Button>
        )}
        {showPayment && <Button type="button"  onClick={() => onPayment(target)}>
          {currentStatus === 'holding' ? 'Tiếp tục thanh toán' : 'Gửi lại chứng từ'}
        </Button>}
        {viewPayment && <Button type="button" variant="secondary" onClick={() => onPayment(target)}>
          {detail.receiptNo ? 'Xem biên nhận' : 'Xem thanh toán'}
        </Button>}
      </fieldset>
    </Container>
  )
}
