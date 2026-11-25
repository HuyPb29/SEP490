import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getAllPages } from '../../api'
import { voucherGrantState } from '../../api/bookingApi'
import { searchFacilities } from '../../api/facilityApi'
import WorkspaceLayout, { ActionForm, EmptyState, Feedback, Field, Section, StatusPill } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import PointGrantForm from './PointGrantForm'
import VoucherRecipients from './VoucherRecipients'
import { useLoyaltyMilestones, usePersonalLoyaltyProgress } from '../../hooks/useLoyaltyMilestones'
import { useVoucherCampaigns } from '../../hooks/useVoucherCampaigns'
import { dateTime, shortDate } from '../../utils/formatters'
import { Modal as DialogModal } from '../../components/common'
import { Button } from '../../components/common/Button'
import { FormField, Select } from '../../components/common/FormField'
import { EmptyState as SharedEmptyState, ErrorState, LoadingState, Toast } from '../../components/common/States'
import { StatusBadge } from '../../components/common/StatusBadge'
import { STATUS_CATALOG } from '../../components/common/statusCatalog'
import { Table } from '../../components/common/Table'
import { Tabs } from '../../components/common/Tabs'
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
const grantLabels = Object.fromEntries(['AVAILABLE', 'USED', 'UNAVAILABLE', 'EXPIRED'].map((key) => [key, STATUS_CATALOG.voucher[key].label]))
const pointTypes = { EARN: 'Tích điểm', REDEEM: 'Dùng điểm', RETURN: 'Hoàn điểm', REVOKE: 'Thu hồi điểm', ADJUST: 'Điều chỉnh' }

const voucherDiscount = (voucher) =>
  voucher.discountType === 'PERCENT' ? voucher.discountValue + '%' : money(voucher.discountValue)

const compactMoney = (value) => money(value).replace(/\s/g, '').replace('₫', 'đ')
const pointNumber = (value) => Number(value ?? 0).toLocaleString('vi-VN')

function RewardVoucher({ entry, location }) {
  const { voucher, state } = entry
  const [copying, setCopying] = useState(false)
  const copyLock = useRef(false)
  const [message, setMessage] = useState(null)
  async function copyCode() {
    if (copyLock.current) return
    copyLock.current = true
    setCopying(true)
    setMessage(null)
    try {
      await navigator.clipboard.writeText(voucher.code)
      setMessage({ tone: 'success', text: 'Đã sao chép mã ' + voucher.code + '.' })
    } catch {
      setMessage({ tone: 'danger', text: 'Chưa sao chép được. Hãy chọn mã bên cạnh để sao chép thủ công hoặc thử lại.' })
    } finally {
      copyLock.current = false
      setCopying(false)
    }
  }
  return <article className={styles.ticket} data-state={state} aria-label={voucher.name}>
    <div className={styles.ticketBody}>
      <div className={styles.ticketTop}><span className={styles.ticketKind}>{voucher.source === 'LOYALTY' ? 'Ưu đãi tích lũy' : 'Phiếu ưu đãi'}</span>
        <StatusBadge status={state} category="voucher" /></div>
      <p className={styles.ticketValue}><span>Giảm </span>{voucher.discountType === 'PERCENT' ? voucher.discountValue + '%' : compactMoney(voucher.discountValue)}</p>
      <h3>{voucher.name}</h3>
      <p className={styles.ticketMinimum}>{voucher.minOrderAmount > 0 ? 'Đơn tối thiểu ' + compactMoney(voucher.minOrderAmount) : 'Không yêu cầu đơn tối thiểu'}</p>
      <dl className={styles.ticketDetails}>
        <div><dt>Áp dụng tại</dt><dd>{location}</dd></div>
        <div><dt>Hạn sử dụng</dt><dd>{shortDate(entry.expiresAt || voucher.validTo)}</dd></div>
        {state === 'UNAVAILABLE' && voucher.validFrom && <div><dt>Có hiệu lực từ</dt><dd>{shortDate(voucher.validFrom)}</dd></div>}
      </dl>
    </div>
    <div className={styles.ticketStub}>{voucher.code ? <>
      <code aria-label={'Mã ưu đãi ' + voucher.code}>{voucher.code}</code>
      <Button variant="secondary" size="sm" onClick={copyCode} loading={copying} aria-label={'Sao chép mã ' + voucher.code}>Sao chép mã</Button>
    </> : <p>Phiếu cá nhân · Chọn trực tiếp khi đặt sân</p>}</div>
    {message && <div className={styles.copyMessage}><Toast tone={message.tone}>{message.text}</Toast></div>}
  </article>
}

