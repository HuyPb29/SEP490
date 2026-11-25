import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getAllPages } from '../../api'
import PlayerComplaintWorkspace from './PlayerComplaintWorkspace'
import ComplaintEvidence from './ComplaintEvidence'
import { ActionForm, Field } from '../WorkspaceLayout'
import ManagementLayout from '../../components/layout/ManagementLayout'
import { Drawer } from '../../components/common/Drawer'
import { Modal } from '../../components/common/Modal'
import styles from './CourtComplaintsPage.module.css'
import { today, useResource } from '../workspaceSupport'

const staffPath = '/staff/complaints'
const ownerPath = '/owner/complaints'
const latePaymentType = 'LATE_PAYMENT_CONFIRMATION'
const labels = { SUBMITTED: 'Mới gửi', PENDING_OWNER: 'Chờ chủ sân quyết định', RESOLVED: 'Đã xử lý', REJECTED: 'Bị từ chối' }
const resultLabels = {
  REFUND: 'Đã tạo yêu cầu hoàn tiền',
  POINTS: 'Cộng điểm bồi hoàn',
  NO_COMPENSATION: 'Ghi nhận, không bồi thường',
  LATE_PAYMENT_CONFIRMED: 'Đã xác nhận thanh toán trễ, tặng phiếu ưu đãi 10.000 đ',
}
const loadStaffCases = (signal) => getAllPages(staffPath, { signal })
const loadOwnerCases = (signal) => getAllPages(ownerPath, { signal })

/** Booking tại quầy đã có hiệu lực mới có cái để khiếu nại; đang giữ chỗ hoặc hết hạn thì chưa phát sinh giao dịch. */
const WALK_IN_COMPLAINABLE = ['CONFIRMED', 'IN_USE', 'COMPLETED', 'CANCELLED_BY_FACILITY', 'CANCELLED_BY_PLAYER']
const walkInStatusLabels = {
  CONFIRMED: 'Đã xác nhận', IN_USE: 'Đang sử dụng', COMPLETED: 'Hoàn thành',
  CANCELLED_BY_FACILITY: 'Sân hủy', CANCELLED_BY_PLAYER: 'Khách hủy',
}
/** FR110, FR111: Staff chọn loại khiếu nại như Player; khiếu nại chậm xác nhận chỉ Player gửi (BR58). */
const walkInTypes = [['COURT_SERVICE', 'Dịch vụ sân'], ['PAYMENT_ISSUE', 'Vấn đề thanh toán'], ['OTHER', 'Khác']]

function OwnerDecision({ complaint, refresh }) {
  const latePayment = complaint.complaintType === latePaymentType
  const [result, setResult] = useState(latePayment ? 'LATE_PAYMENT_CONFIRMED' : 'REFUND')
  // BR58, FR116 (D176): chọn phương án này thì hệ thống tặng người chơi phiếu ưu đãi bồi thường.
  const results = latePayment ? [['LATE_PAYMENT_CONFIRMED', 'Xác nhận thanh toán trễ · tặng người chơi phiếu ưu đãi 10.000 đ']] :
    [['REFUND', 'Tạo yêu cầu hoàn tiền'], ...(complaint.playerId ? [['POINTS', 'Cộng điểm bồi hoàn']] : []),
      ['NO_COMPENSATION', 'Ghi nhận không bồi thường']]

  return <>
    <ActionForm label="Xác nhận phương án" after={refresh} confirmation="Ghi nhận phương án xử lý này?"
      action={(form) => api.post(ownerPath + '/' + complaint.id + '/resolve', {
        result, note: form.note,
        refundAmount: form.refundAmount ? Number(form.refundAmount) : null,
        verifiedUnrecordedAmount: form.verifiedUnrecordedAmount ? Number(form.verifiedUnrecordedAmount) : null,
        originalTransferDate: form.originalTransferDate || null,
        compensationPoints: form.compensationPoints ? Number(form.compensationPoints) : null,
      })}>
      <Field label="Phương án" options={results} value={result} onChange={(event) => setResult(event.target.value)} />
      {result === 'REFUND' && <>
        <Field label="Số tiền đề xuất (để trống dùng gợi ý của hệ thống)" name="refundAmount" type="number" min={1} />
        <Field label="Đã thu chưa ghi doanh thu (VND, nếu có)" name="verifiedUnrecordedAmount" type="number" min={1} />
        <Field label="Ngày chuyển khoản gốc nếu chưa ghi doanh thu" name="originalTransferDate" type="date" max={today()} />
      </>}
      {result === 'POINTS' && <Field label="Số điểm bồi hoàn" name="compensationPoints" type="number" min={1} required />}
      <Field label="Ghi chú" name="note" maxLength={255} />
    </ActionForm>
    <ActionForm label="Từ chối khiếu nại" tone="danger" after={refresh} confirmation="Xác nhận từ chối khiếu nại?"
      action={(form) => api.post(ownerPath + '/' + complaint.id + '/reject', form)}>
      <Field label="Lý do từ chối" name="reason" maxLength={500} required />
    </ActionForm>
  </>
}

