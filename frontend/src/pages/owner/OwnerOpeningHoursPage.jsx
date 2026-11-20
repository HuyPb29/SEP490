import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apiErrorMessage,
  createOpeningException,
  deleteOpeningException,
  getOpeningExceptions,
  getOpeningHours,
  getOwnerLocations,
  getStoredLocationId,
  storeLocationId,
  updateOpeningException,
  updateOpeningHours,
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

const WEEKDAY_LABELS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"]

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
  const locationLocked = selectedLocation?.status === 'LOCKED'
  // D123: quá hạn dịch vụ thì địa điểm vẫn hoạt động, quá hạn 10 ngày (P31) mới bị khóa.
  const serviceExpired = selectedLocation?.status === 'ACTIVE'
    && Boolean(selectedLocation.serviceTermEndDate)
    && selectedLocation.serviceActive === false

  const loadWeek = useCallback(async (locationId) => {
    const days = await getOpeningHours(locationId)
    setWeek(buildWeek(days))
  }, [])

  const loadExceptions = useCallback(async (locationId, filter) => {
    const rows = await getOpeningExceptions(locationId, filter)
    setExceptions(rows)
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
      } catch (err) {
        if (!cancelled) setWeekError(apiErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedLocationId, loadWeek, loadExceptions])

  const handleFacilityChange = (value) => {
    const nextId = Number(value)
    if (!Number.isInteger(nextId) || nextId <= 0) return
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
    setWeekMessage("Đã sao chép giờ Thứ Hai sang tất cả ngày đang mở. Hãy lưu thay đổi.")
  }

  const weekValidationError = () => {
    const enabledDays = week.filter((day) => day.enabled)
    if (enabledDays.length === 0) return "Chọn ít nhất một ngày mở cửa."
    const broken = enabledDays.find((day) => day.closeMinute <= day.openMinute)
    if (broken) return `${broken.label}: giờ đóng cửa phải sau giờ mở cửa.`
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
      "Lưu giờ mở cửa sẽ thay thế cấu hình của cả tuần.\n\n"
      + "Các lượt đặt sân đã xác nhận nằm ngoài giờ mở cửa mới sẽ được đánh dấu bị ảnh hưởng "
      + "và khách bị ảnh hưởng sẽ được thông báo. Tiếp tục?",
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
      setWeekMessage("Đã lưu giờ mở cửa.")
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
        setWeekMessage("Đã khôi phục lịch đã lưu.")
      })
      .catch((err) => setWeekError(apiErrorMessage(err)))
  }

  // ------------------------------------------------------------- ngày ngoại lệ

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
      setExceptionError("Giờ đóng cửa phải sau giờ mở cửa.")
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
      setExceptionMessage(editingExceptionId ? "Đã cập nhật ngày ngoại lệ." : "Đã thêm ngày ngoại lệ.")
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
    if (!window.confirm(`Xóa ngày ngoại lệ ${formatDate(row.exceptionDate)}?`)) return
    try {
      await deleteOpeningException(row.id, selectedLocationId)
      await loadExceptions(selectedLocationId, exceptionFilter)
      if (editingExceptionId === row.id) resetExceptionForm()
      setExceptionError('')
      setExceptionMessage("Đã xóa ngày ngoại lệ.")
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
      title="Giờ mở cửa &amp; khung giờ"
      subtitle={selectedLocation ? `Cụm sân: ${selectedLocation.name} · Cấu hình giờ mở cửa, khung giờ và ngày ngoại lệ` : "Cấu hình khung giờ hoạt động, thời lượng khung giờ và ngày ngoại lệ"}
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
            Kỳ hạn dịch vụ đã hết ngày {selectedLocation.serviceTermEndDate}. Địa điểm sẽ bị khóa khi quá hạn 10 ngày
            nếu chưa gia hạn. Vui lòng liên hệ Quản trị viên.
          </p>
        )}

        {/* ------------------------------------------------------- tuần */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Giờ mở cửa theo tuần</h2>
              <p className={styles.cardHint}>
                {configuredDays} trong 7 ngày đã cấu hình · ngày không được chọn sẽ đóng cửa khi lưu
              </p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.ghostButton} type="button" onClick={copyFirstDayToAll}>
                Sao chép giờ Thứ Hai cho các ngày
              </button>
              <button className={styles.ghostButton} type="button" onClick={handleResetWeek}>
                Khôi phục
              </button>
            </div>
          </div>

          <table className={`${styles.table} ${styles.weekTable}`}>
            <thead>
              <tr>
                <th className={styles.colToggle}>Mở cửa</th>
                <th>Ngày</th>
                <th>Từ</th>
                <th>Đến</th>
                <th className={styles.colDuration}>Thời lượng</th>
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
                      aria-label={`Mở cửa vào ${day.label}`}
                    />
                  </td>
                  <td className={styles.dayName}>{day.label}</td>
                  <td>
                    <select
                      className={styles.timeSelect}
                      value={day.openMinute}
                      disabled={!day.enabled}
                      onChange={(event) => updateDay(day.dayOfWeek, { openMinute: Number(event.target.value) })}
                      aria-label={`${day.label} giờ mở cửa`}
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
                      aria-label={`${day.label} giờ đóng cửa`}
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
              {weekSaving ? "Đang lưu…" : "Lưu giờ mở cửa"}
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cấu hình khung giờ</h2>
          <p>Mỗi khung giờ trên lịch sân dài {SLOT_STEP} phút.</p>
        </section>

        {/* --------------------------------------------- ngày ngoại lệ */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Ngày mở cửa ngoại lệ</h2>
              <p className={styles.cardHint}>
                Thiết lập giờ mở cửa riêng cho một ngày cụ thể. Giờ đóng cửa phải sau giờ mở cửa.
              </p>
            </div>
          </div>

          <form className={styles.exceptionForm} onSubmit={handleExceptionSubmit}>
            <label className={styles.field}>
              <span>Ngày</span>
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
              <span>Từ</span>
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
              <span>Đến</span>
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
              <span>Ghi chú</span>
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
                {exceptionSaving ? "Đang lưu…" : editingExceptionId ? "Cập nhật ngày ngoại lệ" : "Thêm ngày ngoại lệ"}
              </button>
              {editingExceptionId && (
                <button className={styles.ghostButton} type="button" onClick={resetExceptionForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </form>

          {exceptionError && <p className={styles.alertError} role="alert">{exceptionError}</p>}
          {exceptionMessage && <p className={styles.alertOk}>{exceptionMessage}</p>}

          <div className={styles.filterRow}>
            <label className={styles.inlineField}>
              <span>Từ</span>
              <input
                type="date"
                value={exceptionFilter.from}
                onChange={(event) =>
                  setExceptionFilter((current) => ({ ...current, from: event.target.value }))
                }
              />
            </label>
            <label className={styles.inlineField}>
              <span>Đến</span>
              <input
                type="date"
                value={exceptionFilter.to}
                onChange={(event) =>
                  setExceptionFilter((current) => ({ ...current, to: event.target.value }))
                }
              />
            </label>
            <button className={styles.ghostButton} type="button" onClick={applyExceptionFilter}>
              Lọc
            </button>
            <button className={styles.ghostButton} type="button" onClick={clearExceptionFilter}>
              Xóa bộ lọc
            </button>
          </div>

          {exceptions.length === 0 ? (
            <p className={styles.empty}>Không có ngày ngoại lệ trong khoảng đã chọn.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colDate}>Ngày</th>
                  <th className={styles.colDay}>Ngày</th>
                  <th className={styles.colWindow}>Giờ hoạt động</th>
                  <th className={styles.colDuration}>Thời lượng</th>
                  <th>Ghi chú</th>
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
                        Sửa
                      </button>
                      <button
                        className={styles.linkButtonDanger}
                        type="button"
                        onClick={() => handleDeleteException(row)}
                      >
                        Xóa
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