function LoyaltyProgress({ locationId }) {
  const progress = usePersonalLoyaltyProgress(locationId)
  if (progress.loading) return <LoadingState message="Đang tải mốc tích lũy…" />
  if (progress.error) return <ErrorState message={progress.error} onRetry={progress.reload} />
  const item = progress.data
  if (!item?.nextMilestoneAmount) return <p className={styles.progressHint}>Địa điểm chưa có mốc thưởng tiếp theo đang áp dụng.</p>
  const reached = Number(item.remainingAmount) === 0
  return <div className={styles.progressBlock}>
    <div className={styles.progressHeading}><span>Mốc thưởng tiếp theo</span><strong>{compactMoney(item.nextMilestoneAmount)}</strong></div>
    <progress className={styles.progress} max={Number(item.nextMilestoneAmount)} value={Math.min(Number(item.totalPaid), Number(item.nextMilestoneAmount))}
      aria-label={'Tiến độ chi tiêu: ' + compactMoney(item.totalPaid) + ' trên ' + compactMoney(item.nextMilestoneAmount)} />
    <p>{reached ? 'Đã đạt mốc. Thưởng được xét ở lần xác nhận thanh toán tiếp theo.' : <>Còn <strong>{compactMoney(item.remainingAmount)}</strong> để đạt mốc.</>}</p>
    <p className={styles.progressHint}>{item.rewardName} · Giảm {compactMoney(item.rewardValue)}</p>
  </div>
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
  const availableCount = vouchers.data?.filter((entry) => voucherGrantState(entry, now) === 'AVAILABLE').length
  const hasFilters = voucherFilter !== 'all' || voucherLocation !== ''
  const findCourts = <Link className={styles.actionLink} to="/locations">Tìm sân để đặt lịch <span aria-hidden="true">↗</span></Link>
  const voucherPanel = <section className={styles.rewardSection} aria-label="Phiếu ưu đãi của tôi">
    <div className={styles.sectionHeading}><div><h2>Phiếu ưu đãi của tôi</h2><p>Chọn phiếu phù hợp cho buổi chơi tiếp theo.</p></div>
      {!vouchers.loading && !vouchers.error && <span className={styles.count}>{visibleVouchers?.length ?? 0} phiếu</span>}</div>
    <div className={styles.filters}>
      <FormField label="Địa điểm áp dụng"><Select value={voucherLocation} onChange={(event) => setVoucherLocation(event.target.value)}
        options={[[ '', 'Tất cả địa điểm' ], ...voucherLocationIds.map((id) => [id, name(id)])]} /></FormField>
      <FormField label="Trạng thái"><Select value={voucherFilter} onChange={(event) => setVoucherFilter(event.target.value)}
        options={[[ 'all', 'Tất cả trạng thái' ], ...Object.entries(grantLabels)]} /></FormField>
      {hasFilters && <Button variant="ghost" onClick={() => { setVoucherFilter('all'); setVoucherLocation('') }}>Xóa bộ lọc</Button>}
    </div>
    {vouchers.loading ? <LoadingState message="Đang tải phiếu ưu đãi…" /> : vouchers.error ? <ErrorState message={vouchers.error} onRetry={vouchers.reload} /> :
      visibleVouchers?.length ? <div className={styles.voucherGrid}>{visibleVouchers.map((entry) => <RewardVoucher key={entry.grantId} entry={entry} location={name(entry.voucher.locationId)} />)}</div> :
        <SharedEmptyState title={hasFilters ? 'Không có phiếu phù hợp' : 'Bạn chưa có phiếu ưu đãi'}
          description={hasFilters ? 'Thử chọn địa điểm hoặc trạng thái khác để xem các phiếu của bạn.' : 'Đặt sân và tích lũy chi tiêu tại địa điểm để nhận thêm ưu đãi.'}
          action={hasFilters ? <Button variant="secondary" onClick={() => { setVoucherFilter('all'); setVoucherLocation('') }}>Xóa bộ lọc</Button> : findCourts} />}
  </section>
  const pointsPanel = <div className={styles.pointsPanel}>
    <section className={styles.rewardSection} aria-label="Số dư và ưu đãi tích lũy">
      <div className={styles.sectionHeading}><div><h2>Điểm tại từng địa điểm</h2><p>Điểm và chi tiêu được tích lũy riêng tại mỗi địa điểm.</p></div></div>
      {balances.loading ? <LoadingState message="Đang tải số dư điểm…" /> : balances.error ? <ErrorState message={balances.error} onRetry={balances.reload} /> :
        balances.data?.length ? <div className={styles.balanceGrid}>{balances.data.map((item) => <article key={item.id} className={styles.balanceCard}>
          <h3>{name(item.locationId)}</h3><p className={styles.pointBalance}>{pointNumber(item.pointBalance)} <span>điểm khả dụng</span></p>
          <div className={styles.spend}><span>Chi tiêu tích lũy</span><strong>{compactMoney(item.totalPaid)}</strong></div>
          {tab === 'points' && <LoyaltyProgress locationId={item.locationId} />}
        </article>)}</div> : <SharedEmptyState title="Chưa có điểm tích lũy" description="Điểm sẽ xuất hiện tại địa điểm sau khi thanh toán lịch đặt sân đủ điều kiện." action={findCourts} />}
    </section>
    <section className={styles.rewardSection} aria-label="Lịch sử điểm">
      <div className={styles.sectionHeading}><div><h2>Lịch sử điểm</h2><p>Theo dõi từng lần tích, sử dụng và hoàn điểm.</p></div>
        <FormField className={styles.historyFilter} label="Địa điểm trong lịch sử"><Select value={location} onChange={(event) => setLocation(event.target.value)}
          options={[[ '', 'Tất cả địa điểm' ], ...(balances.data ?? []).map((item) => [item.locationId, name(item.locationId)])]} /></FormField></div>
      {history.loading ? <LoadingState message="Đang tải lịch sử điểm…" /> : history.error ? <ErrorState message={history.error} onRetry={history.reload} /> :
        history.data?.length ? <Table className={styles.historyTable} data={history.data} columns={[
          { key: 'createdAt', header: 'Thời gian', render: (item) => <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time> },
          { key: 'location', header: 'Địa điểm', render: (item) => name(locationByBalance.get(item.balanceId)) },
          { key: 'reason', header: 'Nội dung', render: (item) => <div className={styles.transactionReason}><strong>{pointTypes[item.type] ?? 'Giao dịch điểm'}</strong>
            {item.reason && <p>{item.reason}</p>}<small>{item.bookingId && 'Đặt sân #' + item.bookingId}{item.bookingId && item.packageId && ' · '}{item.packageId && 'Gói #' + item.packageId}
              {item.earningRate && ' · ' + compactMoney(item.earningRate) + '/điểm'}</small></div> },
          { key: 'points', header: 'Thay đổi', align: 'right', render: (item) => <strong className={item.points > 0 ? styles.pointCredit : styles.pointDebit}>{item.points > 0 ? '+' : ''}{pointNumber(item.points)} điểm</strong> },
          { key: 'balanceAfter', header: 'Số dư sau', align: 'right', render: (item) => pointNumber(item.balanceAfter) + ' điểm' },
        ]} /> : <SharedEmptyState title="Chưa có giao dịch điểm" description={location ? 'Địa điểm này chưa ghi nhận giao dịch. Chọn tất cả địa điểm để xem thêm.' : 'Các lần tích và sử dụng điểm sẽ xuất hiện tại đây sau khi giao dịch được ghi nhận.'}
          action={location ? <Button variant="secondary" onClick={() => setLocation('')}>Xem tất cả địa điểm</Button> : findCourts} />}
    </section>
  </div>
  return <div className={styles.rewards}>
    <div className={styles.walletSummary}>
      <div><span>Phiếu có thể sử dụng</span><strong>{vouchers.loading || vouchers.error ? '—' : availableCount}<small> phiếu</small></strong></div>
      <div><span>Địa điểm tích điểm</span><strong>{balances.loading || balances.error ? '—' : balances.data?.length ?? 0}<small> địa điểm</small></strong></div>
      <p>Ưu đãi riêng cho bạn.<br />Sẵn sàng cho buổi chơi tiếp theo.</p>
    </div>
    {locations.loading ? <LoadingState message="Đang tải tên địa điểm…" /> : locations.error && <ErrorState message={'Không tải được tên địa điểm. ' + locations.error} onRetry={locations.reload} />}
    <Tabs label="Ví ưu đãi" value={tab} onChange={setTab} items={[
      { value: 'vouchers', label: 'Phiếu ưu đãi', content: voucherPanel },
      { value: 'points', label: 'Điểm và lịch sử', content: pointsPanel },
    ]} />
  </div>
}

