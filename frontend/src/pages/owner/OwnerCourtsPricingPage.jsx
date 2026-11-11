import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiErrorMessage,
  createBatchOffer,
  createCourt,
  createPriceRule,
  deleteBatchOffer,
  deletePriceRule,
  getBatchOffers,
  getCourtPriceRules,
  getOwnerLocations,
  getPublishedVouchers,
  getStoredLocationId,
  storeLocationId,
  updateBatchOffer,
  updateCourt,
  updatePriceRule,
} from '../../api/locationApi'
import styles from './OwnerCourtsPricingPage.module.css'

/** Mục sidebar đã có màn hình thật; mục không có trong map vẫn là link chết. */
const NAV_LINKS = {
  Reports: '/owner/reports',
  'Courts & Pricing': '/owner/courts-pricing',
  'Opening Hours': '/owner/opening-hours',
  'Maintenance Approval': '/maintenance',
  'Facility Settings': '/owner/facility-settings',
}

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

const WEEK_DAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 7, short: 'Sun', label: 'Sunday' },
]

const WEEKDAY_VALUES = [1, 2, 3, 4, 5]
const WEEKEND_VALUES = [6, 7]

const DAY_LOOKUP = Object.fromEntries(WEEK_DAYS.map((day) => [day.value, day]))

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

function emptyRuleForm() {
  return {
    courtId: 'all',
    days: [...WEEKEND_VALUES],
    startTime: '17:00',
    endTime: '23:00',
    price: '95000',
    validFrom: todayIso(),
    validTo: '',
  }
}

function emptyOfferForm() {
  return {
    name: '',
    startDate: todayIso(),
    endDate: '',
    minPackageAmount: '1000000',
    voucherId: '',
  }
}

function formatPrice(price) {
  if (price === '' || price === null || price === undefined) return ''
  return Number(price).toLocaleString('en-US')
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, date] = String(value).split('-')
  return `${date}/${month}/${year}`
}

function daySummary(days) {
  if (!days || days.length === 0) return '—'
  if (days.length === 7) return 'Every day'
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 5 && WEEKDAY_VALUES.every((day) => sorted.includes(day))) return 'Mon – Fri'
  if (sorted.length === 2 && WEEKEND_VALUES.every((day) => sorted.includes(day))) return 'Sat, Sun'
  return sorted.map((day) => DAY_LOOKUP[day]?.short ?? day).join(', ')
}

function discountLabel(offer) {
  if (offer.discountValue === null || offer.discountValue === undefined) return '—'
  if (offer.discountType === 'PERCENT') return `${offer.discountValue}%`
  return `${formatPrice(offer.discountValue)} VND`
}

