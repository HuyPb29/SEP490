import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './OwnerCourtsPricingPage.module.css'

const FACILITIES = [
  { id: 'smash-arena', name: 'Smash Arena' },
  { id: 'green-shuttle-club', name: 'Green Shuttle Club' },
]

const INITIAL_COURTS = [
  { id: 'court-1', name: 'Court 1', status: 'Active', description: 'Yonex mat · air-conditioned' },
  { id: 'court-2', name: 'Court 2', status: 'Active', description: 'Yonex mat · air-conditioned' },
  { id: 'court-6', name: 'Court 6', status: 'Maintenance', description: 'Mat replacement until 26/10' },
  { id: 'court-9', name: 'Court 9', status: 'Disabled', description: 'New court, not yet open' },
  { id: 'court-3', name: 'Court 3', status: 'Active', description: 'Competition-grade flooring' },
  { id: 'court-4', name: 'Court 4', status: 'Active', description: 'Competition-grade flooring' },
  { id: 'court-5', name: 'Court 5', status: 'Active', description: 'Competition-grade flooring' },
  { id: 'court-7', name: 'Court 7', status: 'Active', description: 'Competition-grade flooring' },
]

const INITIAL_PRICE_RULES = [
  { courtId: 'all', days: 'weekdays', startTime: '05:00', endTime: '16:00', price: 60000, effectiveDate: '01/09/' },
  { courtId: 'all', days: 'weekdays', startTime: '16:00', endTime: '23:00', price: 80000, effectiveDate: '01/09/' },
  { courtId: 'all', days: 'weekend', startTime: '05:00', endTime: '16:00', price: 70000, effectiveDate: '01/09/' },
  { courtId: 'all', days: 'weekend', startTime: '16:00', endTime: '23:00', price: 90000, effectiveDate: '01/09/' },
]

const INITIAL_FORM = {
  courtId: 'all',
  days: 'weekend',
  startTime: '17:00',
  endTime: '23:00',
  price: '95000',
  effectiveDate: '01/09/',
}

const DAY_LABELS = {
  weekdays: 'Mon – Fri',
  weekend: 'Sat, Sun',
}

const OVERLAP_MESSAGE = 'This time range overlaps with price rule "16:00 – 23:00, Sat, Sun". Adjust the time or effective date to avoid overlap.'

function formatPrice(price) {
  if (price === '' || price === null || price === undefined) return ''
  return Number(price).toLocaleString('en-US')
}