export function PersonalRewardsPage() {
  return <WorkspaceLayout title="Ưu đãi của tôi" subtitle="Quản lý phiếu ưu đãi, theo dõi điểm và các mốc thưởng của bạn." role="player"><PersonalRewards /></WorkspaceLayout>
}

/** Thẻ xem trước voucher, đọc giá trị đang nhập trong form. */
function VoucherPreview({ values }) {
  const discount = Number(values.discountValue)
  const minimum = Number(values.minOrderAmount)
  const hasDiscount = Number.isFinite(discount) && discount > 0
  return <aside className={styles.preview} aria-label="Xem trước phiếu ưu đãi">
    <p className={styles.previewLabel}>Xem trước</p>
    <div className={styles.previewTicket}>
      <div className={styles.previewTicketValue}>
        {hasDiscount ? (values.discountType === 'PERCENT' ? discount + '%' : money(discount)) : '—'}
        <span>giảm</span>
      </div>
      <div className={styles.previewTicketBody}>
        <strong>{values.name?.trim() || 'Tên phiếu ưu đãi'}</strong>
        <span>{minimum > 0 ? 'Đơn tối thiểu ' + money(minimum) : 'Không yêu cầu đơn tối thiểu'}</span>
        <span>{values.validFrom ? shortDate(values.validFrom) : '—'} – {values.validTo ? shortDate(values.validTo) : '—'}</span>
        <span>{voucherTargets[values.targetGroup] ?? ''}</span>
        {values.targetGroup !== 'SPECIFIED' && <code>{values.code?.trim().toUpperCase() || 'MÃ ƯU ĐÃI'}</code>}
      </div>
    </div>
  </aside>
}

