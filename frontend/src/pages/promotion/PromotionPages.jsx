import { useCallback, useId, useRef, useState } from 'react'
import api, { getAllPages } from '../../api'
import { voucherGrantState } from '../../api/bookingApi'
import { searchFacilities } from '../../api/facilityApi'
import WorkspaceLayout, { ActionForm, EmptyState, Feedback, Field, Section, StatusPill } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import PointGrantForm from './PointGrantForm'
import { useLoyaltyMilestones } from '../../hooks/useLoyaltyMilestones'
import { useVoucherCampaigns } from '../../hooks/useVoucherCampaigns'
import { shortDate } from '../../utils/formatters'
import styles from './PromotionPages.module.css'

const loadPersonalVouchers = (signal) => getAllPages('/me/vouchers', { signal })
const loadBalances = (signal) => getAllPages('/me/loyalty-balances', { signal })
const loadPublicLocations = async (signal) => (await searchFacilities({ signal })).data.items
const optionalNumber = (value) => value === '' || value == null ? null : Number(value)
const locationName = (locations, id) =>
  locations?.find((item) => item.id === id)?.name ?? 'Địa điểm không khả dụng'

const voucherStatus = { PUBLISHED: 'Đã phát hành', DRAFT: 'Bản nháp', EXPIRED: 'Hết hạn', DISABLED: 'Đã vô hiệu hóa', STOPPED: 'Đã dừng' }
const voucherTones = { PUBLISHED: 'positive', DRAFT: 'pending', STOPPED: 'negative', DISABLED: 'negative' }
const voucherTargets = { ALL_PLAYERS: 'Tất cả người chơi', NEW_PLAYERS: 'Người chơi mới', SPECIFIED: 'Người chơi chỉ định' }
// The API requires a positive Java Integer even when the form has no campaign-wide limit.
const defaultCampaignUseLimit = 2_147_483_647
const grantLabels = { AVAILABLE: 'Có thể sử dụng', USED: 'Đã sử dụng', EXPIRED: 'Hết hạn', UNAVAILABLE: 'Chưa khả dụng' }
const pointTypes = { EARN: 'Tích điểm', REDEEM: 'Dùng điểm', RETURN: 'Hoàn điểm', REVOKE: 'Thu hồi điểm', ADJUST: 'Điều chỉnh' }

const voucherDiscount = (voucher) =>
  voucher.discountType === 'PERCENT' ? voucher.discountValue + '%' : money(voucher.discountValue)

function VoucherDescription({ voucher }) {
  const minimum = voucher.minOrderAmount > 0 ? 'Đơn tối thiểu ' + money(voucher.minOrderAmount) : 'Không yêu cầu giá trị đơn tối thiểu'
  return <>
    <h3 className="cw-record-title">{voucher.name}</h3>
    <p><strong>Giảm {voucherDiscount(voucher)}</strong> · {minimum}</p>
    {voucher.code && <code>{voucher.code}</code>}
  </>
}

