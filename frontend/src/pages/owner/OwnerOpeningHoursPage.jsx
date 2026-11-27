import { Switch as UiSwitch, DatePicker as UiDatePicker } from '../../components/ui';
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  Select,
  Table,
  Toast,
} from '../../components/common'
import { shortDate } from '../../utils/formatters'
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
  .map((minute) => [minute, toTimeLabel(minute)])
const CLOSE_OPTIONS = Array.from({ length: DAY_MINUTES / SLOT_STEP }, (_, index) => (index + 1) * SLOT_STEP)
  .map((minute) => [minute, toTimeLabel(minute)])

const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
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

/** Số khung 30 phút trong ngày, để Owner xem trước lịch sân sẽ có bao nhiêu ô. */
function slotCount(openMinute, closeMinute) {
  return Math.max(0, Math.floor((closeMinute - openMinute) / SLOT_STEP))
}

const emptyExceptionForm = () => ({ exceptionDate: todayIso(), openMinute: 360, closeMinute: 1080, note: '' })

export default function OwnerOpeningHoursPage() {
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [week, setWeek] = useState(() => buildWeek([]))
  const [savedWeek, setSavedWeek] = useState(() => buildWeek([]))
  const [weekLoading, setWeekLoading] = useState(false)
  const [weekSaving, setWeekSaving] = useState(false)
  const [weekError, setWeekError] = useState('')
  const [confirmSave, setConfirmSave] = useState(false)

  const [exceptions, setExceptions] = useState([])
  const [exceptionFilter, setExceptionFilter] = useState({ from: '', to: '' })
  const [exceptionForm, setExceptionForm] = useState(emptyExceptionForm)
  const [exceptionModal, setExceptionModal] = useState(null)
  const [exceptionSaving, setExceptionSaving] = useState(false)
  const [exceptionError, setExceptionError] = useState('')
  const [listError, setListError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [toast, setToast] = useState(null)

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )
  const locationLocked = selectedLocation?.status === 'LOCKED'
  // D123: quá hạn dịch vụ thì địa điểm vẫn hoạt động, quá hạn 10 ngày (P31) mới bị khóa.
  const serviceExpired = selectedLocation?.status === 'ACTIVE'
    && Boolean(selectedLocation.serviceTermEndDate)
    && selectedLocation.serviceActive === false

  const weekDirty = useMemo(
    () => week.some((day, index) => {
      const saved = savedWeek[index]
      return day.enabled !== saved.enabled
        || (day.enabled && (day.openMinute !== saved.openMinute || day.closeMinute !== saved.closeMinute))
    }),
    [week, savedWeek],
  )

  const loadWeek = useCallback(async (locationId) => {
    const days = buildWeek(await getOpeningHours(locationId))
    setWeek(days)
    setSavedWeek(days)
  }, [])

  const loadExceptions = useCallback(async (locationId, filter) => {
    const rows = await getOpeningExceptions(locationId, filter)
    setExceptions(rows)
  }, [])

  // Nạp danh sách địa điểm, chọn địa điểm nhớ lần trước nếu còn hợp lệ.
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
  }, [reloadKey])

  // Đổi địa điểm thì nạp lại giờ mở cửa và ngày ngoại lệ.
  useEffect(() => {
    if (!selectedLocationId) return
    let cancelled = false
    ;(async () => {
      setWeekLoading(true)
      try {
        await loadWeek(selectedLocationId)
        if (cancelled) return
        await loadExceptions(selectedLocationId, {})
        if (cancelled) return
        setExceptionFilter({ from: '', to: '' })
        setWeekError('')
        setListError('')
      } catch (err) {
        if (!cancelled) setWeekError(apiErrorMessage(err))
      } finally {
        if (!cancelled) setWeekLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedLocationId, loadWeek, loadExceptions, reloadKey])

  const handleFacilityChange = (value) => {
    const nextId = Number(value)
    if (!Number.isInteger(nextId) || nextId <= 0) return
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setToast(null)
  }

  // ------------------------------------------------------------ giờ mở cửa

  const updateDay = (dayOfWeek, patch) => {
    setWeek((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    )
    setWeekError('')
  }

  /** Chép giờ của một ngày sang các ngày đang mở cửa khác. */
  const applyToOtherDays = (source) => {
    setWeek((current) =>
      current.map((day) => (day.dayOfWeek === source.dayOfWeek || !day.enabled
        ? day
        : { ...day, openMinute: source.openMinute, closeMinute: source.closeMinute })),
    )
    setToast({ tone: 'info', text: `Đã áp dụng giờ ${source.label} cho các ngày đang mở cửa. Bấm "Lưu giờ mở cửa" để lưu.` })
  }

  const weekValidationError = () => {
    const enabledDays = week.filter((day) => day.enabled)
    if (enabledDays.length === 0) return 'Chọn ít nhất một ngày mở cửa.'
    const broken = enabledDays.find((day) => day.closeMinute <= day.openMinute)
    if (broken) return `${broken.label}: giờ đóng cửa phải sau giờ mở cửa.`
    return ''
  }

  const requestSaveWeek = () => {
    const validation = weekValidationError()
    if (validation) {
      setWeekError(validation)
      return
    }
    setConfirmSave(true)
  }

  const handleSaveWeek = async () => {
    setWeekSaving(true)
    try {
      const payload = week
        .filter((day) => day.enabled)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          openMinute: day.openMinute,
          closeMinute: day.closeMinute,
        }))
      const saved = buildWeek(await updateOpeningHours(selectedLocationId, payload))
      setWeek(saved)
      setSavedWeek(saved)
      setWeekError('')
      setToast({ tone: 'success', text: 'Đã lưu giờ mở cửa.' })
    } catch (err) {
      setWeekError(apiErrorMessage(err))
    } finally {
      setWeekSaving(false)
      setConfirmSave(false)
    }
  }

  const handleResetWeek = () => {
    setWeek(savedWeek)
    setWeekError('')
  }

  // ------------------------------------------------------------- ngày ngoại lệ

  const openCreateException = () => {
    setExceptionForm(emptyExceptionForm())
    setExceptionError('')
    setExceptionModal({ id: null })
  }

  const openEditException = (row) => {
    setExceptionForm({
      exceptionDate: row.exceptionDate,
      openMinute: row.openMinute,
      closeMinute: row.closeMinute,
      note: row.note ?? '',
    })
    setExceptionError('')
    setExceptionModal({ id: row.id })
  }

  const closeExceptionModal = () => {
    if (!exceptionSaving) setExceptionModal(null)
  }

  const exceptionTimeInvalid = Number(exceptionForm.closeMinute) <= Number(exceptionForm.openMinute)

  const handleExceptionSubmit = async (event) => {
    event.preventDefault()
    if (exceptionTimeInvalid) {
      setExceptionError('Giờ đóng cửa phải sau giờ mở cửa.')
      return
    }
    const editingId = exceptionModal?.id
    setExceptionSaving(true)
    try {
      const payload = {
        exceptionDate: exceptionForm.exceptionDate,
        openMinute: Number(exceptionForm.openMinute),
        closeMinute: Number(exceptionForm.closeMinute),
        note: exceptionForm.note?.trim() ? exceptionForm.note.trim() : null,
      }
      if (editingId) {
        await updateOpeningException(editingId, payload, selectedLocationId)
      } else {
        await createOpeningException(selectedLocationId, payload)
      }
      await loadExceptions(selectedLocationId, exceptionFilter)
      setToast({ tone: 'success', text: editingId ? 'Đã cập nhật ngày ngoại lệ.' : 'Đã thêm ngày ngoại lệ.' })
      setExceptionModal(null)
    } catch (err) {
      setExceptionError(apiErrorMessage(err))
    } finally {
      setExceptionSaving(false)
    }
  }

  const handleDeleteException = async () => {
    const row = pendingDelete
    if (!row) return
    setDeleting(true)
    try {
      await deleteOpeningException(row.id, selectedLocationId)
      await loadExceptions(selectedLocationId, exceptionFilter)
      setToast({ tone: 'success', text: 'Đã xóa ngày ngoại lệ.' })
    } catch (err) {
      setToast({ tone: 'danger', text: apiErrorMessage(err) })
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  const applyExceptionFilter = async (filter) => {
    try {
      await loadExceptions(selectedLocationId, filter)
      setListError('')
    } catch (err) {
      setListError(apiErrorMessage(err))
    }
  }

  const clearExceptionFilter = () => {
    const empty = { from: '', to: '' }
    setExceptionFilter(empty)
    applyExceptionFilter(empty)
  }

  const filterInvalid = Boolean(exceptionFilter.from && exceptionFilter.to && exceptionFilter.from > exceptionFilter.to)
  const configuredDays = week.filter((day) => day.enabled).length
  const totalSlots = week.reduce((sum, day) => sum + (day.enabled ? slotCount(day.openMinute, day.closeMinute) : 0), 0)
  const readOnly = locationLocked || !selectedLocationId

  return (
    <ManagementLayout
      role="owner"
      title="Giờ mở cửa"
      subtitle={selectedLocation
        ? `${selectedLocation.name} · Giờ mở cửa theo tuần và ngày ngoại lệ. Mỗi khung giờ trên lịch sân dài ${SLOT_STEP} phút.`
        : `Giờ mở cửa theo tuần và ngày ngoại lệ. Mỗi khung giờ trên lịch sân dài ${SLOT_STEP} phút.`}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      <div className={styles.page}>
        {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}

        {loading && <LoadingState message="Đang tải địa điểm…" />}
        {!loading && loadError && (
          <ErrorState message={loadError} onRetry={() => setReloadKey((value) => value + 1)} />
        )}
        {!loading && !loadError && locations.length === 0 && (
          <EmptyState
            title="Chưa có địa điểm"
            description="Tài khoản chưa được gán địa điểm nào. Đăng ký sử dụng dịch vụ để bắt đầu cấu hình giờ mở cửa."
            action={<Link className={styles.linkButton} to="/register-service">Đăng ký thêm địa điểm</Link>}
          />
        )}

        {locationLocked && (
          <p className={`${styles.notice} ${styles.noticeDanger}`} role="status">
            <strong>Địa điểm đã bị khóa.</strong> Bạn chỉ xem được dữ liệu, không chỉnh sửa giờ mở cửa.
          </p>
        )}
        {serviceExpired && (
          <p className={`${styles.notice} ${styles.noticeWarning}`} role="status">
            <span>
              <strong>Thời hạn dịch vụ đã hết ngày {shortDate(selectedLocation.serviceTermEndDate)}.</strong>{' '}
              Địa điểm sẽ bị khóa khi quá hạn 10 ngày nếu chưa gia hạn.
            </span>
            <Link className={styles.linkButton} to={`/owner/facility-settings?locationId=${selectedLocation.id}#service-renewal`}>
              Yêu cầu gia hạn
            </Link>
          </p>
        )}

        {selectedLocationId && !loadError && (
          <>
            <section className={styles.card} aria-labelledby="week-heading">
              <header className={styles.cardHeader}>
                <div>
                  <h2 id="week-heading" className={styles.cardTitle}>Giờ mở cửa theo tuần</h2>
                  <p className={styles.cardHint}>
                    {configuredDays}/7 ngày mở cửa · {totalSlots} khung {SLOT_STEP} phút mỗi tuần.
                    Ngày tắt "Mở cửa" sẽ đóng cửa sau khi lưu.
                  </p>
                </div>
              </header>

              {weekLoading ? <LoadingState message="Đang tải giờ mở cửa…" /> : (
                <Table className={styles.weekTable}>
                  <thead>
                    <tr>
                      <th scope="col">Ngày</th>
                      <th scope="col">Mở cửa</th>
                      <th scope="col">Giờ mở</th>
                      <th scope="col">Giờ đóng</th>
                      <th scope="col">Số khung giờ</th>
                      <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.map((day) => {
                      const invalid = day.enabled && day.closeMinute <= day.openMinute
                      return (
                        <tr key={day.dayOfWeek} className={day.enabled ? undefined : styles.rowClosed}>
                          <td className={styles.dayName}>{day.label}</td>
                          <td>
                            <label className={styles.switch}>
                              <UiSwitch
                                aria-label={`${day.label}: mở cửa`}
                                checked={day.enabled}
                                disabled={readOnly || weekSaving}
                                onChange={(event) => updateDay(day.dayOfWeek, { enabled: event.target.checked })}
                              />
                              <span>{day.enabled ? 'Mở cửa' : 'Nghỉ'}</span>
                            </label>
                          </td>
                          <td>
                            <Select
                              className={styles.timeSelect}
                              value={day.openMinute}
                              disabled={!day.enabled || readOnly || weekSaving}
                              invalid={invalid}
                              aria-label={`${day.label}: giờ mở cửa`}
                              options={OPEN_OPTIONS}
                              onChange={(event) => updateDay(day.dayOfWeek, { openMinute: Number(event.target.value) })}
                            />
                          </td>
                          <td>
                            <Select
                              className={styles.timeSelect}
                              value={day.closeMinute}
                              disabled={!day.enabled || readOnly || weekSaving}
                              invalid={invalid}
                              aria-label={`${day.label}: giờ đóng cửa`}
                              options={CLOSE_OPTIONS}
                              onChange={(event) => updateDay(day.dayOfWeek, { closeMinute: Number(event.target.value) })}
                            />
                          </td>
                          <td className={styles.numeric}>
                            {!day.enabled ? '—' : invalid
                              ? <span className={styles.inlineError}>Giờ đóng phải sau giờ mở</span>
                              : `${slotCount(day.openMinute, day.closeMinute)} khung`}
                          </td>
                          <td className={styles.rowAction}>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!day.enabled || invalid || readOnly || weekSaving}
                              onClick={() => applyToOtherDays(day)}
                            >
                              Áp dụng cho các ngày khác
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}

              {weekError && <p className={styles.formError} role="alert">{weekError}</p>}
            </section>

            <section className={styles.card} aria-labelledby="exception-heading">
              <header className={styles.cardHeader}>
                <div>
                  <h2 id="exception-heading" className={styles.cardTitle}>Ngày ngoại lệ</h2>
                  <p className={styles.cardHint}>
                    Giờ mở cửa riêng cho một ngày cụ thể (nghỉ lễ, giải đấu, đổi giờ trong ngày).
                  </p>
                </div>
                <Button onClick={openCreateException} disabled={readOnly}>Thêm ngày ngoại lệ</Button>
              </header>

              <form
                className={styles.filterRow}
                onSubmit={(event) => { event.preventDefault(); if (!filterInvalid) applyExceptionFilter(exceptionFilter) }}
              >
                <FormField label="Từ ngày" className={styles.filterField}>
                  <UiDatePicker
                    value={exceptionFilter.from}
                    onChange={(event) => setExceptionFilter((current) => ({ ...current, from: event.target.value }))}
                  />
                </FormField>
                <FormField
                  label="Đến ngày"
                  className={styles.filterField}
                  error={filterInvalid ? 'Ngày kết thúc phải sau ngày bắt đầu.' : undefined}
                >
                  <UiDatePicker
                    value={exceptionFilter.to}
                    onChange={(event) => setExceptionFilter((current) => ({ ...current, to: event.target.value }))}
                  />
                </FormField>
                <div className={styles.filterActions}>
                  <Button type="submit" variant="secondary" disabled={filterInvalid}>Lọc</Button>
                  {(exceptionFilter.from || exceptionFilter.to) && (
                    <Button variant="ghost" onClick={clearExceptionFilter}>Xóa bộ lọc</Button>
                  )}
                </div>
              </form>

              {listError && (
                <ErrorState message={listError} onRetry={() => applyExceptionFilter(exceptionFilter)} />
              )}
              {!listError && !weekLoading && exceptions.length === 0 && (
                <EmptyState
                  title="Chưa có ngày ngoại lệ"
                  description={exceptionFilter.from || exceptionFilter.to
                    ? 'Không có ngày ngoại lệ trong khoảng đã chọn. Thử bỏ bớt điều kiện lọc.'
                    : 'Các ngày còn lại dùng giờ mở cửa theo tuần ở trên.'}
                  action={!readOnly && <Button variant="secondary" onClick={openCreateException}>Thêm ngày ngoại lệ</Button>}
                />
              )}
              {!listError && exceptions.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Ngày</th>
                      <th scope="col">Giờ hoạt động</th>
                      <th scope="col">Số khung giờ</th>
                      <th scope="col">Ghi chú</th>
                      <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{weekdayName(row.exceptionDate)}, {shortDate(row.exceptionDate)}</strong>
                        </td>
                        <td className={styles.numeric}>{row.openTime}–{row.closeTime}</td>
                        <td className={styles.numeric}>
                          {Math.floor((row.durationMinutes ?? 0) / SLOT_STEP)} khung
                        </td>
                        <td className={styles.noteCell}>{row.note || '—'}</td>
                        <td className={styles.rowAction}>
                          <div className={styles.rowButtons}>
                            <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => openEditException(row)}>
                              Sửa
                            </Button>
                            <Button variant="ghost" size="sm" className={styles.dangerText} disabled={readOnly}
                              onClick={() => setPendingDelete(row)}>
                              Xóa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          </>
        )}

        {weekDirty && (
          <div className={styles.saveBar} role="region" aria-label="Thay đổi chưa lưu">
            <span>Giờ mở cửa có thay đổi chưa lưu.</span>
            <div className={styles.saveBarActions}>
              <Button variant="secondary" onClick={handleResetWeek} disabled={weekSaving}>Hoàn tác</Button>
              <Button onClick={requestSaveWeek} loading={weekSaving} disabled={readOnly}>Lưu giờ mở cửa</Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmSave}
        title="Lưu giờ mở cửa?"
        confirmText="Lưu giờ mở cửa"
        busy={weekSaving}
        onConfirm={handleSaveWeek}
        onCancel={() => setConfirmSave(false)}
      >
        <p>Giờ mở cửa mới thay thế cấu hình của cả tuần.</p>
        <p className={styles.dialogWarning}>
          Booking đã xác nhận nằm ngoài giờ mở cửa mới sẽ bị đánh dấu ảnh hưởng do sân hủy lịch. Khách được thông báo
          để chọn đổi slot miễn phí, hoàn tiền hoặc nhận điểm bồi hoàn.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa ngày ngoại lệ?"
        tone="danger"
        confirmText="Xóa ngày ngoại lệ"
        busy={deleting}
        onConfirm={handleDeleteException}
        onCancel={() => setPendingDelete(null)}
      >
        {pendingDelete && (
          <p>
            Ngày {shortDate(pendingDelete.exceptionDate)} sẽ quay về giờ mở cửa theo tuần của{' '}
            {weekdayName(pendingDelete.exceptionDate)}.
          </p>
        )}
      </ConfirmDialog>

      <Modal
        open={Boolean(exceptionModal)}
        title={exceptionModal?.id ? 'Sửa ngày ngoại lệ' : 'Thêm ngày ngoại lệ'}
        onClose={closeExceptionModal}
        busy={exceptionSaving}
      >
        <form className={styles.modalForm} onSubmit={handleExceptionSubmit}>
          <FormField label="Ngày" required>
            <UiDatePicker
              required
              value={exceptionForm.exceptionDate}
              onChange={(event) => setExceptionForm((current) => ({ ...current, exceptionDate: event.target.value }))}
            />
          </FormField>
          <div className={styles.twoCols}>
            <FormField label="Giờ mở" required>
              <Select
                value={exceptionForm.openMinute}
                options={OPEN_OPTIONS}
                invalid={exceptionTimeInvalid}
                onChange={(event) => setExceptionForm((current) => ({ ...current, openMinute: Number(event.target.value) }))}
              />
            </FormField>
            <FormField label="Giờ đóng" required
              error={exceptionTimeInvalid ? 'Giờ đóng cửa phải sau giờ mở cửa.' : undefined}>
              <Select
                value={exceptionForm.closeMinute}
                options={CLOSE_OPTIONS}
                invalid={exceptionTimeInvalid}
                onChange={(event) => setExceptionForm((current) => ({ ...current, closeMinute: Number(event.target.value) }))}
              />
            </FormField>
          </div>
          {!exceptionTimeInvalid && (
            <p className={styles.cardHint}>
              Ngày này có {slotCount(Number(exceptionForm.openMinute), Number(exceptionForm.closeMinute))} khung {SLOT_STEP} phút.
            </p>
          )}
          <FormField label="Ghi chú" hint={`${exceptionForm.note.length}/255 ký tự`}>
            <Input
              type="text"
              maxLength={255}
              placeholder="Ví dụ: Nghỉ lễ Quốc khánh, giải đấu nội bộ"
              value={exceptionForm.note}
              onChange={(event) => setExceptionForm((current) => ({ ...current, note: event.target.value }))}
            />
          </FormField>
          {exceptionError && <p className={styles.formError} role="alert">{exceptionError}</p>}
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={closeExceptionModal} disabled={exceptionSaving}>Hủy</Button>
            <Button type="submit" loading={exceptionSaving} disabled={exceptionTimeInvalid}>
              {exceptionModal?.id ? 'Lưu thay đổi' : 'Thêm ngày ngoại lệ'}
            </Button>
          </div>
        </form>
      </Modal>
    </ManagementLayout>
  )
}
