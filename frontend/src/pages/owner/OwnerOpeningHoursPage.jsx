/**
 * OwnerOpeningHoursPage.jsx — UC08, FR18, FR19, FR62, BR01, BR04, BR17
 *
 * Route: /owner/locations/:id/hours
 *
 * Section 1: Standard Weekly Opening Hours (with step="1800" 30-min interval time inputs)
 * Section 2: Special / Exception Dates (BR04, stored in YYYY-MM-DD format)
 *
 * Validations:
 * - BR01 & MSG16: close_time > open_time and aligned to 30-minute intervals (:00 or :30)
 * - MSG42: Time range within configured court pricing hours (05:00 - 23:00)
 * - BR17 & MSG15: Impact confirmation modal when narrowing hours or closing
 * - MSG03: Success notification with (MSG67) reference
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getOpeningHoursApi, updateOpeningHoursApi } from '../../api/ownerApi'
import styles from './OwnerOpeningHoursPage.module.css'

const DEFAULT_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** Helper to verify if time string is aligned to 30-minute intervals (:00 or :30) */
function isAlignedTo30Minutes(timeStr) {
  if (!timeStr) return false
  const parts = timeStr.split(':')
  if (parts.length < 2) return false
  const minutes = parseInt(parts[1], 10)
  return minutes === 0 || minutes === 30
}

