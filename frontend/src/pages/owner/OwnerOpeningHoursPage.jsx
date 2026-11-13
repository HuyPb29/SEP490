import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apiErrorMessage,
  createOpeningException,
  deleteOpeningException,
  getOpeningExceptions,
  getOpeningHours,
  getOwnerLocations,
  getSlotSetting, getStoredLocationId,
  storeLocationId,
  updateOpeningException,
  updateOpeningHours,
  updateSlotSetting,
} from '../../api/locationApi'
import ManagementLayout from '../../components/layout/ManagementLayout'
import styles from './OwnerOpeningHoursPage.module.css'

/** Backend chỉ nhận bội số 30 phút: mở 00:00–23:30, đóng 00:30–24:00. */
const SLOT_STEP = 30
const DAY_MINUTES = 24 * 60

function toTimeLabel(minutes) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const OPEN_OPTIONS = Array.from({ length: DAY_MINUTES / SLOT_STEP }, (_, index) => index * SLOT_STEP)
const CLOSE_OPTIONS = Array.from(
  { length: DAY_MINUTES / SLOT_STEP },
  (_, index) => (index + 1) * SLOT_STEP,
)

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Slot length: backend yêu cầu bội số 30, từ 30 đến 240 phút.
const SLOT_MINUTE_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240]
// Thời gian nghỉ: 0–60 phút VÀ cũng phải là bội số của 30 (backend chặn 10/15/20/45).
const BUFFER_OPTIONS = [0, 30, 60]
const MAX_SLOT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12]

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(isoDate) {
  if (!isoDate) return '—'
  const [year, month, day] = String(isoDate).split('-')
  return `${day}/${month}/${year}`
}

function weekdayName(isoDate) {
  if (!isoDate) return ''
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  // getDay(): 0 = Chủ nhật → đổi sang 0 = Thứ 2 cho khớp thứ tự hiển thị.
  return WEEKDAY_LABELS[(date.getDay() + 6) % 7]
}

function buildWeek(days) {
  const byDay = new Map((days ?? []).map((day) => [day.dayOfWeek, day]))
  return WEEKDAY_LABELS.map((label, index) => {
    const dayOfWeek = index + 1
    const found = byDay.get(dayOfWeek)
    return {
      dayOfWeek,
      label,
      enabled: Boolean(found?.configured),
      openMinute: found?.openMinute ?? 360,
      closeMinute: found?.closeMinute ?? 1440,
    }
  })
}

