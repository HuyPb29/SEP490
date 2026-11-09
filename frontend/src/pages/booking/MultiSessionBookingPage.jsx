import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  createBookingPackageApi,
  getLocationCourtsApi,
  getMyOwnedTeams,
  previewBookingPackageApi,
  toMinutes,
  toTimeLabel,
} from '../../api/bookingApi'
import { apiErrorMessage } from '../../api'
import styles from './MultiSessionBookingPage.module.css'

// value theo Date.getDay() (CN = 0); backend dùng 1 = Thứ 2 … 7 = Chủ nhật
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Mốc 30 phút từ 05:00 đến 24:00; giờ mở cửa thật do backend kiểm (buổi ngoài giờ bị đánh dấu trùng)
const TIMES = Array.from({ length: 39 }, (_, index) => toTimeLabel(300 + index * 30))
const CONFLICT_LABELS = {
  TAKEN: 'already booked',
  MAINTENANCE: 'maintenance',
  CLOSED: 'outside opening hours',
  STARTED: 'already started',
}

const toDateKey = (date) => date.toLocaleDateString('en-CA')
const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const addMonths = (dateKey, months, minusDays = 0) => {
  const date = parseDateKey(dateKey)
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + months, date.getDate() - minusDays))
}
const formatCurrency = (amount) => `${new Intl.NumberFormat('en-US').format(Number(amount || 0))} VND`
const sessionKey = (session) => `${session.date}|${session.courtId}|${session.startMinute}`

