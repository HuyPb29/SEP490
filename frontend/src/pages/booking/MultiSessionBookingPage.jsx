import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styles from './MultiSessionBookingPage.module.css'

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]
const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5']
const TIMES = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']
const CONFLICT_DATES = ['2026-11-12', '2026-11-24']
const INITIAL_CUSTOM_DATES = [
  '2026-11-03',
  '2026-11-05',
  '2026-11-10',
  '2026-11-12',
  '2026-11-17',
  '2026-11-19',
  '2026-11-24',
  '2026-11-26',
]
const SLOT_PRICE = 80000

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatCurrency = (amount) => `${new Intl.NumberFormat('en-US').format(amount)} VND`

export default function MultiSessionBookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const facilityName = location.state?.facilityName || 'Smash Arena'
  const [mode, setMode] = useState('recurring')
  const [court, setCourt] = useState('Court 3')
  const [fromDate, setFromDate] = useState('2026-11-01')
  const [toDate, setToDate] = useState('2026-11-30')
  const [selectedWeekdays, setSelectedWeekdays] = useState([2, 4])
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')
  const [bookFor, setBookFor] = useState('Personal')
  const [customDates, setCustomDates] = useState(INITIAL_CUSTOM_DATES)
  const [removedDates, setRemovedDates] = useState([])
  const [compensatedDates, setCompensatedDates] = useState([])
  const [showCompensation, setShowCompensation] = useState(false)
  const [compensationCourt, setCompensationCourt] = useState('Court 2')
  const [compensationTime, setCompensationTime] = useState('19:00')
  const [notice, setNotice] = useState('')

  const monthStart = useMemo(() => new Date(2026, 10, 1), [])

  const calendarDays = useMemo(() => {
    const leadingDays = (monthStart.getDay() + 6) % 7
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
    const cells = Array.from({ length: leadingDays }, () => null)

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
      const dateKey = toDateKey(date)
      const inRange = (!fromDate || dateKey >= fromDate) && (!toDate || dateKey <= toDate)
      const selectedByRule =
        mode === 'recurring'
          ? selectedWeekdays.includes(date.getDay())
          : customDates.includes(dateKey)
      const isSelected = inRange && selectedByRule && !removedDates.includes(dateKey)
      const isConflicted =
        isSelected && CONFLICT_DATES.includes(dateKey) && !compensatedDates.includes(dateKey)

      cells.push({ dateKey, day, isSelected, isConflicted })
    }

    return cells
  }, [
    monthStart,
    fromDate,
    toDate,
    mode,
    selectedWeekdays,
    customDates,
    removedDates,
    compensatedDates,
  ])

  const selectedSessions = calendarDays.filter((day) => day?.isSelected)
  const conflictedSessions = selectedSessions.filter((day) => day.isConflicted)
  const validSessions = selectedSessions.length - conflictedSessions.length
  const durationMinutes = (() => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    return endHour * 60 + endMinute - (startHour * 60 + startMinute)
  })()
  const slotsPerSession = durationMinutes > 0 ? Math.ceil(durationMinutes / 30) : 0
  const totalPrice = validSessions * slotsPerSession * SLOT_PRICE
  const shortTime = `${Number(startTime.slice(0, 2))}–${Number(endTime.slice(0, 2))}h`

  const toggleWeekday = (weekday) => {
    setSelectedWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday]
    )
    setRemovedDates([])
    setNotice('')
  }

  const toggleCustomDate = (dateKey) => {
    if (mode !== 'custom') return
    setCustomDates((current) =>
      current.includes(dateKey)
        ? current.filter((date) => date !== dateKey)
        : [...current, dateKey]
    )
    setRemovedDates((current) => current.filter((date) => date !== dateKey))
    setNotice('')
  }

  const removeAllConflicts = () => {
    setRemovedDates((current) => [
      ...new Set([...current, ...conflictedSessions.map((day) => day.dateKey)]),
    ])
    setNotice(`Removed ${conflictedSessions.length} conflicting sessions from your schedule.`)
  }

  const applyCompensation = () => {
    setCompensatedDates((current) => [
      ...new Set([...current, ...conflictedSessions.map((day) => day.dateKey)]),
    ])
    setShowCompensation(false)
    setNotice(
      `Replacement slot ${compensationCourt} · ${compensationTime} selected for ${conflictedSessions.length} sessions.`
    )
  }

  const confirmSchedule = () => {
    if (durationMinutes <= 0) {
      setNotice('The end time must be after the start time.')
    } else if (conflictedSessions.length > 0) {
      setNotice('Please resolve all conflicting sessions before confirming your schedule.')
    } else if (validSessions < 2) {
      setNotice('A booking package must include at least 2 valid sessions.')
    } else {
      setNotice('Your schedule preview is ready. This is mock data; no booking has been submitted.')
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          <button type="button" className={styles.brand} onClick={() => navigate('/')}>
            <span className={styles.brandIcon}>⚡</span>
            <span className={styles.brandText}>Courtly</span>
          </button>
          <nav className={styles.navLinks} aria-label="Main navigation">
            <Link to="/" className={styles.activeLink}>Find Courts</Link>
            <a href="#matches">Open Matches</a>
            <Link to="/my-bookings">My Bookings</Link>
          </nav>
          <div className={styles.userProfile}>
            <span className={styles.avatar}>MA</span>
            <span className={styles.userName}>Minh Anh</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContainer}>
        <h1 className={styles.pageTitle}>Multi-Session Booking · {facilityName}</h1>

        <div className={styles.layoutGrid}>
          <aside className={styles.configCard}>
            <div className={styles.modeSwitch} role="tablist" aria-label="Booking mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'recurring'}
                className={`${styles.modeTab} ${mode === 'recurring' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('recurring')
                  setNotice('')
                }}
              >
                Recurring
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'custom'}
                className={`${styles.modeTab} ${mode === 'custom' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('custom')
                  setNotice('')
                }}
              >
                Custom Sessions
              </button>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="court">Court</label>
              <select id="court" className={styles.selectInput} value={court} onChange={(event) => setCourt(event.target.value)}>
                {COURTS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="from-date">From date</label>
                <input id="from-date" type="date" className={styles.dateInput} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="to-date">To date</label>
                <input id="to-date" type="date" className={styles.dateInput} min={fromDate} value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Days of week</span>
              <div className={styles.weekdayRow}>
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={selectedWeekdays.includes(day.value)}
                    disabled={mode === 'custom'}
                    className={`${styles.weekdayBtn} ${selectedWeekdays.includes(day.value) ? styles.weekdayBtnActive : ''}`}
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {mode === 'custom' && (
                <p className={styles.customModeHint}>Click dates on the calendar to select custom sessions.</p>
              )}
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="start-time">Start time</label>
                <select id="start-time" className={styles.selectInput} value={startTime} onChange={(event) => setStartTime(event.target.value)}>
                  {TIMES.slice(0, -1).map((time) => <option key={time}>{time}</option>)}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="end-time">End time</label>
                <select id="end-time" className={styles.selectInput} value={endTime} onChange={(event) => setEndTime(event.target.value)}>
                  {TIMES.slice(1).map((time) => <option key={time}>{time}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="book-for">Book for</label>
              <select id="book-for" className={styles.selectInput} value={bookFor} onChange={(event) => setBookFor(event.target.value)}>
                <option>Personal</option>
                <option>Team</option>
              </select>
            </div>

            <p className={styles.ruleHintText}>
              Recurring: minimum 1 session/week, from 1 to 3 months.
            </p>
          </aside>

          <div className={styles.rightColumn}>
            <div className={styles.promoBanner}>
              <strong>Batch booking offer: packages from 1,000,000 VND get a 100,000 VND voucher</strong>
              <span>Your package qualifies for this reward</span>
            </div>

            <section className={styles.calendarCard} aria-label="November 2026 booking calendar">
              <div className={styles.calendarHeader}>
                <h2 className={styles.monthTitle}>November 2026</h2>
                <div className={styles.legendGroup}>
                  <span className={styles.legendItem}>
                    <i className={styles.dotSelected} />
                    Selected · {selectedSessions.length}
                  </span>
                  <span className={styles.legendItem}>
                    <i className={styles.dotConflicted} />
                    Conflict · {conflictedSessions.length}
                  </span>
                </div>
              </div>

              <div className={styles.weekdayHeaderGrid}>
                {WEEKDAYS.map((day) => <span key={day.value} className={styles.weekdayHeaderCell}>{day.label}</span>)}
              </div>
              <div className={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} className={styles.emptyDayCell} />
                  const className = [
                    styles.dayCell,
                    day.isSelected && !day.isConflicted ? styles.dayCellSelected : '',
                    day.isConflicted ? styles.dayCellConflicted : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <button
                      type="button"
                      key={day.dateKey}
                      disabled={mode !== 'custom' || day.dateKey < fromDate || day.dateKey > toDate}
                      aria-pressed={day.isSelected}
                      aria-label={`${day.day}${day.isConflicted ? ', conflict' : day.isSelected ? ', selected' : ''}`}
                      className={className}
                      onClick={() => toggleCustomDate(day.dateKey)}
                    >
                      <strong className={styles.dayNumber}>{day.day}</strong>
                      {day.isConflicted
                        ? <span className={styles.conflictTag}>Conflict</span>
                        : day.isSelected && <span className={styles.timeSubTag}>{shortTime}</span>}
                    </button>
                  )
                })}
              </div>

              {conflictedSessions.length > 0 && (
                <div className={styles.conflictResolutionBox} role="status">
                  <strong className={styles.conflictBoxTitle}>
                    {conflictedSessions.length} conflicting sessions: {conflictedSessions.map((day) => `${String(day.day).padStart(2, '0')}/11`).join(' and ')} ({startTime} – {endTime} already booked)
                  </strong>
                  <div className={styles.conflictActionRow}>
                    <button type="button" className={styles.compensateBtn} onClick={() => setShowCompensation(true)}>
                      Choose replacement slot
                    </button>
                    <button type="button" className={styles.removeConflictsBtn} onClick={removeAllConflicts}>
                      Remove all conflicts
                    </button>
                  </div>
                </div>
              )}
              {notice && <p className={styles.notice} role="status">{notice}</p>}
            </section>

            <section className={styles.summaryFooterCard}>
              <div className={styles.summaryLeft}>
                <span className={styles.formulaText}>
                  {validSessions} valid sessions × {slotsPerSession} slots × {formatCurrency(SLOT_PRICE)}
                </span>
                <strong className={styles.totalPriceText}>{formatCurrency(totalPrice)}</strong>
                <span className={styles.holdNoteText}>
                  One-time payment. After confirming, your package is held for 15 minutes.
                </span>
              </div>
              <button type="button" className={styles.confirmScheduleBtn} onClick={confirmSchedule}>
                Confirm Schedule
              </button>
            </section>
          </div>
        </div>
      </main>

      {showCompensation && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setShowCompensation(false)}>
          <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setShowCompensation(false)}>×</button>
            <h2 id="modal-title" className={styles.modalTitle}>Choose replacement slot</h2>
            <p className={styles.modalSub}>
              Select an alternative court and time for {conflictedSessions.length} conflicting sessions.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-court">Alternative court</label>
              <select id="replacement-court" className={styles.selectInput} value={compensationCourt} onChange={(event) => setCompensationCourt(event.target.value)}>
                {COURTS.filter((option) => option !== court).map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-time">Start time</label>
              <select id="replacement-time" className={styles.selectInput} value={compensationTime} onChange={(event) => setCompensationTime(event.target.value)}>
                {TIMES.slice(0, -1).map((time) => <option key={time}>{time}</option>)}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.removeConflictsBtn} onClick={() => setShowCompensation(false)}>Cancel</button>
              <button type="button" className={styles.confirmScheduleBtn} onClick={applyCompensation}>Apply replacement slot</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
