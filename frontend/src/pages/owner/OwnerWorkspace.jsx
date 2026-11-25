import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { useLocationContext } from '../../hooks/useLocation'
import { useOwnerRefund, useOwnerRefunds } from '../../hooks/useOwnerRefunds'
import WorkspaceLayout from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  Select,
  StatusBadge,
  Table,
  Toast,
} from '../../components/common'
import { errorMessage, shortDate } from '../../utils/formatters'
import { OwnerCourtComplaints } from '../feedback/CourtComplaintsPage'
import { OwnerPromotions } from '../promotion/PromotionPages'
import { OwnerReviews } from '../feedback/OwnerReviews'
import OwnerStaffAccounts from './OwnerStaffAccounts'
import styles from './OwnerWorkspace.module.css'

const ownerTabs = [['staff', 'Nhân viên'], ['cancel', 'Hủy đặt sân'], ['refund', 'Hoàn tiền'], ['complaints', 'Khiếu nại'], ['reviews', 'Đánh giá'], ['rewards', 'Ưu đãi và điểm']]
const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')
const vnd = (value) => money(value).replace(/\s*₫/, 'đ')

function refundSource(item) {
  if (item.complaintId) return 'Khiếu nại #' + item.complaintId
  if (item.affectedBookingId) return 'Đặt sân bị ảnh hưởng do sân hủy lịch'
  return 'Yêu cầu hoàn tiền'
}

// ---------------------------------------------------------------- hoàn tiền

function RefundRecordForm({ item, record, onRecorded }) {
  const [form, setForm] = useState(() => ({
    amount: String(Math.min(item.suggestedAmount, item.remainingRefundableAmount)),
    refundDate: today(),
    reason: '',
    note: '',
  }))
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const update = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }))
  }
  const differsFromSuggestion = Number(form.amount) !== Number(item.suggestedAmount)

  function validate(event) {
    event.preventDefault()
    const next = {}
    const amount = Number(form.amount)
    if (!form.amount || !Number.isFinite(amount) || amount < 1) next.amount = 'Nhập số tiền lớn hơn 0.'
    else if (amount > item.remainingRefundableAmount) next.amount = `Không vượt quá ${vnd(item.remainingRefundableAmount)} còn có thể hoàn.`
    if (!form.refundDate) next.refundDate = 'Chọn ngày hoàn.'
    if (differsFromSuggestion && !form.reason.trim()) next.reason = 'Số tiền khác gợi ý nên phải ghi lý do.'
    setErrors(next)
    if (!Object.keys(next).length) setConfirming(true)
  }

  async function submit() {
    setBusy(true)
    try {
      const result = await record({ ...form, reason: form.reason.trim(), note: form.note.trim() })
      onRecorded(result.data)
    } catch (error) {
      const fieldErrors = error.response?.data?.errors
      setErrors(fieldErrors && Object.keys(fieldErrors).length
        ? Object.fromEntries(Object.entries(fieldErrors).map(([name, text]) => [name.split('.').at(-1), text]))
        : { form: errorMessage(error) })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form noValidate className={styles.modalForm} onSubmit={validate}>
      <p className={styles.callout}>Chuyển tiền cho khách bên ngoài hệ thống trước, rồi ghi nhận tại đây.</p>
      <div className={styles.twoCols}>
        <FormField label="Số tiền thực hoàn (đồng)" required error={errors.amount}
          hint={`Gợi ý ${vnd(item.suggestedAmount)}`}>
          <Input type="number" min={1} max={item.remainingRefundableAmount} value={form.amount} onChange={update('amount')} />
        </FormField>
        <FormField label="Ngày hoàn" required error={errors.refundDate}>
          <Input type="date" min={item.originalPaymentDate} max={today()} value={form.refundDate} onChange={update('refundDate')} />
        </FormField>
      </div>
      <FormField label="Lý do" required={differsFromSuggestion} error={errors.reason}
        hint={differsFromSuggestion ? 'Bắt buộc vì số tiền khác gợi ý.' : 'Không bắt buộc khi hoàn đúng số tiền gợi ý.'}>
        <Input maxLength={500} value={form.reason} onChange={update('reason')} />
      </FormField>
      <FormField label="Ghi chú">
        <Input maxLength={500} value={form.note} onChange={update('note')} />
      </FormField>
      {errors.form && <p className={styles.formError} role="alert">{errors.form}</p>}
      <div className={styles.modalActions}>
        <Button type="submit" loading={busy}>Ghi nhận đã hoàn</Button>
      </div>
      <ConfirmDialog open={confirming} title="Ghi nhận đã hoàn tiền?" confirmText="Ghi nhận" busy={busy}
        onConfirm={submit} onCancel={() => setConfirming(false)}>
        <p>Xác nhận đã hoàn {vnd(form.amount)} cho đặt sân {item.bookingCode} ngày {shortDate(form.refundDate)}?</p>
        <p className={styles.dialogWarning}>Khoản hoàn trừ vào doanh thu của ngày hoàn và không sửa lại được.</p>
      </ConfirmDialog>
    </form>
  )
}

