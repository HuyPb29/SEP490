import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiErrorMessage,
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  createMaintenanceRequest,
  getMaintenanceRequests,
  getOwnerLocations,
  getStaffCourts,
  getStoredLocationId,
  rejectMaintenanceRequest,
  storeLocationId,
} from '../../api/locationApi'
import styles from './MaintenanceRequestsPage.module.css'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

function readCurrentUser() {
  try {
    const raw = localStorage.getItem('bms_user_info')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** LocalDateTime "2026-11-10T19:00:00" -> "10/11/2026 19:00". */
function formatDateTime(value) {
  if (!value) return '—'
  const [datePart, timePart = ''] = String(value).split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`
}

/** LocalDateTime -> value cho <input type="datetime-local">. */
function toInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 16)
}

function defaultStartAt() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  const pad = (number) => String(number).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function addHours(inputValue, hours) {
  if (!inputValue) return ''
  const date = new Date(`${inputValue}:00`)
  date.setHours(date.getHours() + hours)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyForm() {
  const startAt = defaultStartAt()
  return { courtId: '', startAt, endAt: addHours(startAt, 2), reason: '' }
}

export default function MaintenanceRequestsPage() {
  const currentUser = useMemo(() => readCurrentUser(), [])
  const role = String(currentUser?.role_code ?? '').toUpperCase()
  const isOwner = role === 'OWNER'
  const isStaff = role === 'STAFF'

  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(() => getStoredLocationId())
  const [courts, setCourts] = useState([])
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const selectedLocation =
    locations.find((location) => String(location.id) === String(selectedLocationId)) || null

  const loadRequests = async (status = statusFilter) => {
    if (!isOwner && !isStaff) {
      setRequests([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await getMaintenanceRequests(isOwner ? 'OWNER' : 'STAFF', status || null)
      setRequests(list)
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Owner chọn địa điểm trước; staff bị ghim vào địa điểm trên tài khoản.
  useEffect(() => {
    const bootstrap = async () => {
      if (isOwner) {
        try {
          const list = await getOwnerLocations()
          setLocations(list)
          setSelectedLocationId((currentId) => {
            const exists = list.some((location) => String(location.id) === String(currentId))
            const nextId = exists ? currentId : list[0]?.id ?? null
            storeLocationId(nextId)
            return nextId
          })
        } catch (err) {
          setActionError(apiErrorMessage(err))
        }
      }
      if (isStaff) {
        try {
          setCourts(await getStaffCourts())
        } catch (err) {
          setActionError(apiErrorMessage(err))
        }
      }
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadRequests(statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, selectedLocationId])

  // Owner đổi địa điểm thì danh sách sân của form cũng đổi theo.
  useEffect(() => {
    if (isOwner) {
      setCourts(selectedLocation?.courts ?? [])
    }
  }, [isOwner, selectedLocation])

  const updateForm = (field, value) => {
    setForm((current) => {
      if (field === 'startAt') {
        // Giữ khoảng thời gian 2 giờ khi đổi giờ bắt đầu.
        return { ...current, startAt: value, endAt: addHours(value, 2) }
      }
      return { ...current, [field]: value }
    })
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!form.courtId) {
      setActionError('Choose the court that needs maintenance.')
      return
    }
    if (!form.startAt || !form.endAt) {
      setActionError('Enter both the start and end time.')
      return
    }
    if (form.endAt <= form.startAt) {
      setActionError('The end time must be later than the start time.')
      return
    }
    if (!form.reason.trim()) {
      setActionError('Enter a maintenance reason.')
      return
    }
    setSaving(true)
    try {
      await createMaintenanceRequest({
        courtId: Number(form.courtId),
        startAt: `${form.startAt}:00`,
        endAt: `${form.endAt}:00`,
        reason: form.reason.trim(),
      })
      setForm(emptyForm())
      await loadRequests(statusFilter)
      setActionError('')
      setStatusMessage('Maintenance request submitted. The owner will review it.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (request) => {
    if (!window.confirm(`Cancel the maintenance request for "${request.courtName}"?`)) return
    setSaving(true)
    try {
      await cancelMaintenanceRequest(request.id, '')
      await loadRequests(statusFilter)
      setActionError('')
      setStatusMessage('Maintenance request cancelled.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (request) => {
    if (!window.confirm(
      `Approve maintenance for "${request.courtName}"? Confirmed bookings in this time range will be notified to reschedule, get a refund, or receive compensation points.`,
    )) return
    setSaving(true)
    try {
      await approveMaintenanceRequest(request.id)
      await loadRequests(statusFilter)
      setActionError('')
      setStatusMessage('Maintenance approved. Affected bookings were notified.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmReject = async (event) => {
    event.preventDefault()
    if (!rejectReason.trim()) {
      setActionError('A rejection reason is required.')
      return
    }
    setSaving(true)
    try {
      await rejectMaintenanceRequest(rejectTarget.id, rejectReason.trim())
      setRejectTarget(null)
      setRejectReason('')
      await loadRequests(statusFilter)
      setActionError('')
      setStatusMessage('Maintenance request rejected.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = requests.filter((request) => request.status === 'PENDING').length

  if (!isOwner && !isStaff) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <h1 className={styles.pageTitle}>Court Maintenance</h1>
          <p className={styles.noticeBox}>
            This screen is for Staff and Owner accounts. Sign in with a staff or owner account to manage
            maintenance requests.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandBolt} aria-hidden="true">⚡</span>
          <span>Courtly</span>
        </div>

        {isOwner && (
          <>
            <label className={styles.facilityLabel} htmlFor="maintenance-facility">Facility</label>
            <select
              className={styles.facilitySelect}
              id="maintenance-facility"
              value={selectedLocationId ?? ''}
              onChange={(event) => {
                setSelectedLocationId(event.target.value)
                storeLocationId(event.target.value)
                setActionError('')
                setStatusMessage('')
              }}
              disabled={locations.length === 0}
            >
              {locations.length === 0 && <option value="">No facility</option>}
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </>
        )}

        <nav className={styles.navigation} aria-label="Maintenance navigation">
          {isOwner && (
            <>
              <Link className={styles.navItem} to="/owner/courts-pricing">Courts &amp; Pricing</Link>
              <span className={`${styles.navItem} ${styles.navItemActive}`} aria-current="page">
                Maintenance Approval
              </span>
            </>
          )}
          {isStaff && (
            <span className={`${styles.navItem} ${styles.navItemActive}`} aria-current="page">
              Maintenance Requests
            </span>
          )}
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>{isOwner ? 'Maintenance Approval' : 'Court Maintenance'}</h1>

        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
        {statusMessage && <p className={styles.statusMessage} role="status">{statusMessage}</p>}

        {isStaff && (
          <section className={styles.panel} aria-labelledby="new-request-heading">
            <h2 id="new-request-heading">Report Maintenance</h2>
            <p className={styles.hint}>
              A request stays Pending until the owner approves it. Only approved requests block the court
              schedule.
            </p>
            <form className={styles.form} onSubmit={handleCreate}>
              <label className={styles.field}>
                <span>Court</span>
                <select value={form.courtId} onChange={(event) => updateForm('courtId', event.target.value)}>
                  <option value="">{courts.length === 0 ? 'No court in this facility' : 'Select a court'}</option>
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>{court.name}</option>
                  ))}
                </select>
              </label>
              <div className={styles.timeFields}>
                <label className={styles.field}>
                  <span>From</span>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => updateForm('startAt', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>To</span>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) => updateForm('endAt', event.target.value)}
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>Reason</span>
                <textarea
                  rows="3"
                  maxLength={500}
                  value={form.reason}
                  placeholder="Net replacement, floor repair, lighting…"
                  onChange={(event) => updateForm('reason', event.target.value)}
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                Submit Request
              </button>
            </form>
          </section>
        )}

        <section className={styles.panel} aria-labelledby="request-list-heading">
          <div className={styles.panelHeader}>
            <h2 id="request-list-heading">
              {isOwner ? 'Requests' : 'My Facility Requests'} ({requests.length})
              {pendingCount > 0 && <span className={styles.pendingTag}>{pendingCount} pending</span>}
            </h2>
            <label className={styles.filterField}>
              <span className={styles.visuallyHidden}>Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Court</th>
                  <th scope="col">Time</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Requested by</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isOwn = String(request.requestedBy) === String(currentUser?.user_id)
                  return (
                    <tr key={request.id}>
                      <td>{request.courtName}</td>
                      <td>
                        {formatDateTime(request.startAt)}
                        <span className={styles.subText}>
                          to {formatDateTime(request.endAt).slice(11)} · {request.durationMinutes} min
                        </span>
                      </td>
                      <td className={styles.reasonCell}>
                        {request.reason}
                        {request.rejectReason && (
                          <span className={styles.rejectNote}>Rejected: {request.rejectReason}</span>
                        )}
                        {request.cancelReason && (
                          <span className={styles.rejectNote}>Cancelled: {request.cancelReason}</span>
                        )}
                      </td>
                      <td>
                        {request.requesterName || '—'}
                        {request.approverName && (
                          <span className={styles.subText}>by {request.approverName}</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles[`badge${request.status}`] ?? ''}`}>
                          {STATUS_LABELS[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {isStaff && request.status === 'PENDING' && isOwn && (
                            <button className={styles.linkButton} type="button" onClick={() => handleCancel(request)} disabled={saving}>
                              Cancel
                            </button>
                          )}
                          {isOwner && request.status === 'PENDING' && (
                            <>
                              <button className={styles.approveButton} type="button" onClick={() => handleApprove(request)} disabled={saving}>
                                Approve
                              </button>
                              <button
                                className={styles.linkButton}
                                type="button"
                                onClick={() => {
                                  setRejectTarget(request)
                                  setRejectReason('')
                                  setActionError('')
                                }}
                                disabled={saving}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {request.status !== 'PENDING' && <span className={styles.muted}>—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {loading && <p className={styles.emptyState}>Loading requests…</p>}
          {!loading && requests.length === 0 && (
            <p className={styles.emptyState}>
              {isOwner ? 'No maintenance request in this facility.' : 'You have not reported any maintenance yet.'}
            </p>
          )}
        </section>

        {rejectTarget && (
          <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRejectTarget(null)
          }}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reject-title">
              <h2 id="reject-title">Reject Maintenance Request</h2>
              <p>The staff member will see this reason.</p>
              <form onSubmit={handleConfirmReject}>
                {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
                <label className={styles.field}>
                  <span>Rejection reason</span>
                  <textarea
                    autoFocus
                    rows="4"
                    maxLength={500}
                    value={rejectReason}
                    onChange={(event) => {
                      setRejectReason(event.target.value)
                      setActionError('')
                    }}
                  />
                </label>
                <div className={styles.modalActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => setRejectTarget(null)} disabled={saving}>
                    Cancel
                  </button>
                  <button className={styles.primaryButton} type="submit" disabled={saving}>
                    Send Rejection
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
