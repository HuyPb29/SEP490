import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  apiErrorMessage,
  createPriceRule,
  deletePriceRule,
  getCourtPriceRules,
  getOpeningHours,
  getOwnerLocations,
  getStoredLocationId,
  storeLocationId,
  updateCourt,
  updatePriceRule,
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
  StatusBadge,
  Table,
  Tabs,
  Textarea,
  Toast,
} from '../../components/common'
import { shortDate } from '../../utils/formatters'
import CourtExpansionPanel from './CourtExpansionPanel'
import styles from './OwnerCourtsPricingPage.module.css'

const WEEK_DAYS = [
  { value: 1, short: 'T2', label: 'Thứ Hai' },
  { value: 2, short: 'T3', label: 'Thứ Ba' },
  { value: 3, short: 'T4', label: 'Thứ Tư' },
  { value: 4, short: 'T5', label: 'Thứ Năm' },
  { value: 5, short: 'T6', label: 'Thứ Sáu' },
  { value: 6, short: 'T7', label: 'Thứ Bảy' },
  { value: 7, short: 'CN', label: 'Chủ nhật' },
]

const WEEKDAY_VALUES = [1, 2, 3, 4, 5]
const WEEKEND_VALUES = [6, 7]
const SLOT_STEP = 30

const DAY_LOOKUP = Object.fromEntries(WEEK_DAYS.map((day) => [day.value, day]))
const SLOT_TIMES = Array.from({ length: 49 }, (_, index) =>
  `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`)
const START_OPTIONS = SLOT_TIMES.slice(0, -1).map((time) => [time, time])
const END_OPTIONS = SLOT_TIMES.slice(1).map((time) => [time, time === '24:00' ? '24:00 (hết ngày)' : time])
/** Số mức đậm nhạt dùng để tô lưới giá. */
const PRICE_SHADES = [30, 46, 62, 78]

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

function emptyRuleForm(courtId = 'all') {
  return {
    courtId: String(courtId),
    days: [...WEEKEND_VALUES],
    startTime: '17:00',
    endTime: '23:00',
    price: '95000',
    validFrom: todayIso(),
    validTo: '',
  }
}

function formatPrice(price) {
  if (price === '' || price === null || price === undefined) return ''
  return Number(price).toLocaleString('vi-VN')
}

const priceLabel = (price) => `${formatPrice(price)}đ`

function toMinutes(time) {
  const [hour, minute] = String(time).split(':').map(Number)
  return hour * 60 + (minute || 0)
}

function clock(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function daySummary(days) {
  if (!days || days.length === 0) return '—'
  if (days.length === 7) return 'Hằng ngày'
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 5 && WEEKDAY_VALUES.every((day) => sorted.includes(day))) return 'Thứ Hai – Thứ Sáu'
  if (sorted.length === 2 && WEEKEND_VALUES.every((day) => sorted.includes(day))) return 'Thứ Bảy, Chủ nhật'
  return sorted.map((day) => DAY_LOOKUP[day]?.short ?? day).join(', ')
}

function ruleEffectiveToday(rule, today) {
  if (rule.active === false) return false
  if (rule.validFrom && rule.validFrom > today) return false
  if (rule.validTo && rule.validTo < today) return false
  return true
}

/**
 * Lưới 7 ngày × khung 30 phút trong giờ mở cửa, tô theo mức giá đang hiệu lực hôm nay.
 * Ô trong giờ mở cửa mà chưa có giá được gạch chéo đỏ.
 */
