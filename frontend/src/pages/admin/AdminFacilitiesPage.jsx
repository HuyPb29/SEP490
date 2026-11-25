import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api'
import {
  apiErrorMessage,
  approveServiceRegistration,
  getAdminLocations,
  getAdminServiceRegistrations,
  getServiceRegistrationPaymentInfo,
  getServiceRegistrationProof,
  operatorQrUrl,
  rejectServiceRegistration,
  updateLocationStatus,
  updateOperatorPaymentInfo,
  uploadOperatorQr,
} from '../../api/locationApi'
import { adminExpansions } from '../../api/courtExpansionApi'
import AdminLayout from '../../components/layout/AdminLayout'
import { Drawer } from '../../components/common/Drawer'
import { Modal } from '../../components/common/Modal'
import { FileInput } from '../../components/common/FileInput'
import { RenewalDecision } from '../../components/location/ServiceRenewals'
import AdminCourtExpansions from './AdminCourtExpansions'
import { formatVnd } from '../location/serviceRegistrationTerms'
import styles from './AdminFacilitiesPage.module.css'

/**
 * UC06 – Admin quản lý địa điểm sử dụng dịch vụ: duyệt đăng ký (FR11), yêu cầu gia hạn (FR129, D178),
 * mua thêm sân (FR128), khóa/mở lại địa điểm, thông tin nhận chuyển khoản của bên vận hành (FR127).
 * Admin không xem doanh thu, giao dịch, khoản hoàn của địa điểm (BR63).
 */

/** DR28: ảnh QR JPG hoặc PNG, tối đa 5 MB (backend kiểm tra lại). */
const QR_TYPES = ['image/jpeg', 'image/png']
const QR_MAX_BYTES = 5 * 1024 * 1024

/** Số ngày còn lại được coi là "sắp hết hạn" để tô màu cảnh báo. */
const EXPIRING_SOON_DAYS = 30

const TABS = [
  { value: 'requests', label: 'Yêu cầu đăng ký' },
  { value: 'renewals', label: 'Yêu cầu gia hạn' },
  { value: 'expansions', label: 'Mua thêm sân' },
  { value: 'locations', label: 'Địa điểm' },
  { value: 'payment', label: 'Thông tin nhận chuyển khoản' },
]

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const [datePart, timePart = ''] = String(value).split('T')
  const time = timePart.slice(0, 5)
  return `${formatDate(datePart)}${time ? ` ${time}` : ''}`
}