function RefundDetail({ id, saved, onRecorded }) {
  const refund = useOwnerRefund(id)
  const item = saved ?? refund.data
  const canRecord = item?.status === 'PENDING_REFUND' && item.remainingRefundableAmount > 0
  if (!saved && refund.loading) return <LoadingState message="Đang tải chi tiết…" />
  if (!saved && refund.error) return <ErrorState message={refund.error} onRetry={refund.reload} />
  if (!item) return null
  return (
    <div className={styles.detailBody}>
      <dl className={styles.facts}>
        <div><dt>Mã đặt sân</dt><dd>{item.bookingCode}</dd></div>
        <div><dt>Trạng thái</dt><dd><StatusBadge category="refund" status={item.status} /></dd></div>
        <div><dt>Nguồn yêu cầu</dt><dd>{refundSource(item)}</dd></div>
        <div><dt>Kỳ thanh toán gốc</dt><dd>{shortDate(item.originalPaymentDate)}</dd></div>
        <div><dt>Số tiền gợi ý</dt><dd>{vnd(item.suggestedAmount)}</dd></div>
        {item.status === 'PENDING_REFUND' && <div><dt>Còn có thể hoàn</dt><dd>{vnd(item.remainingRefundableAmount)}</dd></div>}
        {item.status === 'REFUNDED' && <>
          <div><dt>Số tiền thực hoàn</dt><dd>{vnd(item.refundedAmount)}</dd></div>
          <div><dt>Ngày hoàn</dt><dd>{shortDate(item.refundDate)}</dd></div>
          <div className={styles.factWide}><dt>Lý do</dt><dd>{item.reason || '—'}</dd></div>
          <div className={styles.factWide}><dt>Ghi chú</dt><dd>{item.note || '—'}</dd></div>
        </>}
      </dl>
      {item.verifiedUnrecordedAmount != null && (
        <p className={styles.muted}>Khoản thu đã xác minh ngoài doanh thu: {vnd(item.verifiedUnrecordedAmount)}.</p>
      )}
      {canRecord && <RefundRecordForm item={item} record={refund.record} onRecorded={onRecorded} />}
    </div>
  )
}

