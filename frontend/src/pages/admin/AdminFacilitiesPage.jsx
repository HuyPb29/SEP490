import { useEffect, useMemo, useState } from 'react'
import {
  apiErrorMessage,
  approveServiceRegistration,
  createServiceTerm,
  getAdminLocations,
  getAdminServiceRegistrations,
  getLocationServiceTerms,
  rejectServiceRegistration,
  updateLocationStatus,
} from '../../api/locationApi'
import styles from './AdminFacilitiesPage.module.css'

const EXTENSION_OPTIONS = [
  { months: 12, label: '12 months (1 year)' },
  { months: 24, label: '24 months (2 years)' },
  { months: 36, label: '36 months (3 years)' },
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
  const [pendingRequests, setPendingRequests] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

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
    loadAll()
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
    if (!window.confirm(`Approve "${request.locationName}"? Courts and default opening hours (06:00–24:00) will be created.`)) return
    setSaving(true)
    try {
      await approveServiceRegistration(request.id)
      await loadAll()
      setActionError('')
      setStatusMessage(`Approved "${request.locationName}". Courts and default opening hours were created.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = (request) => {
    setModal({ type: 'reject', requestId: request.id, locationName: request.locationName, reason: '' })
    setActionError('')
    setStatusMessage('')
  }

  const handleConfirmRejection = async (event) => {
    event.preventDefault()
    if (!modal?.reason.trim()) {
      setActionError('A rejection reason is required.')
      return
    }
    setSaving(true)
    try {
      await rejectServiceRegistration(modal.requestId, modal.reason.trim())
      await loadAll()
      setModal(null)
      setActionError('')
      setStatusMessage(`Rejected "${modal.locationName}".`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------- UC06: khoá / mở lại

  const handleLock = async (facility) => {
    const confirmed = window.confirm(
      `Lock "${facility.name}"? The facility will stop appearing in search and will not accept new bookings.`,
    )
    if (!confirmed) return
    setSaving(true)
    try {
      await updateLocationStatus(facility.id, 'LOCKED')
      await loadAll()
      setActionError('')
      setStatusMessage(`"${facility.name}" has been locked.`)
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
      setStatusMessage(`"${facility.name}" has been reopened.`)
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
      setActionError('Choose a start date for the new service period.')
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
        ? `"${modal.facilityName}" extended to ${formatDate(endDate)} and reopened.`
        : `"${modal.facilityName}" service extended to ${formatDate(endDate)}.`)
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
    if (!end) return { kind: 'none', text: 'No service term' }
    if (facility.serviceActive === false) return { kind: 'expired', text: `Expired ${formatDate(end)}` }
    const remaining = daysBetween(todayIso(), String(end).slice(0, 10))
    if (remaining <= EXPIRING_SOON_DAYS) {
      return { kind: 'expiring', text: `Expires ${formatDate(end)} (${remaining}d)` }
    }
    return { kind: 'range', text: `Valid to ${formatDate(end)}` }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandBolt} aria-hidden="true">⚡</span>
          <span>Courtly</span>
        </div>

        <div className={styles.roleCard}>
          <span>System Administration</span>
          <strong>Admin</strong>
        </div>

        <nav className={styles.navigation} aria-label="Admin navigation">
          <button className={`${styles.navItem} ${styles.navItemActive}`} type="button" aria-current="page">
            <span>Facilities</span>
            <span className={styles.pendingBadge} aria-label={`${pendingRequests.length} pending requests`}>
              {pendingRequests.length}
            </span>
          </button>
          <button className={styles.navItem} type="button">Accounts</button>
          <button className={styles.navItem} type="button">Violating Vouchers</button>
          <button className={styles.navItem} type="button">Violating Reviews</button>
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Manage Service Facilities</h1>

        {(statusMessage || (actionError && !modal)) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={clearStatus}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.requestsPanel}`} aria-labelledby="requests-title">
          <h2 className={styles.sectionTitle} id="requests-title">
            Pending Registration Requests ({pendingRequests.length})
          </h2>
          <div className={styles.requestList}>
            {pendingRequests.map((request) => (
              <article className={styles.requestRow} key={request.id}>
                <div className={styles.requestInfo}>
                  <div className={styles.requestHeading}>
                    <h3>{request.locationName}</h3>
                    <span className={styles.requestType}>{request.courtCount} courts</span>
                  </div>
                  <p className={styles.requestAddress}>{request.address || 'No address'}</p>
                  <p className={styles.requestMeta}>
                    {request.requesterName || 'Unknown requester'}
                    {request.contactPhone ? ` · ${request.contactPhone}` : ''}
                    {request.contactEmail ? ` · ${request.contactEmail}` : ''}
                    {` · submitted ${formatDateTime(request.createdAt)}`}
                  </p>
                </div>
                <div className={styles.requestActions}>
                  <button className={styles.rejectButton} type="button" onClick={() => handleReject(request)} disabled={saving}>
                    Reject
                  </button>
                  <button className={styles.approveButton} type="button" onClick={() => handleApprove(request)} disabled={saving}>
                    Approve
                  </button>
                </div>
              </article>
            ))}
            {!loading && pendingRequests.length === 0 && (
              <p className={styles.emptyState}>There are no pending registration requests.</p>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="facilities-title">
          <div className={styles.facilitiesHeader}>
            <h2 className={styles.sectionTitle} id="facilities-title">
              Facilities ({facilities.length})
              <span className={styles.countHint}>
                {activeCount} active · {lockedCount} locked
              </span>
            </h2>
            <div className={styles.filterGroup}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LOCKED">Locked</option>
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Search by facility or owner name</span>
                <input
                  type="search"
                  placeholder="Search by facility or owner"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row">
              <span role="columnheader">Facility</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Service Period</span>
              <span role="columnheader">Courts</span>
              <span role="columnheader">Actions</span>
            </div>
            {filteredFacilities.map((facility) => {
              const period = periodInfo(facility)
              return (
                <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={facility.id}>
                  <div className={styles.facilityName} role="cell">
                    <strong>{facility.name}</strong>
                    <span>Owner: {facility.ownerName || '—'}</span>
                  </div>
                  <div className={styles.statusCell} role="cell">
                    <span className={`${styles.statusBadge} ${facility.status === 'ACTIVE' ? styles.statusActive : styles.statusLocked}`}>
                      {facility.status === 'ACTIVE' ? 'Active' : 'Locked'}
                    </span>
                  </div>
                  <div
                    className={`${styles.servicePeriod} ${period.kind === 'expiring' ? styles.periodExpiring : ''} ${period.kind === 'expired' ? styles.periodExpired : ''}`}
                    role="cell"
                  >
                    {period.text}
                    {facility.lockedAt && facility.status === 'LOCKED' && (
                      <span className={styles.lockedHint}>Locked {formatDateTime(facility.lockedAt)}</span>
                    )}
                  </div>
                  <span className={styles.numberCell} role="cell">{facility.courtCount ?? 0}</span>
                  <div className={styles.facilityActions} role="cell">
                    <button className={styles.extendButton} type="button" onClick={() => openExtendModal(facility)} disabled={saving}>
                      Extend
                    </button>
                    {facility.status === 'ACTIVE' ? (
                      <button className={styles.lockButton} type="button" onClick={() => handleLock(facility)} disabled={saving}>
                        Lock
                      </button>
                    ) : (
                      <button className={styles.reopenButton} type="button" onClick={() => handleReopen(facility)} disabled={saving}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && <p className={styles.emptyState}>Loading facilities…</p>}
            {!loading && filteredFacilities.length === 0 && (
              <p className={styles.emptyState}>No facilities match your filter.</p>
            )}
          </div>
        </section>

        {modal && (
          <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
              <h2 id="admin-modal-title">
                {modal.type === 'reject'
                  ? 'Reject Registration Request'
                  : modal.reopening ? 'Extend and Reopen Facility' : 'Extend Service Period'}
              </h2>
              <p>
                {modal.type === 'reject'
                  ? `The owner of "${modal.locationName}" will see this reason.`
                  : `New service period for "${modal.facilityName}". The backend requires at least 12 months and no overlap with existing periods.`}
              </p>
              <form onSubmit={modal.type === 'reject' ? handleConfirmRejection : handleConfirmExtension}>
                {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
                {modal.type === 'reject' ? (
                  <label className={styles.modalField}>
                    <span>Rejection reason</span>
                    <textarea
                      autoFocus
                      rows="4"
                      maxLength={500}
                      value={modal.reason}
                      onChange={(event) => updateModalField('reason', event.target.value)}
                    />
                  </label>
                ) : (
                  <>
                    <label className={styles.modalField}>
                      <span>Extension period</span>
                      <select value={modal.months} onChange={(event) => updateModalField('months', Number(event.target.value))}>
                        {EXTENSION_OPTIONS.map((option) => (
                          <option key={option.months} value={option.months}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.modalField}>
                      <span>Start date</span>
                      <input
                        type="date"
                        value={modal.startDate}
                        onChange={(event) => updateModalField('startDate', event.target.value)}
                      />
                    </label>
                    <p className={styles.computedDate}>
                      New period: <strong>{formatDate(modal.startDate)}</strong> –{' '}
                      <strong>{formatDate(endDateForMonths(modal.startDate || todayIso(), Number(modal.months)))}</strong>
                      {modal.currentEndDate && (
                        <span className={styles.computedHint}>Current period ends {formatDate(modal.currentEndDate)}</span>
                      )}
                    </p>
                  </>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.cancelButton} type="button" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button className={styles.approveButton} type="submit" disabled={saving}>
                    {modal.type === 'reject'
                      ? 'Send Rejection'
                      : modal.reopening ? 'Extend & Reopen' : 'Confirm Extension'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
