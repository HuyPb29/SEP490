import ServiceRenewals from '../../components/location/ServiceRenewals'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProtectedImage } from '../../api'
import {
  apiErrorMessage,
  getOwnerLocations, getStoredLocationId,
  storeLocationId,
  updateOwnerLocation,
  uploadOwnerLocationQr,
} from '../../api/locationApi'
import { downloadVenueData } from '../../api/ownerApi'
import ManagementLayout from '../../components/layout/ManagementLayout'
import {
  Button,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  StatusBadge,
  Toast,
} from '../../components/common'
import { FileInput } from '../../components/common/FileInput'
import LocationMap from '../../components/map/LocationMap'
import { dateTime, errorMessage, shortDate, today } from '../../utils/formatters'
import styles from './OwnerFacilitySettingsPage.module.css'

/** Khớp ràng buộc trong UpdateLocationRequest để báo lỗi ngay, khỏi gọi API. */
const PHONE_PATTERN = /^0\d{9}$/
const LIMITS = {
  name: 100,
  address: 255,
  bankName: 100,
  bankAccountNo: 30,
  bankAccountHolder: 100,
  advanceBookingDays: { min: 1, max: 365 },
  pointEarningRate: { min: 1000, max: 100000 },
}
const DEFAULT_MAP_CENTER = { latitude: 21.028511, longitude: 105.854444 }

/** Mỗi khối có nút Lưu riêng và chỉ gửi các trường của khối đó. */
const GROUPS = {
  profile: ['name', 'address', 'contactPhone', 'latitude', 'longitude'],
  policy: ['advanceBookingDays', 'pointEarningRate'],
  bank: ['bankName', 'bankAccountNo', 'bankAccountHolder'],
}

const SECTIONS = [
  ['settings-profile', 'Hồ sơ địa điểm'],
  ['settings-bank', 'Nhận chuyển khoản'],
  ['settings-policy', 'Chính sách đặt sân'],
  ['settings-service', 'Thời hạn dịch vụ'],
  ['settings-export', 'Tải dữ liệu quản lý'],
]

/** Form luôn giữ dạng chuỗi để người dùng xoá trắng được, lúc gửi mới đổi kiểu. */
function toForm(location) {
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    contactPhone: location?.contactPhone ?? '',
    latitude: location?.latitude === null || location?.latitude === undefined ? '' : String(location.latitude),
    longitude: location?.longitude === null || location?.longitude === undefined ? '' : String(location.longitude),
    advanceBookingDays:
      location?.advanceBookingDays === null || location?.advanceBookingDays === undefined
        ? ''
        : String(location.advanceBookingDays),
    pointEarningRate:
      location?.pointEarningRate === null || location?.pointEarningRate === undefined
        ? ''
        : String(location.pointEarningRate),
    bankName: location?.bankName ?? '',
    bankAccountNo: location?.bankAccountNo ?? '',
    bankAccountHolder: location?.bankAccountHolder ?? '',
  }
}

function pick(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]))
}

function validateGroup(form, keys) {
  const errors = {}
  if (keys.includes('name')) {
    if (!form.name.trim()) errors.name = 'Tên địa điểm không được để trống.'
    else if (form.name.trim().length > LIMITS.name) errors.name = `Tên địa điểm tối đa ${LIMITS.name} ký tự.`
  }
  if (keys.includes('address')) {
    if (!form.address.trim()) errors.address = 'Địa chỉ không được để trống.'
    else if (form.address.trim().length > LIMITS.address) errors.address = `Địa chỉ tối đa ${LIMITS.address} ký tự.`
  }
  if (keys.includes('contactPhone') && form.contactPhone.trim() && !PHONE_PATTERN.test(form.contactPhone.trim())) {
    errors.contactPhone = 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'
  }
  const numericChecks = [
    ['advanceBookingDays', 'Số ngày đặt trước tối đa', LIMITS.advanceBookingDays],
    ['pointEarningRate', 'Tỷ lệ tích điểm', LIMITS.pointEarningRate],
  ]
  for (const [field, label, range] of numericChecks) {
    if (!keys.includes(field)) continue
    const raw = form[field].trim()
    if (!raw) continue
    const value = Number(raw)
    if (!Number.isFinite(value)) errors[field] = `${label} phải là số.`
    else if (value < range.min || value > range.max) {
      errors[field] = `${label} phải trong khoảng ${range.min.toLocaleString('vi-VN')} đến ${range.max.toLocaleString('vi-VN')}.`
    }
  }
  return errors
}

