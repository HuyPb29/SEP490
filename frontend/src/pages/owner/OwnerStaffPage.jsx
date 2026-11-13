/**
 * OwnerStaffPage.jsx — UC04 Staff Management (FR07, FR08, BR59, BR60, D150)
 *
 * Route: /owner/locations/:id/staff
 *
 * Features:
 * - Staff table with Lock/Unlock (BR59) and Reset Password (FR07, DR31)
 * - Add Staff modal (DR22, DR23, DR24, DR01)
 * - Edit Staff modal (full_name, phone)
 * - NO Delete button (DR30)
 * - NO Email field, NO PIN, NO OTP
 */
import { useEffect, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getStaffByLocation,
  addStaff,
  updateStaff,
  lockStaff,
  unlockStaff,
  resetStaffPassword,
} from '../../api/ownerApi'
import styles from './OwnerStaffPage.module.css'

// ─── Validation helpers (DR22, DR23, DR24, DR01) ──────────────────────────────

/** DR23: 8–32 chars, at least 1 letter and 1 digit */
function isValidPassword(pw) {
  if (!pw || pw.length < 8 || pw.length > 32) return false
  return /[a-zA-Z]/.test(pw) && /\d/.test(pw)
}

/** DR22: username non-empty, no spaces, alphanumeric+underscore */
function isValidUsername(u) {
  return /^[a-zA-Z0-9_]{3,50}$/.test(u)
}

/** DR01: basic phone — 10 digits starting with 0 */
function isValidPhone(p) {
  return /^0\d{9}$/.test(p.replace(/\s/g, ''))
}

function getErrMsg(err) {
  return err?.response?.data?.message || err?.message || 'An unexpected error occurred.'
}

// ─── Modal: Add / Edit Staff ──────────────────────────────────────────────────