function PersonalRewards() {
  const vouchers = useResource(loadPersonalVouchers)
  const balances = useResource(loadBalances)
  const [location, setLocation] = useState('')
  const [tab, setTab] = useState('vouchers')
  const [voucherFilter, setVoucherFilter] = useState('all')
  const [voucherLocation, setVoucherLocation] = useState('')
  const loadHistory = useCallback((signal) => getAllPages('/me/loyalty-transactions', {
    signal, params: { locationId: location || undefined },
  }), [location])
  const history = useResource(loadHistory, location)
  const locations = useResource(loadPublicLocations)
  const name = (id) => locationName(locations.data, id)
  const locationByBalance = new Map(balances.data?.map((item) => [item.id, item.locationId]))

  const [now] = useState(() => new Date())
  const voucherLocationIds = [...new Set(vouchers.data?.map(({ voucher }) => voucher.locationId))]
  const visibleVouchers = vouchers.data?.map((entry) => ({ ...entry, state: voucherGrantState(entry, now) }))
    .filter((entry) => voucherFilter === 'all' || entry.state === voucherFilter)
    .filter((entry) => !voucherLocation || String(entry.voucher.locationId) === voucherLocation)
  return <>
    <div className="cw-tabs" role="group" aria-label="Ví ưu đãi">
      <button type="button" aria-pressed={tab === 'vouchers'} onClick={() => setTab('vouchers')}>Phiếu ưu đãi</button>
      <button type="button" aria-pressed={tab === 'points'} onClick={() => setTab('points')}>Điểm và lịch sử</button>
    </div>
    {tab === 'vouchers' ? <Section title="Phiếu ưu đãi của tôi" resource={vouchers}>
      <Field label="Địa điểm" value={voucherLocation} onChange={(event) => setVoucherLocation(event.target.value)}
        options={[[ '', 'Tất cả địa điểm' ], ...voucherLocationIds.map((id) => [id, name(id)])]} />
      <Field label="Trạng thái" value={voucherFilter} onChange={(event) => setVoucherFilter(event.target.value)}
        options={[[ 'all', 'Tất cả' ], ...Object.entries(grantLabels)]} />
      {visibleVouchers?.length === 0 && <EmptyState>Không có phiếu ưu đãi trong mục này.</EmptyState>}
      <div className="cw-columns">{visibleVouchers?.map((entry) => <article key={entry.grantId} className="cw-voucher">
        <VoucherDescription voucher={entry.voucher} />
        <p>{name(entry.voucher.locationId)}</p>
        <div className="cw-voucher-meta"><span>Hạn dùng {entry.expiresAt?.slice(0, 10) || entry.voucher.validTo || '—'}</span>
          <StatusPill tone={entry.state === 'AVAILABLE' ? 'positive' : 'neutral'}>
            {grantLabels[entry.state] ?? entry.state}
          </StatusPill></div>
      </article>)}</div>
    </Section> : <>
      <Section title="Số dư theo địa điểm" resource={balances}>
        {balances.data?.length === 0 && <EmptyState>Bạn chưa tích điểm ở địa điểm nào.</EmptyState>}
        <ul className="cw-records">{balances.data?.map((item) => <li className="cw-record" key={item.id}>
          <div>
            <p className="cw-record-title">{name(item.locationId)}</p>
            <small>Chi tiêu tích lũy {money(item.totalPaid)}</small>
          </div>
          <strong>Số dư {item.pointBalance} điểm</strong>
        </li>)}</ul>
      </Section>
      <Section title="Lịch sử điểm" resource={history}>
        <Field label="Địa điểm" value={location} onChange={(event) => setLocation(event.target.value)}
          options={[[ '', 'Tất cả' ], ...(balances.data ?? []).map((item) => [item.locationId, name(item.locationId)])]} />
        {history.data?.length === 0 && <EmptyState>Chưa có giao dịch điểm.</EmptyState>}
        <ul className="cw-records">{history.data?.map((item) => <li className="cw-record" key={item.id}>
          <div><p className="cw-record-title">{pointTypes[item.type] ?? item.type} · {name(locationByBalance.get(item.balanceId))}</p>
            <small>{item.createdAt?.replace('T', ' ')}{item.reason && ' · ' + item.reason}
              {item.bookingId && " · Mã đặt sân #" + item.bookingId}{item.packageId && ' · Gói #' + item.packageId}
              {item.earningRate && ' · ' + money(item.earningRate) + '/điểm'}</small></div>
          <div><strong>{item.points > 0 ? '+' : ''}{item.points} điểm</strong><small className="block">Số dư sau giao dịch {item.balanceAfter} điểm</small></div>
        </li>)}</ul>
      </Section>
    </>}
  </>
}

export function PersonalRewardsPage() {
  return <WorkspaceLayout title="Ưu đãi của tôi" role="player"><PersonalRewards /></WorkspaceLayout>
}