/** Chỉ gửi trường đã đổi: backend coi null là "giữ nguyên". */
function buildPayload(form, original, keys) {
  const payload = {}
  const changed = (key) => keys.includes(key) && form[key] !== original[key]
  if (changed('name')) payload.name = form.name.trim()
  if (changed('address')) payload.address = form.address.trim()
  // contactPhone có @Pattern nên không gửi chuỗi rỗng (không xoá được, chỉ thay được).
  if (changed('contactPhone') && form.contactPhone.trim()) payload.contactPhone = form.contactPhone.trim()
  if (changed('latitude') && form.latitude.trim()) payload.latitude = Number(form.latitude)
  if (changed('longitude') && form.longitude.trim()) payload.longitude = Number(form.longitude)
  if (changed('advanceBookingDays') && form.advanceBookingDays.trim()) {
    payload.advanceBookingDays = Number(form.advanceBookingDays)
  }
  if (changed('pointEarningRate') && form.pointEarningRate.trim()) {
    payload.pointEarningRate = Number(form.pointEarningRate)
  }
  // Nhóm ngân hàng gửi chuỗi rỗng để xoá được giá trị cũ.
  if (changed('bankName')) payload.bankName = form.bankName.trim()
  if (changed('bankAccountNo')) payload.bankAccountNo = form.bankAccountNo.trim()
  if (changed('bankAccountHolder')) payload.bankAccountHolder = form.bankAccountHolder.trim()
  return payload
}

function SettingsCard({ id, title, hint, dirty, children, footer }) {
  return (
    <section id={id} className={styles.card} aria-labelledby={`${id}-title`} tabIndex={-1}>
      <header className={styles.cardHeader}>
        <div>
          <h2 id={`${id}-title`} className={styles.cardTitle}>{title}</h2>
          {hint && <p className={styles.cardHint}>{hint}</p>}
        </div>
        {dirty && <StatusBadge tone="warning">Chưa lưu</StatusBadge>}
      </header>
      {children}
      {footer && <footer className={styles.cardFooter}>{footer}</footer>}
    </section>
  )
}