export default function OwnerOpeningHoursPage() {
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [_loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [week, setWeek] = useState(() => buildWeek([]))
  const [weekSaving, setWeekSaving] = useState(false)
  const [weekError, setWeekError] = useState('')
  const [weekMessage, setWeekMessage] = useState('')

  const [slotCourtId, setSlotCourtId] = useState('')
  const [slot, setSlot] = useState({ slotMinutes: 30, bufferMinutes: 0, maxSlotsPerBooking: 4 })
  const [slotConfigured, setSlotConfigured] = useState(false)
  const [slotSaving, setSlotSaving] = useState(false)
  const [slotError, setSlotError] = useState('')
  const [slotMessage, setSlotMessage] = useState('')

  const [exceptions, setExceptions] = useState([])
  const [exceptionFilter, setExceptionFilter] = useState({ from: '', to: '' })
  const [exceptionForm, setExceptionForm] = useState({
    exceptionDate: todayIso(),
    openMinute: 360,
    closeMinute: 1080,
    note: '',
  })
  const [editingExceptionId, setEditingExceptionId] = useState(null)
  const [exceptionSaving, setExceptionSaving] = useState(false)
  const [exceptionError, setExceptionError] = useState('')
  const [exceptionMessage, setExceptionMessage] = useState('')

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )
  const courts = useMemo(() => selectedLocation?.courts ?? [], [selectedLocation])
  const locationLocked = selectedLocation?.status === 'LOCKED'

  const loadWeek = useCallback(async (locationId) => {
    const days = await getOpeningHours(locationId)
    setWeek(buildWeek(days))
  }, [])

  const loadExceptions = useCallback(async (locationId, filter) => {
    const rows = await getOpeningExceptions(locationId, filter)
    setExceptions(rows)
  }, [])

  const loadSlot = useCallback(async (courtId, locationId) => {
    if (!courtId) {
      Promise.resolve().then(() => setSlotConfigured(false))
      return
    }
    const setting = await getSlotSetting(courtId, locationId)
    if (!setting) return
    setSlot({
      slotMinutes: setting.slotMinutes ?? 30,
      bufferMinutes: setting.bufferMinutes ?? 0,
      maxSlotsPerBooking: setting.maxSlotsPerBooking ?? 4,
    })
    setSlotConfigured(Boolean(setting.configured))
  }, [])

  // Nạp danh sách địa điểm một lần, chọn địa điểm nhớ lần trước nếu còn hợp lệ.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = await getOwnerLocations()
        if (cancelled) return
        setLocations(rows)
        const stored = Number(getStoredLocationId())
        const fallback = rows.some((location) => location.id === stored) ? stored : rows[0]?.id
        setSelectedLocationId(fallback ?? null)
        if (fallback) storeLocationId(fallback)
        setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(apiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Đổi địa điểm thì nạp lại cả 3 phần.
  useEffect(() => {
    if (!selectedLocationId) return
    let cancelled = false
    ;(async () => {
      try {
        await loadWeek(selectedLocationId)
        if (cancelled) return
        await loadExceptions(selectedLocationId, {})
        if (cancelled) return
        setExceptionFilter({ from: '', to: '' })
        setEditingExceptionId(null)
        setWeekError('')
        setWeekMessage('')
        setExceptionError('')
        setExceptionMessage('')
        setSlotError('')
        setSlotMessage('')
      } catch (err) {
        if (!cancelled) setWeekError(apiErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedLocationId, loadWeek, loadExceptions])

  // Cấu hình slot thuộc về địa điểm, nên chỉ cần xem qua sân đầu tiên.
  useEffect(() => {
    if (!selectedLocationId) return
    const firstCourtId = courts[0]?.id ?? ''
    Promise.resolve().then(() => setSlotCourtId(firstCourtId ? String(firstCourtId) : ''))
    if (!firstCourtId) {
      Promise.resolve().then(() => setSlotConfigured(false))
      return
    }
    Promise.resolve().then(() => loadSlot(firstCourtId, selectedLocationId)).catch((err) => setSlotError(apiErrorMessage(err)))
  }, [selectedLocationId, courts, loadSlot])

  const handleFacilityChange = (event) => {
    const nextId = Number(event.target.value)
    if (!Number.isFinite(nextId)) return
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
  }

  // ------------------------------------------------------------ giờ mở cửa

  const updateDay = (dayOfWeek, patch) => {
    setWeek((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    )
    setWeekMessage('')
  }

  const copyFirstDayToAll = () => {
    const source = week[0]
    if (!source) return
    setWeek((current) =>
      current.map((day) => ({
        ...day,
        enabled: day.enabled || source.enabled,
        openMinute: source.openMinute,
        closeMinute: source.closeMinute,
      })),
    )
    setWeekMessage('Copied Monday hours to every enabled day. Remember to save.')
  }

  const weekValidationError = () => {
    const enabledDays = week.filter((day) => day.enabled)
    if (enabledDays.length === 0) return 'Pick at least one opening day.'
    const broken = enabledDays.find((day) => day.closeMinute <= day.openMinute)
    if (broken) return `${broken.label}: closing time must be after opening time.`
    return ''
  }

  const handleSaveWeek = async () => {
    const validation = weekValidationError()
    if (validation) {
      setWeekError(validation)
      setWeekMessage('')
      return
    }
    const confirmed = window.confirm(
      'Saving the opening hours replaces the whole week.\n\n'
      + 'Confirmed bookings that no longer fit inside the new window will be marked as affected '
      + 'and the affected players will be notified. Continue?',
    )
    if (!confirmed) return

    setWeekSaving(true)
    try {
      const payload = week
        .filter((day) => day.enabled)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          openMinute: day.openMinute,
          closeMinute: day.closeMinute,
        }))
      const saved = await updateOpeningHours(selectedLocationId, payload)
      setWeek(buildWeek(saved))
      setWeekError('')
      setWeekMessage('Opening hours saved.')
    } catch (err) {
      setWeekError(apiErrorMessage(err))
      setWeekMessage('')
    } finally {
      setWeekSaving(false)
    }
  }

  const handleResetWeek = () => {
    loadWeek(selectedLocationId)
      .then(() => {
        setWeekError('')
        setWeekMessage('Reverted to the saved schedule.')
      })
      .catch((err) => setWeekError(apiErrorMessage(err)))
  }

  // ------------------------------------------------------------- cấu hình slot

  const handleSlotCourtChange = (event) => {
    const courtId = event.target.value
    setSlotCourtId(courtId)
    setSlotError('')
    setSlotMessage('')
    if (courtId) {
      loadSlot(Number(courtId), selectedLocationId).catch((err) => setSlotError(apiErrorMessage(err)))
    }
  }

  const handleSaveSlot = async () => {
    if (!slotCourtId) {
      setSlotError('This facility has no court yet, so the slot setting cannot be saved.')
      return
    }
    setSlotSaving(true)
    try {
      const saved = await updateSlotSetting(
        Number(slotCourtId),
        {
          slotMinutes: Number(slot.slotMinutes),
          bufferMinutes: Number(slot.bufferMinutes),
          maxSlotsPerBooking: Number(slot.maxSlotsPerBooking),
        },
        selectedLocationId,
      )
      setSlot({
        slotMinutes: saved?.slotMinutes ?? slot.slotMinutes,
        bufferMinutes: saved?.bufferMinutes ?? slot.bufferMinutes,
        maxSlotsPerBooking: saved?.maxSlotsPerBooking ?? slot.maxSlotsPerBooking,
      })
      setSlotConfigured(true)
      setSlotError('')
      setSlotMessage('Slot setting saved. It applies to every court of this facility.')
    } catch (err) {
      setSlotError(apiErrorMessage(err))
      setSlotMessage('')
    } finally {
      setSlotSaving(false)
    }
  }

  // ------------------------------------------------------------ ngày ngoại lệ

  const resetExceptionForm = () => {
    setExceptionForm({
      exceptionDate: todayIso(),
      openMinute: 360,
      closeMinute: 1080,
      note: '',
    })
    setEditingExceptionId(null)
    setExceptionError('')
  }

  const handleExceptionSubmit = async (event) => {
    event.preventDefault()
    if (exceptionForm.closeMinute <= exceptionForm.openMinute) {
      setExceptionError('Closing time must be after opening time.')
      return
    }
    setExceptionSaving(true)
    try {
      const payload = {
        exceptionDate: exceptionForm.exceptionDate,
        openMinute: Number(exceptionForm.openMinute),
        closeMinute: Number(exceptionForm.closeMinute),
        note: exceptionForm.note?.trim() ? exceptionForm.note.trim() : null,
      }
      if (editingExceptionId) {
        await updateOpeningException(editingExceptionId, payload, selectedLocationId)
      } else {
        await createOpeningException(selectedLocationId, payload)
      }
      await loadExceptions(selectedLocationId, exceptionFilter)
      setExceptionMessage(editingExceptionId ? 'Exception day updated.' : 'Exception day added.')
      resetExceptionForm()
    } catch (err) {
      setExceptionError(apiErrorMessage(err))
      setExceptionMessage('')
    } finally {
      setExceptionSaving(false)
    }
  }

  const handleEditException = (row) => {
    setEditingExceptionId(row.id)
    setExceptionForm({
      exceptionDate: row.exceptionDate,
      openMinute: row.openMinute,
      closeMinute: row.closeMinute,
      note: row.note ?? '',
    })
    setExceptionError('')
    setExceptionMessage('')
  }

  const handleDeleteException = async (row) => {
    if (!window.confirm(`Delete the exception on ${formatDate(row.exceptionDate)}?`)) return
    try {
      await deleteOpeningException(row.id, selectedLocationId)
      await loadExceptions(selectedLocationId, exceptionFilter)
      if (editingExceptionId === row.id) resetExceptionForm()
      setExceptionError('')
      setExceptionMessage('Exception day deleted.')
    } catch (err) {
      setExceptionError(apiErrorMessage(err))
      setExceptionMessage('')
    }
  }

  const applyExceptionFilter = async () => {
    try {
      await loadExceptions(selectedLocationId, exceptionFilter)
      setExceptionError('')
    } catch (err) {
      setExceptionError(apiErrorMessage(err))
    }
  }

  const clearExceptionFilter = async () => {
    const empty = { from: '', to: '' }
    setExceptionFilter(empty)
    try {
      await loadExceptions(selectedLocationId, empty)
      setExceptionError('')
    } catch (err) {
      setExceptionError(apiErrorMessage(err))
    }
  }

  const configuredDays = week.filter((day) => day.enabled).length

  return (
    <ManagementLayout
      role="owner"
      title="Giờ mở cửa & Slot"
      subtitle={selectedLocation ? `Cụm sân: ${selectedLocation.name} · Cấu hình giờ mở cửa, slot và ngày ngoại lệ` : 'Cấu hình khung giờ hoạt động, thời lượng slot và ngày ngoại lệ'}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      <div>
        {loadError && <p className={styles.alertError} role="alert">{loadError}</p>}
        {locationLocked && (
          <p className={styles.alertWarn}>
            Cụm sân này đã bị khóa. Anh/chị chỉ có thể xem dữ liệu mà không thể chỉnh sửa.
          </p>
        )}
        {serviceExpired && (
          <p className={styles.alertWarn}>
            Kỳ hạn dịch vụ đã hết hạn. Vui lòng liên hệ Quản trị viên để gia hạn trước khi thay đổi cấu hình.
          </p>
        )}

        {/* ------------------------------------------------------- tuần */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Weekly opening hours</h2>
              <p className={styles.cardHint}>
                {configuredDays} of 7 days configured · unselected days are removed when you save
              </p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.ghostButton} type="button" onClick={copyFirstDayToAll}>
                Copy Monday to all
              </button>
              <button className={styles.ghostButton} type="button" onClick={handleResetWeek}>
                Reset
              </button>
            </div>
          </div>

          <table className={`${styles.table} ${styles.weekTable}`}>
            <thead>
              <tr>
                <th className={styles.colToggle}>Open</th>
                <th>Day</th>
                <th>From</th>
                <th>To</th>
                <th className={styles.colDuration}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {week.map((day) => (
                <tr key={day.dayOfWeek} className={day.enabled ? '' : styles.rowDisabled}>
                  <td>
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) => updateDay(day.dayOfWeek, { enabled: event.target.checked })}
                      aria-label={`Open on ${day.label}`}
                    />
                  </td>
                  <td className={styles.dayName}>{day.label}</td>
                  <td>
                    <select
                      className={styles.timeSelect}
                      value={day.openMinute}
                      disabled={!day.enabled}
                      onChange={(event) => updateDay(day.dayOfWeek, { openMinute: Number(event.target.value) })}
                      aria-label={`${day.label} opening time`}
                    >
                      {OPEN_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>{toTimeLabel(minute)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={styles.timeSelect}
                      value={day.closeMinute}
                      disabled={!day.enabled}
                      onChange={(event) => updateDay(day.dayOfWeek, { closeMinute: Number(event.target.value) })}
                      aria-label={`${day.label} closing time`}
                    >
                      {CLOSE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>{toTimeLabel(minute)}</option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.colDuration}>
                    {day.enabled
                      ? `${((day.closeMinute - day.openMinute) / 60).toFixed(1)} h`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {weekError && <p className={styles.alertError} role="alert">{weekError}</p>}
          {weekMessage && <p className={styles.alertOk}>{weekMessage}</p>}

          <div className={styles.cardFooter}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleSaveWeek}
              disabled={weekSaving || locationLocked}
            >
              {weekSaving ? 'Saving…' : 'Save opening hours'}
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------- slot */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Slot configuration</h2>
              <p className={styles.cardHint}>
                Belongs to the whole facility, not to a single court
                {slotConfigured ? '' : ' · currently using the default values'}
              </p>
            </div>
            {courts.length > 1 && (
              <label className={styles.inlineField}>
                <span>View via court</span>
                <select
                  className={styles.timeSelect}
                  value={slotCourtId}
                  onChange={handleSlotCourtChange}
                >
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>{court.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Slot length</span>
              <select
                value={slot.slotMinutes}
                onChange={(event) => setSlot((current) => ({ ...current, slotMinutes: Number(event.target.value) }))}
              >
                {SLOT_MINUTE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} minutes</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Buffer between slots</span>
              <select
                value={slot.bufferMinutes}
                onChange={(event) => setSlot((current) => ({ ...current, bufferMinutes: Number(event.target.value) }))}
              >
                {BUFFER_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} minutes</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Max slots per booking</span>
              <select
                value={slot.maxSlotsPerBooking}
                onChange={(event) =>
                  setSlot((current) => ({ ...current, maxSlotsPerBooking: Number(event.target.value) }))
                }
              >
                {MAX_SLOT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          <p className={styles.note}>
            One booking occupies {slot.slotMinutes + slot.bufferMinutes} minutes
            ({slot.slotMinutes} minutes of play + {slot.bufferMinutes} minutes buffer).
          </p>

          {slotError && <p className={styles.alertError} role="alert">{slotError}</p>}
          {slotMessage && <p className={styles.alertOk}>{slotMessage}</p>}

          <div className={styles.cardFooter}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleSaveSlot}
              disabled={slotSaving || locationLocked || !slotCourtId}
            >
              {slotSaving ? 'Saving…' : 'Save slot setting'}
            </button>
          </div>
        </section>

        {/* --------------------------------------------- ngày ngoại lệ */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Exception days</h2>
              <p className={styles.cardHint}>
                A different opening window for one specific date. The schema has no “closed all day”
                flag, so every exception must still open and close.
              </p>
            </div>
          </div>

          <form className={styles.exceptionForm} onSubmit={handleExceptionSubmit}>
            <label className={styles.field}>
              <span>Date</span>
              <input
                type="date"
                value={exceptionForm.exceptionDate}
                onChange={(event) =>
                  setExceptionForm((current) => ({ ...current, exceptionDate: event.target.value }))
                }
                required
              />
            </label>

            <label className={styles.field}>
              <span>From</span>
              <select
                value={exceptionForm.openMinute}
                onChange={(event) =>
                  setExceptionForm((current) => ({ ...current, openMinute: Number(event.target.value) }))
                }
              >
                {OPEN_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>{toTimeLabel(minute)}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>To</span>
              <select
                value={exceptionForm.closeMinute}
                onChange={(event) =>
                  setExceptionForm((current) => ({ ...current, closeMinute: Number(event.target.value) }))
                }
              >
                {CLOSE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>{toTimeLabel(minute)}</option>
                ))}
              </select>
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Note</span>
              <input
                type="text"
                maxLength={255}
                placeholder="Holiday, tournament, maintenance…"
                value={exceptionForm.note}
                onChange={(event) => setExceptionForm((current) => ({ ...current, note: event.target.value }))}
              />
            </label>

            <div className={styles.exceptionActions}>
              <button className={styles.primaryButton} type="submit" disabled={exceptionSaving || locationLocked}>
                {exceptionSaving ? 'Saving…' : editingExceptionId ? 'Update exception' : 'Add exception'}
              </button>
              {editingExceptionId && (
                <button className={styles.ghostButton} type="button" onClick={resetExceptionForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          {exceptionError && <p className={styles.alertError} role="alert">{exceptionError}</p>}
          {exceptionMessage && <p className={styles.alertOk}>{exceptionMessage}</p>}

          <div className={styles.filterRow}>
            <label className={styles.inlineField}>
              <span>From</span>
              <input
                type="date"
                value={exceptionFilter.from}
                onChange={(event) =>
                  setExceptionFilter((current) => ({ ...current, from: event.target.value }))
                }
              />
            </label>
            <label className={styles.inlineField}>
              <span>To</span>
              <input
                type="date"
                value={exceptionFilter.to}
                onChange={(event) =>
                  setExceptionFilter((current) => ({ ...current, to: event.target.value }))
                }
              />
            </label>
            <button className={styles.ghostButton} type="button" onClick={applyExceptionFilter}>
              Filter
            </button>
            <button className={styles.ghostButton} type="button" onClick={clearExceptionFilter}>
              Clear
            </button>
          </div>

          {exceptions.length === 0 ? (
            <p className={styles.empty}>No exception day in this range.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colDate}>Date</th>
                  <th className={styles.colDay}>Day</th>
                  <th className={styles.colWindow}>Window</th>
                  <th className={styles.colDuration}>Duration</th>
                  <th>Note</th>
                  <th className={styles.colActions} />
                </tr>
              </thead>
              <tbody>
                {exceptions.map((row) => (
                  <tr key={row.id} className={editingExceptionId === row.id ? styles.rowEditing : ''}>
                    <td className={styles.dayName}>{formatDate(row.exceptionDate)}</td>
                    <td>{weekdayName(row.exceptionDate)}</td>
                    <td>{row.openTime} – {row.closeTime}</td>
                    <td className={styles.colDuration}>{((row.durationMinutes ?? 0) / 60).toFixed(1)} h</td>
                    <td className={styles.noteCell}>{row.note || '—'}</td>
                    <td className={styles.colActions}>
                      <button className={styles.linkButton} type="button" onClick={() => handleEditException(row)}>
                        Edit
                      </button>
                      <button
                        className={styles.linkButtonDanger}
                        type="button"
                        onClick={() => handleDeleteException(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </ManagementLayout>
  )
}
