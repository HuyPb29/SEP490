/**
 * OwnerLocationSettingsPage.jsx — UC07, FR16, FR17, BR60, D140, D151
 *
 * Route: /owner/locations/:id/settings
 *
 * Form is split into 3 clear groups:
 *   1. Basic Location Info (FR16)
 *   2. VietQR & Bank Payment Info (FR17, DR21, DR28)
 *   3. Location Operational Parameters (BR60):
 *      - P01 Booking Lead Time Limit (D140) — editable
 *      - P09 Loyalty Point Earn Rate — editable (BR38: 1,000–100,000)
 *      - P14 Cumulative Spending Milestones (D151, UC26) — dynamic list
 *      - System params shown read-only
 */
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getLocationSettings, updateLocationSettings } from '../../api/ownerApi'
import styles from './OwnerLocationSettingsPage.module.css'

const MAX_QR_BYTES = 5 * 1024 * 1024 // 5 MB (DR21)
const ALLOWED_QR_TYPES = ['image/jpeg', 'image/png']

function getErrMsg(err) {
  return err?.response?.data?.message || err?.message || "Đã xảy ra lỗi. Vui lòng thử lại."
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateBasic(form) {
  const e = {}
  if (!form.facility_name.trim()) e.facility_name = "Vui lòng nhập tên địa điểm."
  if (!form.address.trim())       e.address       = "Vui lòng nhập địa chỉ."
  if (!form.district.trim())      e.district      = "Vui lòng nhập quận/huyện."
  if (!form.city.trim())          e.city          = "Vui lòng nhập tỉnh/thành phố."
  return e
}

function validateBank(form) {
  const e = {}
  if (form.bank_account_number && !/^\d{6,20}$/.test(form.bank_account_number.replace(/\s/g, ''))) {
    e.bank_account_number = "Số tài khoản phải gồm 6–20 chữ số."
  }
  return e
}

function validateParams(form) {
  const e = {}
  const lead = Number(form.p01_booking_lead_time_days)
  if (!Number.isInteger(lead) || lead < 1 || lead > 365) {
    e.p01 = "Giới hạn đặt trước phải từ 1 đến 365 ngày."
  }
  const earnRate = Number(form.p09_loyalty_point_earn_rate)
  if (!Number.isFinite(earnRate) || earnRate < 1000 || earnRate > 100000) {
    e.p09 = "Tỷ lệ tích điểm phải từ 1.000 đến 100.000 đồng cho mỗi điểm."
  }
  form.p14_cumulative_milestones.forEach((m, i) => {
    if (!Number.isFinite(Number(m.milestone_amount)) || Number(m.milestone_amount) <= 0) {
      e[`p14_milestone_${i}`] = "Số tiền mốc tích lũy phải lớn hơn 0."
    }
    if (!Number.isFinite(Number(m.reward_voucher_value)) || Number(m.reward_voucher_value) <= 0) {
      e[`p14_voucher_${i}`] = "Giá trị phiếu ưu đãi thưởng phải lớn hơn 0."
    }
  })
  return e
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, htmlFor, error, hint, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={htmlFor}>{label}</label>
      )}
      {children}
      {hint  && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.fieldError} role="alert">{error}</span>}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OwnerLocationSettingsPage() {
  const { id: locationId } = useParams()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [pageErr,  setPageErr]  = useState('')
  const [saveErr,  setSaveErr]  = useState('')
  const [toast,    setToast]    = useState('')
  const [errors,   setErrors]   = useState({})

  const [form, setForm] = useState({
    // Group 1
    facility_name:   '',
    address:         '',
    district:        '',
    city:            '',
    contact_hotline: '',
    latitude:        '',
    longitude:       '',
    // Group 2
    bank_name:            '',
    bank_account_number:  '',
    account_holder_name:  '',
    qr_image_url:         null,
    // Group 3
    p01_booking_lead_time_days:  30,
    p09_loyalty_point_earn_rate: 10000,
    p14_cumulative_milestones:   [],
  })

  // QR preview (local object URL while offline)
  const [qrPreview, setQrPreview] = useState(null)
  const qrInputRef = useRef(null)

  // ── Load settings ───────────────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false
    getLocationSettings(locationId)
      .then((data) => {
        if (isCancelled) return
        setForm({
          facility_name:   data.facility_name   ?? '',
          address:         data.address         ?? '',
          district:        data.district        ?? '',
          city:            data.city            ?? '',
          contact_hotline: data.contact_hotline ?? '',
          latitude:        data.latitude        != null ? String(data.latitude)  : '',
          longitude:       data.longitude       != null ? String(data.longitude) : '',
          bank_name:            data.bank_name            ?? '',
          bank_account_number:  data.bank_account_number  ?? '',
          account_holder_name:  data.account_holder_name  ?? '',
          qr_image_url:         data.qr_image_url         ?? null,
          p01_booking_lead_time_days:  data.p01_booking_lead_time_days  ?? 30,
          p09_loyalty_point_earn_rate: data.p09_loyalty_point_earn_rate ?? 10000,
          p14_cumulative_milestones:   Array.isArray(data.p14_cumulative_milestones)
            ? data.p14_cumulative_milestones.map((m) => ({
                milestone_amount:    m.milestone_amount    ?? '',
                reward_voucher_value: m.reward_voucher_value ?? '',
              }))
            : [],
        })
        if (data.qr_image_url) setQrPreview(data.qr_image_url)
      })
      .catch((err) => {
        if (isCancelled) return
        setPageErr(getErrMsg(err))
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [locationId])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const n = { ...e }; delete n[field]; return n })
    setSaveErr('')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // ── QR file (DR21) ──────────────────────────────────────────────────────────
  function handleQrFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!ALLOWED_QR_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, qr: "Chỉ chấp nhận ảnh JPG và PNG." }))
      return
    }
    if (file.size > MAX_QR_BYTES) {
      setErrors((e) => ({ ...e, qr: "Dung lượng ảnh không được vượt quá 5 MB." }))
      return
    }
    setErrors((e) => { const n = { ...e }; delete n.qr; return n })
    // Use createObjectURL for offline preview (DR21)
    if (qrPreview && qrPreview.startsWith('blob:')) URL.revokeObjectURL(qrPreview)
    const url = URL.createObjectURL(file)
    setQrPreview(url)
    // Store the File object to upload later
    setForm((f) => ({ ...f, _qrFile: file }))
  }

  // ── Milestones (P14, D151) ──────────────────────────────────────────────────
  function addMilestone() {
    setForm((f) => ({
      ...f,
      p14_cumulative_milestones: [
        ...f.p14_cumulative_milestones,
        { milestone_amount: '', reward_voucher_value: '' },
      ],
    }))
  }

  function updateMilestone(idx, field, value) {
    setForm((f) => {
      const list = f.p14_cumulative_milestones.map((m, i) =>
        i === idx ? { ...m, [field]: value } : m,
      )
      return { ...f, p14_cumulative_milestones: list }
    })
    setErrors((e) => {
      const n = { ...e }
      delete n[`p14_milestone_${idx}`]
      delete n[`p14_voucher_${idx}`]
      return n
    })
    setSaveErr('')
  }

  function removeMilestone(idx) {
    setForm((f) => ({
      ...f,
      p14_cumulative_milestones: f.p14_cumulative_milestones.filter((_, i) => i !== idx),
    }))
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(event) {
    event.preventDefault()
    const allErrors = {
      ...validateBasic(form),
      ...validateBank(form),
      ...validateParams(form),
    }
    if (errors.qr) allErrors.qr = errors.qr
    setErrors(allErrors)
    if (Object.keys(allErrors).length > 0) {
      setSaveErr("Vui lòng sửa các lỗi ở trên trước khi lưu.")
      return
    }

    setSaving(true)
    setSaveErr('')
    try {
      const payload = {
        facility_name:   form.facility_name.trim(),
        address:         form.address.trim(),
        district:        form.district.trim(),
        city:            form.city.trim(),
        contact_hotline: form.contact_hotline.trim(),
        latitude:        form.latitude !== '' ? Number(form.latitude) : null,
        longitude:       form.longitude !== '' ? Number(form.longitude) : null,
        bank_name:            form.bank_name.trim(),
        bank_account_number:  form.bank_account_number.trim(),
        account_holder_name:  form.account_holder_name.trim(),
        p01_booking_lead_time_days:  Number(form.p01_booking_lead_time_days),
        p09_loyalty_point_earn_rate: Number(form.p09_loyalty_point_earn_rate),
        p14_cumulative_milestones:   form.p14_cumulative_milestones.map((m) => ({
          milestone_amount:    Number(m.milestone_amount),
          reward_voucher_value: Number(m.reward_voucher_value),
        })),
      }
      await updateLocationSettings(locationId, payload)
      showToast("Đã lưu cài đặt thành công.")
    } catch (err) {
      setSaveErr(getErrMsg(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className={styles.page}><p className={styles.loading}>Đang tải cài đặt…</p></div>
  if (pageErr) return <div className={styles.page}><p className={styles.pageError} role="alert">{pageErr}</p></div>

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast} role="status" aria-live="polite">{toast}</div>}

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Cài đặt địa điểm</h1>
        <p className={styles.pageSub}>Mã địa điểm #{locationId}</p>
      </div>

      <form onSubmit={handleSave} noValidate>
        {saveErr && <p className={styles.saveError} role="alert">{saveErr}</p>}

        {/* ── Group 1: Basic Location Info ─────────────────────────────── */}
        <section className={styles.section} aria-labelledby="grp-basic">
          <h2 id="grp-basic" className={styles.sectionTitle}>Thông tin cơ bản của địa điểm</h2>
          <div className={styles.grid2}>
            <FormField label="Tên địa điểm *" htmlFor="s-name" error={errors.facility_name}>
              <input
                id="s-name"
                type="text"
                value={form.facility_name}
                onChange={(e) => set('facility_name', e.target.value)}
                aria-invalid={!!errors.facility_name}
              />
            </FormField>
            <FormField label="Số điện thoại liên hệ" htmlFor="s-hotline">
              <input
                id="s-hotline"
                type="tel"
                value={form.contact_hotline}
                onChange={(e) => set('contact_hotline', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Địa chỉ *" htmlFor="s-addr" error={errors.address}>
            <input
              id="s-addr"
              type="text"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              aria-invalid={!!errors.address}
            />
          </FormField>

          <div className={styles.grid2}>
            <FormField label="Quận/huyện *" htmlFor="s-district" error={errors.district}>
              <input
                id="s-district"
                type="text"
                value={form.district}
                onChange={(e) => set('district', e.target.value)}
                aria-invalid={!!errors.district}
              />
            </FormField>
            <FormField label="Tỉnh/thành phố *" htmlFor="s-city" error={errors.city}>
              <input
                id="s-city"
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                aria-invalid={!!errors.city}
              />
            </FormField>
          </div>

          <div className={styles.grid2}>
            <FormField label="Vĩ độ" htmlFor="s-lat" hint="e.g. 21.0362">
              <input
                id="s-lat"
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => set('latitude', e.target.value)}
              />
            </FormField>
            <FormField label="Kinh độ" htmlFor="s-lng" hint="e.g. 105.7885">
              <input
                id="s-lng"
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => set('longitude', e.target.value)}
              />
            </FormField>
          </div>
        </section>

        {/* ── Group 2: VietQR & Bank Payment Info ─────────────────────── */}
        <section className={styles.section} aria-labelledby="grp-bank">
          <h2 id="grp-bank" className={styles.sectionTitle}>Mã VietQR và thông tin chuyển khoản</h2>
          <div className={styles.grid2}>
            <FormField label="Tên ngân hàng" htmlFor="s-bank">
              <input
                id="s-bank"
                type="text"
                placeholder="e.g. Vietcombank"
                value={form.bank_name}
                onChange={(e) => set('bank_name', e.target.value)}
              />
            </FormField>
            <FormField label="Số tài khoản ngân hàng" htmlFor="s-acct" error={errors.bank_account_number}>
              <input
                id="s-acct"
                type="text"
                inputMode="numeric"
                value={form.bank_account_number}
                onChange={(e) => set('bank_account_number', e.target.value)}
                aria-invalid={!!errors.bank_account_number}
              />
            </FormField>
          </div>

          <FormField label="Tên chủ tài khoản" htmlFor="s-holder" hint="Theo thông tin trên tài khoản ngân hàng">
            <input
              id="s-holder"
              type="text"
              value={form.account_holder_name}
              onChange={(e) => set('account_holder_name', e.target.value)}
            />
          </FormField>

          {/* QR upload */}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Mã QR thanh toán</span>
            <div className={styles.qrRow}>
              {qrPreview ? (
                <img
                  className={styles.qrPreview}
                  src={qrPreview}
                  alt="Ảnh mã QR thanh toán"
                />
              ) : (
                <div className={styles.qrPlaceholder} aria-hidden="true">
                  <span>Chưa có ảnh mã QR</span>
                </div>
              )}
              <div className={styles.qrUploadArea}>
                <button
                  className={styles.uploadBtn}
                  type="button"
                  onClick={() => qrInputRef.current?.click()}
                >
                  {qrPreview ? "Đổi ảnh mã QR" : "Tải lên ảnh mã QR"}
                </button>
                <input
                  ref={qrInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  style={{ display: 'none' }}
                  onChange={handleQrFile}
                />
                <span className={styles.hint}>Chấp nhận ảnh JPG/PNG, tối đa 5 MB.</span>
                {errors.qr && <span className={styles.fieldError} role="alert">{errors.qr}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* ── Group 3: Operational Parameters ─────────────────────────── */}
        <section className={styles.section} aria-labelledby="grp-params">
          <h2 id="grp-params" className={styles.sectionTitle}>Tham số vận hành địa điểm</h2>

          {/* Read-only system params */}
          <div className={styles.readOnlyGrid}>
            <div className={styles.readOnlyItem}>
              <span className={styles.readOnlyLabel}>Thời gian giữ chỗ đặt sân</span>
              <span className={styles.readOnlyValue}>10 phút</span>
            </div>
            <div className={styles.readOnlyItem}>
              <span className={styles.readOnlyLabel}>Thời gian chờ thanh toán</span>
              <span className={styles.readOnlyValue}>15 phút</span>
            </div>
            <div className={styles.readOnlyItem}>
              <span className={styles.readOnlyLabel}>Giá trị quy đổi điểm</span>
              <span className={styles.readOnlyValue}>1 điểm = 500 đồng</span>
            </div>
            <div className={styles.readOnlyItem}>
              <span className={styles.readOnlyLabel}>Giới hạn giảm giá bằng điểm</span>
              <span className={styles.readOnlyValue}>50% tổng tiền đặt sân</span>
            </div>
          </div>

          {/* P01 — Booking Lead Time */}
          <FormField
            label="Giới hạn đặt sân trước (ngày)"
            htmlFor="p01"
            hint="Mặc định 30 ngày. Khoảng thời gian tối đa người chơi có thể đặt trước."
            error={errors.p01}
          >
            <input
              id="p01"
              type="number"
              min="1"
              max="365"
              value={form.p01_booking_lead_time_days}
              onChange={(e) => set('p01_booking_lead_time_days', e.target.value)}
              aria-invalid={!!errors.p01}
              className={styles.inputNarrow}
            />
          </FormField>

          {/* P09 — Loyalty Point Earn Rate */}
          <FormField
            label="Tỷ lệ tích điểm (đồng cho mỗi điểm)"
            htmlFor="p09"
            hint="Từ 1.000 đến 100.000 đồng cho mỗi điểm. Mặc định 10.000 đồng."
            error={errors.p09}
          >
            <input
              id="p09"
              type="number"
              min="1000"
              max="100000"
              step="1000"
              value={form.p09_loyalty_point_earn_rate}
              onChange={(e) => set('p09_loyalty_point_earn_rate', e.target.value)}
              aria-invalid={!!errors.p09}
              className={styles.inputNarrow}
            />
          </FormField>

          {/* P14 — Cumulative Spending Milestones */}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Các mốc chi tiêu tích lũy</span>
            <span className={styles.hint}>
              Khách đạt mốc chi tiêu sẽ được tặng phiếu ưu đãi.
            </span>

            {form.p14_cumulative_milestones.length === 0 && (
              <p className={styles.milestonesEmpty}>Chưa có mốc tích lũy. Hãy thêm mốc ở bên dưới.</p>
            )}

            <div className={styles.milestoneList}>
              {form.p14_cumulative_milestones.map((m, idx) => (
                <div key={idx} className={styles.milestoneRow}>
                  <div className={styles.milestoneFields}>
                    <div className={styles.milestoneField}>
                      <label
                        className={styles.milestoneLabel}
                        htmlFor={`ms-amount-${idx}`}
                      >
                        Số tiền mốc tích lũy (đồng)
                      </label>
                      <input
                        id={`ms-amount-${idx}`}
                        type="number"
                        min="1"
                        step="1000"
                        placeholder="e.g. 1000000"
                        value={m.milestone_amount}
                        onChange={(e) => updateMilestone(idx, 'milestone_amount', e.target.value)}
                        aria-invalid={!!errors[`p14_milestone_${idx}`]}
                      />
                      {errors[`p14_milestone_${idx}`] && (
                        <span className={styles.fieldError}>{errors[`p14_milestone_${idx}`]}</span>
                      )}
                    </div>

                    <div className={styles.milestoneField}>
                      <label
                        className={styles.milestoneLabel}
                        htmlFor={`ms-voucher-${idx}`}
                      >
                        Giá trị phiếu ưu đãi thưởng (đồng)
                      </label>
                      <input
                        id={`ms-voucher-${idx}`}
                        type="number"
                        min="1"
                        step="1000"
                        placeholder="e.g. 50000"
                        value={m.reward_voucher_value}
                        onChange={(e) => updateMilestone(idx, 'reward_voucher_value', e.target.value)}
                        aria-invalid={!!errors[`p14_voucher_${idx}`]}
                      />
                      {errors[`p14_voucher_${idx}`] && (
                        <span className={styles.fieldError}>{errors[`p14_voucher_${idx}`]}</span>
                      )}
                    </div>
                  </div>

                  <button
                    className={styles.removeMilestoneBtn}
                    type="button"
                    onClick={() => removeMilestone(idx)}
                    aria-label={`Xóa mốc tích lũy ${idx + 1}`}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>

            <button
              className={styles.addMilestoneBtn}
              type="button"
              onClick={addMilestone}
            >
              + Thêm mốc tích lũy
            </button>
          </div>
        </section>

        {/* Save button */}
        <div className={styles.formFooter}>
          <button className={styles.saveBtn} type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu cài đặt"}
          </button>
        </div>
      </form>
    </div>
  )
}