function VoucherForm({ voucher, save, after }) {
  const [target, setTarget] = useState(voucher?.targetGroup || 'ALL_PLAYERS')
  const [discountType, setDiscountType] = useState(voucher?.discountType || 'AMOUNT')
  const [startDate, setStartDate] = useState(voucher?.validFrom ?? today())
  const [preview, setPreview] = useState(() => ({
    name: voucher?.name ?? '', code: voucher?.code ?? '', targetGroup: voucher?.targetGroup || 'ALL_PLAYERS',
    discountType: voucher?.discountType || 'AMOUNT', discountValue: voucher?.discountValue ?? '',
    minOrderAmount: voucher?.minOrderAmount ?? 0, validFrom: voucher?.validFrom ?? today(), validTo: voucher?.validTo ?? '',
  }))
  const readPreview = (event) => {
    const form = event.target.form
    if (form) setPreview(Object.fromEntries(new FormData(form)))
  }
  return <div className={styles.voucherLayout} onChange={readPreview} onInput={readPreview}>
  <div className={styles.voucherForm}><ActionForm label={voucher ? 'Lưu voucher' : 'Tạo và phát hành'} after={after}
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
      <div className={styles.formGroup} role="group" aria-label="Loại và giá trị">
        <h4>Loại và giá trị</h4>
        <Field label="Tên phiếu ưu đãi" name="name" defaultValue={voucher?.name} maxLength={100} required error={errors.name} />
        <Field label="Kiểu giảm" name="discountType" value={discountType} onChange={(event) => setDiscountType(event.target.value)}
          options={[[ 'AMOUNT', 'Số tiền (đồng)' ], [ 'PERCENT', 'Phần trăm' ]]} error={errors.discountType} />
        <Field label={discountType === 'PERCENT' ? 'Mức giảm (1–99%)' : 'Mức giảm (đồng)'} name="discountValue" type="number" min={1}
          max={discountType === 'PERCENT' ? 99 : 999999999999} defaultValue={voucher?.discountValue} required
          error={errors.discountValue || errors.percentageValid} />
      </div>
      <div className={styles.formGroup} role="group" aria-label="Thời hạn và điều kiện">
        <h4>Thời hạn và điều kiện</h4>
        <Field label="Từ ngày" name="validFrom" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}
          required error={errors.validFrom} />
        <Field label="Đến ngày" name="validTo" type="date" min={startDate > today() ? startDate : today()}
          defaultValue={voucher?.validTo} required error={errors.validTo || errors.dateRangeValid} />
        <Field label="Đơn tối thiểu (đồng)" name="minOrderAmount" type="number" min={0} max={999999999999}
          defaultValue={voucher?.minOrderAmount ?? 0} required error={errors.minOrderAmount} hint="Nhập 0 nếu không yêu cầu." />
      </div>
      <div className={styles.formGroup} role="group" aria-label="Đối tượng">
        <h4>Đối tượng</h4>
        <Field label="Đối tượng" name="targetGroup" value={target} onChange={(event) => setTarget(event.target.value)}
          options={Object.entries(voucherTargets)} error={errors.targetGroup}
          hint={target === 'SPECIFIED' ? 'Chỉ người được cấp mới dùng được. Sau khi phát hành, mở chiến dịch để tìm và chọn người nhận theo tên đăng nhập, email hoặc số điện thoại.' : undefined} />
        {target !== 'SPECIFIED' && <Field label="Mã phiếu ưu đãi" name="code" defaultValue={voucher?.code || ''} maxLength={20}
          pattern="[A-Za-z0-9_\u002D]+" required error={errors.code || errors.codeValid} hint="Chữ, số, gạch dưới hoặc gạch ngang." />}
        {target === 'SPECIFIED' && <Field label="Hạn dùng sau khi cấp (ngày)" name="grantValidDays" type="number" min={1} max={3650}
          defaultValue={voucher?.grantValidDays} error={errors.grantValidDays} />}
      </div>
      <div className={styles.formGroup} role="group" aria-label="Lượt và ngân sách">
        <h4>Lượt và ngân sách</h4>
        <Field label="Lượt dùng mỗi người" name="maxUsesPerPlayer" type="number" min={1} required
          defaultValue={voucher?.maxUsesPerPlayer} error={errors.maxUsesPerPlayer} />
        <Field label="Ngân sách (đồng)" name="budget" type="number" min={1} max={999999999999} required
          defaultValue={voucher?.budget} error={errors.budget} hint="Tổng tiền giảm tối đa của cả chiến dịch." />
      </div>
    </>}
  </ActionForm></div>
  <VoucherPreview values={preview} />
  </div>
}