function buildPriceGrid(openingDays, rules) {
  const today = todayIso()
  const effective = rules.filter((rule) => ruleEffectiveToday(rule, today))
  const openDays = openingDays.filter((day) => day.configured)
  if (!openDays.length) return { rows: [], start: 0, end: 0, gaps: 0, prices: [] }
  const start = Math.min(...openDays.map((day) => day.openMinute))
  const end = Math.max(...openDays.map((day) => day.closeMinute))
  const prices = [...new Set(effective.map((rule) => Number(rule.pricePerSlot)))].sort((a, b) => a - b)
  let gaps = 0
  const rows = WEEK_DAYS.map((day) => {
    const hours = openingDays.find((item) => item.dayOfWeek === day.value && item.configured)
    const cells = []
    for (let minute = start; minute < end; minute += SLOT_STEP) {
      const open = Boolean(hours) && minute >= hours.openMinute && minute < hours.closeMinute
      const rule = open
        ? effective.find((item) => item.days?.includes(day.value)
          && toMinutes(item.startTime) <= minute && minute < toMinutes(item.endTime))
        : null
      if (open && !rule) gaps += 1
      cells.push({ minute, open, price: rule ? Number(rule.pricePerSlot) : null })
    }
    return { day, cells }
  })
  return { rows, start, end, gaps, prices }
}

function shadeFor(price, prices) {
  if (prices.length <= 1) return PRICE_SHADES[1]
  const index = prices.indexOf(price)
  return PRICE_SHADES[Math.round((index / (prices.length - 1)) * (PRICE_SHADES.length - 1))]
}

function PriceGrid({ grid, loading, error, onRetry }) {
  if (loading) return <LoadingState message="Đang tải giờ mở cửa…" />
  if (error) return <ErrorState message={`Không vẽ được lưới giá: ${error}`} onRetry={onRetry} />
  if (!grid.rows.length) {
    return (
      <EmptyState
        title="Chưa cấu hình giờ mở cửa"
        description="Lưới giá dựa trên giờ mở cửa của địa điểm. Hãy cấu hình giờ mở cửa trước."
        action={<Link className={styles.linkButton} to="/owner/opening-hours">Cấu hình giờ mở cửa</Link>}
      />
    )
  }
  const hourMarks = []
  for (let minute = grid.start; minute < grid.end; minute += SLOT_STEP) hourMarks.push(minute)
  return (
    <figure className={styles.gridFigure}>
      <figcaption className={styles.gridCaption}>
        <span>Giá đang hiệu lực hôm nay theo thứ và khung giờ.</span>
        {grid.gaps > 0
          ? <strong className={styles.gapText}>Còn {grid.gaps} khung giờ chưa có giá</strong>
          : <strong className={styles.okText}>Đã phủ giá kín giờ mở cửa</strong>}
      </figcaption>
      <div className={styles.gridScroller}>
        <div
          className={styles.priceGrid}
          style={{ gridTemplateColumns: `56px repeat(${hourMarks.length}, minmax(18px, 1fr))` }}
          role="img"
          aria-label={grid.gaps > 0
            ? `Lưới giá theo tuần, còn ${grid.gaps} khung giờ trong giờ mở cửa chưa có giá.`
            : 'Lưới giá theo tuần, mọi khung giờ trong giờ mở cửa đã có giá.'}
        >
          <span />
          {hourMarks.map((minute) => (
            <span key={minute} className={styles.gridHour}>{minute % 60 === 0 ? clock(minute).slice(0, 2) : ''}</span>
          ))}
          {grid.rows.map(({ day, cells }) => [
            <span key={`label-${day.value}`} className={styles.gridDay}>{day.short}</span>,
            ...cells.map((cell) => {
              const title = `${day.label} ${clock(cell.minute)}–${clock(cell.minute + SLOT_STEP)}: ${
                !cell.open ? 'đóng cửa' : cell.price === null ? 'chưa có giá' : priceLabel(cell.price)}`
              if (!cell.open) return <span key={`${day.value}-${cell.minute}`} className={styles.cellClosed} title={title} />
              if (cell.price === null) return <span key={`${day.value}-${cell.minute}`} className={styles.cellGap} title={title} />
              return (
                <span
                  key={`${day.value}-${cell.minute}`}
                  className={styles.cellPriced}
                  style={{ '--shade': `${shadeFor(cell.price, grid.prices)}%` }}
                  title={title}
                />
              )
            }),
          ])}
        </div>
      </div>
      <ul className={styles.legend} aria-label="Chú thích lưới giá">
        {grid.prices.map((price) => (
          <li key={price}>
            <span className={styles.cellPriced} style={{ '--shade': `${shadeFor(price, grid.prices)}%` }} aria-hidden="true" />
            {priceLabel(price)} / 30 phút
          </li>
        ))}
        <li><span className={styles.cellGap} aria-hidden="true" />Chưa có giá</li>
        <li><span className={styles.cellClosed} aria-hidden="true" />Đóng cửa</li>
      </ul>
    </figure>
  )
}