function StaffFormModal({ mode, initial, locationId, onClose, onSaved }) {
  const isAdd = mode === 'add'
  const [form, setForm] = useState({
    username:  initial?.username  ?? '',
    full_name: initial?.full_name ?? '',
    phone:     initial?.phone     ?? '',
    password:  '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const firstInputRef = useRef(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
    setApiError('')
  }

  function validate() {
    const e = {}
    if (isAdd && !isValidUsername(form.username)) {
      e.username = 'Username must be 3–50 characters: letters, digits, or underscores only.'
    }
    if (!form.full_name.trim()) e.full_name = 'Full name is required.'
    if (!isValidPhone(form.phone)) e.phone = 'Phone must be 10 digits starting with 0 (e.g. 0912345678).'
    if (isAdd && !isValidPassword(form.password)) {
      e.password = 'Password must be 8–32 characters with at least 1 letter and 1 digit.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiError('')
    try {
      if (isAdd) {
        const created = await addStaff(locationId, {
          username:  form.username,
          full_name: form.full_name.trim(),
          phone:     form.phone.trim(),
          password:  form.password,
        })
        onSaved(created, 'add')
      } else {
        const updated = await updateStaff(locationId, initial.id, {
          full_name: form.full_name.trim(),
          phone:     form.phone.trim(),
        })
        onSaved(updated, 'edit')
      }
    } catch (err) {
      setApiError(getErrMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 id="staff-modal-title">{isAdd ? 'Add Staff' : 'Edit Staff'}</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
          {apiError && <p className={styles.apiError} role="alert">{apiError}</p>}

          {isAdd && (
            <div className={styles.field}>
              <label htmlFor="sf-username">Username <span className={styles.req}>*</span></label>
              <input
                id="sf-username"
                ref={firstInputRef}
                type="text"
                autoComplete="off"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                aria-invalid={!!errors.username}
              />
              {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="sf-fullname">Full Name <span className={styles.req}>*</span></label>
            <input
              id="sf-fullname"
              ref={isAdd ? undefined : firstInputRef}
              type="text"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name && <span className={styles.fieldError}>{errors.full_name}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="sf-phone">Phone Number <span className={styles.req}>*</span></label>
            <input
              id="sf-phone"
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
          </div>

          {isAdd && (
            <div className={styles.field}>
              <label htmlFor="sf-password">Password <span className={styles.req}>*</span></label>
              <input
                id="sf-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                aria-invalid={!!errors.password}
              />
              {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
              <span className={styles.hint}>8–32 characters, at least 1 letter and 1 digit.</span>
            </div>
          )}

          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} type="button" onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} type="submit" disabled={saving}>
              {saving ? 'Saving…' : isAdd ? 'Add Staff' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Reset Password (FR07, DR31) ───────────────────────────────────────

function ResetPasswordModal({ staff, locationId, onClose, onDone }) {
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const [apiError, setApiError] = useState('')
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  function validate() {
    const e = {}
    if (!isValidPassword(newPw)) {
      e.newPw = 'Password must be 8–32 characters with at least 1 letter and 1 digit.'
    }
    if (newPw !== confirmPw) {
      e.confirmPw = 'Passwords do not match.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiError('')
    try {
      await resetStaffPassword(locationId, staff.id, { new_password: newPw })
      onDone()
    } catch (err) {
      setApiError(getErrMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="rp-title">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 id="rp-title">Reset Password</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalSub}>
            Resetting password for <strong>{staff.full_name}</strong> (@{staff.username})
          </p>
          {apiError && <p className={styles.apiError} role="alert">{apiError}</p>}
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="rp-new">New Password <span className={styles.req}>*</span></label>
              <input
                id="rp-new"
                ref={firstRef}
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setErrors({}) }}
                aria-invalid={!!errors.newPw}
              />
              {errors.newPw && <span className={styles.fieldError}>{errors.newPw}</span>}
              <span className={styles.hint}>8–32 characters, at least 1 letter and 1 digit.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="rp-confirm">Confirm New Password <span className={styles.req}>*</span></label>
              <input
                id="rp-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setErrors({}) }}
                aria-invalid={!!errors.confirmPw}
              />
              {errors.confirmPw && <span className={styles.fieldError}>{errors.confirmPw}</span>}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} type="button" onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} type="submit" disabled={saving}>
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function staffReducer(state, action) {
  switch (action.type) {
    case 'SET':  return action.payload
    case 'ADD':  return [...state, action.payload]
    case 'UPDATE':
      return state.map((s) => s.id === action.payload.id ? { ...s, ...action.payload } : s)
    default: return state
  }
}

export default function OwnerStaffPage() {
  const { id: locationId } = useParams()
  const [staff, dispatch] = useReducer(staffReducer, [])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [toast, setToast] = useState('')   // success message

  // Modal state
  const [addModal, setAddModal]           = useState(false)
  const [editTarget, setEditTarget]       = useState(null)   // staff object
  const [resetTarget, setResetTarget]     = useState(null)   // staff object

  // Per-row action errors
  const [rowError, setRowError] = useState({}) // { [staffId]: errorMsg }

  // ── Load staff ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false
    getStaffByLocation(locationId)
      .then((data) => {
        if (!isCancelled) dispatch({ type: 'SET', payload: data })
      })
      .catch((err) => {
        if (!isCancelled) setPageError(getErrMsg(err))
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [locationId])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function setRowErr(staffId, msg) {
    setRowError((prev) => ({ ...prev, [staffId]: msg }))
  }

  // ── Add staff callback ──────────────────────────────────────────────────────
  function handleStaffSaved(result, mode) {
    if (mode === 'add') {
      dispatch({ type: 'ADD', payload: result })
      showToast(`Staff "${result.username}" added successfully.`)
    } else {
      dispatch({ type: 'UPDATE', payload: result })
      showToast('Staff information updated successfully.')
    }
    setAddModal(false)
    setEditTarget(null)
  }

  // ── Lock / Unlock (BR59, DR30, MSG13, MSG14) ────────────────────────────────
  async function handleToggleLock(member) {
    setRowErr(member.id, '')
    if (!member.is_locked) {
      // MSG13: confirm before locking
      const ok = window.confirm(
        `Lock account for "${member.full_name}" (@${member.username})?\n\n` +
        'The staff member will no longer be able to log in until unlocked.',
      )
      if (!ok) return
    }
    try {
      if (member.is_locked) {
        await unlockStaff(locationId, member.id)
        dispatch({ type: 'UPDATE', payload: { ...member, is_locked: false } })
        // MSG14
        showToast(`Account for "${member.full_name}" has been unlocked.`)
      } else {
        await lockStaff(locationId, member.id)
        dispatch({ type: 'UPDATE', payload: { ...member, is_locked: true } })
        showToast(`Account for "${member.full_name}" has been locked.`)
      }
    } catch (err) {
      setRowErr(member.id, getErrMsg(err))
    }
  }

  // ── Reset password callback ─────────────────────────────────────────────────
  function handlePasswordReset() {
    showToast('Password has been reset successfully.')
    setResetTarget(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">{toast}</div>
      )}

      {/* Modals */}
      {addModal && (
        <StaffFormModal
          mode="add"
          locationId={locationId}
          onClose={() => setAddModal(false)}
          onSaved={handleStaffSaved}
        />
      )}
      {editTarget && (
        <StaffFormModal
          mode="edit"
          initial={editTarget}
          locationId={locationId}
          onClose={() => setEditTarget(null)}
          onSaved={handleStaffSaved}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          staff={resetTarget}
          locationId={locationId}
          onClose={() => setResetTarget(null)}
          onDone={handlePasswordReset}
        />
      )}

      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Staff</h1>
          <p className={styles.sub}>Location #{locationId} · Manage staff accounts</p>
        </div>
        <button className={styles.addBtn} type="button" onClick={() => setAddModal(true)}>
          + Add Staff
        </button>
      </div>

      {pageError && <p className={styles.pageError} role="alert">{pageError}</p>}

      {loading ? (
        <p className={styles.loading}>Loading staff…</p>
      ) : staff.length === 0 ? (
        <div className={styles.empty}>
          <span aria-hidden="true">👤</span>
          <p>No staff members for this location yet.</p>
          <button className={styles.addBtn} type="button" onClick={() => setAddModal(true)}>
            + Add First Staff
          </button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Username</th>
                <th scope="col">Full Name</th>
                <th scope="col">Phone</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member, idx) => (
                <>
                  <tr key={member.id} className={member.is_locked ? styles.rowLocked : ''}>
                    <td className={styles.tdNum}>{idx + 1}</td>
                    <td className={styles.tdUsername}>
                      <span className={styles.usernameText}>@{member.username}</span>
                    </td>
                    <td>{member.full_name}</td>
                    <td>{member.phone}</td>
                    <td>
                      {member.is_locked ? (
                        <span className={styles.badgeLocked}>Locked</span>
                      ) : (
                        <span className={styles.badgeActive}>Active</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          type="button"
                          onClick={() => setEditTarget(member)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.actionBtn}
                          type="button"
                          onClick={() => setResetTarget(member)}
                        >
                          Reset Password
                        </button>
                        <button
                          className={`${styles.actionBtn} ${member.is_locked ? styles.unlockBtn : styles.lockBtn}`}
                          type="button"
                          onClick={() => handleToggleLock(member)}
                        >
                          {member.is_locked ? 'Unlock' : 'Lock'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {rowError[member.id] && (
                    <tr key={`err-${member.id}`} className={styles.rowErrorRow}>
                      <td colSpan={6}>
                        <span className={styles.rowErrorMsg} role="alert">{rowError[member.id]}</span>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