function CampaignCard({ item, campaigns }) {
  const { reload: refresh, save, publish } = campaigns
  const [stopped, setStopped] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const editable = item.source === 'CAMPAIGN' && ['DRAFT', 'EXPIRED'].includes(item.status)
  return <details className={styles.campaign} onToggle={event => { if (event.target === event.currentTarget) setExpanded(event.currentTarget.open) }}>
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
      {expanded && item.source === 'CAMPAIGN' && item.targetGroup === 'SPECIFIED' && <VoucherRecipients voucher={item} />}
    </div>
  </details>
}

function Campaigns({ campaigns }) {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
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
    <button type="button" className="action" disabled={busy} onClick={() => {
        setResult(null)
        setCreating(true)
      }}>
      Tạo chiến dịch voucher
    </button>
  }>
    {result && (published
      ? <Feedback tone="success">Đã tạo và phát hành voucher.</Feedback>
      : <Feedback tone="warning">Đã tạo voucher nhưng chưa xác nhận phát hành. Nếu thẻ còn hiện Bản nháp, mở thẻ và chọn Phát hành để thử lại.</Feedback>)}
    <DialogModal open={creating} title="Tạo chiến dịch phiếu ưu đãi" className={styles.createDialog} busy={busy}
      onClose={() => setCreating(false)}>
      <p className={styles.createHint}>Phiếu ưu đãi được phát hành ngay sau khi tạo.</p>
      <VoucherForm save={create} after={(created) => {
        setCreating(false)
        setResult(created)
        campaigns.reload()
      }} />
      <div className={styles.createFooter}>
        <button type="button" className="cw-secondary" disabled={busy} onClick={() => setCreating(false)}>Hủy</button>
      </div>
    </DialogModal>
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
      })} after={refreshLocation} preserve>
        {(errors) => <>
          <Field label="VND để tích 1 điểm" name="pointEarningRate" type="number" min={1000} max={100000}
            defaultValue={location.pointEarningRate ?? 10000} required error={errors.pointEarningRate} />
        </>}
      </ActionForm>
    </Section>
    <PointGrantForm locationId={location.id} />
    <Milestones locationId={location.id} />
  </>
}
