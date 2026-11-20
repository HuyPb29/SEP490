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

const FILTER_TABS = ["Tất cả", "Chờ duyệt", "Đã duyệt", "Đã từ chối"]

export default function OwnerMaintenancePage() {
  const { id: locationId } = useParams()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [activeFilter, setActiveFilter] = useState("Tất cả")
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
        if (!isCancelled) setPageError(err?.response?.data?.message || err?.message || "Không tải được yêu cầu bảo trì.")
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
    Pending: requests.filter((r) => r.status === "Chờ duyệt").length,
    Approved: requests.filter((r) => r.status === "Đã duyệt").length,
    Rejected: requests.filter((r) => r.status === "Đã từ chối").length,
  }

  const filteredRequests = requests.filter((r) => {
    if (activeFilter === "Tất cả") return true
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
        prev.map((item) => (item.id === requestId ? { ...item, status: "Đã duyệt" } : item))
      )
      setApproveConfirmTarget(null)

      if (hadAffectedBookings) {
        showToast(
          "Đã duyệt yêu cầu bảo trì, khóa các khung giờ và thông báo cho khách bị ảnh hưởng."
        )
      } else {
        showToast("Đã duyệt yêu cầu bảo trì và khóa các khung giờ thành công.")
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Không duyệt được yêu cầu bảo trì.")
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
            ? { ...item, status: "Đã từ chối", rejection_note: rejectionNote }
            : item
        )
      )
      setRejectTarget(null)
      showToast("Đã từ chối yêu cầu bảo trì. Lịch sân được giữ nguyên.")
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Không từ chối được yêu cầu bảo trì.")
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
              <h2 id="approve-modal-title">Xác nhận duyệt bảo trì</h2>
              <button
                className={styles.closeBtn}
                type="button"
                onClick={() => setApproveConfirmTarget(null)}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningAlert} role="alert">
                <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
                <p className={styles.alertText}>
                  Thay đổi này ảnh hưởng {approveConfirmTarget.affected_bookings_count} lượt đặt sân đã xác nhận. Khách sẽ được thông báo để chọn cách xử lý. Bạn có muốn tiếp tục?
                </p>
              </div>

              <div className={styles.targetSummary}>
                <div><strong>Sân:</strong> {approveConfirmTarget.court_name}</div>
                <div><strong>Ngày và giờ:</strong> {approveConfirmTarget.maintenance_date} ({approveConfirmTarget.start_time} – {approveConfirmTarget.end_time})</div>
                <div><strong>Lý do:</strong> {approveConfirmTarget.reason}</div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={() => setApproveConfirmTarget(null)}
                  disabled={processingId === approveConfirmTarget.id}
                >
                  Hủy
                </button>
                <button
                  className={styles.confirmApproveBtn}
                  type="button"
                  onClick={() => executeApproval(approveConfirmTarget.id, true)}
                  disabled={processingId === approveConfirmTarget.id}
                >
                  {processingId === approveConfirmTarget.id ? "Đang duyệt…" : "Xác nhận duyệt"}
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
              <h2 id="reject-modal-title">Từ chối yêu cầu bảo trì</h2>
              <button
                className={styles.closeBtn}
                type="button"
                onClick={() => setRejectTarget(null)}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSub}>
                Từ chối yêu cầu bảo trì cho <strong>{rejectTarget.court_name}</strong> vào {rejectTarget.maintenance_date} ({rejectTarget.start_time} – {rejectTarget.end_time}).
              </p>

              <div className={styles.field}>
                <label htmlFor="rejection-note" className={styles.fieldLabel}>
                  Ghi chú từ chối (không bắt buộc)
                </label>
                <textarea
                  id="rejection-note"
                  className={styles.textarea}
                  rows={3}
                  placeholder="Nhập lý do từ chối yêu cầu bảo trì…"
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
                  Hủy
                </button>
                <button
                  className={styles.confirmRejectBtn}
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={processingId === rejectTarget.id}
                >
                  {processingId === rejectTarget.id ? "Đang từ chối…" : "Xác nhận từ chối"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Duyệt yêu cầu bảo trì</h1>
          <p className={styles.sub}>
            Mã địa điểm #{locationId} · Kiểm tra yêu cầu bảo trì và xử lý xung đột lịch đặt sân
          </p>
        </div>
      </div>

      {pageError && <p className={styles.pageError} role="alert">{pageError}</p>}

      {/* Filter Tabs */}
      <nav className={styles.filterTabs} aria-label="Lọc trạng thái bảo trì">
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
        <p className={styles.loading}>Đang tải yêu cầu bảo trì…</p>
      ) : filteredRequests.length === 0 ? (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden="true">🛠️</span>
          <p className={styles.emptyText}>Không {activeFilter !== "Tất cả" ? activeFilter.toLowerCase() : ''} yêu cầu bảo trì.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Sân</th>
                <th scope="col">Ngày</th>
                <th scope="col">Khung giờ</th>
                <th scope="col">Lý do</th>
                <th scope="col">Người gửi</th>
                <th scope="col">Lượt đặt sân bị ảnh hưởng</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
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
                    {req.status === "Đã từ chối" && req.rejection_note && (
                      <p className={styles.rejectionNoteText}>
                        <strong>Ghi chú từ chối:</strong> {req.rejection_note}
                      </p>
                    )}
                  </td>
                  <td className={styles.requestedByCol}>{req.requested_by}</td>
                  <td className={styles.affectedCol}>
                    {req.affected_bookings_count > 0 ? (
                      <span className={styles.affectedWarning}>
                        {req.affected_bookings_count} lượt đặt sân bị ảnh hưởng
                      </span>
                    ) : (
                      <span className={styles.affectedZero}>0 (Không trùng lịch)</span>
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
                    {req.status === "Chờ duyệt" ? (
                      <div className={styles.actionButtonGroup}>
                        <button
                          className={styles.approveBtn}
                          type="button"
                          onClick={() => handleApproveClick(req)}
                          disabled={processingId === req.id}
                        >
                          Duyệt
                        </button>
                        <button
                          className={styles.rejectBtn}
                          type="button"
                          onClick={() => handleRejectClick(req)}
                          disabled={processingId === req.id}
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : req.status === "Đã duyệt" ? (
                      <span className={styles.approvedNotice}>Đã khóa khung giờ</span>
                    ) : (
                      <span className={styles.rejectedNotice}>Giữ nguyên</span>
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