const typeLabels = {
  COURT_SERVICE: 'Dịch vụ sân',
  PAYMENT_ISSUE: 'Vấn đề thanh toán',
  OTHER: 'Khác',
  LATE_PAYMENT_CONFIRMATION: 'Xác nhận thanh toán trễ',
}

function formatCreatedAt(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

export function PlayerComplaintsPage() {
  return <PlayerComplaintWorkspace />
}

/** UC33 #2, FR111: khách tại quầy khiếu nại trực tiếp thì Staff tạo khiếu nại thay khách (trong 24 giờ, BR49). */
function WalkInComplaintForm({ refresh }) {
  const [date, setDate] = useState(today)
  const loadWalkIns = useCallback(async (signal) => date
    ? (await getAllPages('/staff/bookings', { signal, params: { date } }))
      .filter((item) => WALK_IN_COMPLAINABLE.includes(item.status))
    : [], [date])
  const bookings = useResource(loadWalkIns, date)
  return <div className={styles.walkIn}>
    <p className={styles.muted}>Khiếu nại phải gửi trong 24 giờ kể từ giờ kết thúc của đặt sân. Nhân viên kiểm tra rồi chuyển chủ sân quyết định.</p>
    <Field label="Ngày đặt sân" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    {bookings.loading && <p className={styles.muted} role="status">Đang tải đặt sân tại quầy…</p>}
    {bookings.error && <p className={styles.error} role="alert">{bookings.error}{' '}
      <button type="button" className={styles.link} onClick={bookings.reload}>Thử lại</button></p>}
    {bookings.data?.length === 0 && <p className={styles.muted}>Không có đặt sân tại quầy trong ngày này.</p>}
    {bookings.data?.length > 0 && <ActionForm key={date} label="Lập khiếu nại" after={refresh}
      action={(form) => api.post(staffPath, { ...form, bookingId: Number(form.bookingId) })}>
      <Field label="Đặt sân tại quầy" name="bookingId" required options={[
        ['', 'Chọn đặt sân'], ...bookings.data.map((item) => [item.id, item.bookingCode + ' · ' + item.customerName + ' · '
          + item.startTime + ' · ' + (walkInStatusLabels[item.status] ?? item.status)]),
      ]} />
      <Field label="Loại khiếu nại" name="complaintType" required options={walkInTypes} />
      <Field label="Nội dung khách phản ánh" name="content" required maxLength={1000} />
    </ActionForm>}
  </div>
}

const STATUS_BADGE = { SUBMITTED: styles.badgeWarning, PENDING_OWNER: styles.badgeWarning, RESOLVED: styles.badgeSuccess, REJECTED: styles.badgeDanger }

function StatusBadgeText({ status }) {
  return <span className={`${styles.badge} ${STATUS_BADGE[status] ?? ''}`}>{labels[status] ?? status}</span>
}

/** Người gửi: Player gửi online thì có tên người chơi; không có người chơi là khiếu nại Staff lập thay khách tại quầy. */
const sourceOf = (item) => (item.playerId ? 'Online' : 'Tại quầy')
const customerOf = (item) => item.playerName || 'Khách tại quầy'

/** Chi tiết khiếu nại trong ngăn bên phải: thông tin, nội dung, diễn biến và thao tác theo vai trò (UC33 #3–#6). */
function ManagerDetail({ id, role, refreshList, onClose }) {
  const owner = role === 'owner'
  const path = owner ? ownerPath : staffPath
  const load = useCallback((signal) => api.get(path + '/' + id, { signal }).then((response) => response.data.data), [id, path])
  const detail = useResource(load, id)
  const item = detail.data
  function refresh() {
    detail.reload()
    refreshList()
  }
  const title = item ? `#${item.id} · ${typeLabels[item.complaintType] ?? item.complaintType}` : `Khiếu nại #${id}`
  return <Drawer title={title} onClose={onClose}>
    {detail.loading && <p className={styles.muted} role="status">Đang tải chi tiết…</p>}
    {detail.error && <p className={styles.error} role="alert">{detail.error}{' '}
      <button type="button" className={styles.link} onClick={detail.reload}>Thử lại</button></p>}
    {item && <>
      <div className={styles.detailHead}>
        <StatusBadgeText status={item.status} />
        <span className={styles.muted}>{sourceOf(item)} · gửi lúc {formatCreatedAt(item.createdAt)}</span>
      </div>
      <dl className={styles.kv}>
        <dt>Khách</dt><dd>{customerOf(item)}</dd>
        <dt>Booking</dt><dd>{item.bookingCode ?? 'Lịch đặt #' + item.bookingId}</dd>
        <dt>Loại</dt><dd>{typeLabels[item.complaintType] ?? item.complaintType}</dd>
        {item.locationName && <><dt>Địa điểm</dt><dd>{item.locationName}</dd></>}
      </dl>
      <section>
        <h3 className={styles.sectionTitle}>Nội dung khách gửi</h3>
        <p className={styles.contentBox}>{item.content}</p>
        <ComplaintEvidence complaintId={id} />
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Diễn biến</h3>
        <ol className={styles.timeline}>
          <li className={styles.done}><b>{formatCreatedAt(item.createdAt)}</b> · {item.playerId ? 'Khách gửi khiếu nại online' : 'Nhân viên lập khiếu nại thay khách tại quầy'}</li>
          {item.complaintType === latePaymentType
            ? <li className={styles.done}>Khiếu nại chậm xác nhận thanh toán gửi thẳng chủ sân (BR58)</li>
            : <li className={item.status === 'SUBMITTED' ? '' : styles.done}>
              {item.staffNote ? <>Nhân viên kiểm tra và chuyển chủ sân: <i>{item.staffNote}</i></> : 'Chờ nhân viên kiểm tra và chuyển chủ sân'}
            </li>}
          <li className={['RESOLVED', 'REJECTED'].includes(item.status) ? styles.done : ''}>
            {item.status === 'RESOLVED'
              ? <>Chủ sân quyết định: <b>{resultLabels[item.result] ?? item.result}</b>{item.result === 'POINTS' && item.compensationPoints ? ` (${item.compensationPoints} điểm)` : ''}{item.decidedAt ? ` · ${formatCreatedAt(item.decidedAt)}` : ''}</>
              : item.status === 'REJECTED'
                ? <>Chủ sân từ chối: <i>{item.rejectReason}</i>{item.decidedAt ? ` · ${formatCreatedAt(item.decidedAt)}` : ''}</>
                : 'Chủ sân quyết định: từ chối / xác nhận thanh toán muộn / hoàn tiền / điểm bồi hoàn / ghi nhận không bồi hoàn'}
          </li>
        </ol>
      </section>

      {owner && item.result === 'REFUND' && <Link className={styles.link} to={'/owner/workspace?tab=refund&complaintId=' + item.id}>Mở yêu cầu hoàn tiền</Link>}

      {role === 'staff' && item.status === 'SUBMITTED' && <section className={styles.actionBox}>
        <h3 className={styles.sectionTitle}>Chuyển chủ sân</h3>
        <ActionForm label="Chuyển chủ sân ›" after={refresh}
          action={(form) => api.post(staffPath + '/' + id + '/forward', form)}>
          <Field label="Kết quả kiểm tra của nhân viên" name="staffNote" required maxLength={1000} />
        </ActionForm>
        <p className={styles.muted}>Ghi những gì đã kiểm tra tại sân để chủ sân quyết định. Nhân viên không quyết định hoàn tiền hay bồi hoàn.</p>
      </section>}
      {role === 'staff' && item.status === 'PENDING_OWNER' && <p className={styles.notice}>Đã chuyển chủ sân, đang chờ chủ sân quyết định.</p>}

      {owner && item.status === 'PENDING_OWNER' && item.complaintType === latePaymentType &&
        <Link className={styles.link} to={`/staff/confirm-payments?paymentId=${item.paymentId}${item.reschedulePayment ? '&type=reschedule' : ''}`}>
          Mở giao dịch để xác nhận, yêu cầu bổ sung hoặc từ chối
        </Link>}
      {owner && item.status === 'PENDING_OWNER' && <section className={styles.actionBox}>
        <h3 className={styles.sectionTitle}>Quyết định của chủ sân</h3>
        <OwnerDecision complaint={item} refresh={refresh} />
      </section>}
    </>}
  </Drawer>
}

/** Bảng khiếu nại của Staff và Owner: tab trạng thái, tìm kiếm, lọc loại; bấm dòng mở ngăn chi tiết. */
function ManagerBoard({ role, revision = 0 }) {
  const owner = role === 'owner'
  const cases = useResource(owner ? loadOwnerCases : loadStaffCases, revision)
  const [params] = useSearchParams()
  const requestedId = params.get('complaintId')
  const requestedCase = /^[1-9]\d*$/.test(requestedId || '') ? requestedId : ''
  const [selection, setSelection] = useState({ request: requestedCase, id: requestedCase })
  const openId = selection.request === requestedCase ? selection.id : requestedCase
  const setOpenId = (value) => setSelection({ request: requestedCase, id: value })
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  // Owner thấy khiếu nại đã được nhân viên chuyển và khiếu nại chậm xác nhận gửi thẳng; không có tab Mới gửi.
  const statuses = Object.keys(labels).filter((value) => !owner || value !== 'SUBMITTED')
  const all = cases.data ?? []
  const count = (value) => all.filter((item) => item.status === value).length
  const text = query.trim().toLowerCase()
  const visible = all
    .filter((item) => !status || item.status === status)
    .filter((item) => !type || item.complaintType === type)
    .filter((item) => !text || [item.id, item.bookingCode, item.playerName, item.content].join(' ').toLowerCase().includes(text))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const urgentStatus = owner ? 'PENDING_OWNER' : 'SUBMITTED'

  return <section className={styles.board} aria-label="Khiếu nại tại địa điểm">
    <div className={styles.tabs} role="tablist" aria-label="Lọc theo trạng thái">
      {[['', 'Tất cả', all.length], ...statuses.map((value) => [value, labels[value], count(value)])].map(([value, label, n]) =>
        <button key={value || 'all'} type="button" role="tab" aria-selected={status === value}
          className={status === value ? styles.tabOn : ''} onClick={() => setStatus(value)}>
          {label}<span className={value === urgentStatus && n > 0 ? styles.countHot : styles.count}>{n}</span>
        </button>)}
    </div>
    <div className={styles.toolbar}>
      <input className={styles.search} type="search" aria-label="Tìm khiếu nại" placeholder="Mã khiếu nại, mã booking, tên khách, nội dung…"
        value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className={styles.select} aria-label="Lọc theo loại" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">Loại: Tất cả</option>
        {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {cases.loading && <p className={styles.empty} role="status">Đang tải khiếu nại…</p>}
    {cases.error && <p className={styles.empty} role="alert">{cases.error}{' '}
      <button type="button" className={styles.link} onClick={cases.reload}>Thử lại</button></p>}
    {cases.data && visible.length === 0 && <p className={styles.empty}>Không có khiếu nại trong mục này.</p>}
    {visible.length > 0 && <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Mã</th><th>Khách</th><th>Booking</th><th>Loại</th><th>Trạng thái</th><th>Gửi lúc</th><th aria-label="Thao tác" /></tr></thead>
        <tbody>{visible.map((item) => {
          const selected = String(item.id) === String(openId)
          return <tr key={item.id} className={selected ? styles.rowOn : item.status === urgentStatus ? styles.rowNew : ''}>
            <td><b>#{item.id}</b><small>{sourceOf(item)}</small></td>
            <td><b>{customerOf(item)}</b></td>
            <td><b>{item.bookingCode ?? 'Lịch đặt #' + item.bookingId}</b></td>
            <td>{typeLabels[item.complaintType] ?? item.complaintType}</td>
            <td><StatusBadgeText status={item.status} /></td>
            <td>{formatCreatedAt(item.createdAt)}</td>
            <td><button type="button" className={styles.viewButton} onClick={() => setOpenId(String(item.id))}>Xem</button></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    {openId && <ManagerDetail key={openId} id={openId} role={role} refreshList={cases.reload} onClose={() => setOpenId('')} />}
  </section>
}

export function OwnerCourtComplaints() {
  return <ManagerBoard role="owner" />
}

export default function CourtComplaintsPage() {
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  return <ManagementLayout role="staff" title="Khiếu nại của khách"
    subtitle="Tiếp nhận, kiểm tra, bổ sung thông tin rồi chuyển chủ sân. Chỉ chủ sân quyết định kết quả."
    actions={<button type="button" className={styles.primary} onClick={() => setCreating(true)}>+ Tạo khiếu nại hộ khách</button>}>
    <ManagerBoard role="staff" revision={revision} />
    {creating && <Modal title="Tạo khiếu nại hộ khách tại quầy" onClose={() => setCreating(false)} className={styles.modal}>
      <WalkInComplaintForm refresh={() => { setRevision((value) => value + 1); setCreating(false) }} />
    </Modal>}
  </ManagementLayout>
}
