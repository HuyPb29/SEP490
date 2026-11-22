import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  apiErrorMessage,
  approveServiceRegistration,
  createServiceTerm,
  getAdminLocations,
  getAdminServiceRegistrations,
  getLocationServiceTerms,
  getServiceRegistrationPaymentInfo,
  getServiceRegistrationProof,
  operatorQrUrl,
  rejectServiceRegistration,
  updateLocationStatus,
  updateOperatorPaymentInfo,
  uploadOperatorQr,
} from '../../api/locationApi'
import AdminLayout from '../../components/layout/AdminLayout'
import AdminCourtExpansions from './AdminCourtExpansions'
import { FileInput } from '../../components/common/FileInput'
import { formatVnd } from '../location/serviceRegistrationTerms'
import styles from './AdminFacilitiesPage.module.css'

/** DR28: ảnh QR JPG hoặc PNG, tối đa 5 MB (backend kiểm tra lại). */
const QR_TYPES = ['image/jpeg', 'image/png']
const QR_MAX_BYTES = 5 * 1024 * 1024

const EXTENSION_OPTIONS = [
  { months: 12, label: '12 tháng (1 năm)' },
  { months: 24, label: '24 tháng (2 năm)' },
  { months: 36, label: '36 tháng (3 năm)' },
]

