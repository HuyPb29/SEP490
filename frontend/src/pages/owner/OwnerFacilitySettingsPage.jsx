import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchProtectedImage } from '../../api'
import {
  apiErrorMessage,
  getOwnerLocations, getStoredLocationId,
  storeLocationId,
  updateOwnerLocation,
  uploadOwnerLocationQr,
} from '../../api/locationApi'
import ManagementLayout from '../../components/layout/ManagementLayout'
import LocationMap from '../../components/map/LocationMap'
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
  pointRedemptionValue: { min: 1, max: 100000 },
}
const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', LOCKED: 'Đã khóa' }
const DEFAULT_MAP_CENTER = { latitude: 21.028511, longitude: 105.854444 }

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
    pointRedemptionValue: String(location?.pointRedemptionValue ?? 500),
    bankName: location?.bankName ?? '',
    bankAccountNo: location?.bankAccountNo ?? '',
    bankAccountHolder: location?.bankAccountHolder ?? '',
  }
}

function formatDateTime(value) {
  if (!value) return '—'
  const [datePart, timePart = ''] = String(value).split('T')
  const [year, month, day] = datePart.split('-')
  const date = `${day}/${month}/${year}`
  const time = timePart.slice(0, 5)
  return time ? `${date} ${time}` : date
}

