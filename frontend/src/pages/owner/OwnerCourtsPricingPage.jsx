import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  apiErrorMessage,
  createBatchOffer,
  createPriceRule,
  deleteBatchOffer,
  deletePriceRule,
  getBatchOffers,
  getCourtPriceRules,
  getOwnerLocations,
  getBatchOfferVouchers,
  getStoredLocationId,
  storeLocationId,
  updateBatchOffer,
  updateCourt,
  updatePriceRule,
} from '../../api/locationApi'
import ManagementLayout from '../../components/layout/ManagementLayout'
import CourtExpansionPanel from './CourtExpansionPanel'
import styles from './OwnerCourtsPricingPage.module.css'

const WEEK_DAYS = [
  { value: 1, short: "T2", label: "Thứ Hai" },
  { value: 2, short: "T3", label: "Thứ Ba" },
  { value: 3, short: "T4", label: "Thứ Tư" },
  { value: 4, short: "T5", label: "Thứ Năm" },
  { value: 5, short: "T6", label: "Thứ Sáu" },
  { value: 6, short: "T7", label: "Thứ Bảy" },
  { value: 7, short: "CN", label: "Chủ nhật" },
]

const WEEKDAY_VALUES = [1, 2, 3, 4, 5]
const WEEKEND_VALUES = [6, 7]

const DAY_LOOKUP = Object.fromEntries(WEEK_DAYS.map((day) => [day.value, day]))
const SLOT_TIMES = Array.from({ length: 49 }, (_, index) =>
  `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`)

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
  return Number(price).toLocaleString('vi-VN')
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, date] = String(value).split('-')
  return `${date}/${month}/${year}`
}

function daySummary(days) {
  if (!days || days.length === 0) return '—'
  if (days.length === 7) return "Hằng ngày"
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 5 && WEEKDAY_VALUES.every((day) => sorted.includes(day))) return "Thứ Hai – Thứ Sáu"
  if (sorted.length === 2 && WEEKEND_VALUES.every((day) => sorted.includes(day))) return "Thứ Bảy, Chủ nhật"
  return sorted.map((day) => DAY_LOOKUP[day]?.short ?? day).join(', ')
}

function discountLabel(offer) {
  if (offer.discountValue === null || offer.discountValue === undefined) return '—'
  if (offer.discountType === 'PERCENT') return `${offer.discountValue}%`
  return `${formatPrice(offer.discountValue)} VND`
}