function isTimeOverlap(newStart, newEnd, existingStart, existingEnd) {
  return newStart < existingEnd && newEnd > existingStart
}

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function OwnerCourtsPricingPage() {
  const [selectedFacilityId, setSelectedFacilityId] = useState('smash-arena')
  const [courts, setCourts] = useState(INITIAL_COURTS)
  const [priceRules, setPriceRules] = useState(INITIAL_PRICE_RULES)
  const [form, setForm] = useState(INITIAL_FORM)
  const [actionError, setActionError] = useState('')
  const selectedFacility = FACILITIES.find((facility) => facility.id === selectedFacilityId)
  const overlap = priceRules.some((rule) => {
    const sameDays = rule.days === form.days
    const sameCourt = rule.courtId === 'all' || form.courtId === 'all' || rule.courtId === form.courtId
    const sameEffectiveDate = rule.effectiveDate === form.effectiveDate
    return sameDays && sameCourt && sameEffectiveDate && isTimeOverlap(
      form.startTime,
      form.endTime,
      rule.startTime,
      rule.endTime,
    )
  })
  const invalidTimeRange = form.startTime >= form.endTime

  const updateForm = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handleFacilityChange = (event) => {
    try {
      setSelectedFacilityId(event.target.value)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleCourtStatus = (courtId) => {
    try {
      const court = courts.find((item) => item.id === courtId)
      if (!court) throw new Error('The selected court could not be found.')
      if (court.status === 'Active' && !window.confirm('This change affects 3 confirmed bookings. Customers will be notified to choose a resolution (free reschedule, refund, or compensation points). Continue?')) return
      setCourts((currentCourts) => currentCourts.map((item) => (
        item.id === courtId
          ? { ...item, status: item.status === 'Disabled' ? 'Active' : 'Disabled' }
          : item
      )))
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleEditCourt = (courtId) => {
    try {
      const court = courts.find((item) => item.id === courtId)
      if (!court) throw new Error('The selected court could not be found.')
      const description = window.prompt('Edit court description', court.description)
      if (description === null) return
      setCourts((currentCourts) => currentCourts.map((item) => (
        item.id === courtId ? { ...item, description: description.trim() || item.description } : item
      )))
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleAddCourt = () => {
    try {
      const name = window.prompt('Court name')
      if (name === null) return
      if (!name.trim()) throw new Error('Enter a court name.')
      setCourts((currentCourts) => [...currentCourts, {
        id: `court-${Date.now()}`,
        name: name.trim(),
        status: 'Active',
        description: 'New court, not yet open',
      }])
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleSavePriceRule = (event) => {
    event.preventDefault()
    try {
      if (overlap) throw new Error(OVERLAP_MESSAGE)
      if (invalidTimeRange) throw new Error('The end time must be later than the start time.')
      const price = Number(form.price)
      if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid price greater than zero.')
      setPriceRules((currentRules) => [...currentRules, { ...form, price }])
      setForm(INITIAL_FORM)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleEditProgram = () => {
    try {
      window.alert('Bulk booking offer settings are available in this mock preview.')
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
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
          value={selectedFacilityId}
          onChange={handleFacilityChange}
        >
          {FACILITIES.map((facility) => (
            <option key={facility.id} value={facility.id}>{facility.name}</option>
          ))}
        </select>

        <nav className={styles.navigation} aria-label="Owner navigation">
          {[
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
          ].map((item) => (
            item === 'Reports' || item === 'Courts & Pricing' ? (
              <Link
                className={`${styles.navItem} ${item === 'Courts & Pricing' ? styles.navItemActive : ''}`}
                to={item === 'Reports' ? '/owner/reports' : '/owner/courts-pricing'}
                key={item}
                aria-current={item === 'Courts & Pricing' ? 'page' : undefined}
              >
                {item}
              </Link>
            ) : (
              <a className={styles.navItem} href="#" key={item} onClick={(event) => event.preventDefault()}>
                {item}
              </a>
            )
          ))}
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Courts &amp; Pricing</h1>
        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}

        <section className={`${styles.panel} ${styles.courtPanel}`} aria-labelledby="court-list-heading">
          <div className={styles.panelHeader}>
            <h2 id="court-list-heading">Court List ({courts.length})</h2>
            <button className={styles.primaryButton} type="button" onClick={handleAddCourt}>+ Add Court</button>
          </div>
          <div className={styles.courtGrid}>
            {courts.slice(0, 4).map((court) => (
              <article className={styles.courtCard} key={court.id}>
                <div className={styles.courtCardHeader}>
                  <h3>{court.name}</h3>
                  <span className={`${styles.statusBadge} ${styles[`status${court.status}`]}`}>{court.status}</span>
                </div>
                <p className={styles.courtDescription}>{court.description}</p>
                <div className={styles.courtActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEditCourt(court.id)}>Edit</button>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleCourtStatus(court.id)}>
                    {court.status === 'Disabled' ? 'Enable' : 'Disable'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.pricingGrid}>
          <section className={`${styles.panel} ${styles.rulesPanel}`} aria-labelledby="price-rules-heading">
            <h2 id="price-rules-heading">Price Rules</h2>
            <div className={styles.tableScroller}>
              <table className={styles.rulesTable}>
                <thead>
                  <tr>
                    <th scope="col">Court</th>
                    <th scope="col">Days</th>
                    <th scope="col">Time Range</th>
                    <th scope="col">Price / slot</th>
                    <th scope="col">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRules.map((rule, index) => {
                    const courtName = rule.courtId === 'all'
                      ? 'All'
                      : courts.find((court) => court.id === rule.courtId)?.name ?? 'Court'
                    return (
                      <tr key={`${rule.courtId}-${rule.days}-${rule.startTime}-${index}`}>
                        <td>{courtName}</td>
                        <td>{DAY_LABELS[rule.days]}</td>
                        <td>{rule.startTime} – {rule.endTime}</td>
                        <td><strong>{formatPrice(rule.price)} VND</strong></td>
                        <td>From {rule.effectiveDate}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.formPanel}`} aria-labelledby="add-rule-heading">
            <h2 id="add-rule-heading">Add Price Rule</h2>
            <form onSubmit={handleSavePriceRule}>
              <label className={styles.field}>
                <span>Court</span>
                <select value={form.courtId} onChange={(event) => updateForm('courtId', event.target.value)}>
                  <option value="all">All courts</option>
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Applicable Days</span>
                <select value={form.days} onChange={(event) => updateForm('days', event.target.value)}>
                  <option value="weekend">Saturday, Sunday</option>
                  <option value="weekdays">Monday – Friday</option>
                </select>
              </label>
              <div className={styles.timeFields}>
                <label className={styles.field}>
                  <span>From</span>
                  <input
                    className={overlap ? styles.invalidInput : ''}
                    type="time"
                    value={form.startTime}
                    aria-invalid={overlap}
                    onChange={(event) => updateForm('startTime', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>To</span>
                  <input
                    className={overlap ? styles.invalidInput : ''}
                    type="time"
                    value={form.endTime}
                    aria-invalid={overlap}
                    onChange={(event) => updateForm('endTime', event.target.value)}
                  />
                </label>
              </div>
              {overlap && <p className={styles.overlapMessage} role="alert">{OVERLAP_MESSAGE}</p>}
              {invalidTimeRange && !overlap && <p className={styles.overlapMessage} role="alert">The end time must be later than the start time.</p>}
              <label className={styles.field}>
                <span>Price per 30-min slot</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatPrice(form.price)}
                  onChange={(event) => updateForm('price', event.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button className={styles.saveButton} type="submit" disabled={overlap || invalidTimeRange}>Save Price Rule</button>
            </form>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.offerPanel}`} aria-label="Bulk booking offer">
          <div className={styles.offerCopy}>
            <p className={styles.offerEyebrow}>BULK BOOKING OFFER</p>
            <h2>Packages from 1,000,000 VND get a 100,000 VND voucher</h2>
            <p className={styles.offerMeta}>01/10/2026 – 31/12/2026 · 37 packages received voucher</p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={handleEditProgram}>Edit Program</button>
        </section>
        <span className={styles.facilityContext} aria-live="polite">{selectedFacility?.name}</span>
      </main>
    </div>
  )
}