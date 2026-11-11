import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiErrorMessage,
  getOwnerLocations,
  storeLocationId,
  updateOwnerLocation,
} from '../../api/locationApi'
// Dùng lại đúng khung sidebar của trang Courts & Pricing để các màn owner không lệch nhau.
import shell from './OwnerCourtsPricingPage.module.css'
import styles from './OwnerFacilitySettingsPage.module.css'

const NAV_ITEMS = [
  'Reports',
  'Courts & Pricing',
  'Opening Hours',
  'Staff',
  'Vouchers & Offers',
  'Complaints',
  'Refunds',
  'Maintenance Approval',
  'Reviews',
  'Facility Settings',
]

const NAV_LINKS = {
  Reports: '/owner/reports',
  'Courts & Pricing': '/owner/courts-pricing',
  'Opening Hours': '/owner/opening-hours',
  'Maintenance Approval': '/maintenance',
  'Facility Settings': '/owner/facility-settings',
}

/** Khớp ràng buộc trong UpdateLocationRequest để báo lỗi ngay, khỏi gọi API. */
const PHONE_PATTERN = /^0\d{9}$/
const LIMITS = {
  name: 100,
  address: 255,
  bankName: 100,
  bankAccountNo: 30,
  bankAccountHolder: 100,
  qrImagePath: 255,
  advanceBookingDays: { min: 1, max: 365 },
  pointEarningRate: { min: 1000, max: 100000 },
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
}

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
    qrImagePath: location?.qrImagePath ?? '',
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState(() => toForm(null))
  const [original, setOriginal] = useState(() => toForm(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )
  const locked = selectedLocation?.status === 'LOCKED'
  const dirty = useMemo(
    () => Object.keys(form).some((key) => form[key] !== original[key]),
    [form, original],
  )

  const loadLocations = useCallback(async (preferredId) => {
    const rows = await getOwnerLocations()
    setLocations(rows)
    const stored = Number(localStorage.getItem('bms_selected_location_id'))
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

  const handleFacilityChange = (event) => {
    const nextId = Number(event.target.value)
    if (!Number.isFinite(nextId)) return
    const next = locations.find((location) => location.id === nextId) ?? null
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setForm(toForm(next))
    setOriginal(toForm(next))
    setError('')
    setMessage('')
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  const validate = () => {
    if (!form.name.trim()) return 'Facility name is required.'
    if (form.name.trim().length > LIMITS.name) return `Facility name is limited to ${LIMITS.name} characters.`
    if (!form.address.trim()) return 'Address is required.'
    if (form.address.trim().length > LIMITS.address) return `Address is limited to ${LIMITS.address} characters.`
    if (form.contactPhone.trim() && !PHONE_PATTERN.test(form.contactPhone.trim())) {
      return 'Contact phone must be 10 digits and start with 0.'
    }

    const numericChecks = [
      ['latitude', 'Latitude', LIMITS.latitude],
      ['longitude', 'Longitude', LIMITS.longitude],
      ['advanceBookingDays', 'Advance booking days', LIMITS.advanceBookingDays],
      ['pointEarningRate', 'Point earning rate', LIMITS.pointEarningRate],
    ]
    for (const [field, label, range] of numericChecks) {
      const raw = form[field].trim()
      if (!raw) continue
      const value = Number(raw)
      if (!Number.isFinite(value)) return `${label} must be a number.`
      if (value < range.min || value > range.max) {
        return `${label} must be between ${range.min} and ${range.max}.`
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
    // Nhóm ngân hàng gửi chuỗi rỗng để xoá được giá trị cũ.
    if (form.bankName !== original.bankName) payload.bankName = form.bankName.trim()
    if (form.bankAccountNo !== original.bankAccountNo) payload.bankAccountNo = form.bankAccountNo.trim()
    if (form.bankAccountHolder !== original.bankAccountHolder) {
      payload.bankAccountHolder = form.bankAccountHolder.trim()
    }
    if (form.qrImagePath !== original.qrImagePath) payload.qrImagePath = form.qrImagePath.trim()
    return payload
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (locked) {
      setError('This facility is locked, so the backend rejects every update.')
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
      setMessage('Nothing changed.')
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
      setMessage('Facility profile saved.')
    } catch (err) {
      setError(apiErrorMessage(err))
      setMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(original)
    setError('')
    setMessage('Reverted to the saved values.')
  }

  const qrPreview = form.qrImagePath.trim()

  return (
    <div className={shell.page}>
      <aside className={shell.sidebar}>
        <div className={shell.brand}>
          <span className={shell.brandBolt} aria-hidden="true">⚡</span>
          <span>Courtly</span>
        </div>

        <label className={shell.facilityLabel} htmlFor="owner-settings-facility">Facility</label>
        <select
          className={shell.facilitySelect}
          id="owner-settings-facility"
          value={selectedLocationId ?? ''}
          onChange={handleFacilityChange}
          disabled={loading || locations.length === 0}
        >
          {locations.length === 0 && <option value="">{loading ? 'Loading…' : 'No facility'}</option>}
          {locations.map((location) => (
            <option key={location.id} value={location.id}>{location.name}</option>
          ))}
        </select>

        <nav className={shell.navigation} aria-label="Owner navigation">
          {NAV_ITEMS.map((item) =>
            NAV_LINKS[item] ? (
              <Link
                className={`${shell.navItem} ${item === 'Facility Settings' ? shell.navItemActive : ''}`}
                to={NAV_LINKS[item]}
                key={item}
                aria-current={item === 'Facility Settings' ? 'page' : undefined}
              >
                {item}
              </Link>
            ) : (
              <a className={shell.navItem} href="#" key={item} onClick={(event) => event.preventDefault()}>
                {item}
              </a>
            ),
          )}
        </nav>
      </aside>

      <main className={shell.main}>
        <h1 className={shell.pageTitle}>Facility Settings</h1>
        <p className={styles.subtitle}>
          Profile, booking rules and payment details of the selected facility.
          Empty optional fields are sent as blank so the stored value is cleared.
        </p>

        {loadError && <p className={styles.alertError} role="alert">{loadError}</p>}
        {locked && (
          <p className={styles.alertWarn}>
            This facility is locked (expired service term) — every update is rejected until the
            service term is renewed.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Profile</h2>
                <p className={styles.cardHint}>Shown to players on the facility search and detail pages.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Facility name *</span>
                <input
                  type="text"
                  maxLength={LIMITS.name}
                  value={form.name}
                  onChange={updateField('name')}
                  required
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Address *</span>
                <input
                  type="text"
                  maxLength={LIMITS.address}
                  value={form.address}
                  onChange={updateField('address')}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Contact phone</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0900000010"
                  value={form.contactPhone}
                  onChange={updateField('contactPhone')}
                />
              </label>

              <label className={styles.field}>
                <span>Latitude</span>
                <input
                  type="number"
                  step="0.000001"
                  min={LIMITS.latitude.min}
                  max={LIMITS.latitude.max}
                  placeholder="10.801"
                  value={form.latitude}
                  onChange={updateField('latitude')}
                />
              </label>

              <label className={styles.field}>
                <span>Longitude</span>
                <input
                  type="number"
                  step="0.000001"
                  min={LIMITS.longitude.min}
                  max={LIMITS.longitude.max}
                  placeholder="106.652"
                  value={form.longitude}
                  onChange={updateField('longitude')}
                />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Booking rules</h2>
                <p className={styles.cardHint}>Applied to every court of this facility.</p>
              </div>
            </div>

            <div className={`${styles.fieldGrid} ${styles.fieldGridNarrow}`}>
              <label className={styles.field}>
                <span>Advance booking days</span>
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
                <span>Point earning rate</span>
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
            </div>

            <p className={styles.note}>
              Advance booking days: 1–365. Point earning rate: 1,000–100,000 VND per point.
            </p>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Payment &amp; QR</h2>
                <p className={styles.cardHint}>Used by players to transfer the deposit and by staff to confirm it.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Bank name</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankName}
                  placeholder="Vietcombank"
                  value={form.bankName}
                  onChange={updateField('bankName')}
                />
              </label>

              <label className={styles.field}>
                <span>Account number</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankAccountNo}
                  value={form.bankAccountNo}
                  onChange={updateField('bankAccountNo')}
                />
              </label>

              <label className={styles.field}>
                <span>Account holder</span>
                <input
                  type="text"
                  maxLength={LIMITS.bankAccountHolder}
                  value={form.bankAccountHolder}
                  onChange={updateField('bankAccountHolder')}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>QR image path</span>
                <input
                  type="text"
                  maxLength={LIMITS.qrImagePath}
                  placeholder="/uploads/qr/location-1.png"
                  value={form.qrImagePath}
                  onChange={updateField('qrImagePath')}
                />
              </label>
            </div>

            {qrPreview && (
              <div className={styles.qrBox}>
                <img
                  src={qrPreview}
                  alt="Facility payment QR"
                  className={styles.qrImage}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
                <span className={styles.qrHint}>Preview — hidden if the path does not resolve.</span>
              </div>
            )}
          </section>

          {error && <p className={styles.alertError} role="alert">{error}</p>}
          {message && <p className={styles.alertOk}>{message}</p>}

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving || locked || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
            </button>
            <button className={styles.ghostButton} type="button" onClick={handleReset} disabled={!dirty || saving}>
              Reset
            </button>
            <span className={styles.dirtyHint}>
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
          </div>
        </form>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Read-only information</h2>
              <p className={styles.cardHint}>Managed by the admin, not editable here.</p>
            </div>
          </div>

          <dl className={styles.metaGrid}>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`${styles.badge} ${locked ? styles.badgeLocked : styles.badgeActive}`}>
                  {selectedLocation?.status ?? '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Service term ends</dt>
              <dd>{selectedLocation?.serviceTermEndDate ? formatDateTime(selectedLocation.serviceTermEndDate) : '—'}</dd>
            </div>
            <div>
              <dt>Courts</dt>
              <dd>{selectedLocation?.courts?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Locked at</dt>
              <dd>{formatDateTime(selectedLocation?.lockedAt)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(selectedLocation?.createdAt)}</dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>{formatDateTime(selectedLocation?.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  )
}