function VoucherForm({ voucher, save, after }) {
  const [target, setTarget] = useState(voucher?.targetGroup || 'ALL_PLAYERS')
  const [discountType, setDiscountType] = useState(voucher?.discountType || 'AMOUNT')
  const [startDate, setStartDate] = useState(voucher?.validFrom ?? today())
  return <div className={styles.voucherForm}><ActionForm label={voucher ? 'Lưu voucher' : 'Tạo và phát hành'} after={after}
    successMessage={voucher ? 'Đã lưu thay đổi.' : false} action={(form) => {
    const payload = {
      ...form, code: form.code?.trim().toUpperCase() || null, discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount), grantValidDays: optionalNumber(form.grantValidDays),
      maxUsesPerPlayer: optionalNumber(form.maxUsesPerPlayer), maxTotalUses: voucher?.maxTotalUses ?? defaultCampaignUseLimit,
      budget: optionalNumber(form.budget),
    }
    return save(payload)
  }}>
    {(errors) => <>
      <div className={styles.formGroup} role="group" aria-label="Thông tin voucher">
        <h4>Thông tin voucher</h4>
        <Field label="Tên voucher" name="name" defaultValue={voucher?.name} maxLength={100} required error={errors.name} />
        <Field label="Đối tượng" name="targetGroup" value={target} onChange={(event) => setTarget(event.target.value)}
          options={Object.entries(voucherTargets)} error={errors.targetGroup}
          hint={target === 'SPECIFIED' ? 'Voucher dành riêng cho những người được cấp. Sau khi phát hành, mở chiến dịch và nhập ID người chơi ở mục Cấp voucher.' : undefined} />
        {target !== 'SPECIFIED' && <Field label="Mã voucher" name="code" defaultValue={voucher?.code || ''} maxLength={20}
          pattern="[A-Za-z0-9_\u002D]+" required error={errors.code || errors.codeValid} />}
      </div>
      <div className={styles.formGroup} role="group" aria-label="Điều kiện giảm giá">
        <h4>Điều kiện giảm giá</h4>
        <Field label="Kiểu giảm" name="discountType" value={discountType} onChange={(event) => setDiscountType(event.target.value)}
          options={[[ 'AMOUNT', 'Số tiền (VND)' ], [ 'PERCENT', 'Phần trăm' ]]} error={errors.discountType} />
        <Field label={discountType === 'PERCENT' ? 'Mức giảm (%)' : 'Mức giảm (VND)'} name="discountValue" type="number" min={1}
          max={discountType === 'PERCENT' ? 99 : 999999999999} defaultValue={voucher?.discountValue} required
          error={errors.discountValue || errors.percentageValid} />
        <Field label="Đơn tối thiểu (VND)" name="minOrderAmount" type="number" min={0} max={999999999999}
          defaultValue={voucher?.minOrderAmount ?? 0} required error={errors.minOrderAmount} />
      </div>
      <div className={styles.formGroup} role="group" aria-label="Thời gian áp dụng">
        <h4>Thời gian áp dụng</h4>
        <Field label="Từ ngày" name="validFrom" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}
          required error={errors.validFrom} />
        <Field label="Đến ngày" name="validTo" type="date" min={startDate > today() ? startDate : today()}
          defaultValue={voucher?.validTo} required error={errors.validTo || errors.dateRangeValid} />
        {target === 'SPECIFIED' && <Field label="Hạn voucher cá nhân (ngày)" name="grantValidDays" type="number" min={1} max={3650}
          defaultValue={voucher?.grantValidDays} error={errors.grantValidDays} />}
      </div>
      <div className={styles.formGroup} role="group" aria-label="Hạn mức sử dụng">
        <h4>Hạn mức sử dụng</h4>
        <Field label="Lượt mỗi người" name="maxUsesPerPlayer" type="number" min={1} required
          defaultValue={voucher?.maxUsesPerPlayer} error={errors.maxUsesPerPlayer} />
        <Field label="Ngân sách (VND)" name="budget" type="number" min={1} max={999999999999} required
          defaultValue={voucher?.budget} error={errors.budget} />
      </div>
    </>}
  </ActionForm></div>
}