function Refunds() {
  const [params, setParams] = useSearchParams()
  const complaintId = params.get('complaintId')
  const refunds = useOwnerRefunds()
  const [openId, setOpenId] = useState(null)
  const [status, setStatus] = useState(complaintId ? '' : 'PENDING_REFUND')
  const [recorded, setRecorded] = useState(null)
  const items = refunds.data ?? []
  const currentItems = recorded
    ? items.some((item) => item.id === recorded.data.id)
      ? items.map((item) => item.id === recorded.data.id ? recorded.data : item)
      : [recorded.data, ...items]
    : items
  const visible = currentItems.filter((item) => !status || item.status === status)
  const linkedId = complaintId ? visible.find((item) => String(item.complaintId) === complaintId)?.id : null
  const selectedId = openId ?? linkedId
  const pendingCount = currentItems.filter((item) => item.status === 'PENDING_REFUND').length

  function handleRecorded(result) {
    setRecorded(result)
    setStatus('REFUNDED')
    refunds.reload()
  }

  return (
    <section className={styles.panel} aria-labelledby="refund-heading">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="refund-heading" className={styles.panelTitle}>Hoàn tiền</h2>
          <p className={styles.muted}>Yêu cầu hoàn phát sinh từ khiếu nại được duyệt hoặc khách chọn hoàn tiền khi sân hủy lịch.</p>
        </div>
      </header>
      <div className={styles.segmented} role="group" aria-label="Trạng thái hoàn tiền">
        {[['PENDING_REFUND', `Chờ hoàn (${pendingCount})`], ['REFUNDED', 'Đã hoàn'], ['', 'Tất cả']].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={status === value}
            onClick={() => { setStatus(value); setOpenId(null); setRecorded(null) }}>{label}</button>
        ))}
      </div>
      {complaintId && (
        <p className={styles.callout}>
          <span>Đang xem yêu cầu hoàn tiền từ khiếu nại #{complaintId}.</span>
          <Button variant="ghost" size="sm" onClick={() => {
            const next = new URLSearchParams(params)
            next.delete('complaintId')
            setParams(next, { replace: true })
          }}>Bỏ liên kết</Button>
        </p>
      )}
      {recorded && <Toast tone="success" onClose={() => setRecorded(null)}>{recorded.message || 'Đã ghi nhận hoàn tiền.'}</Toast>}
      {refunds.loading && <LoadingState message="Đang tải yêu cầu hoàn tiền…" />}
      {refunds.error && <ErrorState message={refunds.error} onRetry={refunds.reload} />}
      {!refunds.loading && !refunds.error && !visible.length && (
        <EmptyState title="Không có yêu cầu"
          description={status === 'PENDING_REFUND' ? 'Hiện không có khoản nào chờ hoàn.' : 'Không có yêu cầu trong mục này.'} />
      )}
      {!refunds.loading && !refunds.error && visible.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th scope="col">Mã đặt sân</th>
              <th scope="col">Nguồn</th>
              <th scope="col">Số tiền</th>
              <th scope="col">Kỳ thanh toán gốc</th>
              <th scope="col">Trạng thái</th>
              <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.bookingCode}</strong></td>
                <td>{refundSource(item)}</td>
                <td className={styles.numeric}>
                  {item.status === 'REFUNDED' ? vnd(item.refundedAmount) : `Gợi ý ${vnd(item.suggestedAmount)}`}
                </td>
                <td>{shortDate(item.originalPaymentDate)}</td>
                <td><StatusBadge category="refund" status={item.status} /></td>
                <td className={styles.rowAction}>
                  <Button variant={item.status === 'PENDING_REFUND' ? 'primary' : 'ghost'} size="sm" onClick={() => setOpenId(item.id)}>
                    {item.status === 'PENDING_REFUND' ? 'Ghi nhận' : 'Xem'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {selectedId && visible.some((item) => item.id === selectedId) && (
        <Drawer title="Chi tiết hoàn tiền" onClose={() => {
          setOpenId(null)
          if (complaintId) {
            const next = new URLSearchParams(params)
            next.delete('complaintId')
            setParams(next, { replace: true })
          }
        }}>
          <RefundDetail key={selectedId} id={selectedId}
            saved={recorded?.data.id === selectedId ? recorded.data : null} onRecorded={handleRecorded} />
        </Drawer>
      )}
    </section>
  )
}

// -------------------------------------------------------------- hủy đặt sân