export default function OwnerFacilitySettingsPage() {
  // ?locationId= từ thông báo gia hạn hoặc nút "Yêu cầu gia hạn": mở đúng địa điểm đó thay vì địa điểm đang chọn.
  const [searchParams] = useSearchParams()
  const requestedLocationId = Number(searchParams.get('locationId')) || null
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState(() => toForm(null))
  const [original, setOriginal] = useState(() => toForm(null))
  const [fieldErrors, setFieldErrors] = useState({})
  const [savingGroup, setSavingGroup] = useState(null)
  const [groupError, setGroupError] = useState({})
  const [toast, setToast] = useState(null)
  const [qrPreview, setQrPreview] = useState('')
  const [qrError, setQrError] = useState('')
  const [uploadingQr, setUploadingQr] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [exportRange, setExportRange] = useState(() => ({ from: today().slice(0, 8) + '01', to: today() }))
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )
  const locked = selectedLocation?.status === 'LOCKED'
  const qrPath = selectedLocation?.qrImagePath
  useEffect(() => {
    let active = true
    let objectUrl
    setQrPreview('')
    setQrError('')
    if (qrPath && !locked) {
      fetchProtectedImage(`/api/owner/locations/${selectedLocationId}/qr`)
        .then((url) => {
          objectUrl = url
          if (active) setQrPreview(url)
          else URL.revokeObjectURL(url)
        })
        .catch(() => {
          if (active) setQrError('Không tải được ảnh QR đã lưu.')
        })
    }
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedLocationId, qrPath, locked])

  const handleQrUpload = async (event) => {
    const input = event.currentTarget
    const image = input.files?.[0]
    input.value = ''
    if (!image || !selectedLocationId || locked || uploadingQr) return
    setQrError('')
    if (!['image/jpeg', 'image/png'].includes(image.type) || image.size > 5 * 1024 * 1024) {
      setQrError('Chọn ảnh JPG hoặc PNG tối đa 5 MB.')
      return
    }
    setUploadingQr(true)
    try {
      const path = await uploadOwnerLocationQr(selectedLocationId, image)
      setLocations((rows) => rows.map((row) =>
        row.id === selectedLocationId ? { ...row, qrImagePath: path } : row))
      setToast({ tone: 'success', text: 'Đã lưu ảnh QR chuyển khoản.' })
    } catch (err) {
      setQrError(apiErrorMessage(err))
    } finally {
      setUploadingQr(false)
    }
  }

  const dirtyGroup = useMemo(
    () => Object.fromEntries(Object.entries(GROUPS).map(([group, keys]) =>
      [group, keys.some((key) => form[key] !== original[key])])),
    [form, original],
  )

  const loadLocations = useCallback(async (preferredId) => {
    const rows = await getOwnerLocations()
    setLocations(rows)
    const stored = Number(getStoredLocationId())
    const wanted = preferredId ?? stored
    const next = rows.find((location) => location.id === wanted) ?? rows[0] ?? null
    setSelectedLocationId(next?.id ?? null)
    if (next) storeLocationId(next.id)
    setForm(toForm(next))
    setOriginal(toForm(next))
    setFieldErrors({})
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await loadLocations(requestedLocationId ?? undefined)
        if (!cancelled) setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(apiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadLocations, requestedLocationId, reloadKey])

  const handleFacilityChange = (value) => {
    const nextId = Number(value)
    if (!Number.isInteger(nextId) || nextId <= 0) return
    const next = locations.find((location) => location.id === nextId) ?? null
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setForm(toForm(next))
    setOriginal(toForm(next))
    setFieldErrors({})
    setGroupError({})
    setToast(null)
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  /** FR17: vị trí chỉ chọn bằng ghim trên bản đồ hoặc GPS, không nhập tay kinh độ, vĩ độ. */
  const pickLocation = (latitude, longitude) => {
    setForm((current) => ({
      ...current,
      latitude: String(Number(latitude.toFixed(6))),
      longitude: String(Number(longitude.toFixed(6))),
    }))
    setLocationError('')
  }

  const handleUseCurrentLocation = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('Không thể dùng định vị ở trình duyệt này. Hãy bấm vào bản đồ để đặt ghim.')
      return
    }
    setLocationError('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        pickLocation(coords.latitude, coords.longitude)
        setLocating(false)
      },
      (geoError) => {
        setLocationError(geoError.code === 1
          ? 'Quyền vị trí đang bị chặn. Hãy cho phép vị trí trong cài đặt trang hoặc bấm vào bản đồ để đặt ghim.'
          : 'Không lấy được vị trí. Hãy bấm vào bản đồ để đặt ghim.')
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  const saveGroup = async (group) => {
    const keys = GROUPS[group]
    if (locked) {
      setGroupError((current) => ({ ...current, [group]: 'Địa điểm đang bị khóa nên không lưu được thay đổi.' }))
      return
    }
    const errors = validateGroup(form, keys)
    if (Object.keys(errors).length) {
      setFieldErrors((current) => ({ ...current, ...errors }))
      return
    }
    const payload = buildPayload(form, original, keys)
    if (Object.keys(payload).length === 0) {
      setGroupError((current) => ({ ...current, [group]: 'Chưa có thay đổi nào để lưu.' }))
      return
    }
    setSavingGroup(group)
    setGroupError((current) => ({ ...current, [group]: '' }))
    try {
      const updated = await updateOwnerLocation(selectedLocationId, payload)
      setLocations((current) =>
        current.map((location) =>
          location.id === selectedLocationId ? { ...location, ...updated } : location,
        ),
      )
      // Chỉ cập nhật trường của khối vừa lưu, giữ nguyên thay đổi chưa lưu ở khối khác.
      const saved = pick(toForm(updated), keys)
      setForm((current) => ({ ...current, ...saved }))
      setOriginal((current) => ({ ...current, ...saved }))
      setToast({ tone: 'success', text: 'Đã lưu thay đổi.' })
    } catch (err) {
      setGroupError((current) => ({ ...current, [group]: apiErrorMessage(err) }))
    } finally {
      setSavingGroup(null)
    }
  }

  const resetGroup = (group) => {
    const keys = GROUPS[group]
    setForm((current) => ({ ...current, ...pick(original, keys) }))
    setFieldErrors((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, undefined])) }))
    setGroupError((current) => ({ ...current, [group]: '' }))
  }

  const exportInvalid = !exportRange.from || !exportRange.to || exportRange.from > exportRange.to
  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      await downloadVenueData({ from: exportRange.from, to: exportRange.to })
      setToast({ tone: 'success', text: 'Đã tải file Excel dữ liệu quản lý.' })
    } catch (err) {
      setExportError(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const groupFooter = (group, label) => (
    <>
      {groupError[group] && <p className={styles.formError} role="alert">{groupError[group]}</p>}
      <div className={styles.footerActions}>
        <Button variant="ghost" onClick={() => resetGroup(group)} disabled={!dirtyGroup[group] || savingGroup === group}>
          Hoàn tác
        </Button>
        <Button
          onClick={() => saveGroup(group)}
          loading={savingGroup === group}
          disabled={locked || !dirtyGroup[group] || Boolean(savingGroup && savingGroup !== group)}
        >
          {label}
        </Button>
      </div>
    </>
  )

  const disabled = locked || !selectedLocationId

  return (
    <ManagementLayout
      role="owner"
      title="Cài đặt địa điểm"
      subtitle={selectedLocation
        ? `${selectedLocation.name} · Hồ sơ, tài khoản nhận tiền, chính sách đặt sân và thời hạn dịch vụ. Đổi địa điểm ở thanh bên trái.`
        : 'Hồ sơ, tài khoản nhận tiền, chính sách đặt sân và thời hạn dịch vụ.'}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}
      {loading && <LoadingState message="Đang tải hồ sơ địa điểm…" />}
      {!loading && loadError && <ErrorState message={loadError} onRetry={() => setReloadKey((value) => value + 1)} />}

      {!loading && !loadError && selectedLocation && (
        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="Mục lục cài đặt">
            <ol>
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} onClick={(event) => {
                    event.preventDefault()
                    const target = document.getElementById(id)
                    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    target?.focus({ preventScroll: true })
                  }}>
                    {label}
                    {GROUPS[id.replace('settings-', '')] && dirtyGroup[id.replace('settings-', '')] && (
                      <span className={styles.dirtyDot} aria-label="có thay đổi chưa lưu" />
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.content}>
            {locked && (
              <p className={`${styles.notice} ${styles.noticeDanger}`} role="status">
                <strong>Địa điểm đã bị khóa.</strong> Gửi yêu cầu gia hạn ở mục "Thời hạn dịch vụ" để mở lại và chỉnh sửa.
              </p>
            )}

            <SettingsCard
              id="settings-profile"
              title="Hồ sơ địa điểm"
              hint="Hiển thị cho người chơi ở trang tìm địa điểm và trang chi tiết địa điểm."
              dirty={dirtyGroup.profile}
              footer={groupFooter('profile', 'Lưu hồ sơ')}
            >
              <div className={styles.fieldGrid}>
                <FormField label="Tên địa điểm" required error={fieldErrors.name} className={styles.fieldWide}
                  hint={`${form.name.length}/${LIMITS.name} ký tự`}>
                  <Input type="text" maxLength={LIMITS.name} value={form.name} disabled={disabled}
                    onChange={updateField('name')} />
                </FormField>
                <FormField label="Địa chỉ" required error={fieldErrors.address} className={styles.fieldWide}>
                  <Input type="text" maxLength={LIMITS.address} value={form.address} disabled={disabled}
                    onChange={updateField('address')} />
                </FormField>
                <FormField label="Số điện thoại liên hệ" error={fieldErrors.contactPhone}
                  hint="10 chữ số, bắt đầu bằng 0.">
                  <Input type="tel" inputMode="numeric" placeholder="0900000010" value={form.contactPhone}
                    disabled={disabled} onChange={updateField('contactPhone')} />
                </FormField>
              </div>

              <div className={styles.mapBlock}>
                <div className={styles.mapHeader}>
                  <div>
                    <p className={styles.fieldLabel}>Vị trí trên bản đồ</p>
                    <p className={styles.cardHint}>Bấm vào bản đồ để đặt ghim tại sân, kéo ghim để chỉnh cho đúng.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleUseCurrentLocation}
                    loading={locating} loadingText="Đang lấy vị trí…"
                    disabled={disabled || Boolean(savingGroup)}>
                    Dùng vị trí hiện tại
                  </Button>
                </div>
                <div className={styles.map}>
                  <LocationMap
                    initialCenter={DEFAULT_MAP_CENTER}
                    venues={form.latitude === '' || form.longitude === '' ? [] :
                      [{ facility_id: 'current', latitude: form.latitude, longitude: form.longitude }]}
                    onPick={pickLocation}
                    pickDisabled={disabled || Boolean(savingGroup) || locating}
                  />
                </div>
                <p className={styles.cardHint} aria-live="polite">
                  {form.latitude === '' || form.longitude === ''
                    ? 'Chưa chọn vị trí.'
                    : `Ghim đang ở ${form.latitude}, ${form.longitude}.`}
                </p>
                {locationError && <p className={styles.formError} role="alert">{locationError}</p>}
              </div>
            </SettingsCard>

            <SettingsCard
              id="settings-bank"
              title="Thông tin nhận chuyển khoản"
              hint="Người chơi chuyển khoản theo thông tin này; nhân viên đối chiếu để xác nhận thanh toán."
              dirty={dirtyGroup.bank}
              footer={groupFooter('bank', 'Lưu tài khoản')}
            >
              <div className={styles.bankLayout}>
                <div className={styles.fieldStack}>
                  <FormField label="Ngân hàng">
                    <Input type="text" maxLength={LIMITS.bankName} placeholder="Vietcombank" value={form.bankName}
                      disabled={disabled} onChange={updateField('bankName')} />
                  </FormField>
                  <FormField label="Số tài khoản">
                    <Input type="text" inputMode="numeric" maxLength={LIMITS.bankAccountNo} value={form.bankAccountNo}
                      className={styles.accountNo} disabled={disabled} onChange={updateField('bankAccountNo')} />
                  </FormField>
                  <FormField label="Tên chủ tài khoản">
                    <Input type="text" maxLength={LIMITS.bankAccountHolder} value={form.bankAccountHolder}
                      disabled={disabled} onChange={updateField('bankAccountHolder')} />
                  </FormField>
                </div>
                <div className={styles.qrPanel}>
                  <p className={styles.fieldLabel}>Ảnh mã QR</p>
                  <div className={styles.qrFrame}>
                    {qrPreview ? (
                      <img
                        src={qrPreview}
                        alt="Mã QR chuyển khoản của địa điểm"
                        className={styles.qrImage}
                        onError={() => {
                          setQrPreview('')
                          setQrError('Ảnh QR đã lưu nhưng không hiển thị được. Hãy chọn lại ảnh JPG hoặc PNG.')
                        }}
                      />
                    ) : (
                      <span className={styles.qrEmpty}>{uploadingQr ? 'Đang tải ảnh…' : 'Chưa có ảnh QR'}</span>
                    )}
                  </div>
                  <FormField label="Chọn ảnh QR mới" htmlFor="location-qr-upload"
                    hint="JPG hoặc PNG, tối đa 5 MB. Ảnh được lưu ngay khi chọn." error={qrError || undefined}>
                    <FileInput id="location-qr-upload" accept="image/jpeg,image/png" onChange={handleQrUpload}
                      aria-describedby={qrError ? 'location-qr-upload-error' : 'location-qr-upload-hint'}
                      disabled={uploadingQr || Boolean(savingGroup) || disabled} />
                  </FormField>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              id="settings-policy"
              title="Chính sách đặt sân và tích điểm"
              hint="Áp dụng cho mọi sân của địa điểm này."
              dirty={dirtyGroup.policy}
              footer={groupFooter('policy', 'Lưu chính sách')}
            >
              <div className={styles.fieldGrid}>
                <FormField label="Số ngày đặt trước tối đa" error={fieldErrors.advanceBookingDays}
                  hint="Từ 1 đến 365 ngày. Mặc định 30 ngày.">
                  <Input type="number" min={LIMITS.advanceBookingDays.min} max={LIMITS.advanceBookingDays.max}
                    placeholder="30" value={form.advanceBookingDays} disabled={disabled}
                    onChange={updateField('advanceBookingDays')} />
                </FormField>
                <FormField label="Tỷ lệ tích điểm (số đồng được 1 điểm)" error={fieldErrors.pointEarningRate}
                  hint="Từ 1.000 đến 100.000 đồng. Chỉ áp dụng cho các lần tích điểm sau khi lưu.">
                  <Input type="number" min={LIMITS.pointEarningRate.min} max={LIMITS.pointEarningRate.max}
                    step="1000" placeholder="10000" value={form.pointEarningRate} disabled={disabled}
                    onChange={updateField('pointEarningRate')} />
                </FormField>
              </div>
            </SettingsCard>

            <SettingsCard
              id="settings-service"
              title="Thời hạn sử dụng dịch vụ"
              hint="Do quản trị viên ghi nhận. Gửi yêu cầu gia hạn kèm chứng từ chuyển khoản ở bên dưới."
            >
              <dl className={styles.facts}>
                <div>
                  <dt>Tình trạng</dt>
                  <dd><StatusBadge category="location" status={selectedLocation.status} /></dd>
                </div>
                <div>
                  <dt>Hết hạn sử dụng dịch vụ</dt>
                  <dd>{selectedLocation.serviceTermEndDate ? shortDate(selectedLocation.serviceTermEndDate) : '—'}</dd>
                </div>
                <div><dt>Số sân</dt><dd>{selectedLocation.courts?.length ?? 0}</dd></div>
                {selectedLocation.lockedAt && <div><dt>Thời điểm khóa</dt><dd>{dateTime(selectedLocation.lockedAt)}</dd></div>}
                <div><dt>Ngày tạo</dt><dd>{dateTime(selectedLocation.createdAt)}</dd></div>
                <div><dt>Cập nhật lần cuối</dt><dd>{dateTime(selectedLocation.updatedAt)}</dd></div>
              </dl>
              <ServiceRenewals key={selectedLocationId} locationId={selectedLocationId}
                onRefresh={() => loadLocations(selectedLocationId)} />
            </SettingsCard>

            <SettingsCard
              id="settings-export"
              title="Tải dữ liệu quản lý"
              hint="File Excel gồm lịch sắp tới, booking đã qua và thu chi trong khoảng ngày đã chọn."
            >
              <div className={styles.exportRow}>
                <FormField label="Từ ngày" required>
                  <Input type="date" value={exportRange.from} max={exportRange.to || undefined}
                    onChange={(event) => setExportRange((current) => ({ ...current, from: event.target.value }))} />
                </FormField>
                <FormField label="Đến ngày" required
                  error={exportRange.from && exportRange.to && exportRange.from > exportRange.to
                    ? 'Ngày kết thúc phải sau ngày bắt đầu.' : undefined}>
                  <Input type="date" value={exportRange.to} min={exportRange.from || undefined}
                    onChange={(event) => setExportRange((current) => ({ ...current, to: event.target.value }))} />
                </FormField>
                <Button variant="secondary" className={styles.exportButton} onClick={handleExport}
                  loading={exporting} loadingText="Đang tạo file…" disabled={exportInvalid}>
                  Tải file Excel
                </Button>
              </div>
              {exportError && <p className={styles.formError} role="alert">{exportError}</p>}
            </SettingsCard>
          </div>
        </div>
      )}
    </ManagementLayout>
  )
}