/** Số ngày còn lại được coi là "sắp hết hạn" để tô màu cảnh báo. */
const EXPIRING_SOON_DAYS = 30

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Backend tính kỳ hạn tối thiểu 12 tháng: endDate = startDate + months - 1 ngày. */
function endDateForMonths(startIso, months) {
  const [year, month, day] = startIso.split('-').map(Number)
  const targetYear = year + Math.floor((month - 1 + months) / 12)
  const targetMonth = (month - 1 + months) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const end = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
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

export default function AdminFacilitiesPage() {
  const [notificationParams] = useSearchParams()
  const requestedRegistration = notificationParams.get('registrationId')
  const [pendingRequests, setPendingRequests] = useState([])
  useEffect(() => {
    if (!requestedRegistration) return
    const row = document.getElementById('registration-' + requestedRegistration)
    row?.scrollIntoView({ block: 'center' })
    row?.focus({ preventScroll: true })
  }, [requestedRegistration, pendingRequests])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const processingRegistration = useRef(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')
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

  useEffect(() => {
    Promise.resolve().then(() => loadOperatorInfo())
  }, [])

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

  // FR11: Admin xem ảnh chứng từ chuyển khoản tiền thuê trước khi duyệt.
  const handleViewProof = async (request) => {
    setSaving(true)
    try {
      const blob = await getServiceRegistrationProof(request.id)
      setModal({ type: 'proof', locationName: request.locationName, url: URL.createObjectURL(blob) })
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
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
    Promise.resolve().then(() => loadAll())
  }, [])

  const filteredFacilities = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return facilities.filter((facility) => {
      if (statusFilter !== 'ALL' && facility.status !== statusFilter) return false
      if (!keyword) return true
      return (
        (facility.name ?? '').toLocaleLowerCase().includes(keyword) ||
        (facility.ownerName ?? '').toLocaleLowerCase().includes(keyword)
      )
    })
  }, [facilities, searchKeyword, statusFilter])

  const activeCount = facilities.filter((facility) => facility.status === 'ACTIVE').length
  const lockedCount = facilities.filter((facility) => facility.status === 'LOCKED').length

  // --------------------------------------------------- UC05: duyệt / từ chối đơn đăng ký

  const handleApprove = async (request) => {
    if (processingRegistration.current || saving) return
    const confirmed = window.confirm(
      `Duyệt "${request.locationName}"?\n`
      + `Chỉ duyệt khi đã thấy ${formatVnd(request.rentalAmount)} về tài khoản của bên vận hành.\n`
      + `Hệ thống sẽ tạo địa điểm, ghi thời hạn ${request.rentalYears} năm từ hôm nay`
      + `${request.requesterId ? '' : ", tạo tài khoản chủ sân"} và gửi email kết quả tới ${request.contactEmail}.`,
    )
    if (!confirmed) return
    processingRegistration.current = true
    setSaving(true)
    try {
      await approveServiceRegistration(request.id)
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
      await loadAll()
      setModal(null)
      setActionError('')
      setStatusMessage(`Đã từ chối "${modal.locationName}" và gửi email lý do tới chủ sân.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      processingRegistration.current = false
      setSaving(false)
    }
  }

  // ------------------------------------------------------------- UC06: khoá / mở lại

  const handleLock = async (facility) => {
    const confirmed = window.confirm(
      `Khóa địa điểm "${facility.name}"? Địa điểm sẽ không hiển thị trong tìm kiếm và không nhận lượt đặt sân mới.`,
    )
    if (!confirmed) return
    setSaving(true)
    try {
      await updateLocationStatus(facility.id, 'LOCKED')
      await loadAll()
      setActionError('')
      setStatusMessage(`"${facility.name}" đã được khóa.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleReopen = async (facility) => {
    // Địa điểm hết kỳ hạn mà mở lại ngay sẽ bị job khoá lại đêm nay,
    // nên bắt buộc gia hạn trước rồi mới mở.
    if (facility.serviceActive === false) {
      openExtendModal(facility, true)
      return
    }
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

  // ------------------------------------------------------------- UC06: gia hạn kỳ hạn

  const openExtendModal = async (facility, reopening = false) => {
    setModal({
      type: 'extend',
      facilityId: facility.id,
      facilityName: facility.name,
      months: 12,
      startDate: '',
      reopening,
      currentEndDate: facility.serviceTermEndDate ?? null,
    })
    setActionError('')
    setStatusMessage('')

    // Kỳ hạn mới phải nối tiếp kỳ hạn xa nhất đã có, nếu không backend báo trùng.
    try {
      const terms = await getLocationServiceTerms(facility.id)
      const latestEnd = terms
        .map((term) => term.endDate)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
      const today = todayIso()
      const startDate = latestEnd && latestEnd >= today ? addDays(latestEnd, 1) : today
      setModal((current) => (
        current && current.facilityId === facility.id
          ? { ...current, startDate, currentEndDate: latestEnd }
          : current
      ))
    } catch {
      setModal((current) => (
        current && current.facilityId === facility.id ? { ...current, startDate: todayIso() } : current
      ))
    }
  }

  const handleConfirmExtension = async (event) => {
    event.preventDefault()
    if (!modal?.startDate) {
      setActionError("Chọn ngày bắt đầu kỳ hạn dịch vụ mới.")
      return
    }
    const endDate = endDateForMonths(modal.startDate, Number(modal.months))
    setSaving(true)
    try {
      await createServiceTerm(modal.facilityId, { startDate: modal.startDate, endDate })
      if (modal.reopening) {
        await updateLocationStatus(modal.facilityId, 'ACTIVE')
      }
      await loadAll()
      setModal(null)
      setActionError('')
      setStatusMessage(modal.reopening
        ? `"${modal.facilityName}" đã gia hạn đến ${formatDate(endDate)} và đã được mở lại.`
        : `"${modal.facilityName}" đã gia hạn dịch vụ đến ${formatDate(endDate)}.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
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
    if (modal?.type === 'proof' && modal.url) URL.revokeObjectURL(modal.url)
    setModal(null)
    setActionError('')
  }

  const clearStatus = () => {
    setStatusMessage('')
    setActionError('')
  }

  /** Trạng thái kỳ hạn: hết hạn / sắp hết hạn / còn hạn / chưa có kỳ hạn. */
  const periodInfo = (facility) => {
    const end = facility.serviceTermEndDate
    if (!end) return { kind: 'none', text: 'Chưa có kỳ hạn' }
    if (facility.serviceActive === false) return { kind: 'expired', text: `Hết hạn ${formatDate(end)}` }
    const remaining = daysBetween(todayIso(), String(end).slice(0, 10))
    if (remaining <= EXPIRING_SOON_DAYS) {
      return { kind: 'expiring', text: `Sắp hết hạn ${formatDate(end)} (${remaining} ngày)` }
    }
    return { kind: 'range', text: `Hiệu lực đến ${formatDate(end)}` }
  }

  return (
    <AdminLayout
      title="Quản lý địa điểm & Đăng ký dịch vụ"
      subtitle="Kiểm duyệt đơn đăng ký của chủ sân và quản lý kỳ hạn hoạt động"
      actions={
        <button
          className={styles.secondaryButton || 'cw-secondary'}
          type="button"
          onClick={loadAll}
          disabled={loading || saving}
        >
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      }
    >
        <AdminCourtExpansions />

        {(statusMessage || (actionError && !modal)) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Đóng thông báo" onClick={clearStatus}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.requestsPanel}`} aria-labelledby="requests-title">
          <h2 className={styles.sectionTitle} id="requests-title">
            Đơn đăng ký dịch vụ chờ duyệt ({pendingRequests.length})
          </h2>
          <div className={styles.requestList}>
            {pendingRequests.map((request) => (
              <article className={`${styles.requestRow} ${String(request.id) === requestedRegistration ? 'ring-2 ring-emerald-600' : ''}`}
                id={`registration-${request.id}`} tabIndex={-1} key={request.id}>
                <div className={styles.requestInfo}>
                  <div className={styles.requestHeading}>
                    <h3>{request.locationName}</h3>
                    <span className={styles.requestType}>{request.courtCount} sân</span>
                    <span className={styles.requestType}>{request.rentalYears} năm</span>
                    <span className={styles.requestType}>{formatVnd(request.rentalAmount)}</span>
                    <span className={styles.requestType}>{request.requesterId ? "chủ sân thêm địa điểm" : 'Chủ sân mới'}</span>
                  </div>
                  <p className={styles.requestAddress}>{request.address || 'Chưa có địa chỉ'}</p>
                  <p className={styles.requestMeta}>
                    {request.requesterName || 'Chưa rõ người gửi'}
                    {request.contactPhone ? ` · ${request.contactPhone}` : ''}
                    {request.contactEmail ? ` · ${request.contactEmail}` : ''}
                    {` · gửi lúc ${formatDateTime(request.createdAt)}`}
                  </p>
                </div>
                <div className={styles.requestActions}>
                  {request.hasProof ? (
                    <button className={styles.extendButton} type="button" onClick={() => handleViewProof(request)} disabled={saving}>
                      Xem chứng từ
                    </button>
                  ) : (
                    <span className={styles.requestMeta}>Không có ảnh chứng từ</span>
                  )}
                  <button className={styles.rejectButton} type="button" onClick={() => handleReject(request)} disabled={saving}>
                    Từ chối
                  </button>
                  <button className={styles.approveButton} type="button" onClick={() => handleApprove(request)} disabled={saving}>
                    Duyệt
                  </button>
                </div>
              </article>
            ))}
            {!loading && pendingRequests.length === 0 && (
              <p className={styles.emptyState}>Không có đơn đăng ký dịch vụ nào đang chờ duyệt.</p>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.requestsPanel}`} aria-labelledby="operator-payment-title">
          <h2 className={styles.sectionTitle} id="operator-payment-title">
            Thông tin nhận chuyển khoản của bên vận hành
          </h2>
          <p className={styles.requestMeta}>
            Hiện trên form đăng ký sử dụng dịch vụ để chủ sân chuyển khoản tiền thuê.
            {operatorInfo && !operatorInfo.customQr && ' Đang dùng ảnh QR mặc định khi cài hệ thống: hãy tải ảnh QR thật của tài khoản lên.'}
          </p>
          {(operatorMessage || operatorError) && (
            <div className={operatorError ? styles.errorNotice : styles.statusNotice} role={operatorError ? 'alert' : 'status'}>
              <span>{operatorError || operatorMessage}</span>
              <button type="button" aria-label="Đóng thông báo" onClick={() => { setOperatorError(''); setOperatorMessage('') }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', padding: '12px 0' }}>
            {operatorInfo && (
              <div>
                <img
                  src={operatorQrUrl(operatorInfo.updatedAt)}
                  alt="Mã QR chuyển khoản của bên vận hành"
                  width={160}
                  height={160}
                  style={{ border: '1px solid #e3e7ed', borderRadius: 8, background: '#fff', display: 'block' }}
                />
                <label className={styles.modalField} style={{ marginTop: 8 }}>
                  <span>Thay ảnh QR (JPG/PNG, tối đa 5 MB)</span>
                  <FileInput
                    accept="image/jpeg,image/png"
                    disabled={saving}
                    onChange={(event) => { handleOperatorQr(event.target.files?.[0]); event.target.value = '' }}
                  />
                </label>
              </div>
            )}
            <form onSubmit={handleSaveOperatorInfo} style={{ flex: '1 1 280px', maxWidth: 420 }}>
              <label className={styles.modalField}>
                <span>Ngân hàng</span>
                <input
                  maxLength={100}
                  value={operatorForm.bankName}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankName: event.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>Số tài khoản</span>
                <input
                  maxLength={30}
                  value={operatorForm.bankAccountNo}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankAccountNo: event.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>Tên chủ tài khoản</span>
                <input
                  maxLength={100}
                  value={operatorForm.bankAccountHolder}
                  onChange={(event) => setOperatorForm((form) => ({ ...form, bankAccountHolder: event.target.value }))}
                />
              </label>
              <button className={styles.approveButton} type="submit" disabled={saving}>
                Lưu thông tin chuyển khoản
              </button>
            </form>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="facilities-title">
          <div className={styles.facilitiesHeader}>
            <h2 className={styles.sectionTitle} id="facilities-title">
              Danh sách cụm sân ({facilities.length})
              <span className={styles.countHint}>
                {activeCount} hoạt động · {lockedCount} đã khóa
              </span>
            </h2>
            <div className={styles.filterGroup}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Lọc theo trạng thái</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="LOCKED">Đã khóa</option>
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Tìm theo tên sân hoặc chủ sân</span>
                <input
                  type="search"
                  placeholder="Tìm theo tên sân hoặc chủ sân"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row">
              <span role="columnheader">Địa điểm sân</span>
              <span role="columnheader">Trạng thái</span>
              <span role="columnheader">Kỳ hạn dịch vụ</span>
              <span role="columnheader">Số sân</span>
              <span role="columnheader">Số đơn đặt sân</span>
              <span role="columnheader">Hành động</span>
            </div>
            {filteredFacilities.map((facility) => {
              const period = periodInfo(facility)
              return (
                <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={facility.id}>
                  <div className={styles.facilityName} role="cell">
                    <strong>{facility.name}</strong>
                    <span>Chủ sân: {facility.ownerName || '—'}</span>
                  </div>
                  <div className={styles.statusCell} role="cell">
                    <span className={`${styles.statusBadge} ${facility.status === 'ACTIVE' ? styles.statusActive : styles.statusLocked}`}>
                      {facility.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </div>
                  <div
                    className={`${styles.servicePeriod} ${period.kind === 'expiring' ? styles.periodExpiring : ''} ${period.kind === 'expired' ? styles.periodExpired : ''}`}
                    role="cell"
                  >
                    {period.text}
                    {facility.lockedAt && facility.status === 'LOCKED' && (
                      <span className={styles.lockedHint}>Đã khóa {formatDateTime(facility.lockedAt)}</span>
                    )}
                  </div>
                  <span className={styles.numberCell} role="cell">{facility.courtCount ?? 0}</span>
                  <span className={styles.numberCell} role="cell">{facility.bookingCount ?? 0}</span>
                  <div className={styles.facilityActions} role="cell">
                    <button className={styles.extendButton} type="button" onClick={() => openExtendModal(facility)} disabled={saving}>
                      Gia hạn
                    </button>
                    {facility.status === 'ACTIVE' ? (
                      <button className={styles.lockButton} type="button" onClick={() => handleLock(facility)} disabled={saving}>
                        Khóa
                      </button>
                    ) : (
                      <button className={styles.reopenButton} type="button" onClick={() => handleReopen(facility)} disabled={saving}>
                        Mở lại
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && <p className={styles.emptyState}>Đang tải danh sách địa điểm…</p>}
            {!loading && filteredFacilities.length === 0 && (
              <p className={styles.emptyState}>Không có địa điểm nào phù hợp bộ lọc.</p>
            )}
          </div>
        </section>

        {modal?.type === 'proof' && (
          <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="proof-modal-title">
              <h2 id="proof-modal-title">Chứng từ chuyển khoản</h2>
              <p>Đơn đăng ký "{modal.locationName}". Đối chiếu với lịch sử giao dịch của tài khoản bên vận hành trước khi duyệt.</p>
              <img src={modal.url} alt="Ảnh chứng từ chuyển khoản tiền thuê" style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto' }} />
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} type="button" onClick={closeModal}>Đóng</button>
              </div>
            </section>
          </div>
        )}

        {modal && modal.type !== 'proof' && (
          <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
              <h2 id="admin-modal-title">
                {modal.type === 'reject'
                  ? 'Từ chối đơn đăng ký dịch vụ'
                  : modal.reopening ? 'Gia hạn và mở lại cụm sân' : 'Gia hạn kỳ hạn dịch vụ'}
              </h2>
              <p>
                {modal.type === 'reject'
                  ? `Hệ thống gửi email lý do tới chủ sân của "${modal.locationName}" (MSG117), kèm câu bên vận hành sẽ liên hệ hoàn tiền thuê đã chuyển.`
                  : `Kỳ hạn dịch vụ mới cho "${modal.facilityName}". Hệ thống yêu cầu tối thiểu 12 tháng và không trùng lặp với kỳ hạn đang có.`}
              </p>
              <form onSubmit={modal.type === 'reject' ? handleConfirmRejection : handleConfirmExtension}>
                {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
                {modal.type === 'reject' ? (
                  <label className={styles.modalField}>
                    <span>Lý do từ chối</span>
                    <textarea
                      autoFocus
                      required
                      disabled={saving}
                      rows="4"
                      maxLength={500}
                      value={modal.reason}
                      onChange={(event) => updateModalField('reason', event.target.value)}
                    />
                  </label>
                ) : (
                  <>
                    <label className={styles.modalField}>
                      <span>Thời hạn gia hạn</span>
                      <select value={modal.months} onChange={(event) => updateModalField('months', Number(event.target.value))}>
                        {EXTENSION_OPTIONS.map((option) => (
                          <option key={option.months} value={option.months}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.modalField}>
                      <span>Ngày bắt đầu</span>
                      <input
                        type="date"
                        value={modal.startDate}
                        onChange={(event) => updateModalField('startDate', event.target.value)}
                      />
                    </label>
                    <p className={styles.computedDate}>
                      Kỳ hạn mới: <strong>{formatDate(modal.startDate)}</strong> –{' '}
                      <strong>{formatDate(endDateForMonths(modal.startDate || todayIso(), Number(modal.months)))}</strong>
                      {modal.currentEndDate && (
                        <span className={styles.computedHint}>Kỳ hạn hiện tại kết thúc ngày {formatDate(modal.currentEndDate)}</span>
                      )}
                    </p>
                  </>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.cancelButton} type="button" onClick={closeModal} disabled={saving}>
                    Hủy
                  </button>
                  <button className={styles.approveButton} type="submit" disabled={saving}>
                    {modal.type === 'reject'
                      ? 'Gửi từ chối'
                      : modal.reopening ? 'Gia hạn & Mở lại' : 'Xác nhận gia hạn'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
    </AdminLayout>
  )
}