function CampaignCard({ item, campaigns }) {
  const { reload: refresh, save, publish } = campaigns
  const [stopped, setStopped] = useState(false)
  const editable = item.source === 'CAMPAIGN' && ['DRAFT', 'EXPIRED'].includes(item.status)
  return <details className={styles.campaign}>
    <summary className={styles.overview}>
      <span className={styles.campaignName}>{item.name}{item.code && <code>{item.code}</code>}</span>
      <span className={styles.campaignStatus}>
        <StatusPill tone={voucherTones[item.status]}>{voucherStatus[item.status] ?? item.status}</StatusPill>
      </span>
      <strong className={styles.discount}>Giảm {voucherDiscount(item)}</strong>
      <span className={styles.campaignMeta}>
        <span>{voucherTargets[item.targetGroup] ?? item.targetGroup}</span>
        <span>{shortDate(item.validFrom)} – {shortDate(item.validTo)}</span>
        <span>Đã dùng {item.usedCount ?? 0} lượt</span>
      </span>
      <span className={styles.chevron} aria-hidden="true" />
    </summary>
    <div className={styles.campaignActions}>
      {editable ? <>
        <h3>Chỉnh sửa voucher</h3>
        <VoucherForm key={item.version} voucher={item} save={(payload) => save(item, payload)} after={refresh} />
      </> : <dl className={styles.campaignDetails}>
        <div><dt>Đơn tối thiểu</dt><dd>{item.minOrderAmount > 0 ? money(item.minOrderAmount) : 'Không yêu cầu'}</dd></div>
        <div><dt>Lượt mỗi người</dt><dd>{item.maxUsesPerPlayer ?? '—'}</dd></div>
        <div><dt>Ngân sách</dt><dd>{item.budget == null ? '—' : money(item.budget)}</dd></div>
      </dl>}
      {stopped && <Feedback tone="success">Đã dừng voucher.</Feedback>}
      {item.source === 'CAMPAIGN' && item.status === 'DRAFT' && <ActionForm label="Phát hành"
        action={() => publish(item.id)} after={refresh} />}
      {item.status === 'PUBLISHED' && <ActionForm label="Dừng voucher" tone="danger"
        confirmation="Dừng mã và ngừng cấp mới voucher này? Voucher đã cấp vẫn sử dụng được trong thời hạn."
        successMessage={false}
        action={() => api.post('/owner/vouchers/' + item.id + '/stop')} after={() => {
          setStopped(true)
          refresh()
        }} />}
      {item.source === 'CAMPAIGN' && item.targetGroup === 'SPECIFIED' && item.status === 'PUBLISHED' &&
        <ActionForm label="Cấp voucher" action={(form) => api.post('/owner/vouchers/' + item.id + '/grants', {
          playerIds: [...new Set(form.playerIds.trim().split(/[\s,]+/).map(Number))],
        })} after={refresh}>
          <Field label="ID người chơi" hint="Nếu cấp cho nhiều người, phân cách các ID bằng dấu phẩy."
            name="playerIds" required pattern="[0-9]+([ ,]+[0-9]+)*" />
        </ActionForm>}
    </div>
  </details>
}

function Campaigns({ campaigns }) {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const formId = useId()
  const toggle = useRef(null)
  const published = result?.published
    || campaigns.data?.some((item) => item.id === result?.id && item.status === 'PUBLISHED')

  async function create(payload) {
    setBusy(true)
    try {
      return await campaigns.create(payload)
    } finally {
      setBusy(false)
    }
  }

  return <Section title="Chiến dịch voucher" resource={campaigns} actions={
    <button ref={toggle} type="button" className={creating ? 'cw-secondary' : 'action'}
      aria-expanded={creating} aria-controls={formId} disabled={busy} onClick={() => {
        setResult(null)
        setCreating(!creating)
      }}>
      {creating ? 'Hủy tạo' : 'Tạo chiến dịch voucher'}
    </button>
  }>
    {result && (published
      ? <Feedback tone="success">Đã tạo và phát hành voucher.</Feedback>
      : <Feedback tone="warning">Đã tạo voucher nhưng chưa xác nhận phát hành. Nếu thẻ còn hiện Bản nháp, mở thẻ và chọn Phát hành để thử lại.</Feedback>)}
    <div id={formId} hidden={!creating} className={styles.createPanel}>
      {creating && <>
        <h3>Tạo voucher</h3>
        <VoucherForm save={create} after={(created) => {
          setCreating(false)
          setResult(created)
          campaigns.reload()
          requestAnimationFrame(() => toggle.current?.focus())
        }} />
      </>}
    </div>
    {campaigns.data?.length === 0 && <EmptyState>Chưa có chiến dịch voucher.</EmptyState>}
    {campaigns.data?.length > 0 && <ul className={styles.campaignList}>
      {campaigns.data.map((item) => <li key={item.id}><CampaignCard item={item} campaigns={campaigns} /></li>)}
    </ul>}
  </Section>
}