export default function OwnerCourtsPricingPage() {
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const expansionOpen = routeLocation.hash === '#court-expansion'
  const closeExpansion = () => navigate({ pathname: routeLocation.pathname, search: routeLocation.search, hash: '' }, { replace: true })
  const openExpansion = () => navigate({ pathname: routeLocation.pathname, search: routeLocation.search, hash: '#court-expansion' })

  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(() => getStoredLocationId())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [selectedCourtId, setSelectedCourtId] = useState(null)
  const [detailTab, setDetailTab] = useState('info')
  const [courtForm, setCourtForm] = useState(null)
  const [courtFormError, setCourtFormError] = useState('')
  const [pendingDisable, setPendingDisable] = useState(null)

  // UC09 — bảng giá
  const [priceRules, setPriceRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState('')
  const [ruleForm, setRuleForm] = useState(emptyRuleForm)
  const [ruleModal, setRuleModal] = useState(null)
  const [ruleError, setRuleError] = useState('')
  const [pendingDeleteRule, setPendingDeleteRule] = useState(null)
  const priceRuleBatch = useRef({ key: '', completed: new Set() })

  const [openingDays, setOpeningDays] = useState([])
  const [hoursLoading, setHoursLoading] = useState(false)
  const [hoursError, setHoursError] = useState('')
  const [hoursKey, setHoursKey] = useState(0)

  const selectedLocation =
    locations.find((location) => String(location.id) === String(selectedLocationId)) || null
  const courts = useMemo(() => selectedLocation?.courts ?? [], [selectedLocation])
  const locked = Boolean(selectedLocation) && selectedLocation.status !== 'ACTIVE'
  const serviceEnded = selectedLocation?.status === 'ACTIVE' && selectedLocation.serviceActive === false
  const selectedCourt = courts.find((court) => court.id === selectedCourtId) ?? courts[0] ?? null
  const courtRules = useMemo(
    () => priceRules.filter((rule) => selectedCourt && String(rule.courtId) === String(selectedCourt.id)),
    [priceRules, selectedCourt],
  )
  const grid = useMemo(() => buildPriceGrid(openingDays, courtRules), [openingDays, courtRules])
  const coverageKnown = !hoursLoading && !hoursError
  const enableBlocked = Boolean(selectedCourt) && !selectedCourt.active && coverageKnown && grid.gaps > 0

  // UC07: nạp địa điểm của Owner kèm danh sách sân (GET /api/owner/locations).
  const loadLocations = useCallback(async () => {
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
      setLoadError('')
    } catch (err) {
      setLoadError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // UC09: bảng giá nằm rải trên từng sân nên phải gọi theo sân rồi gộp lại.
  const loadPriceRules = useCallback(async (locationId, courtList) => {
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
        return toMinutes(left.startTime) - toMinutes(right.startTime)
      })
      setPriceRules(flat)
      setRulesError('')
    } catch (err) {
      setRulesError(apiErrorMessage(err))
    } finally {
      setRulesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedLocationId) {
      setPriceRules([])
      return
    }
    loadPriceRules(selectedLocationId, courts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, selectedLocation?.id, courts.length])

  // Giờ mở cửa chỉ dùng để vẽ lưới giá và giải thích vì sao chưa bật được sân.
  useEffect(() => {
    if (!selectedLocationId) return undefined
    let active = true
    setHoursLoading(true)
    getOpeningHours(selectedLocationId)
      .then((days) => { if (active) { setOpeningDays(days ?? []); setHoursError('') } })
      .catch((err) => { if (active) setHoursError(apiErrorMessage(err)) })
      .finally(() => { if (active) setHoursLoading(false) })
    return () => { active = false }
  }, [selectedLocationId, hoursKey])

  const handleFacilityChange = (nextId) => {
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setSelectedCourtId(null)
    setToast(null)
  }

  // ---------------------------------------------------------------- UC07: sân

  const openEditCourt = (court) => {
    setCourtForm({ id: court.id, name: court.name ?? '', description: court.description ?? '' })
    setCourtFormError('')
  }

  const handleSaveCourt = async (event) => {
    event.preventDefault()
    const name = courtForm.name.trim()
    if (!name) {
      setCourtFormError('Vui lòng nhập tên sân.')
      return
    }
    setSaving(true)
    try {
      await updateCourt(courtForm.id, { name, description: courtForm.description.trim() }, selectedLocation?.id)
      await loadLocations()
      setToast({ tone: 'success', text: `Đã cập nhật sân "${name}".` })
      setCourtForm(null)
    } catch (err) {
      setCourtFormError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const changeCourtStatus = async (court) => {
    setSaving(true)
    try {
      await updateCourt(court.id, { isActive: !court.active }, selectedLocation?.id)
      await loadLocations()
      setToast({ tone: 'success', text: `Đã ${court.active ? 'tắt' : 'bật'} sân "${court.name}".` })
    } catch (err) {
      setToast({ tone: 'danger', text: apiErrorMessage(err) })
    } finally {
      setSaving(false)
      setPendingDisable(null)
    }
  }

  const handleCourtStatus = (court) => {
    if (court.active) setPendingDisable(court)
    else changeCourtStatus(court)
  }

  // ---------------------------------------------------------- UC09: bảng giá

  const updateRuleForm = (field, value) => {
    setRuleForm((currentForm) => ({ ...currentForm, [field]: value }))
    setRuleError('')
  }

  const toggleRuleDay = (day) => {
    setRuleForm((currentForm) => {
      const exists = currentForm.days.includes(day)
      const nextDays = exists
        ? currentForm.days.filter((item) => item !== day)
        : [...currentForm.days, day].sort((a, b) => a - b)
      return { ...currentForm, days: nextDays }
    })
    setRuleError('')
  }

  const setRuleDays = (days) => {
    setRuleForm((currentForm) => ({ ...currentForm, days }))
    setRuleError('')
  }

  const openCreateRule = () => {
    priceRuleBatch.current = { key: '', completed: new Set() }
    setRuleForm(emptyRuleForm(selectedCourt?.id ?? 'all'))
    setRuleError('')
    setRuleModal({ id: null })
  }

  const openEditRule = (rule) => {
    priceRuleBatch.current = { key: '', completed: new Set() }
    setRuleForm({
      courtId: String(rule.courtId),
      days: rule.days?.length ? [...rule.days] : [...WEEKEND_VALUES],
      startTime: rule.startTime,
      endTime: rule.endTime,
      price: String(rule.pricePerSlot),
      validFrom: rule.validFrom ?? todayIso(),
      validTo: rule.validTo ?? '',
    })
    setRuleError('')
    setRuleModal({ id: rule.id })
  }

  const closeRuleModal = () => {
    if (!saving) setRuleModal(null)
  }

  const ruleTimeInvalid = ruleForm.startTime >= ruleForm.endTime
  const ruleDateInvalid = Boolean(ruleForm.validTo && ruleForm.validFrom && ruleForm.validTo < ruleForm.validFrom)

  const handleSavePriceRule = async (event) => {
    event.preventDefault()
    if (ruleTimeInvalid) {
      setRuleError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    if (ruleForm.days.length === 0) {
      setRuleError('Chọn ít nhất một ngày áp dụng.')
      return
    }
    const price = Number(ruleForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      setRuleError('Nhập giá hợp lệ lớn hơn 0.')
      return
    }
    if (ruleDateInvalid) {
      setRuleError('Ngày hết hiệu lực phải sau ngày bắt đầu hiệu lực.')
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
    const editingRuleId = ruleModal?.id
    setSaving(true)
    try {
      let text = 'Đã thêm mức giá.'
      if (editingRuleId) {
        await updatePriceRule(editingRuleId, payload, selectedLocationId)
        text = 'Đã cập nhật mức giá.'
      } else if (ruleForm.courtId === 'all') {
        // Bảng giá lưu theo từng sân, nên "Tất cả sân" = tạo lần lượt cho mọi sân.
        const key = JSON.stringify([selectedLocationId, payload])
        if (priceRuleBatch.current.key !== key) priceRuleBatch.current = { key, completed: new Set() }
        for (const court of courts) {
          if (priceRuleBatch.current.completed.has(court.id)) continue
          await createPriceRule(court.id, payload, selectedLocationId)
          priceRuleBatch.current.completed.add(court.id)
        }
        text = `Đã thêm mức giá cho ${courts.length} sân.`
      } else {
        await createPriceRule(ruleForm.courtId, payload, selectedLocationId)
      }
      setRuleModal(null)
      await loadPriceRules(selectedLocationId, courts)
      setToast({ tone: 'success', text })
    } catch (err) {
      const completed = ruleForm.courtId === 'all' ? priceRuleBatch.current.completed.size : 0
      if (completed) {
        await loadPriceRules(selectedLocationId, courts)
        setRuleError(`Đã thêm mức giá cho ${completed}/${courts.length} sân. ${apiErrorMessage(err)} Giữ nguyên thông tin và bấm Thêm mức giá để tiếp tục các sân còn lại.`)
      } else setRuleError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePriceRule = async () => {
    const rule = pendingDeleteRule
    if (!rule) return
    setSaving(true)
    try {
      await deletePriceRule(rule.id, selectedLocationId)
      await loadPriceRules(selectedLocationId, courts)
      setToast({ tone: 'success', text: 'Đã xóa mức giá.' })
    } catch (err) {
      setToast({ tone: 'danger', text: apiErrorMessage(err) })
    } finally {
      setSaving(false)
      setPendingDeleteRule(null)
    }
  }

  const courtInfo = selectedCourt && (
    <div className={styles.infoPanel}>
      <dl className={styles.facts}>
        <div><dt>Tên sân</dt><dd>{selectedCourt.name}</dd></div>
        <div>
          <dt>Trạng thái</dt>
          <dd>
            <StatusBadge tone={selectedCourt.active ? 'success' : 'neutral'}>
              {selectedCourt.active ? 'Đang hoạt động' : 'Đã tắt'}
            </StatusBadge>
          </dd>
        </div>
        <div className={styles.factWide}><dt>Mô tả</dt><dd>{selectedCourt.description || 'Chưa có mô tả'}</dd></div>
        {selectedCourt.availableFrom && (
          <div className={styles.factWide}>
            <dt>Thời hạn sân thêm</dt>
            <dd>{shortDate(selectedCourt.availableFrom)} → {shortDate(selectedCourt.availableUntil)} (các kỳ gia hạn áp dụng theo địa điểm)</dd>
          </div>
        )}
      </dl>
      {enableBlocked && (
        <p className={styles.blockedHint} id="enable-blocked-hint">
          Chưa bật được sân: còn {grid.gaps} khung giờ trong giờ mở cửa chưa có giá.
          Thêm mức giá ở tab "Bảng giá" cho đến khi lưới không còn ô gạch đỏ.
        </p>
      )}
      <div className={styles.actionRow}>
        <Button variant="secondary" onClick={() => openEditCourt(selectedCourt)} disabled={saving || locked}>
          Sửa thông tin
        </Button>
        <Button
          variant={selectedCourt.active ? 'danger' : 'primary'}
          onClick={() => handleCourtStatus(selectedCourt)}
          disabled={saving || locked || enableBlocked}
          aria-describedby={enableBlocked ? 'enable-blocked-hint' : undefined}
        >
          {selectedCourt.active ? 'Tắt sân' : 'Bật sân'}
        </Button>
      </div>
    </div>
  )

  const pricingPanel = selectedCourt && (
    <div className={styles.pricingPanel}>
      <PriceGrid grid={grid} loading={hoursLoading} error={hoursError} onRetry={() => setHoursKey((value) => value + 1)} />
      <div className={styles.subHeader}>
        <h3>Mức giá của {selectedCourt.name} ({courtRules.length})</h3>
        <Button onClick={openCreateRule} disabled={saving || locked}>Thêm mức giá</Button>
      </div>
      {rulesLoading && <LoadingState message="Đang tải bảng giá…" />}
      {!rulesLoading && rulesError && (
        <ErrorState message={rulesError} onRetry={() => loadPriceRules(selectedLocationId, courts)} />
      )}
      {!rulesLoading && !rulesError && courtRules.length === 0 && (
        <EmptyState
          title="Sân chưa có mức giá"
          description="Thêm mức giá phủ kín giờ mở cửa thì mới bật được sân cho khách đặt."
          action={!locked && <Button variant="secondary" onClick={openCreateRule}>Thêm mức giá đầu tiên</Button>}
        />
      )}
      {!rulesLoading && !rulesError && courtRules.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th scope="col">Ngày áp dụng</th>
              <th scope="col">Khung giờ</th>
              <th scope="col">Giá / 30 phút</th>
              <th scope="col">Hiệu lực</th>
              <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {courtRules.map((rule) => (
              <tr key={rule.id}>
                <td>{daySummary(rule.days)}</td>
                <td className={styles.numeric}>{rule.startTime}–{rule.endTime}</td>
                <td className={styles.numeric}><strong>{priceLabel(rule.pricePerSlot)}</strong></td>
                <td>
                  <span className={styles.validity}>
                    {shortDate(rule.validFrom)} → {rule.validTo ? shortDate(rule.validTo) : 'không thời hạn'}
                    {rule.active === false && <StatusBadge tone="neutral">Hết hạn</StatusBadge>}
                  </span>
                </td>
                <td className={styles.rowAction}>
                  <div className={styles.rowButtons}>
                    <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)} disabled={saving || locked}>Sửa</Button>
                    <Button variant="ghost" size="sm" className={styles.dangerText}
                      onClick={() => setPendingDeleteRule(rule)} disabled={saving || locked}>Xóa</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )

  return (
    <ManagementLayout
      role="owner"
      title="Sân và bảng giá"
      subtitle={selectedLocation
        ? `${selectedLocation.name} · Thông tin từng sân và giá mỗi khung 30 phút`
        : 'Thông tin từng sân và giá mỗi khung 30 phút'}
      actions={<Button onClick={openExpansion} disabled={!selectedLocation || locked}>Đăng ký thêm sân</Button>}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      <div className={styles.page}>
        {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}
        {locked && (
          <p className={`${styles.notice} ${styles.noticeDanger}`} role="status">
            <strong>Địa điểm đã bị khóa.</strong> Bạn chỉ xem được dữ liệu, không chỉnh sửa sân và bảng giá.
          </p>
        )}
        {serviceEnded && (
          <p className={`${styles.notice} ${styles.noticeWarning}`} role="status">
            <span>
              <strong>Thời hạn dịch vụ đã kết thúc{selectedLocation.serviceTermEndDate ? ` ngày ${shortDate(selectedLocation.serviceTermEndDate)}` : ''}.</strong>{' '}
              Gia hạn trước khi thay đổi cấu hình.
            </span>
            <Link className={styles.linkButton} to={`/owner/facility-settings?locationId=${selectedLocation.id}#service-renewal`}>
              Yêu cầu gia hạn
            </Link>
          </p>
        )}

        {loading && <LoadingState message="Đang tải danh sách sân…" />}
        {!loading && loadError && <ErrorState message={loadError} onRetry={loadLocations} />}
        {!loading && !loadError && !selectedLocation && (
          <EmptyState
            title="Chưa có địa điểm"
            description="Tài khoản chưa được gán địa điểm nào."
            action={<Link className={styles.linkButton} to="/register-service">Đăng ký sử dụng dịch vụ</Link>}
          />
        )}
        {!loading && !loadError && selectedLocation && courts.length === 0 && (
          <EmptyState
            title="Địa điểm chưa có sân"
            description="Gửi yêu cầu đăng ký thêm sân để quản trị viên kiểm tra thanh toán và duyệt."
            action={!locked && <Button onClick={openExpansion}>Đăng ký thêm sân</Button>}
          />
        )}

        {!loading && !loadError && courts.length > 0 && (
          <div className={styles.layout}>
            <section className={styles.courtList} aria-labelledby="court-list-heading">
              <h2 id="court-list-heading" className={styles.sectionTitle}>Danh sách sân ({courts.length})</h2>
              <ul className={styles.courtItems}>
                {courts.map((court) => {
                  const current = selectedCourt?.id === court.id
                  const count = priceRules.filter((rule) => String(rule.courtId) === String(court.id)).length
                  return (
                    <li key={court.id}>
                      <button
                        type="button"
                        className={`${styles.courtItem} ${current ? styles.courtItemActive : ''}`}
                        aria-pressed={current}
                        onClick={() => setSelectedCourtId(court.id)}
                      >
                        <span className={styles.courtName}>{court.name}</span>
                        <StatusBadge tone={court.active ? 'success' : 'neutral'}>
                          {court.active ? 'Đang hoạt động' : 'Đã tắt'}
                        </StatusBadge>
                        <span className={styles.courtMeta}>
                          {rulesLoading ? 'Đang tải giá…' : count ? `${count} mức giá` : 'Chưa có giá'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            {selectedCourt && (
              <section className={styles.detail} aria-labelledby="court-detail-heading">
                <h2 id="court-detail-heading" className={styles.sectionTitle}>{selectedCourt.name}</h2>
                <Tabs
                  label="Chi tiết sân"
                  value={detailTab}
                  onChange={setDetailTab}
                  items={[
                    { value: 'info', label: 'Thông tin', content: courtInfo },
                    { value: 'pricing', label: 'Bảng giá', content: pricingPanel },
                  ]}
                />
              </section>
            )}
          </div>
        )}
      </div>

      {selectedLocation && expansionOpen && (
        <CourtExpansionPanel key={selectedLocation.id} locationId={selectedLocation.id} locked={locked} onClose={closeExpansion} />
      )}

      <Modal open={Boolean(courtForm)} title="Sửa thông tin sân" onClose={() => !saving && setCourtForm(null)} busy={saving}>
        {courtForm && (
          <form className={styles.modalForm} onSubmit={handleSaveCourt}>
            <FormField label="Tên sân" required>
              <Input
                maxLength={100}
                value={courtForm.name}
                onChange={(event) => { setCourtForm((current) => ({ ...current, name: event.target.value })); setCourtFormError('') }}
              />
            </FormField>
            <FormField label="Mô tả" hint="Ví dụ: sàn thảm, gần cửa ra vào, có điều hòa.">
              <Textarea
                rows={3}
                maxLength={500}
                value={courtForm.description}
                onChange={(event) => setCourtForm((current) => ({ ...current, description: event.target.value }))}
              />
            </FormField>
            {courtFormError && <p className={styles.formError} role="alert">{courtFormError}</p>}
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setCourtForm(null)} disabled={saving}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu thay đổi</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(ruleModal)} title={ruleModal?.id ? 'Sửa mức giá' : 'Thêm mức giá'} onClose={closeRuleModal} busy={saving}>
        <form className={styles.modalForm} onSubmit={handleSavePriceRule}>
          <FormField label="Sân" hint={ruleModal?.id ? 'Không đổi sân khi sửa mức giá.' : undefined}>
            <Select value={ruleForm.courtId} disabled={Boolean(ruleModal?.id)}
              onChange={(event) => updateRuleForm('courtId', event.target.value)}>
              {!ruleModal?.id && <option value="all">Tất cả sân ({courts.length})</option>}
              {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
            </Select>
          </FormField>

          <fieldset className={styles.dayFieldset}>
            <legend>Ngày áp dụng</legend>
            <div className={styles.dayPicker}>
              {WEEK_DAYS.map((day) => (
                <button
                  className={`${styles.dayChip} ${ruleForm.days.includes(day.value) ? styles.dayChipActive : ''}`}
                  type="button"
                  key={day.value}
                  aria-pressed={ruleForm.days.includes(day.value)}
                  aria-label={day.label}
                  onClick={() => toggleRuleDay(day.value)}
                >
                  {day.short}
                </button>
              ))}
            </div>
            <div className={styles.dayPresets}>
              <Button variant="ghost" size="sm" onClick={() => setRuleDays([...WEEKDAY_VALUES])}>Thứ Hai – Thứ Sáu</Button>
              <Button variant="ghost" size="sm" onClick={() => setRuleDays([...WEEKEND_VALUES])}>Cuối tuần</Button>
              <Button variant="ghost" size="sm" onClick={() => setRuleDays(WEEK_DAYS.map((day) => day.value))}>Cả tuần</Button>
            </div>
          </fieldset>

          <div className={styles.twoCols}>
            <FormField label="Từ" required>
              <Select value={ruleForm.startTime} options={START_OPTIONS} invalid={ruleTimeInvalid}
                onChange={(event) => updateRuleForm('startTime', event.target.value)} />
            </FormField>
            <FormField label="Đến" required error={ruleTimeInvalid ? 'Giờ kết thúc phải sau giờ bắt đầu.' : undefined}>
              <Select value={ruleForm.endTime} options={END_OPTIONS} invalid={ruleTimeInvalid}
                onChange={(event) => updateRuleForm('endTime', event.target.value)} />
            </FormField>
          </div>

          <FormField label="Giá mỗi khung 30 phút (đồng)" required>
            <Input
              type="text"
              inputMode="numeric"
              value={formatPrice(ruleForm.price)}
              onChange={(event) => updateRuleForm('price', event.target.value.replace(/\D/g, ''))}
            />
          </FormField>

          <div className={styles.twoCols}>
            <FormField label="Hiệu lực từ" required>
              <Input type="date" required value={ruleForm.validFrom}
                onChange={(event) => updateRuleForm('validFrom', event.target.value)} />
            </FormField>
            <FormField label="Hiệu lực đến" hint="Để trống nếu không có thời hạn."
              error={ruleDateInvalid ? 'Phải sau ngày bắt đầu hiệu lực.' : undefined}>
              <Input type="date" value={ruleForm.validTo} min={ruleForm.validFrom || undefined}
                onChange={(event) => updateRuleForm('validTo', event.target.value)} />
            </FormField>
          </div>

          <p className={styles.formNote}>Mức giá trùng ngày, trùng khung giờ và trùng thời gian hiệu lực với mức đã có sẽ không được lưu.</p>
          {ruleError && <p className={styles.formError} role="alert">{ruleError}</p>}
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={closeRuleModal} disabled={saving}>Hủy</Button>
            <Button type="submit" loading={saving} disabled={ruleTimeInvalid || ruleDateInvalid}>
              {ruleModal?.id ? 'Lưu mức giá' : 'Thêm mức giá'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDisable)}
        title={`Tắt ${pendingDisable?.name ?? 'sân'}?`}
        tone="danger"
        confirmText="Tắt sân"
        busy={saving}
        onConfirm={() => changeCourtStatus(pendingDisable)}
        onCancel={() => setPendingDisable(null)}
      >
        <p>Sân tắt sẽ không nhận đặt mới.</p>
        <p className={styles.dialogWarning}>
          Booking đã xác nhận trên sân này sẽ bị đánh dấu ảnh hưởng do sân hủy lịch. Khách được thông báo để chọn đổi
          slot miễn phí, hoàn tiền hoặc nhận điểm bồi hoàn.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteRule)}
        title="Xóa mức giá?"
        tone="danger"
        confirmText="Xóa mức giá"
        busy={saving}
        onConfirm={handleDeletePriceRule}
        onCancel={() => setPendingDeleteRule(null)}
      >
        {pendingDeleteRule && (
          <p>
            Xóa mức {priceLabel(pendingDeleteRule.pricePerSlot)} ({daySummary(pendingDeleteRule.days)},{' '}
            {pendingDeleteRule.startTime}–{pendingDeleteRule.endTime}) của {pendingDeleteRule.courtName}?
            Khung giờ không còn giá sẽ khiến sân không bật lại được cho đến khi thêm giá mới.
          </p>
        )}
      </ConfirmDialog>
    </ManagementLayout>
  )
}