export default function OwnerFacilitySettingsPage() {
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [_loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState(() => toForm(null))
  const [original, setOriginal] = useState(() => toForm(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pointValueError, setPointValueError] = useState('')
  const [qrPreview, setQrPreview] = useState('')
  const [qrError, setQrError] = useState('')
  const [qrSavedLocationId, setQrSavedLocationId] = useState(null)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

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
    setQrSavedLocationId(null)
    if (!['image/jpeg', 'image/png'].includes(image.type) || image.size > 5 * 1024 * 1024) {
      setQrError('Chọn ảnh JPG hoặc PNG tối đa 5 MB.')
      return
    }
    setUploadingQr(true)
    try {
      const path = await uploadOwnerLocationQr(selectedLocationId, image)
      setLocations((rows) => rows.map((row) =>
        row.id === selectedLocationId ? { ...row, qrImagePath: path } : row))
      setQrSavedLocationId(selectedLocationId)
    } catch (err) {
      setQrError(apiErrorMessage(err))
    } finally {
      setUploadingQr(false)
    }
  }
  const dirty = useMemo(
    () => Object.keys(form).some((key) => form[key] !== original[key]),
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
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await loadLocations()
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
  }, [loadLocations])

  const handleFacilityChange = (value) => {
    const nextId = Number(value)
    if (!Number.isInteger(nextId) || nextId <= 0) return
    const next = locations.find((location) => location.id === nextId) ?? null
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setForm(toForm(next))
    setOriginal(toForm(next))
    setError('')
    setPointValueError('')
    setMessage('')
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'pointRedemptionValue') setPointValueError('')
    setMessage('')
  }

  /** FR17: vị trí chỉ chọn bằng ghim trên bản đồ hoặc GPS, không nhập tay kinh độ, vĩ độ. */
  const pickLocation = (latitude, longitude) => {
    setForm((current) => ({
      ...current,
      latitude: String(Number(latitude.toFixed(6))),
      longitude: String(Number(longitude.toFixed(6))),
    }))
    setLocationError('')
    setMessage('')
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

  const validate = () => {
    if (!form.name.trim()) return 'Tên địa điểm không được để trống.'
    if (form.name.trim().length > LIMITS.name) return `Tên địa điểm tối đa ${LIMITS.name} ký tự.`
    if (!form.address.trim()) return 'Địa chỉ không được để trống.'
    if (form.address.trim().length > LIMITS.address) return `Địa chỉ tối đa ${LIMITS.address} ký tự.`
    if (form.contactPhone.trim() && !PHONE_PATTERN.test(form.contactPhone.trim())) {
      return 'Số điện thoại liên hệ phải gồm 10 chữ số, bắt đầu bằng 0.'
    }

    const numericChecks = [
      ['advanceBookingDays', 'Số ngày đặt trước tối đa', LIMITS.advanceBookingDays],
      ['pointEarningRate', 'Tỷ lệ tích điểm', LIMITS.pointEarningRate],
    ]
    for (const [field, label, range] of numericChecks) {
      const raw = form[field].trim()
      if (!raw) continue
      const value = Number(raw)
      if (!Number.isFinite(value)) return `${label} phải là số.`
      if (value < range.min || value > range.max) {
        return `${label} phải trong khoảng ${range.min.toLocaleString('vi-VN')} đến ${range.max.toLocaleString('vi-VN')}.`
      }
    }
    return ''
  }

  /** Chỉ gửi trường đã đổi: backend coi null là "giữ nguyên". */
  const buildPayload = () => {
    const payload = {}
    if (form.name !== original.name) payload.name = form.name.trim()
    if (form.address !== original.address) payload.address = form.address.trim()
    // contactPhone có @Pattern nên không gửi chuỗi rỗng (không xoá được, chỉ thay được).
    if (form.contactPhone !== original.contactPhone && form.contactPhone.trim()) {
      payload.contactPhone = form.contactPhone.trim()
    }
    if (form.latitude !== original.latitude && form.latitude.trim()) {
      payload.latitude = Number(form.latitude)
    }
    if (form.longitude !== original.longitude && form.longitude.trim()) {
      payload.longitude = Number(form.longitude)
    }
    if (form.advanceBookingDays !== original.advanceBookingDays && form.advanceBookingDays.trim()) {
      payload.advanceBookingDays = Number(form.advanceBookingDays)
    }
    if (form.pointEarningRate !== original.pointEarningRate && form.pointEarningRate.trim()) {
      payload.pointEarningRate = Number(form.pointEarningRate)
    }
    if (form.pointRedemptionValue !== original.pointRedemptionValue) {
      payload.pointRedemptionValue = Number(form.pointRedemptionValue)
    }
    // Nhóm ngân hàng gửi chuỗi rỗng để xoá được giá trị cũ.
    if (form.bankName !== original.bankName) payload.bankName = form.bankName.trim()
    if (form.bankAccountNo !== original.bankAccountNo) payload.bankAccountNo = form.bankAccountNo.trim()
    if (form.bankAccountHolder !== original.bankAccountHolder) {
      payload.bankAccountHolder = form.bankAccountHolder.trim()
    }
    return payload
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (locked) {
      setError('Địa điểm đang bị khóa nên không lưu được thay đổi.')
      return
    }
    const pointValue = Number(form.pointRedemptionValue)
    if (!Number.isInteger(pointValue) || pointValue < LIMITS.pointRedemptionValue.min || pointValue > LIMITS.pointRedemptionValue.max) {
      setPointValueError('Nhập số tiền nguyên từ 1 đến 100.000 đồng. (MSG02)')
      return
    }
    const validation = validate()
    if (validation) {
      setError(validation)
      setMessage('')
      return
    }
    const payload = buildPayload()
    if (Object.keys(payload).length === 0) {
      setMessage('Chưa có thay đổi nào.')
      setError('')
      return
    }

    setSaving(true)
    try {
      const updated = await updateOwnerLocation(selectedLocationId, payload)
      setLocations((current) =>
        current.map((location) =>
          location.id === selectedLocationId ? { ...location, ...updated } : location,
        ),
      )
      setForm(toForm(updated))
      setOriginal(toForm(updated))
      setError('')
      setMessage('Đã lưu hồ sơ địa điểm.')
    } catch (err) {
      const fieldError = err.response?.data?.errors?.pointRedemptionValue
      if (fieldError) setPointValueError(fieldError)
      else setError(apiErrorMessage(err))
      setMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(original)
    setError('')
    setPointValueError('')
    setMessage('Đã trả về các giá trị đã lưu.')
  }


  return (
    <ManagementLayout
      role="owner"
      title="Hồ sơ địa điểm"
      subtitle={selectedLocation ? `Cụm sân: ${selectedLocation.name} · Cấu hình thông tin địa điểm và tài khoản ngân hàng` : 'Cấu hình thông tin địa điểm và tài khoản ngân hàng'}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      <div>
        {loadError && <p className={styles.alertError} role="alert">{loadError}</p>}
        {locked && (
          <p className={styles.alertWarn}>
            Cụm sân này đã bị khóa (hết hạn kỳ hạn dịch vụ). Vui lòng gia hạn để thực hiện chỉnh sửa.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Thông tin địa điểm</h2>
                <p className={styles.cardHint}>Hiển thị cho người chơi ở trang tìm địa điểm và trang chi tiết địa điểm.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Tên địa điểm *</span>
                <input
                  type="text"
                  maxLength={LIMITS.name}
                  value={form.name}
                  onChange={updateField('name')}
                  required
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Địa chỉ *</span>
                <input
                  type="text"
                  maxLength={LIMITS.address}
                  value={form.address}
                  onChange={updateField('address')}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Số điện thoại liên hệ</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0900000010"
                  value={form.contactPhone}
                  onChange={updateField('contactPhone')}
                />
              </label>

              <div className={`${styles.field} ${styles.fieldWide}`}>
                <span>Vị trí trên bản đồ</span>
                <p className={styles.cardHint}>
                  Bấm vào bản đồ để đặt ghim tại sân, kéo ghim để chỉnh cho đúng. Có thể kéo, phóng to bản đồ để tìm.
                </p>
                <div style={{ maxWidth: 420 }}>
                  <LocationMap
                    initialCenter={DEFAULT_MAP_CENTER}
                    venues={form.latitude === '' || form.longitude === '' ? [] :
                      [{ facility_id: 'current', latitude: form.latitude, longitude: form.longitude }]}
                    onPick={pickLocation}
                    pickDisabled={locked || saving || locating || !selectedLocationId}
                  />
                </div>
                <p className={styles.cardHint} aria-live="polite">
                  {form.latitude === '' || form.longitude === ''
                    ? 'Chưa chọn vị trí.'
                    : `Đã chọn vị trí: ${form.latitude}, ${form.longitude}`}
                </p>
                <div>
                  <button type="button" className={styles.ghostButton} onClick={handleUseCurrentLocation}
                    disabled={locked || saving || locating || !selectedLocationId}>
                    {locating ? 'Đang lấy vị trí…' : 'Đặt ghim tại vị trí hiện tại (GPS)'}
                  </button>
                </div>
                {locationError && <p className={styles.alertError} role="alert">{locationError}</p>}
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Quy định đặt sân và tích điểm</h2>
                <p className={styles.cardHint}>Áp dụng cho mọi sân của địa điểm này.</p>
              </div>
            </div>

            <div className={`${styles.fieldGrid} ${styles.fieldGridNarrow}`}>
              <label className={styles.field}>
                <span>Số ngày đặt trước tối đa</span>
                <input
                  type="number"
                  min={LIMITS.advanceBookingDays.min}
                  max={LIMITS.advanceBookingDays.max}
                  placeholder="30"
                  value={form.advanceBookingDays}
                  onChange={updateField('advanceBookingDays')}
                />
              </label>

              <label className={styles.field}>
                <span>Tỷ lệ tích điểm (số đồng để được 1 điểm)</span>
                <input
                  type="number"
                  min={LIMITS.pointEarningRate.min}
                  max={LIMITS.pointEarningRate.max}
                  step="1000"
                  placeholder="10000"
                  value={form.pointEarningRate}
                  onChange={updateField('pointEarningRate')}
                />
              </label>
              <label className={styles.field}>
                <span>Số đồng giảm khi dùng 1 điểm</span>
                <input type="number" min={LIMITS.pointRedemptionValue.min} max={LIMITS.pointRedemptionValue.max}
                  step={1} required value={form.pointRedemptionValue} onChange={updateField('pointRedemptionValue')}
                  aria-invalid={Boolean(pointValueError)} aria-describedby={pointValueError ? 'point-value-error' : undefined}
                  onInvalid={(event) => {
                    event.preventDefault()
                    setPointValueError(event.target.validity.valueMissing ? 'Vui lòng nhập giá trị dùng điểm. (MSG01)'
                      : 'Nhập số tiền nguyên từ 1 đến 100.000 đồng. (MSG02)')
                  }} />
                {pointValueError && <small id="point-value-error" className="cw-field-error" role="alert">{pointValueError}</small>}
              </label>
            </div>

            <p className={styles.note}>
              Số ngày đặt trước tối đa: 1–365 ngày. Tỷ lệ tích điểm: 1.000–100.000 đồng được 1 điểm.
            </p>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Thông tin nhận chuyển khoản</h2>
                <p className={styles.cardHint}>Người chơi chuyển khoản theo thông tin này; nhân viên đối chiếu để xác nhận thanh toán.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Ngân hàng</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankName}
                  placeholder="Vietcombank"
                  value={form.bankName}
                  onChange={updateField('bankName')}
                />
              </label>

              <label className={styles.field}>
                <span>Số tài khoản</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankAccountNo}
                  value={form.bankAccountNo}
                  onChange={updateField('bankAccountNo')}
                />
              </label>

              <label className={styles.field}>
                <span>Tên chủ tài khoản</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankAccountHolder}
                  value={form.bankAccountHolder}
                  onChange={updateField('bankAccountHolder')}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Ảnh QR chuyển khoản (JPG/PNG, tối đa 5 MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleQrUpload}
                  disabled={uploadingQr || saving || locked || !selectedLocationId}
                />
              </label>
            </div>

            {uploadingQr && <p role="status">Đang tải ảnh QR…</p>}
            {qrSavedLocationId === selectedLocationId && qrSavedLocationId !== null && !qrError &&
              <p className={styles.alertOk} role="status">Ảnh QR đã được lưu.</p>}
            {qrError && <p className={styles.alertError} role="alert">{qrError}</p>}
            {qrPreview && (
              <div className={styles.qrBox}>
                <img
                  src={qrPreview}
                  alt="Mã QR chuyển khoản của địa điểm"
                  className={styles.qrImage}
                  onError={() => {
                    setQrPreview('')
                    setQrError('Ảnh QR đã lưu nhưng không hiển thị được. Hãy chọn lại ảnh JPG hoặc PNG.')
                  }}
                />
                <span className={styles.qrHint}>Ảnh QR đã lưu</span>
              </div>
            )}
          </section>

          {error && <p className={styles.alertError} role="alert">{error}</p>}
          {message && <p className={styles.alertOk}>{message}</p>}

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving || locked || !dirty}>
              {saving ? 'Đang lưu…' : dirty ? 'Lưu thay đổi' : 'Chưa có thay đổi'}
            </button>
            <button className={styles.ghostButton} type="button" onClick={handleReset} disabled={!dirty || saving}>
              Hoàn tác
            </button>
            <span className={styles.dirtyHint}>
              {dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu mọi thay đổi'}
            </span>
          </div>
        </form>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Thông tin do Admin quản lý</h2>
              <p className={styles.cardHint}>Chỉ xem, không sửa ở đây.</p>
            </div>
          </div>

          <dl className={styles.metaGrid}>
            <div>
              <dt>Tình trạng</dt>
              <dd>
                <span className={`${styles.badge} ${locked ? styles.badgeLocked : styles.badgeActive}`}>
                  {STATUS_LABELS[selectedLocation?.status] ?? selectedLocation?.status ?? '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Hết hạn sử dụng dịch vụ</dt>
              <dd>{selectedLocation?.serviceTermEndDate ? formatDateTime(selectedLocation.serviceTermEndDate) : '—'}</dd>
            </div>
            <div>
              <dt>Số sân</dt>
              <dd>{selectedLocation?.courts?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Thời điểm khóa</dt>
              <dd>{formatDateTime(selectedLocation?.lockedAt)}</dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{formatDateTime(selectedLocation?.createdAt)}</dd>
            </div>
            <div>
              <dt>Cập nhật lần cuối</dt>
              <dd>{formatDateTime(selectedLocation?.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </ManagementLayout>
  )
}