export default function OwnerOpeningHoursPage() {
  const { id: locationId } = useParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Section 1: Standard Weekly Hours
  const [standardHours, setStandardHours] = useState([])

  // Section 2: Exception Dates (BR04)
  const [exceptionDates, setExceptionDates] = useState([])

  // MSG15 Confirmation Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [affectedCount, setAffectedCount] = useState(3)
  const [pendingPayload, setPendingPayload] = useState(null)

  useEffect(() => {
    setLoading(true)
    setPageError('')
    setErrorMessage('')
    getOpeningHoursApi(locationId)
      .then((data) => {
        if (data?.standard_hours && Array.isArray(data.standard_hours)) {
          setStandardHours(data.standard_hours)
        } else {
          setStandardHours(
            DEFAULT_DAYS.map((day) => ({
              day_of_week: day,
              open_time: '05:00',
              close_time: '23:00',
              is_closed: false,
            }))
          )
        }
        setExceptionDates(data?.exception_dates || [])
      })
      .catch((err) => {
        setPageError(err?.response?.data?.message || err?.message || 'Failed to load opening hours.')
      })
      .finally(() => setLoading(false))
  }, [locationId])

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  // ── Standard Weekly Handlers ───────────────────────────────────────────────

  function handleStandardToggleClosed(index) {
    setStandardHours((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, is_closed: !item.is_closed } : item))
    )
    setErrorMessage('')
  }

  function handleStandardTimeChange(index, field, value) {
    setStandardHours((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    )
    setErrorMessage('')
  }

  function handleApplyToAllWeekdays(sourceIndex) {
    const source = standardHours[sourceIndex]
    if (!source) return
    setStandardHours((prev) =>
      prev.map((item, idx) =>
        idx <= 4 // Monday through Friday
          ? { ...item, open_time: source.open_time, close_time: source.close_time, is_closed: source.is_closed }
          : item
      )
    )
    showToast('Applied hours to all weekdays (Monday – Friday).')
  }

  // ── Exception Dates Handlers (BR04) ────────────────────────────────────────

  function handleAddExceptionDate() {
    const today = new Date().toISOString().split('T')[0]
    const newException = {
      id: `exp-${Date.now()}`,
      date: today, // Standard format YYYY-MM-DD
      is_closed: true,
      open_time: '06:00',
      close_time: '22:00',
      note: 'Holiday or Maintenance',
    }
    setExceptionDates((prev) => [...prev, newException])
    setErrorMessage('')
  }

  function handleRemoveExceptionDate(id) {
    setExceptionDates((prev) => prev.filter((item) => item.id !== id))
    setErrorMessage('')
  }

  function handleExceptionChange(id, field, value) {
    setExceptionDates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
    setErrorMessage('')
  }

  // ── Validation & Save Flow ─────────────────────────────────────────────────

  function validateUI() {
    // Check BR01 & MSG16 for standard hours
    for (const day of standardHours) {
      if (!day.is_closed) {
        if (!day.open_time || !day.close_time) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
        if (day.close_time <= day.open_time) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
        if (!isAlignedTo30Minutes(day.open_time) || !isAlignedTo30Minutes(day.close_time)) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
      }
    }

    // Check BR01 & MSG16 for exception dates
    for (const exp of exceptionDates) {
      if (!exp.date) {
        return 'All exception dates must have a valid date specified (YYYY-MM-DD).'
      }
      if (!exp.is_closed) {
        if (!exp.open_time || !exp.close_time) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
        if (exp.close_time <= exp.open_time) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
        if (!isAlignedTo30Minutes(exp.open_time) || !isAlignedTo30Minutes(exp.close_time)) {
          return '[MSG16] Closing time must be after opening time and aligned to 30-minute intervals.'
        }
      }
    }

    return null
  }

  async function handleSaveClick(e) {
    if (e) e.preventDefault()
    setErrorMessage('')

    // 1. UI Validation (BR01 & MSG16)
    const validationError = validateUI()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const payload = {
      standard_hours: standardHours,
      exception_dates: exceptionDates,
    }

    setSaving(true)
    try {
      // 2. Call API without confirmation flag first
      const res = await updateOpeningHoursApi(locationId, payload, { confirmAffected: false })

      // 3. Handle confirmed booking impacts (BR17 & MSG15)
      if (res && res.requires_confirmation) {
        setPendingPayload(payload)
        setAffectedCount(res.affected_bookings_count || 3)
        setShowConfirmModal(true)
        return
      }

      showToast('[MSG03] Opening hours updated successfully. Affected customers have been notified (MSG67).')
    } catch (err) {
      // Caught MSG42 or server error
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save opening hours.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmModalAccept() {
    if (!pendingPayload) return
    setSaving(true)
    setErrorMessage('')
    try {
      await updateOpeningHoursApi(locationId, pendingPayload, { confirmAffected: true })
      setShowConfirmModal(false)
      setPendingPayload(null)
      showToast('[MSG03] Opening hours updated successfully. Affected customers have been notified (MSG67).')
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save opening hours.')
    } finally {
      setSaving(false)
    }
  }

  function handleConfirmModalCancel() {
    setShowConfirmModal(false)
    setPendingPayload(null)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading opening hours…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal (MSG15) */}
      {showConfirmModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="modal-title">Confirm Schedule Change</h2>
              <button
                className={styles.closeBtn}
                type="button"
                onClick={handleConfirmModalCancel}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningAlert} role="alert">
                <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
                <p className={styles.alertText}>
                  [MSG15] This change affects {affectedCount} confirmed booking(s). Customers will be notified (MSG67) to choose a resolution (free slot change, refund, or compensation points). Do you want to continue?
                </p>
              </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={handleConfirmModalCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmBtn}
                  type="button"
                  onClick={handleConfirmModalAccept}
                  disabled={saving}
                >
                  {saving ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Opening Hours</h1>
          <p className={styles.sub}>
            Location #{locationId} · Configure standard weekly schedule and exception dates
          </p>
        </div>
        <button
          className={styles.saveBtn}
          type="button"
          onClick={handleSaveClick}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {pageError && <p className={styles.pageError} role="alert">{pageError}</p>}

      {/* Error Banner for MSG16, MSG42, etc. */}
      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Section 1: Standard Weekly Opening Hours ───────────────────────── */}
      <section className={styles.section} aria-labelledby="sec-weekly">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="sec-weekly" className={styles.sectionTitle}>
              Standard Weekly Opening Hours
            </h2>
            <p className={styles.sectionDesc}>
              Configure open and close times for each day of the week in 30-minute intervals (step 1800s).
            </p>
          </div>
        </div>

        <div className={styles.daysList}>
          {standardHours.map((day, idx) => (
            <div
              key={day.day_of_week}
              className={`${styles.dayRow} ${day.is_closed ? styles.dayRowClosed : ''}`}
            >
              <div className={styles.dayCol}>
                <span className={styles.dayName}>{day.day_of_week}</span>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={!day.is_closed}
                    onChange={() => handleStandardToggleClosed(idx)}
                  />
                  <span>{day.is_closed ? 'Closed' : 'Open'}</span>
                </label>
              </div>

              {!day.is_closed ? (
                <div className={styles.timeInputsCol}>
                  <div className={styles.timeGroup}>
                    <label className={styles.timeLabel} htmlFor={`open-time-${idx}`}>
                      Open Time
                    </label>
                    <input
                      id={`open-time-${idx}`}
                      type="time"
                      step="1800"
                      value={day.open_time}
                      onChange={(e) => handleStandardTimeChange(idx, 'open_time', e.target.value)}
                      className={styles.timeInput}
                    />
                  </div>

                  <span className={styles.timeDivider}>–</span>

                  <div className={styles.timeGroup}>
                    <label className={styles.timeLabel} htmlFor={`close-time-${idx}`}>
                      Close Time
                    </label>
                    <input
                      id={`close-time-${idx}`}
                      type="time"
                      step="1800"
                      value={day.close_time}
                      onChange={(e) => handleStandardTimeChange(idx, 'close_time', e.target.value)}
                      className={styles.timeInput}
                    />
                  </div>

                  {idx === 0 && (
                    <button
                      className={styles.copyBtn}
                      type="button"
                      onClick={() => handleApplyToAllWeekdays(0)}
                      title="Copy Monday hours to Tuesday through Friday"
                    >
                      Copy to Weekdays
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.closedNotice}>
                  <span className={styles.closedBadge}>Closed All Day</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Special / Exception Dates (BR04) ─────────────────────── */}
      <section className={styles.section} aria-labelledby="sec-exceptions">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="sec-exceptions" className={styles.sectionTitle}>
              Special / Exception Dates (BR04)
            </h2>
            <p className={styles.sectionDesc}>
              Override weekly opening hours on holidays, maintenance days, or special events. Dates are saved in YYYY-MM-DD format.
            </p>
          </div>
          <button
            className={styles.addBtn}
            type="button"
            onClick={handleAddExceptionDate}
          >
            + Add Exception Date
          </button>
        </div>

        {exceptionDates.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyText}>No special exception dates configured.</p>
            <button
              className={styles.emptyAddBtn}
              type="button"
              onClick={handleAddExceptionDate}
            >
              + Add First Exception Date
            </button>
          </div>
        ) : (
          <div className={styles.exceptionTableWrapper}>
            <table className={styles.exceptionTable}>
              <thead>
                <tr>
                  <th scope="col">Date (YYYY-MM-DD)</th>
                  <th scope="col">Status</th>
                  <th scope="col">Operating Hours</th>
                  <th scope="col">Reason / Note</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exceptionDates.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleExceptionChange(item.id, 'date', e.target.value)}
                        className={styles.dateInput}
                        required
                      />
                    </td>
                    <td>
                      <select
                        value={item.is_closed ? 'closed' : 'custom'}
                        onChange={(e) =>
                          handleExceptionChange(item.id, 'is_closed', e.target.value === 'closed')
                        }
                        className={styles.statusSelect}
                      >
                        <option value="closed">Closed All Day</option>
                        <option value="custom">Custom Hours</option>
                      </select>
                    </td>
                    <td>
                      {!item.is_closed ? (
                        <div className={styles.tableTimeGroup}>
                          <input
                            type="time"
                            step="1800"
                            value={item.open_time}
                            onChange={(e) => handleExceptionChange(item.id, 'open_time', e.target.value)}
                            className={styles.tableTimeInput}
                          />
                          <span>–</span>
                          <input
                            type="time"
                            step="1800"
                            value={item.close_time}
                            onChange={(e) => handleExceptionChange(item.id, 'close_time', e.target.value)}
                            className={styles.tableTimeInput}
                          />
                        </div>
                      ) : (
                        <span className={styles.closedBadge}>Closed</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="e.g. Christmas, Renovation"
                        value={item.note || ''}
                        onChange={(e) => handleExceptionChange(item.id, 'note', e.target.value)}
                        className={styles.noteInput}
                      />
                    </td>
                    <td>
                      <button
                        className={styles.removeBtn}
                        type="button"
                        onClick={() => handleRemoveExceptionDate(item.id)}
                        aria-label="Remove exception date"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Save Action */}
      <div className={styles.footerActions}>
        <button
          className={styles.saveBtn}
          type="button"
          onClick={handleSaveClick}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
