/**
 * OwnerMaintenancePage.jsx — UC10, FR23, FR24, FR25, BR16, BR17, BF-08
 *
 * Route: /owner/locations/:id/maintenance
 *
 * Features:
 * - Maintenance requests list with status filters (All, Pending, Approved, Rejected)
 * - Details: Court Name, Maintenance Date (YYYY-MM-DD), Time Slot, Reason, Requested By, Affected Bookings, Status
 * - Approve flow:
 *   * If affected_bookings_count > 0: Shows MSG15 confirmation modal; on confirm: MSG19
 *   * If affected_bookings_count === 0: Directly approves: MSG19
 * - Reject flow (BF-08):
 *   * Opens Rejection Modal with optional Rejection Note; on confirm: MSG19
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getMaintenanceRequestsApi,
  approveMaintenanceRequestApi,
  rejectMaintenanceRequestApi,
} from '../../api/ownerApi'
import styles from './OwnerMaintenancePage.module.css'

const FILTER_TABS = ['All', 'Pending', 'Approved', 'Rejected']

export default function OwnerMaintenancePage() {
  const { id: locationId } = useParams()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [toastMessage, setToastMessage] = useState('')
  const [processingId, setProcessingId] = useState(null)

  // MSG15 Approval Confirmation Modal state (for affected_bookings_count > 0)
  const [approveConfirmTarget, setApproveConfirmTarget] = useState(null)

  // Rejection Modal state (BF-08)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionNote, setRejectionNote] = useState('')

  useEffect(() => {
    let isCancelled = false
    getMaintenanceRequestsApi(locationId)
      .then((data) => {
        if (!isCancelled) setRequests(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!isCancelled) setPageError(err?.response?.data?.message || err?.message || 'Failed to load maintenance requests.')
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [locationId])

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  // ── Filter counts ──────────────────────────────────────────────────────────

  const countByStatus = {
    All: requests.length,
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Approved: requests.filter((r) => r.status === 'Approved').length,
    Rejected: requests.filter((r) => r.status === 'Rejected').length,
  }

  const filteredRequests = requests.filter((r) => {
    if (activeFilter === 'All') return true
    return r.status === activeFilter
  })

  // ── Approve Action (BR16, BR17) ────────────────────────────────────────────

  async function handleApproveClick(req) {
    if (req.affected_bookings_count > 0) {
      // Prompt MSG15 modal
      setApproveConfirmTarget(req)
    } else {
      // Direct approval without modal
      await executeApproval(req.id, false)
    }
  }

  async function executeApproval(requestId, hadAffectedBookings) {
    setProcessingId(requestId)
    try {
      await approveMaintenanceRequestApi(locationId, requestId)
      setRequests((prev) =>
        prev.map((item) => (item.id === requestId ? { ...item, status: 'Approved' } : item))
      )
      setApproveConfirmTarget(null)

      if (hadAffectedBookings) {
        showToast(
          '[MSG19] Maintenance request approved. Court slots are locked and affected customers have been notified (MSG67).'
        )
      } else {
        showToast('[MSG19] Maintenance request approved and court slots locked successfully.')
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to approve maintenance request.')
    } finally {
      setProcessingId(null)
    }
  }

  // ── Reject Action (BF-08) ──────────────────────────────────────────────────

  function handleRejectClick(req) {
    setRejectTarget(req)
    setRejectionNote('')
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return
    setProcessingId(rejectTarget.id)
    try {
      await rejectMaintenanceRequestApi(locationId, rejectTarget.id, { note: rejectionNote })
      setRequests((prev) =>
        prev.map((item) =>
          item.id === rejectTarget.id
            ? { ...item, status: 'Rejected', rejection_note: rejectionNote }
            : item
        )
      )
      setRejectTarget(null)
      showToast('[MSG19] Maintenance request rejected. Court schedule remains unchanged.')
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to reject maintenance request.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* MSG15 Confirmation Modal for Affected Bookings */}
      {approveConfirmTarget && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-modal-title"
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="approve-modal-title">Confirm Maintenance Approval</h2>
              <button
                className={styles.closeBtn}
                type="button"
                onClick={() => setApproveConfirmTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningAlert} role="alert">
                <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
                <p className={styles.alertText}>
                  [MSG15] This change affects {approveConfirmTarget.affected_bookings_count} confirmed booking(s). Customers will be notified (MSG67) to choose a resolution. Do you want to continue?
                </p>
              </div>

              <div className={styles.targetSummary}>
                <div><strong>Court:</strong> {approveConfirmTarget.court_name}</div>
                <div><strong>Date & Time:</strong> {approveConfirmTarget.maintenance_date} ({approveConfirmTarget.start_time} – {approveConfirmTarget.end_time})</div>
                <div><strong>Reason:</strong> {approveConfirmTarget.reason}</div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={() => setApproveConfirmTarget(null)}
                  disabled={processingId === approveConfirmTarget.id}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmApproveBtn}
                  type="button"
                  onClick={() => executeApproval(approveConfirmTarget.id, true)}
                  disabled={processingId === approveConfirmTarget.id}
                >
                  {processingId === approveConfirmTarget.id ? 'Approving…' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal (Report 3 BF-08) */}
      {rejectTarget && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="reject-modal-title">Reject Maintenance Request</h2>
              <button
                className={styles.closeBtn}
                type="button"
                onClick={() => setRejectTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSub}>
                Rejecting maintenance request for <strong>{rejectTarget.court_name}</strong> on {rejectTarget.maintenance_date} ({rejectTarget.start_time} – {rejectTarget.end_time}).
              </p>

              <div className={styles.field}>
                <label htmlFor="rejection-note" className={styles.fieldLabel}>
                  Rejection Note (optional)
                </label>
                <textarea
                  id="rejection-note"
                  className={styles.textarea}
                  rows={3}
                  placeholder="Explain why this maintenance request was rejected..."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  disabled={processingId === rejectTarget.id}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmRejectBtn}
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={processingId === rejectTarget.id}
                >
                  {processingId === rejectTarget.id ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Maintenance Approval</h1>
          <p className={styles.sub}>
            Location #{locationId} · Review court maintenance requests and resolve booking conflicts
          </p>
        </div>
      </div>

      {pageError && <p className={styles.pageError} role="alert">{pageError}</p>}

      {/* Filter Tabs */}
      <nav className={styles.filterTabs} aria-label="Maintenance status filter">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.filterTab} ${activeFilter === tab ? styles.filterTabActive : ''}`}
            onClick={() => setActiveFilter(tab)}
          >
            <span>{tab}</span>
            <span className={styles.filterBadge}>{countByStatus[tab]}</span>
          </button>
        ))}
      </nav>

      {/* Table Content */}
      {loading ? (
        <p className={styles.loading}>Loading maintenance requests…</p>
      ) : filteredRequests.length === 0 ? (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden="true">🛠️</span>
          <p className={styles.emptyText}>No {activeFilter !== 'All' ? activeFilter.toLowerCase() : ''} maintenance requests found.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Court</th>
                <th scope="col">Date</th>
                <th scope="col">Time Slot</th>
                <th scope="col">Reason</th>
                <th scope="col">Requested By</th>
                <th scope="col">Affected Bookings</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id}>
                  <td className={styles.courtCol}>
                    <strong>{req.court_name}</strong>
                  </td>
                  <td className={styles.dateCol}>
                    <code>{req.maintenance_date}</code>
                  </td>
                  <td className={styles.timeCol}>
                    {req.start_time} – {req.end_time}
                  </td>
                  <td className={styles.reasonCol}>
                    <p className={styles.reasonText}>{req.reason}</p>
                    {req.status === 'Rejected' && req.rejection_note && (
                      <p className={styles.rejectionNoteText}>
                        <strong>Rejection note:</strong> {req.rejection_note}
                      </p>
                    )}
                  </td>
                  <td className={styles.requestedByCol}>{req.requested_by}</td>
                  <td className={styles.affectedCol}>
                    {req.affected_bookings_count > 0 ? (
                      <span className={styles.affectedWarning}>
                        {req.affected_bookings_count} booking(s) affected
                      </span>
                    ) : (
                      <span className={styles.affectedZero}>0 (No conflict)</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status${req.status}`] || ''
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.status === 'Pending' ? (
                      <div className={styles.actionButtonGroup}>
                        <button
                          className={styles.approveBtn}
                          type="button"
                          onClick={() => handleApproveClick(req)}
                          disabled={processingId === req.id}
                        >
                          Approve
                        </button>
                        <button
                          className={styles.rejectBtn}
                          type="button"
                          onClick={() => handleRejectClick(req)}
                          disabled={processingId === req.id}
                        >
                          Reject
                        </button>
                      </div>
                    ) : req.status === 'Approved' ? (
                      <span className={styles.approvedNotice}>Slots Locked</span>
                    ) : (
                      <span className={styles.rejectedNotice}>Unchanged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