function daysBetween(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime()
  const to = new Date(`${toIso}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86_400_000)
}

/** Trạng thái kỳ hạn: hết hạn / sắp hết hạn / còn hạn / chưa có kỳ hạn. */
function periodInfo(facility) {
  const end = facility.serviceTermEndDate
  if (!end) return { kind: 'none', text: 'Chưa có kỳ hạn' }
  const remaining = daysBetween(todayIso(), String(end).slice(0, 10))
  if (facility.serviceActive === false || remaining < 0) {
    return { kind: 'expired', text: `Hết hạn ${formatDate(end)}`, hint: `quá hạn ${Math.abs(remaining)} ngày` }
  }
  if (remaining <= EXPIRING_SOON_DAYS) return { kind: 'expiring', text: `Đến ${formatDate(end)}`, hint: `còn ${remaining} ngày` }
  return { kind: 'range', text: `Đến ${formatDate(end)}`, hint: `còn ${remaining} ngày` }
}

function initialTab(params, hash) {
  const tab = params.get('tab')
  if (TABS.some((item) => item.value === tab)) return tab
  if (hash === '#service-renewal') return 'renewals'
  if (hash === '#court-expansions') return 'expansions'
  return 'requests'
}

export default function AdminFacilitiesPage() {
  const [params, setParams] = useSearchParams()
  const route = useLocation()
  const navigate = useNavigate()
  const requestedRegistration = params.get('registrationId')
  const tab = initialTab(params, route.hash)
  const setTab = (value) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    next.delete('registrationId')
    if (route.hash) navigate({ pathname: route.pathname, search: '?' + next.toString(), hash: '' }, { replace: true })
    else setParams(next, { replace: true })
  }

  const [pendingRequests, setPendingRequests] = useState([])
  const [facilities, setFacilities] = useState([])
  const [renewals, setRenewals] = useState([])
  const [expansionPending, setExpansionPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const processingRegistration = useRef(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [requestQuery, setRequestQuery] = useState('')
  const [openRequestId, setOpenRequestId] = useState(requestedRegistration || null)
  const [proof, setProof] = useState(null)
  const [moneyChecked, setMoneyChecked] = useState(false)
  const [modal, setModal] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [renewalBusy, setRenewalBusy] = useState(false)
  // UC06 #8, FR127: thông tin nhận chuyển khoản của bên vận hành.
  const [operatorInfo, setOperatorInfo] = useState(null)
  const [operatorForm, setOperatorForm] = useState({ bankName: '', bankAccountNo: '', bankAccountHolder: '' })
  const [operatorMessage, setOperatorMessage] = useState('')
  const [operatorError, setOperatorError] = useState('')

  const applyOperatorInfo = (info) => {
    setOperatorInfo(info)
    setOperatorForm({
      bankName: info?.bankName ?? '',
      bankAccountNo: info?.bankAccountNo ?? '',
      bankAccountHolder: info?.bankAccountHolder ?? '',
    })
  }

  const loadOperatorInfo = async () => {
    try {
      applyOperatorInfo(await getServiceRegistrationPaymentInfo())
    } catch (err) {
      setOperatorError(apiErrorMessage(err))
    }
  }

  // Số yêu cầu gia hạn và mua thêm sân đang chờ, hiện trên tab.
  const loadRenewals = async () => {
    try {
      const { data } = await api.get('/admin/service-renewals')
      setRenewals(data.data ?? [])
    } catch (err) {
      setActionError(apiErrorMessage(err))
    }
  }
  const loadExpansionCount = async () => {
    try {
      setExpansionPending((await adminExpansions()).filter((item) => item.status === 'PENDING').length)
    } catch {
      setExpansionPending(0)
    }
  }

  // UC06: nạp danh sách địa điểm + đơn đăng ký đang chờ duyệt.
  const loadAll = async () => {
    setLoading(true)
    try {
      const [locations, registrations] = await Promise.all([
        getAdminLocations(),
        getAdminServiceRegistrations('PENDING'),
      ])
      setFacilities(locations)
      setPendingRequests(registrations)
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      loadAll()
      loadOperatorInfo()
      loadRenewals()
      loadExpansionCount()
    })
  }, [])

  useEffect(() => () => { if (proof?.url) URL.revokeObjectURL(proof.url) }, [proof])

  const handleSaveOperatorInfo = async (event) => {
    event.preventDefault()
    const payload = {
      bankName: operatorForm.bankName.trim(),
      bankAccountNo: operatorForm.bankAccountNo.trim(),
      bankAccountHolder: operatorForm.bankAccountHolder.trim(),
    }
    if (!payload.bankName || !payload.bankAccountNo || !payload.bankAccountHolder) {
      setOperatorError('Nhập đủ ngân hàng, số tài khoản và tên chủ tài khoản.')
      setOperatorMessage('')
      return
    }
    setSaving(true)
    try {
      applyOperatorInfo(await updateOperatorPaymentInfo(payload))
      setOperatorError('')
      setOperatorMessage('Đã lưu thông tin nhận chuyển khoản.')
    } catch (err) {
      setOperatorError(apiErrorMessage(err))
      setOperatorMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleOperatorQr = async (file) => {
    if (!file) return
    if (!QR_TYPES.includes(file.type) || file.size > QR_MAX_BYTES) {
      setOperatorError('Ảnh QR phải là JPG hoặc PNG, tối đa 5 MB.')
      setOperatorMessage('')
      return
    }
    setSaving(true)
    try {
      applyOperatorInfo(await uploadOperatorQr(file))
      setOperatorError('')
      setOperatorMessage('Đã lưu ảnh QR.')
    } catch (err) {
      setOperatorError(apiErrorMessage(err))
      setOperatorMessage('')
    } finally {
      setSaving(false)
    }
  }

  // ----------------------------------------------- UC05/UC06: xem, duyệt, từ chối đơn đăng ký

  const openRequest = (request) => {
    setOpenRequestId(String(request.id))
    setProof(null)
    setMoneyChecked(false)
    setActionError('')
  }
  const closeRequest = () => {
    if (saving || processingRegistration.current) return
    setOpenRequestId(null)
    setProof(null)
    setMoneyChecked(false)
  }
  const openRequestRow = pendingRequests.find((request) => String(request.id) === String(openRequestId))

  // FR11: Admin xem ảnh chứng từ chuyển khoản tiền thuê trước khi duyệt.
  const handleViewProof = async (request) => {
    setSaving(true)
    try {
      const blob = await getServiceRegistrationProof(request.id)
      setProof({ id: request.id, url: URL.createObjectURL(blob) })
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (request) => {
    if (processingRegistration.current || saving) return
    if (!moneyChecked) {
      setActionError(`Hãy xác nhận đã thấy ${formatVnd(request.rentalAmount)} về tài khoản bên vận hành trước khi duyệt.`)
      return
    }
    processingRegistration.current = true
    setSaving(true)
    try {
      await approveServiceRegistration(request.id)
      setOpenRequestId(null)
      setProof(null)
      setMoneyChecked(false)
      await loadAll()
      setActionError('')
      setStatusMessage(`Đã duyệt "${request.locationName}" và gửi email kết quả tới ${request.contactEmail}.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      processingRegistration.current = false
      setSaving(false)
    }
  }

  const handleReject = (request) => {
    if (processingRegistration.current || saving) return
    setModal({ type: 'reject', requestId: request.id, locationName: request.locationName, reason: '' })
    setActionError('')
    setStatusMessage('')
  }

  const handleConfirmRejection = async (event) => {
    event.preventDefault()
    if (processingRegistration.current || saving) return
    if (!modal?.reason.trim()) {
      setActionError('Vui lòng nhập lý do từ chối.')
      return
    }
    processingRegistration.current = true
    setSaving(true)
    try {
      await rejectServiceRegistration(modal.requestId, modal.reason.trim())
      setModal(null)
      setOpenRequestId(null)
      setProof(null)
      await loadAll()
      setActionError('')
      setStatusMessage(`Đã từ chối "${modal.locationName}" và gửi email lý do tới chủ sân.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      processingRegistration.current = false
      setSaving(false)
    }
  }

  // ------------------------------------------------------------- UC06: khóa / mở lại

  const askLock = (facility) => {
    setModal({ type: 'lock', facility })
    setActionError('')
    setStatusMessage('')
  }

  const handleLock = async () => {
    const facility = modal?.facility
    if (!facility) return
    setSaving(true)
    try {
      await updateLocationStatus(facility.id, 'LOCKED')
      setModal(null)
      await loadAll()
      setActionError('')
      setStatusMessage(`"${facility.name}" đã được khóa.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Địa điểm đã hết hạn chỉ mở lại khi duyệt yêu cầu gia hạn của Owner (UC06 #7, D178).
  const handleReopen = async (facility) => {
    setSaving(true)
    try {
      await updateLocationStatus(facility.id, 'ACTIVE')
      await loadAll()
      setActionError('')
      setStatusMessage(`"${facility.name}" đã được mở lại.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const updateModalField = (field, value) => {
    setModal((current) => (current ? { ...current, [field]: value } : current))
    setActionError('')
  }

  const closeModal = () => {
    if (saving || processingRegistration.current) return
    setModal(null)
    setActionError('')
  }

  const filteredFacilities = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return facilities.filter((facility) => {
      const period = periodInfo(facility)
      if (statusFilter === 'ACTIVE' || statusFilter === 'LOCKED') {
        if (facility.status !== statusFilter) return false
      }
      if (statusFilter === 'EXPIRING' && period.kind !== 'expiring') return false
      if (statusFilter === 'EXPIRED' && !(period.kind === 'expired' && facility.status === 'ACTIVE')) return false
      if (!keyword) return true
      return (
        (facility.name ?? '').toLocaleLowerCase().includes(keyword) ||
        (facility.ownerName ?? '').toLocaleLowerCase().includes(keyword)
      )
    })
  }, [facilities, searchKeyword, statusFilter])

  const visibleRequests = pendingRequests.filter((request) => {
    const keyword = requestQuery.trim().toLocaleLowerCase()
    if (!keyword) return true
    return [request.locationName, request.address, request.requesterName, request.contactEmail, request.contactPhone]
      .join(' ').toLocaleLowerCase().includes(keyword)
  })

  const activeCount = facilities.filter((facility) => facility.status === 'ACTIVE').length
  const lockedCount = facilities.filter((facility) => facility.status === 'LOCKED').length
  const expiringCount = facilities.filter((facility) => facility.status === 'ACTIVE' && periodInfo(facility).kind === 'expiring').length
  const expiredCount = facilities.filter((facility) => facility.status === 'ACTIVE' && periodInfo(facility).kind === 'expired').length
  const pendingRenewals = renewals.filter((row) => row.status === 'PENDING')
  const renewalByLocation = new Set(pendingRenewals.map((row) => String(row.locationId)))
  const counts = {
    requests: pendingRequests.length,
    renewals: pendingRenewals.length,
    expansions: expansionPending,
    locations: facilities.length,
  }

  return (
    <AdminLayout
      title="Địa điểm và đăng ký dịch vụ"
      subtitle="Duyệt khi đã thấy tiền thuê về tài khoản bên vận hành. Admin không xem doanh thu, giao dịch của địa điểm."
      actions={
        <button className={styles.secondaryButton} type="button" disabled={loading || saving}
          onClick={() => { loadAll(); loadRenewals(); loadExpansionCount() }}>
          Làm mới
        </button>
      }
    >
      <section className={styles.summary} aria-label="Tổng quan địa điểm">
        <article><span>Đang hoạt động</span><strong>{activeCount}</strong></article>
        <article><span>Sắp hết hạn (≤ {EXPIRING_SOON_DAYS} ngày)</span><strong className={styles.textWarning}>{expiringCount}</strong></article>
        <article><span>Quá hạn, chờ tự khóa</span><strong className={styles.textDanger}>{expiredCount}</strong></article>
        <article><span>Đã khóa</span><strong>{lockedCount}</strong></article>
      </section>

      {(statusMessage || (actionError && !modal && !openRequestRow)) && (
        <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
          <span>{actionError || statusMessage}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => { setStatusMessage(''); setActionError('') }}>×</button>
        </div>
      )}

      <section className={styles.board}>
        <div className={styles.tabs} role="tablist" aria-label="Mục quản lý">
          {TABS.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={tab === item.value}
              className={tab === item.value ? styles.tabOn : ''} onClick={() => setTab(item.value)}>
              {item.label}
              {counts[item.value] != null && (
                <span className={item.value !== 'locations' && counts[item.value] > 0 ? styles.countHot : styles.count}>{counts[item.value]}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'requests' && <>
          <div className={styles.toolbar}>
            <input className={styles.search} type="search" aria-label="Tìm yêu cầu đăng ký"
              placeholder="Tên địa điểm, người đại diện, email, SĐT…" value={requestQuery}
              onChange={(event) => setRequestQuery(event.target.value)} />
          </div>
          {loading && <p className={styles.emptyState}>Đang tải yêu cầu đăng ký…</p>}
          {!loading && visibleRequests.length === 0 && <p className={styles.emptyState}>Không có đơn đăng ký dịch vụ nào đang chờ duyệt.</p>}
          {visibleRequests.length > 0 && <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Địa điểm</th><th>Người đại diện</th><th>Loại</th><th>Số sân · năm</th><th>Số tiền thuê</th><th>Gửi lúc</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>{visibleRequests.map((request) => (
                <tr key={request.id} id={`registration-${request.id}`}
                  className={String(request.id) === String(openRequestId) ? styles.rowOn : ''}>
                  <td><b>{request.locationName}</b><small>{request.address || 'Chưa có địa chỉ'}</small></td>
                  <td><b>{request.requesterName || 'Chưa rõ người gửi'}</b><small>{[request.contactEmail, request.contactPhone].filter(Boolean).join(' · ')}</small></td>
                  <td><span className={`${styles.tag} ${request.requesterId ? styles.tagBlue : styles.tagTeal}`}>
                    {request.requesterId ? 'Owner thêm địa điểm' : 'Chủ sân mới'}</span></td>
                  <td>{request.courtCount} sân · {request.rentalYears} năm</td>
                  <td><b>{formatVnd(request.rentalAmount)}</b></td>
                  <td>{formatDateTime(request.createdAt)}</td>
                  <td><button type="button" className={styles.viewButton} onClick={() => openRequest(request)}>Xem</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
          <p className={styles.footNote}>Yêu cầu chờ xử lý không tự hết hạn. Chuyển thiếu thì không duyệt; nhắn tin hoặc gọi cho chủ sân, yêu cầu vẫn chờ.</p>
        </>}

        {tab === 'renewals' && <div className={styles.panelBody} id="service-renewal">
          <p className={styles.hint}>Duyệt khi đã thấy đủ tiền gia hạn. Còn hạn thì nối tiếp ngày hết hạn xa nhất; đã hết hạn thì tính từ ngày duyệt và địa điểm đang khóa được mở lại. Từ chối thì bên vận hành liên hệ hoàn tiền ngoài hệ thống.</p>
          {pendingRenewals.length === 0
            ? <p className={styles.emptyState}>Không có yêu cầu gia hạn nào đang chờ duyệt.</p>
            : <div className={styles.renewals}>
              {pendingRenewals.map((row) => (
                <RenewalDecision key={row.id} row={row} onBusy={setRenewalBusy}
                  refresh={async () => { await loadRenewals(); await loadAll() }} />
              ))}
            </div>}
          {renewalBusy && <p className={styles.footNote} role="status">Đang xử lý…</p>}
        </div>}

        {tab === 'expansions' && <AdminCourtExpansions onChanged={() => { loadExpansionCount(); loadAll() }} />}

        {tab === 'locations' && <>
          <div className={styles.toolbar}>
            <input className={styles.search} type="search" aria-label="Tìm địa điểm"
              placeholder="Tìm theo tên địa điểm hoặc chủ sân" value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)} />
            <select className={styles.select} aria-label="Lọc theo trạng thái" value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="EXPIRING">Sắp hết hạn</option>
              <option value="EXPIRED">Quá hạn, chờ tự khóa</option>
              <option value="LOCKED">Đã khóa</option>
            </select>
          </div>
          {loading && <p className={styles.emptyState}>Đang tải danh sách địa điểm…</p>}
          {!loading && filteredFacilities.length === 0 && <p className={styles.emptyState}>Không có địa điểm nào phù hợp bộ lọc.</p>}
          {filteredFacilities.length > 0 && <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Địa điểm</th><th>Chủ sân</th><th>Trạng thái</th><th>Thời hạn sử dụng dịch vụ</th><th>Số sân</th><th>Số booking</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>{filteredFacilities.map((facility) => {
                const period = periodInfo(facility)
                const renewalPending = renewalByLocation.has(String(facility.id))
                return (
                  <tr key={facility.id}>
                    <td><b>{facility.name}</b></td>
                    <td>{facility.ownerName || '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${facility.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {facility.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                      </span>
                      {facility.status === 'ACTIVE' && period.kind === 'expiring' && <span className={`${styles.badge} ${styles.badgeWarning}`}>Sắp hết hạn</span>}
                      {facility.status === 'ACTIVE' && period.kind === 'expired' && <span className={`${styles.badge} ${styles.badgeDanger}`}>Quá hạn</span>}
                    </td>
                    <td>
                      <b>{period.text}</b>
                      <small className={period.kind === 'expired' ? styles.textDanger : period.kind === 'expiring' ? styles.textWarning : ''}>
                        {[period.hint,
                          facility.status === 'LOCKED' && facility.lockedAt ? `khóa ${formatDateTime(facility.lockedAt)}` : null,
                          renewalPending ? 'có yêu cầu gia hạn chờ duyệt' : null].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td>{facility.courtCount ?? 0}</td>
                    <td>{facility.bookingCount ?? 0}</td>
                    <td className={styles.actionsCell}>
                      {renewalPending && <button type="button" className={styles.viewButton} onClick={() => setTab('renewals')}>Xem gia hạn</button>}
                      {facility.status === 'ACTIVE' ? (
                        <button type="button" className={styles.dangerButton} disabled={saving} onClick={() => askLock(facility)}>Khóa</button>
                      ) : facility.serviceActive !== false && period.kind !== 'expired' ? (
                        <button type="button" className={styles.viewButton} disabled={saving} onClick={() => handleReopen(facility)}>Mở lại</button>
                      ) : (
                        <span className={styles.muted}>Mở lại khi duyệt gia hạn</span>
                      )}
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>}
          <p className={styles.footNote}>Khóa địa điểm sẽ khóa cả tài khoản Staff, gỡ địa điểm khỏi tìm kiếm, ngừng nhận booking mới và báo cho Player có buổi chưa chơi trong gói đặt nhiều buổi. Địa điểm hết hạn chỉ mở lại khi duyệt yêu cầu gia hạn.</p>
        </>}

        {tab === 'payment' && <div className={styles.panelBody}>
          <p className={styles.hint}>
            Hiện trên form đăng ký sử dụng dịch vụ, gia hạn và mua thêm sân để chủ sân chuyển khoản.
            {operatorInfo && !operatorInfo.customQr && ' Đang dùng ảnh QR mặc định khi cài hệ thống: hãy tải ảnh QR thật của tài khoản lên.'}
          </p>
          {(operatorMessage || operatorError) && (
            <div className={operatorError ? styles.errorNotice : styles.statusNotice} role={operatorError ? 'alert' : 'status'}>
              <span>{operatorError || operatorMessage}</span>
              <button type="button" aria-label="Đóng thông báo" onClick={() => { setOperatorError(''); setOperatorMessage('') }}>×</button>
            </div>
          )}
          <div className={styles.paymentGrid}>
            {operatorInfo && (
              <div className={styles.qrBox}>
                <img src={operatorQrUrl(operatorInfo.updatedAt)} alt="Mã QR chuyển khoản của bên vận hành" width={200} height={200} />
                <label className={styles.field}>
                  <span>Thay ảnh QR (JPG/PNG, tối đa 5 MB)</span>
                  <FileInput accept="image/jpeg,image/png" disabled={saving}
                    onChange={(event) => { handleOperatorQr(event.target.files?.[0]); event.target.value = '' }} />
                </label>
              </div>
            )}
            <form onSubmit={handleSaveOperatorInfo} className={styles.paymentForm}>
              <label className={styles.field}>
                <span>Ngân hàng</span>
                <input maxLength={100} value={operatorForm.bankName}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankName: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Số tài khoản</span>
                <input maxLength={30} value={operatorForm.bankAccountNo}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankAccountNo: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Tên chủ tài khoản</span>
                <input maxLength={100} value={operatorForm.bankAccountHolder}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankAccountHolder: event.target.value }))} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>Lưu thông tin chuyển khoản</button>
            </form>
          </div>
        </div>}
      </section>

      {openRequestRow && (
        <Drawer title={openRequestRow.locationName} onClose={closeRequest} busy={saving}
          footer={<div className={styles.drawerActions}>
            <button type="button" className={styles.dangerButton} disabled={saving} onClick={() => handleReject(openRequestRow)}>Từ chối…</button>
            <button type="button" className={styles.primaryButton} disabled={saving || !moneyChecked} onClick={() => handleApprove(openRequestRow)}>
              {openRequestRow.requesterId ? 'Duyệt và gắn vào chủ sân' : 'Duyệt và tạo tài khoản'}
            </button>
          </div>}>
          <div className={styles.drawerHead}>
            <span className={`${styles.tag} ${openRequestRow.requesterId ? styles.tagBlue : styles.tagTeal}`}>
              {openRequestRow.requesterId ? 'Owner thêm địa điểm' : 'Chủ sân mới'}
            </span>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>Chờ xử lý</span>
            <span className={styles.muted}>gửi {formatDateTime(openRequestRow.createdAt)}</span>
          </div>
          {actionError && !modal && <p className={styles.modalError} role="alert">{actionError}</p>}
          <dl className={styles.kv}>
            <dt>Địa chỉ</dt><dd>{openRequestRow.address || '—'}</dd>
            <dt>Người đại diện</dt><dd>{openRequestRow.requesterName || '—'}</dd>
            <dt>Email · SĐT</dt><dd>{[openRequestRow.contactEmail, openRequestRow.contactPhone].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Số sân con</dt><dd>{openRequestRow.courtCount} sân</dd>
            <dt>Số năm thuê</dt><dd>{openRequestRow.rentalYears} năm · tính từ ngày duyệt</dd>
            <dt>Số tiền thuê</dt><dd>{formatVnd(openRequestRow.rentalAmount)} <span className={styles.muted}>(P35: 10 triệu / 9 sân / năm)</span></dd>
          </dl>
          <section>
            <h3 className={styles.sectionLabel}>Ảnh chứng từ chuyển khoản</h3>
            {!openRequestRow.hasProof ? <p className={styles.muted}>Không có ảnh chứng từ.</p>
              : proof?.id === openRequestRow.id ? <img className={styles.proofImage} src={proof.url} alt="Ảnh chứng từ chuyển khoản tiền thuê" />
                : <button type="button" className={styles.viewButton} disabled={saving} onClick={() => handleViewProof(openRequestRow)}>Xem chứng từ</button>}
          </section>
          <label className={styles.checkBox}>
            <input type="checkbox" checked={moneyChecked} disabled={saving} onChange={(event) => { setMoneyChecked(event.target.checked); setActionError('') }} />
            <span><b>Tôi đã kiểm tra tài khoản bên vận hành, tiền về đủ {formatVnd(openRequestRow.rentalAmount)}.</b>
              <small>Chuyển thiếu thì không duyệt; nhắn tin hoặc gọi cho chủ sân, yêu cầu vẫn chờ.</small></span>
          </label>
          <p className={styles.hint}>
            Duyệt: hệ thống tạo địa điểm, {openRequestRow.courtCount} sân (đang tắt), ghi thời hạn {openRequestRow.rentalYears} năm
            {openRequestRow.requesterId ? ', gắn vào tài khoản chủ sân hiện có' : ', tạo tài khoản chủ sân với tên đăng nhập và mật khẩu tự sinh'}
            {' '}rồi gửi email kết quả tới {openRequestRow.contactEmail} (MSG116).
          </p>
        </Drawer>
      )}

      {modal?.type === 'reject' && (
        <Modal title="Từ chối đơn đăng ký dịch vụ" busy={saving} onClose={closeModal} className={styles.modal}>
          <form onSubmit={handleConfirmRejection} className={styles.modalForm}>
            <p className={styles.muted}>Hệ thống gửi email lý do tới chủ sân của "{modal.locationName}" (MSG117), kèm câu bên vận hành sẽ liên hệ hoàn tiền thuê đã chuyển.</p>
            {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
            <label className={styles.field}>
              <span>Lý do từ chối</span>
              <textarea autoFocus required disabled={saving} rows="4" maxLength={500} value={modal.reason}
                onChange={(event) => updateModalField('reason', event.target.value)} />
            </label>
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal} disabled={saving}>Hủy</button>
              <button className={styles.dangerSolid} type="submit" disabled={saving}>Gửi từ chối</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'lock' && (
        <Modal title={`Khóa địa điểm "${modal.facility.name}"?`} busy={saving} onClose={closeModal} className={styles.modal}>
          <div className={styles.modalForm}>
            <p className={styles.warning}>Địa điểm sẽ bị gỡ khỏi tìm kiếm, không nhận booking mới; tài khoản Staff của địa điểm bị khóa; Player có buổi chưa chơi trong gói đặt nhiều buổi được thông báo. Dữ liệu được giữ nguyên.</p>
            {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal} disabled={saving}>Hủy</button>
              <button className={styles.dangerSolid} type="button" onClick={handleLock} disabled={saving}>Khóa địa điểm</button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  )
}