export default function MultiSessionBookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const facilityId = Number(id || location.state?.facilityId) || null
  const facilityName = location.state?.facilityName || ''

  const today = useMemo(() => toDateKey(new Date()), [])
  const [courts, setCourts] = useState([])
  const [teams, setTeams] = useState([])
  const [mode, setMode] = useState('recurring')
  const [courtId, setCourtId] = useState(null)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(() => addMonths(today, 1, 1))
  const [selectedWeekdays, setSelectedWeekdays] = useState([2, 4])
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')
  const [teamId, setTeamId] = useState('')
  const [customDates, setCustomDates] = useState([])
  // Xử lý buổi trùng (BR50): buổi bỏ và buổi đổi sang slot bù, theo khóa của buổi gốc
  const [removedKeys, setRemovedKeys] = useState([])
  const [replacements, setReplacements] = useState({})
  const [showCompensation, setShowCompensation] = useState(false)
  const [compensationCourtId, setCompensationCourtId] = useState(null)
  const [compensationTime, setCompensationTime] = useState('19:00')
  const [viewMonth, setViewMonth] = useState(() => parseDateKey(today))
  const [basePreview, setBasePreview] = useState(null)
  const [adjustedPreview, setAdjustedPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!facilityId) return
    Promise.all([getLocationCourtsApi(facilityId), getMyOwnedTeams()])
      .then(([courtList, teamRes]) => {
        setCourts(courtList)
        setCourtId((current) => current ?? courtList[0]?.court_id ?? null)
        setTeams(teamRes.data)
      })
      .catch((err) => setPreviewError(apiErrorMessage(err, 'Could not load courts.')))
  }, [facilityId])

  const startMinute = toMinutes(startTime)
  const endMinute = toMinutes(endTime)

  // UC15 #2, #3: PackageRequest theo mẫu Player nhập (chưa xử lý buổi trùng)
  const baseRequest = useMemo(() => {
    if (!courtId || endMinute <= startMinute) return null
    const common = {
      courtId,
      startDate: fromDate,
      endDate: toDate,
      teamId: teamId ? Number(teamId) : null,
    }
    if (mode === 'recurring') {
      if (selectedWeekdays.length === 0) return null
      return {
        ...common,
        packageType: 'RECURRING',
        weeklySlots: selectedWeekdays.map((day) => ({ dayOfWeek: day === 0 ? 7 : day, startMinute, endMinute })),
      }
    }
    if (customDates.length === 0) return null
    return {
      ...common,
      packageType: 'CUSTOM',
      sessions: [...customDates].sort().map((date) => ({ date, courtId, startMinute, endMinute })),
    }
  }, [courtId, fromDate, toDate, teamId, mode, selectedWeekdays, customDates, startMinute, endMinute])

  // Đổi mẫu thì bỏ các xử lý buổi trùng cũ
  useEffect(() => {
    setRemovedKeys([])
    setReplacements({})
    setAdjustedPreview(null)
  }, [baseRequest])

  // UC15 #4: backend sinh buổi và đánh dấu buổi trùng
  useEffect(() => {
    if (!baseRequest) {
      setBasePreview(null)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(() => {
      previewBookingPackageApi(baseRequest)
        .then((data) => {
          if (cancelled) return
          setBasePreview(data)
          setPreviewError('')
        })
        .catch((err) => {
          if (cancelled) return
          setBasePreview(null)
          setPreviewError(apiErrorMessage(err, 'Could not build the schedule.'))
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [baseRequest])

  const hasAdjustments = removedKeys.length > 0 || Object.keys(replacements).length > 0

  // Danh sách buổi gửi backend sau khi bỏ buổi trùng hoặc chọn slot bù (UC15 #5)
  const adjustedRequest = useMemo(() => {
    if (!baseRequest || !basePreview || !hasAdjustments) return null
    const sessions = basePreview.sessions
      .filter((session) => !removedKeys.includes(sessionKey(session)))
      .map((session) => {
        const replacement = replacements[sessionKey(session)]
        return {
          date: session.date,
          courtId: replacement?.courtId ?? session.courtId,
          startMinute: replacement?.startMinute ?? session.startMinute,
          endMinute: replacement?.endMinute ?? session.endMinute,
        }
      })
    return { ...baseRequest, sessions }
  }, [baseRequest, basePreview, hasAdjustments, removedKeys, replacements])

  // Kiểm tra lại các slot bù với backend
  useEffect(() => {
    if (!adjustedRequest) {
      setAdjustedPreview(null)
      return undefined
    }
    let cancelled = false
    previewBookingPackageApi(adjustedRequest)
      .then((data) => {
        if (cancelled) return
        setAdjustedPreview(data)
        setPreviewError('')
      })
      .catch((err) => {
        if (cancelled) return
        setAdjustedPreview(null)
        setPreviewError(apiErrorMessage(err, 'Could not check the adjusted schedule.'))
      })
    return () => {
      cancelled = true
    }
  }, [adjustedRequest])

  const preview = hasAdjustments ? adjustedPreview : basePreview
  const sessions = useMemo(() => preview?.sessions ?? [], [preview])
  const conflictedSessions = sessions.filter((session) => session.conflict)
  const finalRequest = hasAdjustments ? adjustedRequest : baseRequest

  const sessionsByDate = useMemo(() => {
    const map = {}
    sessions.forEach((session) => {
      map[session.date] = [...(map[session.date] || []), session]
    })
    return map
  }, [sessions])

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = Array.from({ length: leadingDays }, () => null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toDateKey(new Date(year, month, day))
      const daySessions = sessionsByDate[dateKey] || []
      cells.push({
        dateKey,
        day,
        sessions: daySessions,
        isSelected: daySessions.length > 0 || (mode === 'custom' && customDates.includes(dateKey)),
        isConflicted: daySessions.some((session) => session.conflict),
      })
    }
    return cells
  }, [viewMonth, sessionsByDate, mode, customDates])

  const toggleWeekday = (weekday) => {
    setSelectedWeekdays((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday]
    )
    setNotice('')
  }

  const toggleCustomDate = (dateKey) => {
    if (mode !== 'custom') return
    setCustomDates((current) =>
      current.includes(dateKey) ? current.filter((date) => date !== dateKey) : [...current, dateKey]
    )
    setNotice('')
  }

  const originalKeyOf = (session) => {
    // Buổi đang hiển thị có thể là slot bù: tìm lại buổi gốc cùng ngày trong bản xem trước ban đầu
    const replaced = Object.entries(replacements).find(
      ([key, value]) =>
        key.startsWith(`${session.date}|`) &&
        value.courtId === session.courtId &&
        value.startMinute === session.startMinute
    )
    return replaced ? replaced[0] : sessionKey(session)
  }

  const removeAllConflicts = () => {
    const keys = conflictedSessions.map(originalKeyOf)
    setRemovedKeys((current) => [...new Set([...current, ...keys])])
    setNotice(`Removed ${keys.length} conflicting sessions from your schedule.`)
  }

  const applyCompensation = () => {
    const replacementStart = toMinutes(compensationTime)
    const next = { ...replacements }
    conflictedSessions.forEach((session) => {
      const duration = session.endMinute - session.startMinute
      next[originalKeyOf(session)] = {
        courtId: Number(compensationCourtId),
        startMinute: replacementStart,
        endMinute: replacementStart + duration,
      }
    })
    setReplacements(next)
    setShowCompensation(false)
    setNotice(`Replacement slot selected for ${conflictedSessions.length} sessions.`)
  }

  const confirmSchedule = async () => {
    setNotice('')
    if (!finalRequest || !preview) {
      setNotice(previewError || 'Please choose a court, time and sessions first.')
      return
    }
    if (conflictedSessions.length > 0) {
      setNotice('Please resolve all conflicting sessions before confirming your schedule.')
      return
    }
    setSubmitting(true)
    try {
      // UC15 #11: giữ chỗ gói 15 phút (P27) rồi sang thanh toán UC18
      const res = await createBookingPackageApi(finalRequest)
      sessionStorage.setItem('active_holding_booking', JSON.stringify(res.data))
      navigate('/booking/payment')
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Could not confirm the package.'))
    } finally {
      setSubmitting(false)
    }
  }

  const shiftMonth = (offset) =>
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))

  if (!facilityId) {
    return (
      <div className={styles.pageWrapper}>
        <main className={styles.mainContainer}>
          <h1 className={styles.pageTitle}>Multi-Session Booking</h1>
          <p>Please open multi-session booking from a facility page.</p>
          <Link to="/">‹ Find courts</Link>
        </main>
      </div>
    )
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
            <Link to="/open-matches">Open Matches</Link>
            <Link to="/my-bookings">My Bookings</Link>
          </nav>
        </div>
      </header>

      <main className={styles.mainContainer}>
        <h1 className={styles.pageTitle}>
          Multi-Session Booking{facilityName || preview?.locationName ? ` · ${facilityName || preview?.locationName}` : ''}
        </h1>

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
              <select
                id="court"
                className={styles.selectInput}
                value={courtId ?? ''}
                onChange={(event) => setCourtId(Number(event.target.value))}
              >
                {courts.map((court) => (
                  <option key={court.court_id} value={court.court_id}>{court.court_name}</option>
                ))}
              </select>
            </div>

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="from-date">From date</label>
                <input
                  id="from-date"
                  type="date"
                  className={styles.dateInput}
                  min={today}
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    if (event.target.value) setViewMonth(parseDateKey(event.target.value))
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="to-date">To date</label>
                <input
                  id="to-date"
                  type="date"
                  className={styles.dateInput}
                  min={fromDate}
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
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
              <select id="book-for" className={styles.selectInput} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                <option value="">Personal</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>{team.team_name}</option>
                ))}
              </select>
            </div>

            <p className={styles.ruleHintText}>
              Recurring: minimum 1 session/week, from 1 to 3 months. All sessions must be within 3 months from today.
            </p>
          </aside>

          <div className={styles.rightColumn}>
            {preview?.batchOffer && (
              <div className={styles.promoBanner}>
                <strong>{preview.batchOffer.name}</strong>
                <span>{preview.batchOffer.message}</span>
              </div>
            )}

            <section className={styles.calendarCard} aria-label="Booking calendar">
              <div className={styles.calendarHeader}>
                <h2 className={styles.monthTitle}>
                  <button type="button" className={styles.weekdayBtn} onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
                  {' '}{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}{' '}
                  <button type="button" className={styles.weekdayBtn} onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
                </h2>
                <div className={styles.legendGroup}>
                  <span className={styles.legendItem}>
                    <i className={styles.dotSelected} />
                    Sessions · {preview?.totalSessions ?? 0}
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
                  const first = day.sessions[0]

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
                        : first && (
                          <span className={styles.timeSubTag}>
                            {first.startTime}–{first.endTime}{day.sessions.length > 1 ? ` +${day.sessions.length - 1}` : ''}
                          </span>
                        )}
                    </button>
                  )
                })}
              </div>

              {conflictedSessions.length > 0 && (
                <div className={styles.conflictResolutionBox} role="status">
                  <strong className={styles.conflictBoxTitle}>
                    {preview?.summary} {conflictedSessions
                      .map((session) => `${session.date.slice(8)}/${session.date.slice(5, 7)} ${session.startTime} ${session.courtName} (${CONFLICT_LABELS[session.conflict] || session.conflict})`)
                      .join(', ')}
                  </strong>
                  <div className={styles.conflictActionRow}>
                    <button
                      type="button"
                      className={styles.compensateBtn}
                      onClick={() => {
                        setCompensationCourtId(courtId)
                        setShowCompensation(true)
                      }}
                    >
                      Choose replacement slot
                    </button>
                    <button type="button" className={styles.removeConflictsBtn} onClick={removeAllConflicts}>
                      Remove all conflicts
                    </button>
                  </div>
                </div>
              )}
              {previewError && <p className={styles.notice} role="alert">{previewError}</p>}
              {notice && <p className={styles.notice} role="status">{notice}</p>}
            </section>

            <section className={styles.summaryFooterCard}>
              <div className={styles.summaryLeft}>
                <span className={styles.formulaText}>
                  {preview ? `${preview.totalSessions - preview.conflictSessions} valid sessions · list price ${formatCurrency(preview.listAmount)}` : 'No sessions yet'}
                </span>
                <strong className={styles.totalPriceText}>{formatCurrency(preview?.finalAmount)}</strong>
                <span className={styles.holdNoteText}>
                  One-time payment. After confirming, your package is held for 15 minutes.
                </span>
              </div>
              <button type="button" className={styles.confirmScheduleBtn} disabled={submitting} onClick={confirmSchedule}>
                {submitting ? 'Holding package...' : 'Confirm Schedule'}
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
              Select an alternative court and start time for {conflictedSessions.length} conflicting sessions (same duration, same day).
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="replacement-court">Court</label>
              <select
                id="replacement-court"
                className={styles.selectInput}
                value={compensationCourtId ?? ''}
                onChange={(event) => setCompensationCourtId(Number(event.target.value))}
              >
                {courts.map((court) => (
                  <option key={court.court_id} value={court.court_id}>{court.court_name}</option>
                ))}
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