function MilestoneForm({ milestone, save, afterSave, beforeSave }) {
  return <ActionForm label={milestone ? 'Lưu mốc' : 'Thêm mốc'} after={afterSave} successMessage={false}
    mapFieldErrors={(error) => {
      const message = error.response?.data?.message
      return message === 'Mốc chi tiêu đã tồn tại' ? { milestoneAmount: message } : undefined
    }}
    action={(form) => {
      beforeSave()
      return save(milestone, {
        name: form.name.trim(), milestoneAmount: Number(form.milestoneAmount),
        rewardValue: Number(form.rewardValue), voucherValidDays: Number(form.voucherValidDays),
      }, form.active === 'true')
    }}>
    {(errors) => <>
      <Field label="Tên phiếu ưu đãi thưởng" name="name" defaultValue={milestone?.voucher.name} maxLength={100} required error={errors.name} />
      <Field label="Mốc chi tiêu (VND)" name="milestoneAmount" type="number" min={1} max={99999999999999}
        defaultValue={milestone?.milestoneAmount} required error={errors.milestoneAmount} />
      <Field label="Giá trị phiếu ưu đãi (VND)" name="rewardValue" type="number" min={1} max={999999999999}
        defaultValue={milestone?.voucher.discountValue} required error={errors.rewardValue} />
      <Field label="Hạn dùng (ngày)" name="voucherValidDays" type="number" min={1} max={3650}
        defaultValue={milestone?.voucher.grantValidDays} required error={errors.voucherValidDays} />
      {milestone && <Field label="Trạng thái" name="active" defaultValue={String(milestone.active)}
        options={[[ 'true', 'Đang áp dụng' ], [ 'false', 'Ngừng áp dụng' ]]} error={errors.active} />}
    </>}
  </ActionForm>
}

function Milestones({ locationId }) {
  const { milestones, save } = useLoyaltyMilestones(locationId)
  const [saved, setSaved] = useState(false)
  const afterSave = () => { setSaved(true); milestones.reload() }
  const beforeSave = () => setSaved(false)
  return <Section title="Mốc chi tiêu nhận phiếu ưu đãi" resource={milestones}>
    {saved && <Feedback tone="success">Đã lưu thay đổi.</Feedback>}
    <details><summary>Thêm mốc chi tiêu</summary><MilestoneForm save={save} beforeSave={beforeSave} afterSave={afterSave} /></details>
    {milestones.data?.length === 0 && <EmptyState>Chưa thiết lập mốc chi tiêu.</EmptyState>}
    {milestones.data?.map((item) => <details key={item.id} className="space-y-2 border-t py-3">
      <summary>{money(item.milestoneAmount)} · {item.voucher.name} · {item.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}</summary>
      <MilestoneForm key={item.version} milestone={item} save={save} beforeSave={beforeSave} afterSave={afterSave} />
    </details>)}
  </Section>
}

export function OwnerPromotions({ location, refreshLocation }) {
  const campaigns = useVoucherCampaigns(location.id)
  return <>
    <Campaigns campaigns={campaigns} />
    <Section title="Điểm thưởng">
      <ActionForm key={location.id} label="Lưu cấu hình điểm" action={(form) => api.patch('/owner/locations/' + location.id, {
        pointEarningRate: Number(form.pointEarningRate),
        pointRedemptionValue: Number(form.pointRedemptionValue),
      })} after={refreshLocation} preserve>
        {(errors) => <>
          <Field label="VND để tích 1 điểm" name="pointEarningRate" type="number" min={1000} max={100000}
            defaultValue={location.pointEarningRate ?? 10000} required error={errors.pointEarningRate} />
          <Field label="Số đồng giảm khi dùng 1 điểm" name="pointRedemptionValue" type="number" min={1} max={100000} step={1}
            defaultValue={location.pointRedemptionValue ?? 500} required error={errors.pointRedemptionValue} />
        </>}
      </ActionForm>
    </Section>
    <PointGrantForm locationId={location.id} />
    <Milestones locationId={location.id} />
  </>
}