export default function OwnerCourtsPricingPage() {
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(() => getStoredLocationId())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  // UC09 — bảng giá
  const [priceRules, setPriceRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleForm, setRuleForm] = useState(emptyRuleForm)
  const [editingRuleId, setEditingRuleId] = useState(null)

  // UC09 — ưu đãi đặt theo lô
  const [offers, setOffers] = useState([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offerForm, setOfferForm] = useState(emptyOfferForm)
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [vouchers, setVouchers] = useState([])

  const selectedLocation =
    locations.find((location) => String(location.id) === String(selectedLocationId)) || null
  const courts = useMemo(() => selectedLocation?.courts ?? [], [selectedLocation])
  const locked = Boolean(selectedLocation) && selectedLocation.status !== 'ACTIVE'

  // UC07: nạp địa điểm của Owner kèm danh sách sân (GET /api/owner/locations).
  const loadLocations = async () => {
    setLoading(true)
    try {
      const list = await getOwnerLocations()
      setLocations(list)
      setSelectedLocationId((currentId) => {
        const exists = list.some((location) => String(location.id) === String(currentId))
        const nextId = exists ? currentId : list[0]?.id ?? null
        storeLocationId(nextId)
        return nextId
      })
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  // UC09: bảng giá nằm rải trên từng sân nên phải gọi theo sân rồi gộp lại.
  const loadPriceRules = async (locationId, courtList) => {
    if (!locationId || courtList.length === 0) {
      setPriceRules([])
      return
    }
    setRulesLoading(true)
    try {
      const perCourt = await Promise.all(
        courtList.map(async (court) => {
          const rules = await getCourtPriceRules(court.id, locationId)
          return rules.map((rule) => ({ ...rule, courtName: rule.courtName ?? court.name }))
        }),
      )
      const flat = perCourt.flat()
      flat.sort((left, right) => {
        if (left.courtName !== right.courtName) return left.courtName.localeCompare(right.courtName)
        return left.startMinute - right.startMinute
      })
      setPriceRules(flat)
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setRulesLoading(false)
    }
  }

  const loadOffers = async (locationId) => {
    if (!locationId) {
      setOffers([])
      return
    }
    setOffersLoading(true)
    try {
      setOffers(await getBatchOffers(locationId))
    } catch (err) {
      setActionError(apiErrorMessage(err))
    } finally {
      setOffersLoading(false)
    }
  }

  // Chỉ voucher PUBLISHED mới gắn được vào ưu đãi (backend chặn ở BatchOfferService).
  const loadVouchers = async (locationId) => {
    if (!locationId) {
      setVouchers([])
      return
    }
    try {
      setVouchers(await getPublishedVouchers(locationId))
    } catch {
      // Voucher là feature khác; lỗi ở đây không được làm hỏng trang bảng giá.
      setVouchers([])
    }
  }

  useEffect(() => {
    if (!selectedLocationId) {
      setPriceRules([])
      setOffers([])
      setVouchers([])
      return
    }
    loadPriceRules(selectedLocationId, courts)
    loadOffers(selectedLocationId)
    loadVouchers(selectedLocationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, selectedLocation?.id, courts.length])

  const handleFacilityChange = (event) => {
    const nextId = event.target.value
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setActionError('')
    setStatusMessage('')
    resetRuleForm()
    resetOfferForm()
  }

  // ---------------------------------------------------------------- UC07: sân

  const handleAddCourt = async () => {
    if (!selectedLocation) {
      setActionError('Select a facility first.')
      return
    }
    const name = window.prompt('Court name')
    if (name === null) return
    if (!name.trim()) {
      setActionError('Enter a court name.')
      return
    }
    setSaving(true)
    try {
      await createCourt(selectedLocation.id, { name: name.trim() })
      await loadLocations()
      setActionError('')
      setStatusMessage(`Court "${name.trim()}" added.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleEditCourt = async (court) => {
    const name = window.prompt('Court name', court.name)
    if (name === null) return
    const description = window.prompt('Court description', court.description ?? '')
    if (description === null) return
    if (!name.trim()) {
      setActionError('Enter a court name.')
      return
    }
    setSaving(true)
    try {
      await updateCourt(court.id, { name: name.trim(), description: description.trim() }, selectedLocation?.id)
      await loadLocations()
      setActionError('')
      setStatusMessage(`Court "${name.trim()}" updated.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleCourtStatus = async (court) => {
    if (court.active && !window.confirm('This change affects confirmed bookings. Customers will be notified to choose a resolution (free reschedule, refund, or compensation points). Continue?')) return
    setSaving(true)
    try {
      await updateCourt(court.id, { isActive: !court.active }, selectedLocation?.id)
      await loadLocations()
      setActionError('')
      setStatusMessage(`Court "${court.name}" ${court.active ? 'disabled' : 'enabled'}.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------- UC09: bảng giá

  function resetRuleForm() {
    setRuleForm(emptyRuleForm())
    setEditingRuleId(null)
  }

  const updateRuleForm = (field, value) => {
    setRuleForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const toggleRuleDay = (day) => {
    setRuleForm((currentForm) => {
      const exists = currentForm.days.includes(day)
      const nextDays = exists
        ? currentForm.days.filter((item) => item !== day)
        : [...currentForm.days, day].sort((a, b) => a - b)
      return { ...currentForm, days: nextDays }
    })
  }

  const ruleTimeInvalid = ruleForm.startTime >= ruleForm.endTime

  const handleSavePriceRule = async (event) => {
    event.preventDefault()
    if (ruleTimeInvalid) {
      setActionError('The end time must be later than the start time.')
      return
    }
    if (ruleForm.days.length === 0) {
      setActionError('Select at least one applicable day.')
      return
    }
    const price = Number(ruleForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      setActionError('Enter a valid price greater than zero.')
      return
    }
    const payload = {
      days: ruleForm.days,
      startTime: ruleForm.startTime,
      endTime: ruleForm.endTime,
      pricePerSlot: price,
      validFrom: ruleForm.validFrom,
      validTo: ruleForm.validTo || null,
    }
    setSaving(true)
    try {
      if (editingRuleId) {
        await updatePriceRule(editingRuleId, payload, selectedLocationId)
        setStatusMessage('Price rule updated.')
      } else if (ruleForm.courtId === 'all') {
        // Bảng giá lưu theo từng sân, nên "All courts" = tạo lần lượt cho mọi sân.
        for (const court of courts) {
          await createPriceRule(court.id, payload, selectedLocationId)
        }
        setStatusMessage(`Price rule added for ${courts.length} court(s).`)
      } else {
        await createPriceRule(ruleForm.courtId, payload, selectedLocationId)
        setStatusMessage('Price rule added.')
      }
      resetRuleForm()
      await loadPriceRules(selectedLocationId, courts)
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleEditPriceRule = (rule) => {
    setEditingRuleId(rule.id)
    setRuleForm({
      courtId: String(rule.courtId),
      days: rule.days?.length ? [...rule.days] : [...WEEKEND_VALUES],
      startTime: rule.startTime,
      endTime: rule.endTime,
      price: String(rule.pricePerSlot),
      validFrom: rule.validFrom ?? todayIso(),
      validTo: rule.validTo ?? '',
    })
    setActionError('')
    setStatusMessage('')
  }

  const handleDeletePriceRule = async (rule) => {
    if (!window.confirm(`Delete the ${rule.startTime} – ${rule.endTime} rule of "${rule.courtName}"?`)) return
    setSaving(true)
    try {
      await deletePriceRule(rule.id, selectedLocationId)
      if (editingRuleId === rule.id) resetRuleForm()
      await loadPriceRules(selectedLocationId, courts)
      setActionError('')
      setStatusMessage('Price rule deleted.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------ UC09: ưu đãi theo lô

  function resetOfferForm() {
    setOfferForm(emptyOfferForm())
    setEditingOfferId(null)
  }

  const updateOfferForm = (field, value) => {
    setOfferForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handleSaveOffer = async (event) => {
    event.preventDefault()
    const minPackageAmount = Number(offerForm.minPackageAmount)
    if (!offerForm.name.trim()) {
      setActionError('Enter an offer name.')
      return
    }
    if (!offerForm.startDate || !offerForm.endDate) {
      setActionError('Enter both the start and end date.')
      return
    }
    if (offerForm.endDate < offerForm.startDate) {
      setActionError('The end date must be on or after the start date.')
      return
    }
    if (!Number.isFinite(minPackageAmount) || minPackageAmount <= 0) {
      setActionError('Enter a valid minimum package amount.')
      return
    }
    if (!offerForm.voucherId) {
      setActionError('Select a voucher to apply.')
      return
    }
    const payload = {
      name: offerForm.name.trim(),
      startDate: offerForm.startDate,
      endDate: offerForm.endDate,
      minPackageAmount,
      voucherId: Number(offerForm.voucherId),
    }
    setSaving(true)
    try {
      if (editingOfferId) {
        await updateBatchOffer(editingOfferId, payload, selectedLocationId)
        setStatusMessage('Bulk offer updated.')
      } else {
        await createBatchOffer(payload, selectedLocationId)
        setStatusMessage('Bulk offer created.')
      }
      resetOfferForm()
      await loadOffers(selectedLocationId)
      setActionError('')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleEditOffer = (offer) => {
    setEditingOfferId(offer.id)
    setOfferForm({
      name: offer.name ?? '',
      startDate: offer.startDate ?? todayIso(),
      endDate: offer.endDate ?? '',
      minPackageAmount: String(offer.minPackageAmount ?? ''),
      voucherId: String(offer.voucherId ?? ''),
    })
    setActionError('')
    setStatusMessage('')
  }

  const handleDeleteOffer = async (offer) => {
    if (!window.confirm(`Delete the bulk offer "${offer.name}"?`)) return
    setSaving(true)
    try {
      await deleteBatchOffer(offer.id, selectedLocationId)
      if (editingOfferId === offer.id) resetOfferForm()
      await loadOffers(selectedLocationId)
      setActionError('')
      setStatusMessage('Bulk offer deleted.')
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandBolt} aria-hidden="true">⚡</span>
          <span>Courtly</span>
        </div>

        <label className={styles.facilityLabel} htmlFor="owner-pricing-facility">Facility</label>
        <select
          className={styles.facilitySelect}
          id="owner-pricing-facility"
          value={selectedLocationId ?? ''}
          onChange={handleFacilityChange}
          disabled={loading || locations.length === 0}
        >
          {locations.length === 0 && <option value="">{loading ? 'Loading…' : 'No facility'}</option>}
          {locations.map((location) => (
            <option key={location.id} value={location.id}>{location.name}</option>
          ))}
        </select>

        <nav className={styles.navigation} aria-label="Owner navigation">
          {NAV_ITEMS.map((item) =>
            NAV_LINKS[item] ? (
              <Link
                className={`${styles.navItem} ${item === 'Courts & Pricing' ? styles.navItemActive : ''}`}
                to={NAV_LINKS[item]}
                key={item}
                aria-current={item === 'Courts & Pricing' ? 'page' : undefined}
              >
                {item}
              </Link>
            ) : (
              <a className={styles.navItem} href="#" key={item} onClick={(event) => event.preventDefault()}>
                {item}
              </a>
            ),
          )}
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Courts &amp; Pricing</h1>
        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
        {statusMessage && <p className={styles.statusMessage} role="status">{statusMessage}</p>}
        {selectedLocation && selectedLocation.status !== 'ACTIVE' && (
          <p className={styles.warningText} role="alert">
            This facility is locked. You can view its data but cannot make changes.
          </p>
        )}
        {selectedLocation && selectedLocation.status === 'ACTIVE' && !selectedLocation.serviceActive && (
          <p className={styles.warningText} role="alert">
            Service term ended{selectedLocation.serviceTermEndDate ? ` on ${selectedLocation.serviceTermEndDate}` : ''}.
            Contact the administrator to renew before changing this facility.
          </p>
        )}

        <section className={`${styles.panel} ${styles.courtPanel}`} aria-labelledby="court-list-heading">
          <div className={styles.panelHeader}>
            <h2 id="court-list-heading">Court List ({courts.length})</h2>
            <button className={styles.primaryButton} type="button" onClick={handleAddCourt} disabled={saving || !selectedLocation || locked}>
              + Add Court
            </button>
          </div>
          {loading && <p className={styles.emptyState}>Loading courts…</p>}
          {!loading && !selectedLocation && (
            <p className={styles.emptyState}>No facility is assigned to this account.</p>
          )}
          {!loading && selectedLocation && courts.length === 0 && (
            <p className={styles.emptyState}>This facility has no court yet. Use “+ Add Court” to create the first one.</p>
          )}
          <div className={styles.courtGrid}>
            {courts.map((court) => (
              <article className={styles.courtCard} key={court.id}>
                <div className={styles.courtCardHeader}>
                  <h3>{court.name}</h3>
                  <span className={`${styles.statusBadge} ${court.active ? styles.statusActive : styles.statusDisabled}`}>
                    {court.active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className={styles.courtDescription}>{court.description || 'No description'}</p>
                <div className={styles.courtActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEditCourt(court)} disabled={saving || locked}>
                    Edit
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleCourtStatus(court)} disabled={saving || locked}>
                    {court.active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.pricingGrid}>
          <section className={`${styles.panel} ${styles.rulesPanel}`} aria-labelledby="price-rules-heading">
            <h2 id="price-rules-heading">Price Rules ({priceRules.length})</h2>
            <div className={styles.tableScroller}>
              <table className={styles.rulesTable}>
                <thead>
                  <tr>
                    <th scope="col">Court</th>
                    <th scope="col">Days</th>
                    <th scope="col">Time Range</th>
                    <th scope="col">Price / slot</th>
                    <th scope="col">Effective</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.courtName}</td>
                      <td>{daySummary(rule.days)}</td>
                      <td>{rule.startTime} – {rule.endTime}</td>
                      <td><strong>{formatPrice(rule.pricePerSlot)} VND</strong></td>
                      <td>
                        {formatDate(rule.validFrom)} – {rule.validTo ? formatDate(rule.validTo) : 'open'}
                        {rule.active === false && <span className={styles.expiredTag}>expired</span>}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button className={styles.linkButton} type="button" onClick={() => handleEditPriceRule(rule)} disabled={saving || locked}>
                            Edit
                          </button>
                          <button className={styles.linkButton} type="button" onClick={() => handleDeletePriceRule(rule)} disabled={saving || locked}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rulesLoading && <p className={styles.emptyState}>Loading price rules…</p>}
            {!rulesLoading && selectedLocation && priceRules.length === 0 && (
              <p className={styles.emptyState}>No price rule yet. Add the first one on the right.</p>
            )}
          </section>

          <section className={`${styles.panel} ${styles.formPanel}`} aria-labelledby="add-rule-heading">
            <h2 id="add-rule-heading">{editingRuleId ? 'Edit Price Rule' : 'Add Price Rule'}</h2>
            <form onSubmit={handleSavePriceRule}>
              <label className={styles.field}>
                <span>Court</span>
                <select
                  value={ruleForm.courtId}
                  onChange={(event) => updateRuleForm('courtId', event.target.value)}
                  disabled={Boolean(editingRuleId)}
                >
                  {!editingRuleId && <option value="all">All courts</option>}
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </label>

              <div className={styles.field}>
                <span>Applicable Days</span>
                <div className={styles.dayPicker}>
                  {WEEK_DAYS.map((day) => (
                    <button
                      className={`${styles.dayChip} ${ruleForm.days.includes(day.value) ? styles.dayChipActive : ''}`}
                      type="button"
                      key={day.value}
                      aria-pressed={ruleForm.days.includes(day.value)}
                      title={day.label}
                      onClick={() => toggleRuleDay(day.value)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.timeFields}>
                <label className={styles.field}>
                  <span>From</span>
                  <input
                    className={ruleTimeInvalid ? styles.invalidInput : ''}
                    type="time"
                    value={ruleForm.startTime}
                    aria-invalid={ruleTimeInvalid}
                    onChange={(event) => updateRuleForm('startTime', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>To</span>
                  <input
                    className={ruleTimeInvalid ? styles.invalidInput : ''}
                    type="time"
                    value={ruleForm.endTime}
                    aria-invalid={ruleTimeInvalid}
                    onChange={(event) => updateRuleForm('endTime', event.target.value)}
                  />
                </label>
              </div>
              {ruleTimeInvalid && <p className={styles.overlapMessage} role="alert">The end time must be later than the start time.</p>}

              <label className={styles.field}>
                <span>Price per slot (VND)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatPrice(ruleForm.price)}
                  onChange={(event) => updateRuleForm('price', event.target.value.replace(/\D/g, ''))}
                />
              </label>

              <div className={styles.timeFields}>
                <label className={styles.field}>
                  <span>Valid from</span>
                  <input
                    type="date"
                    value={ruleForm.validFrom}
                    onChange={(event) => updateRuleForm('validFrom', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Valid to</span>
                  <input
                    type="date"
                    value={ruleForm.validTo}
                    onChange={(event) => updateRuleForm('validTo', event.target.value)}
                  />
                </label>
              </div>

              <button className={styles.saveButton} type="submit" disabled={saving || locked || ruleTimeInvalid || !selectedLocation}>
                {editingRuleId ? 'Update Price Rule' : 'Save Price Rule'}
              </button>
              {editingRuleId && (
                <button className={styles.cancelButton} type="button" onClick={resetRuleForm} disabled={saving}>
                  Cancel edit
                </button>
              )}
            </form>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.offerSection}`} aria-labelledby="bulk-offer-heading">
          <div className={styles.panelHeader}>
            <h2 id="bulk-offer-heading">Bulk Booking Offers ({offers.length})</h2>
          </div>
          <p className={styles.offerHint}>
            A package reaching the minimum amount gets the attached voucher. The voucher must be PUBLISHED and its
            validity must cover the offer dates.
          </p>

          <div className={styles.offerList}>
            {offers.map((offer) => (
              <article className={styles.offerCard} key={offer.id}>
                <div className={styles.offerCardBody}>
                  <h3>{offer.name}</h3>
                  <p className={styles.offerMeta}>
                    {formatDate(offer.startDate)} – {formatDate(offer.endDate)} · from{' '}
                    {formatPrice(offer.minPackageAmount)} VND · voucher {offer.voucherCode ?? '—'} (
                    {discountLabel(offer)})
                  </p>
                </div>
                <div className={styles.offerCardActions}>
                  <span className={`${styles.statusBadge} ${offer.active ? styles.statusActive : styles.statusDisabled}`}>
                    {offer.active ? 'Running' : 'Scheduled / ended'}
                  </span>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEditOffer(offer)} disabled={saving || locked}>
                    Edit
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleDeleteOffer(offer)} disabled={saving || locked}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {offersLoading && <p className={styles.emptyState}>Loading offers…</p>}
          {!offersLoading && offers.length === 0 && (
            <p className={styles.emptyState}>No bulk offer yet for this facility.</p>
          )}

          <form className={styles.offerForm} onSubmit={handleSaveOffer}>
            <label className={styles.field}>
              <span>Offer name</span>
              <input
                type="text"
                maxLength={100}
                value={offerForm.name}
                onChange={(event) => updateOfferForm('name', event.target.value)}
                placeholder="Weekend bulk booking"
              />
            </label>
            <div className={styles.timeFields}>
              <label className={styles.field}>
                <span>Start date</span>
                <input
                  type="date"
                  value={offerForm.startDate}
                  onChange={(event) => updateOfferForm('startDate', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>End date</span>
                <input
                  type="date"
                  value={offerForm.endDate}
                  onChange={(event) => updateOfferForm('endDate', event.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Minimum package amount (VND)</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatPrice(offerForm.minPackageAmount)}
                onChange={(event) => updateOfferForm('minPackageAmount', event.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className={styles.field}>
              <span>Voucher (PUBLISHED only)</span>
              <select value={offerForm.voucherId} onChange={(event) => updateOfferForm('voucherId', event.target.value)}>
                <option value="">{vouchers.length === 0 ? 'No published voucher in this facility' : 'Select a voucher'}</option>
                {vouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.code} · {voucher.name} ({voucher.discountType === 'PERCENT'
                      ? `${voucher.discountValue}%`
                      : `${formatPrice(voucher.discountValue)} VND`})
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.saveButton} type="submit" disabled={saving || locked || !selectedLocation}>
              {editingOfferId ? 'Update Offer' : 'Create Offer'}
            </button>
            {editingOfferId && (
              <button className={styles.cancelButton} type="button" onClick={resetOfferForm} disabled={saving}>
                Cancel edit
              </button>
            )}
          </form>
        </section>
        <span className={styles.facilityContext} aria-live="polite">{selectedLocation?.name}</span>
      </main>
    </div>
  )
}