function CancelDialog({ item, onClose, onDone }) {
  const walkIn = item.bookingType === 'WALK_IN'
  const [cause, setCause] = useState('OWNER_CANCELLED')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const consequence = cause === 'WALK_IN_CUSTOMER_REQUEST'
    ? 'Hủy theo yêu cầu của khách tại quầy. Khoản đã thanh toán không được hoàn lại; khung giờ được mở lại cho người khác đặt.'
    : walkIn
      ? 'Sân hủy đặt sân tại quầy. Nhân viên cần lập khiếu nại thay khách để bạn quyết định bồi hoàn.'
      : 'Khách sẽ được thông báo để chọn đổi slot miễn phí, hoàn tiền hoặc nhận điểm bồi hoàn.'

  async function submit(event) {
    event.preventDefault()
    if (!reason.trim()) {
      setError('Nhập lý do hủy.')
      return
    }
    setBusy(true)
    try {
      await api.post('/owner/bookings/' + item.id + '/cancel', { cause, reason: reason.trim() })
      onDone(item)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Hủy đặt sân ${item.bookingCode}`} onClose={onClose} busy={busy}>
      <form noValidate className={styles.modalForm} onSubmit={submit}>
        <dl className={styles.facts}>
          <div><dt>Sân</dt><dd>{item.courtName ?? 'Sân #' + item.courtId}</dd></div>
          <div><dt>Giờ chơi</dt><dd>{clock(item.startMinute)}–{clock(item.endMinute)}</dd></div>
        </dl>
        {walkIn && (
          <FormField label="Nguyên nhân" required>
            <Select value={cause} onChange={(event) => setCause(event.target.value)}
              options={[['OWNER_CANCELLED', 'Sân hủy'], ['WALK_IN_CUSTOMER_REQUEST', 'Khách tại quầy yêu cầu']]} />
          </FormField>
        )}
        <FormField label="Lý do hủy" required error={error || undefined}>
          <Input maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} />
        </FormField>
        <p className={styles.dialogWarning}>{consequence}</p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Quay lại</Button>
          <Button type="submit" variant="danger" loading={busy}>Xác nhận hủy</Button>
        </div>
      </form>
    </Modal>
  )
}

function Cancellations() {
  const [date, setDate] = useState(today)
  const [cancelling, setCancelling] = useState(null)
  const [done, setDone] = useState('')
  const load = useCallback((signal) => date
    ? api.get('/owner/bookings/cancellable', { params: { playDate: date }, signal }).then((response) => response.data.data)
    : Promise.resolve([]), [date])
  const bookings = useResource(load, date)
  const rows = bookings.data ?? []
  return (
    <section className={styles.panel} aria-labelledby="cancel-heading">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="cancel-heading" className={styles.panelTitle}>Hủy đặt sân tại địa điểm</h2>
          <p className={styles.muted}>Sân hủy lịch, hoặc hủy đặt sân tại quầy theo yêu cầu của khách.</p>
        </div>
        <FormField label="Ngày chơi" className={styles.dateFilter}>
          <Input type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
      </header>
      {done && <Toast tone="success" onClose={() => setDone('')}>{done}</Toast>}
      {bookings.loading && <LoadingState message="Đang tải lịch đặt sân…" />}
      {bookings.error && <ErrorState message={bookings.error} onRetry={bookings.reload} />}
      {!bookings.loading && !bookings.error && rows.length === 0 && (
        <EmptyState title="Không có lịch đặt sân có thể hủy" description="Chọn ngày chơi khác để xem." />
      )}
      {!bookings.loading && !bookings.error && rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th scope="col">Mã đặt sân</th>
              <th scope="col">Sân</th>
              <th scope="col">Giờ chơi</th>
              <th scope="col">Loại</th>
              <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.bookingCode}</strong></td>
                <td>{item.courtName ?? 'Sân #' + item.courtId}</td>
                <td className={styles.numeric}>{clock(item.startMinute)}–{clock(item.endMinute)}</td>
                <td>{item.bookingType === 'WALK_IN' ? 'Tại quầy' : 'Đặt trực tuyến'}</td>
                <td className={styles.rowAction}>
                  <Button variant="ghost" size="sm" className={styles.dangerText} onClick={() => setCancelling(item)}>Hủy</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {cancelling && (
        <CancelDialog item={cancelling} onClose={() => setCancelling(null)} onDone={(item) => {
          setCancelling(null)
          setDone(`Đã hủy đặt sân ${item.bookingCode}.`)
          bookings.reload()
        }} />
      )}
    </section>
  )
}

// ------------------------------------------------------------ địa điểm khóa

function lockedVenueDeadline(location) {
  const lockedAt = new Date(location.lockedAt)
  if (!location.lockedAt || Number.isNaN(lockedAt.getTime())) return null
  lockedAt.setDate(lockedAt.getDate() + 30)
  return lockedAt
}

function canDownloadLockedVenue(location) {
  const deadline = lockedVenueDeadline(location)
  return !deadline || deadline.getTime() >= Date.now()
}

function LockedVenue({ location }) {
  const deadline = lockedVenueDeadline(location)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    setBusy(true)
    setError('')
    try {
      await downloadVenueData()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.lockedBanner} role="status" aria-labelledby="locked-heading">
      <div>
        <h2 id="locked-heading">Địa điểm {location.name} đã bị khóa</h2>
        <p>
          {!deadline ? 'Bạn chỉ còn tải được dữ liệu quản lý.'
            : canDownloadLockedVenue(location)
              ? `Bạn chỉ còn tải được dữ liệu quản lý đến ngày ${new Intl.DateTimeFormat('vi-VN').format(deadline)}.`
              : 'Đã hết thời hạn tải dữ liệu quản lý.'}
          {' '}Gửi yêu cầu gia hạn để mở lại địa điểm.
        </p>
        {error && <p className={styles.formError} role="alert">{error}</p>}
      </div>
      <div className={styles.lockedActions}>
        <Link className={styles.linkButton} to={`/owner/facility-settings?locationId=${location.id}#service-renewal`}>Yêu cầu gia hạn</Link>
        {canDownloadLockedVenue(location) && (
          <Button variant="secondary" onClick={download} loading={busy} loadingText="Đang tạo file…">Tải dữ liệu địa điểm</Button>
        )}
      </div>
    </section>
  )
}

function OwnerLocation() {
  const locations = useResource(loadOwnerLocations)
  const [params, setParams] = useSearchParams()
  const { locationId: selected } = useLocationContext()
  const requestedTab = params.get('tab')
  const tab = ownerTabs.some(([value]) => value === requestedTab) ? requestedTab : 'staff'

  const location = locations.data?.find((item) => String(item.id) === String(selected))

  if (locations.loading) return <LoadingState message="Đang tải địa điểm…" />
  if (locations.error) return <ErrorState message={locations.error} onRetry={locations.reload} />
  if (!locations.data?.length) {
    return (
      <EmptyState title="Bạn chưa có địa điểm" description="Đăng ký sử dụng dịch vụ để bắt đầu quản lý sân."
        action={<Link className={styles.linkButton} to="/register-service">Đăng ký địa điểm</Link>} />
    )
  }
  if (!location) {
    return <EmptyState title="Chưa chọn địa điểm" description="Chọn địa điểm đang làm việc ở thanh bên trái để xem nhân viên, đặt sân và ưu đãi." />
  }
  if (location.status !== 'ACTIVE') return <LockedVenue location={location} />

  return (
    <div className={styles.workspace}>
      <nav className={styles.tabBar} aria-label="Quản lý địa điểm">
        {ownerTabs.map(([value, title]) => (
          <button key={value} type="button" aria-current={tab === value ? 'page' : undefined}
            onClick={() => setParams({ tab: value })}>{title}</button>
        ))}
      </nav>
      <div key={selected + ':' + tab} className={styles.tabContent}>
        {tab === 'staff' && <OwnerStaffAccounts />}
        {tab === 'cancel' && <Cancellations />}
        {tab === 'refund' && <Refunds key={params.get('complaintId') || ''} />}
        {tab === 'complaints' && <OwnerCourtComplaints />}
        {tab === 'reviews' && (
          <section className={styles.panel} aria-labelledby="reviews-heading">
            <header className={styles.panelHeader}>
              <div>
                <h2 id="reviews-heading" className={styles.panelTitle}>Đánh giá từ khách hàng</h2>
                <p className={styles.muted}>Phản hồi đánh giá và ẩn đánh giá vi phạm quy định nội dung.</p>
              </div>
            </header>
            <OwnerReviews />
          </section>
        )}
        {tab === 'rewards' && <OwnerPromotions location={location} refreshLocation={locations.reload} />}
      </div>
    </div>
  )
}

export default function OwnerWorkspace() {
  return (
    <WorkspaceLayout role="owner" title="Quản lý địa điểm"
      description="Nhân viên, hủy đặt sân, hoàn tiền, khiếu nại, đánh giá và ưu đãi của địa điểm đang làm việc."
      actions={<Link className={styles.linkButton} to="/register-service">Đăng ký thêm địa điểm</Link>}>
      <OwnerLocation />
    </WorkspaceLayout>
  )
}