export default function OwnerCourtsPricingPage() {
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const expansionOpen = routeLocation.hash === '#court-expansion'
  const closeExpansion = () => navigate({ pathname: routeLocation.pathname, search: routeLocation.search, hash: '' }, { replace: true })
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
  const [voucherError, setVoucherError] = useState('')
  const eligibleVouchers = vouchers.filter((voucher) =>
    (!offerForm.startDate || !voucher.validFrom || voucher.validFrom <= offerForm.startDate)
    && (!offerForm.endDate || !voucher.validTo || voucher.validTo >= offerForm.endDate))

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

  // BR47: cùng điều kiện loại/trạng thái với BatchOfferService.
  const loadVouchers = async (locationId) => {
    if (!locationId) {
      setVouchers([])
      return
    }
    try {
      setVouchers(await getBatchOfferVouchers(locationId))
      setVoucherError('')
    } catch (err) {
      setVouchers([])
      setVoucherError(apiErrorMessage(err))
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

  const handleFacilityChange = (nextId) => {
    setSelectedLocationId(nextId)
    storeLocationId(nextId)
    setActionError('')
    setStatusMessage('')
    resetRuleForm()
    resetOfferForm()
  }

  // ---------------------------------------------------------------- UC07: sân

  const handleEditCourt = async (court) => {
    const name = window.prompt("Tên sân", court.name)
    if (name === null) return
    const description = window.prompt("Mô tả sân", court.description ?? '')
    if (description === null) return
    if (!name.trim()) {
      setActionError("Vui lòng nhập tên sân.")
      return
    }
    setSaving(true)
    try {
      await updateCourt(court.id, { name: name.trim(), description: description.trim() }, selectedLocation?.id)
      await loadLocations()
      setActionError('')
      setStatusMessage(`Sân "${name.trim()}" đã được cập nhật.`)
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleCourtStatus = async (court) => {
    if (court.active && !window.confirm("Thay đổi này ảnh hưởng các lượt đặt sân đã xác nhận. Khách sẽ được thông báo để chọn đổi lịch miễn phí, hoàn tiền hoặc điểm bồi hoàn. Tiếp tục?")) return
    setSaving(true)
    try {
      await updateCourt(court.id, { isActive: !court.active }, selectedLocation?.id)
      await loadLocations()
      setActionError('')
      setStatusMessage(`Sân "${court.name}" ${court.active ? 'disabled' : 'enabled'}.`)
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
      setActionError("Giờ kết thúc phải sau giờ bắt đầu.")
      return
    }
    if (ruleForm.days.length === 0) {
      setActionError("Chọn ít nhất một ngày áp dụng.")
      return
    }
    const price = Number(ruleForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      setActionError("Nhập giá hợp lệ lớn hơn 0.")
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
        setStatusMessage("Đã cập nhật quy tắc giá.")
      } else if (ruleForm.courtId === 'all') {
        // Bảng giá lưu theo từng sân, nên "All courts" = tạo lần lượt cho mọi sân.
        for (const court of courts) {
          await createPriceRule(court.id, payload, selectedLocationId)
        }
        setStatusMessage(`Đã thêm quy tắc giá cho ${courts.length} sân.`)
      } else {
        await createPriceRule(ruleForm.courtId, payload, selectedLocationId)
        setStatusMessage("Đã thêm quy tắc giá.")
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
    if (!window.confirm(`Xóa ${rule.startTime} – ${rule.endTime} của sân "${rule.courtName}"?`)) return
    setSaving(true)
    try {
      await deletePriceRule(rule.id, selectedLocationId)
      if (editingRuleId === rule.id) resetRuleForm()
      await loadPriceRules(selectedLocationId, courts)
      setActionError('')
      setStatusMessage("Đã xóa quy tắc giá.")
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
      setActionError('Vui lòng nhập tên ưu đãi.')
      return
    }
    if (!offerForm.startDate || !offerForm.endDate) {
      setActionError('Vui lòng nhập ngày bắt đầu và ngày kết thúc.')
      return
    }
    if (offerForm.endDate < offerForm.startDate) {
      setActionError('Ngày kết thúc phải từ ngày bắt đầu trở đi.')
      return
    }
    if (!Number.isFinite(minPackageAmount) || minPackageAmount <= 0) {
      setActionError('Vui lòng nhập số tiền gói tối thiểu hợp lệ.')
      return
    }
    if (!eligibleVouchers.some((voucher) => String(voucher.id) === String(offerForm.voucherId))) {
      setActionError("Hãy chọn phiếu ưu đãi đã phát hành dành cho người chơi chỉ định, có hiệu lực bao phủ toàn bộ thời gian ưu đãi.")
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
        setStatusMessage("Đã cập nhật ưu đãi đặt theo lô.")
      } else {
        await createBatchOffer(payload, selectedLocationId)
        setStatusMessage("Đã tạo ưu đãi đặt theo lô.")
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
    if (!window.confirm(`Xóa ưu đãi đặt theo lô "${offer.name}"?`)) return
    setSaving(true)
    try {
      await deleteBatchOffer(offer.id, selectedLocationId)
      if (editingOfferId === offer.id) resetOfferForm()
      await loadOffers(selectedLocationId)
      setActionError('')
      setStatusMessage("Đã xóa ưu đãi đặt theo lô.")
    } catch (err) {
      setActionError(apiErrorMessage(err))
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ManagementLayout
      role="owner"
      title="Sân & Bảng giá"
      subtitle={selectedLocation ? `Cụm sân: ${selectedLocation.name}` : 'Quản lý danh sách sân, bảng giá giờ chơi và ưu đãi theo lô'}
      locations={locations}
      locationId={selectedLocationId}
      onLocationChange={handleFacilityChange}
    >
      <div>
        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
        {statusMessage && <p className={styles.statusMessage} role="status">{statusMessage}</p>}
        {selectedLocation && selectedLocation.status !== 'ACTIVE' && (
          <p className={styles.warningText} role="alert">
            Cụm sân này đã bị khóa. Anh/chị chỉ có thể xem dữ liệu mà không thể chỉnh sửa.
          </p>
        )}
        {selectedLocation && selectedLocation.status === 'ACTIVE' && !selectedLocation.serviceActive && (
          <p className={styles.warningText} role="alert">
            Kỳ hạn dịch vụ đã kết thúc{selectedLocation.serviceTermEndDate ? ` vào ngày ${selectedLocation.serviceTermEndDate}` : ''}.
            Vui lòng liên hệ Quản trị viên để gia hạn trước khi thay đổi cấu hình.
          </p>
        )}

        <section className={`${styles.panel} ${styles.courtPanel}`} aria-labelledby="court-list-heading">
          <div className={styles.panelHeader}>
            <h2 id="court-list-heading">Danh sách sân ({courts.length})</h2>
            <button className={styles.primaryButton} type="button" disabled={!selectedLocation || locked}
              onClick={() => navigate({ pathname: routeLocation.pathname, search: routeLocation.search, hash: '#court-expansion' })}>
              + Đăng ký thêm sân
            </button>
          </div>
          <p>Thêm giá cho tất cả giờ mở cửa trước khi bật bán sân mới.</p>
          {loading && <p className={styles.emptyState}>Đang tải danh sách sân…</p>}
          {!loading && !selectedLocation && (
            <p className={styles.emptyState}>Tài khoản này chưa được gán địa điểm.</p>
          )}
          {!loading && selectedLocation && courts.length === 0 && (
            <p className={styles.emptyState}>Địa điểm chưa có sân. Gửi yêu cầu thêm sân để quản trị viên kiểm tra và xét duyệt.</p>
          )}
          {selectedLocation && expansionOpen && <CourtExpansionPanel key={selectedLocation.id}
            locationId={selectedLocation.id} locked={locked} onClose={closeExpansion} />}
          <div className={styles.courtGrid}>
            {courts.map((court) => (
              <article className={styles.courtCard} key={court.id}>
                <div className={styles.courtCardHeader}>
                  <h3>{court.name}</h3>
                  <span className={`${styles.statusBadge} ${court.active ? styles.statusActive : styles.statusDisabled}`}>
                    {court.active ? "Đang hoạt động" : "Đã tắt"}
                  </span>
                </div>
                {court.availableFrom && <p>Kỳ hạn thêm sân: {formatDate(court.availableFrom)} → {formatDate(court.availableUntil)}; các kỳ gia hạn áp dụng theo địa điểm.</p>}
                <p className={styles.courtDescription}>{court.description || "Chưa có mô tả"}</p>
                <div className={styles.courtActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEditCourt(court)} disabled={saving || locked}>
                    Sửa
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleCourtStatus(court)} disabled={saving || locked}>
                    {court.active ? "Tắt" : "Bật"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.pricingGrid}>
          <section className={`${styles.panel} ${styles.rulesPanel}`} aria-labelledby="price-rules-heading">
            <h2 id="price-rules-heading">Quy tắc giá ({priceRules.length})</h2>
            <div className={styles.tableScroller}>
              <table className={styles.rulesTable}>
                <thead>
                  <tr>
                    <th scope="col">Sân</th>
                    <th scope="col">Ngày áp dụng</th>
                    <th scope="col">Khung giờ</th>
                    <th scope="col">Price / khung giờ</th>
                    <th scope="col">Hiệu lực</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.courtName}</td>
                      <td>{daySummary(rule.days)}</td>
                      <td>{rule.startTime} – {rule.endTime}</td>
                      <td><strong>{formatPrice(rule.pricePerSlot)} đồng</strong></td>
                      <td>
                        {formatDate(rule.validFrom)} – {rule.validTo ? formatDate(rule.validTo) : 'open'}
                        {rule.active === false && <span className={styles.expiredTag}>hết hạn</span>}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button className={styles.linkButton} type="button" onClick={() => handleEditPriceRule(rule)} disabled={saving || locked}>
                            Sửa
                          </button>
                          <button className={styles.linkButton} type="button" onClick={() => handleDeletePriceRule(rule)} disabled={saving || locked}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rulesLoading && <p className={styles.emptyState}>Đang tải quy tắc giá…</p>}
            {!rulesLoading && selectedLocation && priceRules.length === 0 && (
              <p className={styles.emptyState}>Chưa có quy tắc giá. Hãy thêm quy tắc đầu tiên ở biểu mẫu bên cạnh.</p>
            )}
          </section>

          <section className={`${styles.panel} ${styles.formPanel}`} aria-labelledby="add-rule-heading">
            <h2 id="add-rule-heading">{editingRuleId ? "Sửa quy tắc giá" : "Thêm quy tắc giá"}</h2>
            <form onSubmit={handleSavePriceRule}>
              <label className={styles.field}>
                <span>Sân</span>
                <select
                  value={ruleForm.courtId}
                  onChange={(event) => updateRuleForm('courtId', event.target.value)}
                  disabled={Boolean(editingRuleId)}
                >
                  {!editingRuleId && <option value="all">Tất cả sân</option>}
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </label>

              <div className={styles.field}>
                <span>Ngày áp dụng</span>
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
                  <span>Từ</span>
                  <select
                    className={ruleTimeInvalid ? styles.invalidInput : ''}
                    value={ruleForm.startTime}
                    aria-invalid={ruleTimeInvalid}
                    onChange={(event) => updateRuleForm('startTime', event.target.value)}
                  >
                    {SLOT_TIMES.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Đến</span>
                  <select
                    className={ruleTimeInvalid ? styles.invalidInput : ''}
                    value={ruleForm.endTime}
                    aria-invalid={ruleTimeInvalid}
                    onChange={(event) => updateRuleForm('endTime', event.target.value)}
                  >
                    {SLOT_TIMES.slice(1).map((time) => (
                      <option key={time} value={time}>{time === '24:00' ? '24:00 (00:00 hôm sau)' : time}</option>
                    ))}
                  </select>
                </label>
              </div>
              {ruleTimeInvalid && <p className={styles.overlapMessage} role="alert">Giờ kết thúc phải sau giờ bắt đầu.</p>}

              <label className={styles.field}>
                <span>Giá mỗi khung giờ (đồng)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatPrice(ruleForm.price)}
                  onChange={(event) => updateRuleForm('price', event.target.value.replace(/\D/g, ''))}
                />
              </label>

              <div className={styles.timeFields}>
                <label className={styles.field}>
                  <span>Có hiệu lực từ</span>
                  <input
                    type="date"
                    value={ruleForm.validFrom}
                    onChange={(event) => updateRuleForm('validFrom', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Có hiệu lực đến</span>
                  <input
                    type="date"
                    value={ruleForm.validTo}
                    onChange={(event) => updateRuleForm('validTo', event.target.value)}
                  />
                </label>
              </div>

              <button className={styles.saveButton} type="submit" disabled={saving || locked || ruleTimeInvalid || !selectedLocation}>
                {editingRuleId ? "Cập nhật quy tắc giá" : "Lưu quy tắc giá"}
              </button>
              {editingRuleId && (
                <button className={styles.cancelButton} type="button" onClick={resetRuleForm} disabled={saving}>
                  Hủy chỉnh sửa
                </button>
              )}
            </form>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.offerSection}`} aria-labelledby="bulk-offer-heading">
          <div className={styles.panelHeader}>
            <h2 id="bulk-offer-heading">Ưu đãi đặt theo lô ({offers.length})</h2>
          </div>
          <p className={styles.offerHint}>
            Gói đạt số tiền tối thiểu được tặng phiếu ưu đãi. Chỉ chọn phiếu ưu đãi đã phát hành dành cho người chơi chỉ định,
            có hiệu lực bao phủ toàn bộ thời gian ưu đãi.
          </p>

          <div className={styles.offerList}>
            {offers.map((offer) => (
              <article className={styles.offerCard} key={offer.id}>
                <div className={styles.offerCardBody}>
                  <h3>{offer.name}</h3>
                  <p className={styles.offerMeta}>
                    {formatDate(offer.startDate)} – {formatDate(offer.endDate)} · từ{' '}
                    {formatPrice(offer.minPackageAmount)} đồng · phiếu ưu đãi {offer.voucherCode ?? '—'} (
                    {discountLabel(offer)})
                  </p>
                </div>
                <div className={styles.offerCardActions}>
                  <span className={`${styles.statusBadge} ${offer.active ? styles.statusActive : styles.statusDisabled}`}>
                    {offer.active ? "Đang diễn ra" : 'Scheduled / ended'}
                  </span>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEditOffer(offer)} disabled={saving || locked}>
                    Sửa
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => handleDeleteOffer(offer)} disabled={saving || locked}>
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
          {offersLoading && <p className={styles.emptyState}>Đang tải ưu đãi…</p>}
          {!offersLoading && offers.length === 0 && (
            <p className={styles.emptyState}>Địa điểm chưa có ưu đãi đặt theo lô.</p>
          )}

          <form className={styles.offerForm} onSubmit={handleSaveOffer}>
            <label className={styles.field}>
              <span>Tên ưu đãi</span>
              <input
                type="text"
                maxLength={100}
                value={offerForm.name}
                onChange={(event) => updateOfferForm('name', event.target.value)}
                placeholder="Ưu đãi đặt theo lô cuối tuần"
              />
            </label>
            <div className={styles.timeFields}>
              <label className={styles.field}>
                <span>Ngày bắt đầu</span>
                <input
                  type="date"
                  value={offerForm.startDate}
                  onChange={(event) => updateOfferForm('startDate', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Ngày kết thúc</span>
                <input
                  type="date"
                  value={offerForm.endDate}
                  onChange={(event) => updateOfferForm('endDate', event.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Số tiền gói tối thiểu (đồng)</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatPrice(offerForm.minPackageAmount)}
                onChange={(event) => updateOfferForm('minPackageAmount', event.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className={styles.field}>
              <span>phiếu ưu đãi tặng cho người chơi chỉ định</span>
              <select value={offerForm.voucherId} onChange={(event) => updateOfferForm('voucherId', event.target.value)}>
                <option value="">{eligibleVouchers.length === 0 ? "Chưa có phiếu ưu đãi phù hợp với điều kiện và ngày ưu đãi" : "Chọn phiếu ưu đãi tặng"}</option>
                {eligibleVouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.code ? `${voucher.code} · ` : ''}{voucher.name} ({voucher.discountType === 'PERCENT'
                      ? `${voucher.discountValue}%`
                      : `${formatPrice(voucher.discountValue)} đồng`})
                    {voucher.validTo && ` · Hạn dùng ${formatDate(voucher.validTo)}`}
                  </option>
                ))}
              </select>
              <span>Chọn đối tượng “người chơi chỉ định”, phát hành phiếu ưu đãi rồi quay lại tạo ưu đãi.</span>
              <Link to="/owner/workspace?tab=rewards">Quản lý và phát hành phiếu ưu đãi</Link>
            </label>
            {voucherError && <p className={styles.actionError} role="alert">Không tải được phiếu ưu đãi: {voucherError}</p>}
            <button className={styles.secondaryButton} type="button" disabled={saving || locked || !selectedLocation}
              onClick={() => loadVouchers(selectedLocationId)}>Tải lại danh sách phiếu ưu đãi</button>
            <button className={styles.saveButton} type="submit" disabled={saving || locked || !selectedLocation}>
              {editingOfferId ? "Cập nhật ưu đãi" : "Tạo ưu đãi"}
            </button>
            {editingOfferId && (
              <button className={styles.cancelButton} type="button" onClick={resetOfferForm} disabled={saving}>
                Hủy chỉnh sửa
              </button>
            )}
          </form>
        </section>
        <span className={styles.facilityContext} aria-live="polite">{selectedLocation?.name}</span>
      </div>
    </ManagementLayout>
  )
}
