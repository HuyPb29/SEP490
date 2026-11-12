import { useCallback, useState } from 'react'
import api, { getAllPages } from '../../api'
import { voucherGrantState } from '../../api/bookingApi'
import WorkspaceLayout, { ActionForm, EmptyState, Field, Section, StatusPill } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'
import { defaultPointPercent } from '../../utils/checkoutPoints'
import PointGrantForm from './PointGrantForm'

const loadPersonalVouchers = (signal) => getAllPages('/me/vouchers', { signal })
const loadBalances = (signal) => getAllPages('/me/loyalty-balances', { signal })
const loadCampaigns = (signal) => getAllPages('/owner/vouchers', { signal })
const loadBatchOffers = (signal) => api.get('/owner/batch-offers', { signal }).then((response) => response.data.data)
const loadAdminVouchers = (signal) => getAllPages('/admin/vouchers', { signal })
const loadMilestones = (signal) => api.get('/owner/loyalty-milestones', { signal }).then((response) => response.data.data)
const optionalNumber = (value) => value === '' || value == null ? null : Number(value)

const voucherStatus = { PUBLISHED: 'Đã phát hành', DRAFT: 'Bản nháp', EXPIRED: 'Hết hạn', DISABLED: 'Đã vô hiệu hóa' }
const grantLabels = { AVAILABLE: 'Có thể sử dụng', USED: 'Đã sử dụng', EXPIRED: 'Hết hạn', UNAVAILABLE: 'Chưa khả dụng' }
const pointTypes = { EARN: 'Tích điểm', REDEEM: 'Dùng điểm', RETURN: 'Hoàn điểm', REVOKE: 'Thu hồi điểm', ADJUST: 'Điều chỉnh' }

function VoucherDescription({ voucher, showCampaign = true }) {
  return <div className="cw-voucher-heading">
    <div><p className="cw-record-title">{voucher.name}</p>{voucher.code && <code>{voucher.code}</code>}</div>
    <strong>{voucher.discountType === 'PERCENT' ? voucher.discountValue + '%' : money(voucher.discountValue)}</strong>
    {showCampaign && voucher.status && <StatusPill tone={voucher.status === 'PUBLISHED' ? 'positive' : 'neutral'}>
      {voucherStatus[voucher.status] ?? voucher.status}
    </StatusPill>}
  </div>
}

function PersonalRewards() {
  const vouchers = useResource(loadPersonalVouchers)
  const balances = useResource(loadBalances)
  const [location, setLocation] = useState('')
  const [tab, setTab] = useState('vouchers')
  const [voucherFilter, setVoucherFilter] = useState('all')
  const loadHistory = useCallback((signal) => getAllPages('/me/loyalty-transactions', {
    signal, params: { locationId: location || undefined },
  }), [location])
  const history = useResource(loadHistory, location)
  const locationNames = useResource(useCallback(async (signal) => {
    const { data } = await api.get('/locations', { signal, params: { size: 50 } })
    return data.data.content
  }, []))
  const name = (id) => locationNames.data?.find((item) => item.id === id)?.name || 'Địa điểm #' + id

  const [now] = useState(() => new Date())
  const visibleVouchers = vouchers.data?.map((entry) => ({ ...entry, state: voucherGrantState(entry, now) }))
    .filter((entry) => voucherFilter === 'all' || entry.state === voucherFilter)
  return <>
    <div className="cw-tabs" role="group" aria-label="Ví ưu đãi">
      <button type="button" aria-pressed={tab === 'vouchers'} onClick={() => setTab('vouchers')}>Voucher</button>
      <button type="button" aria-pressed={tab === 'points'} onClick={() => setTab('points')}>Điểm và lịch sử</button>
    </div>
    {tab === 'vouchers' ? <Section title="Voucher của tôi" resource={vouchers}>
      <Field label="Trạng thái" value={voucherFilter} onChange={(event) => setVoucherFilter(event.target.value)}
        options={[[ 'all', 'Tất cả' ], ...Object.entries(grantLabels)]} />
      {visibleVouchers?.length === 0 && <EmptyState>Không có voucher trong mục này.</EmptyState>}
      <div className="cw-columns">{visibleVouchers?.map((entry) => <article key={entry.grantId} className="cw-voucher">
        <VoucherDescription voucher={entry.voucher} showCampaign={false} />
        <p>{name(entry.voucher.locationId)}</p>
        {entry.voucher.minOrderAmount > 0 && <small className="cw-muted">Đơn từ {money(entry.voucher.minOrderAmount)}</small>}
        <div className="cw-voucher-meta"><span>Hạn dùng {entry.expiresAt?.slice(0, 10) || entry.voucher.validTo || '—'}</span>
          <StatusPill tone={entry.state === 'AVAILABLE' ? 'positive' : 'neutral'}>
            {grantLabels[entry.state] ?? entry.state}
          </StatusPill></div>
      </article>)}</div>
    </Section> : <>
      <Section title="Số dư theo địa điểm" resource={balances}>
        {balances.data?.length === 0 && <EmptyState>Bạn chưa tích điểm ở địa điểm nào.</EmptyState>}
        <ul className="cw-records">{balances.data?.map((item) => <li className="cw-record" key={item.id}>
          <div><p className="cw-record-title">{name(item.locationId)}</p><small>Chi tiêu tích lũy {money(item.totalPaid)}</small></div>
          <StatusPill tone="positive">{item.pointBalance} điểm</StatusPill>
        </li>)}</ul>
      </Section>
      <Section title="Lịch sử điểm" resource={history}>
        <Field label="Địa điểm" value={location} onChange={(event) => setLocation(event.target.value)}
          options={[[ '', 'Tất cả' ], ...(balances.data ?? []).map((item) => [item.locationId, name(item.locationId)])]} />
        {history.data?.length === 0 && <EmptyState>Chưa có giao dịch điểm.</EmptyState>}
        <ul className="cw-records">{history.data?.map((item) => <li className="cw-record" key={item.id}>
          <div><p className="cw-record-title">{pointTypes[item.type] ?? item.type} · {name(item.locationId)}</p>
            <small>{item.createdAt?.replace('T', ' ')}{item.reason && ' · ' + item.reason}
              {item.bookingId && ' · Booking #' + item.bookingId}{item.packageId && ' · Gói #' + item.packageId}
              {item.earningRate && ' · ' + money(item.earningRate) + '/điểm'}</small></div>
          <div><strong>{item.points > 0 ? '+' : ''}{item.points} điểm</strong><small className="block">Số dư {item.balanceAfter}</small></div>
        </li>)}</ul>
      </Section>
    </>}
  </>
}

export function PersonalRewardsPage() {
  return <WorkspaceLayout title="Ưu đãi của tôi" role="player"><PersonalRewards /></WorkspaceLayout>
}

function VoucherForm({ voucher, refresh }) {
  const [target, setTarget] = useState(voucher?.targetGroup || 'ALL_PLAYERS')
  const [discountType, setDiscountType] = useState(voucher?.discountType || 'AMOUNT')
  const [startDate, setStartDate] = useState(voucher?.validFrom ?? today())
  const [allowPoints, setAllowPoints] = useState(voucher?.allowPoints ?? true)
  const campaignPath = '/owner/vouchers'
  return <ActionForm label={voucher ? 'Lưu voucher' : 'Tạo bản nháp'} after={refresh}
    successMessage="Đã lưu thay đổi. (MSG03)" action={(form) => {
    const payload = {
      ...form, code: form.code?.trim().toUpperCase() || null, discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount), grantValidDays: optionalNumber(form.grantValidDays),
      maxUsesPerPlayer: optionalNumber(form.maxUsesPerPlayer), maxTotalUses: optionalNumber(form.maxTotalUses),
      budget: optionalNumber(form.budget),
      allowPoints: form.allowPoints === 'true',
      maxPointPercent: optionalNumber(form.maxPointPercent),
    }
    return voucher
      ? api.patch(campaignPath + '/' + voucher.id, { version: voucher.version, voucher: payload })
      : api.post(campaignPath, payload)
  }}>
    {(errors) => <>
    <Field label="Tên voucher" name="name" defaultValue={voucher?.name} maxLength={100} required error={errors.name} />
    <Field label="Đối tượng" name="targetGroup" value={target} onChange={(event) => setTarget(event.target.value)} options={[
      ['ALL_PLAYERS', 'Tất cả Player'], ['NEW_PLAYERS', 'Player mới'], ['SPECIFIED', 'Player chỉ định'],
    ]} error={errors.targetGroup} />
    {target !== 'SPECIFIED' && <Field label="Mã voucher" name="code" defaultValue={voucher?.code || ''} maxLength={20}
      pattern="[A-Za-z0-9_\u002D]+" required error={errors.code || errors.codeValid} />}
    <Field label="Kiểu giảm" name="discountType" value={discountType} onChange={(event) => setDiscountType(event.target.value)}
      options={[[ 'AMOUNT', 'Số tiền (VND)' ], [ 'PERCENT', 'Phần trăm' ]]} error={errors.discountType} />
    <Field label={discountType === 'PERCENT' ? 'Mức giảm (%)' : 'Mức giảm (VND)'} name="discountValue" type="number" min={1}
      max={discountType === 'PERCENT' ? 99 : 999999999999} defaultValue={voucher?.discountValue} required
      error={errors.discountValue || errors.percentageValid} />
    <Field label="Đơn tối thiểu (VND)" name="minOrderAmount" type="number" min={0} max={999999999999}
      defaultValue={voucher?.minOrderAmount ?? 0} required error={errors.minOrderAmount} />
    <Field label="Từ ngày" name="validFrom" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required error={errors.validFrom} />
    <Field label="Đến ngày" name="validTo" type="date" min={startDate > today() ? startDate : today()}
      defaultValue={voucher?.validTo} required error={errors.validTo || errors.dateRangeValid} />
    {target === 'SPECIFIED' && <Field label="Hạn voucher cá nhân (ngày)" name="grantValidDays" type="number" min={1} max={3650}
      defaultValue={voucher?.grantValidDays} error={errors.grantValidDays} />}
    <Field label="Lượt mỗi người" name="maxUsesPerPlayer" type="number" min={1} required defaultValue={voucher?.maxUsesPerPlayer} error={errors.maxUsesPerPlayer} />
    <Field label="Tổng lượt" name="maxTotalUses" type="number" min={1} required defaultValue={voucher?.maxTotalUses} error={errors.maxTotalUses} />
    <Field label="Ngân sách (VND)" name="budget" type="number" min={1} max={999999999999} required defaultValue={voucher?.budget} error={errors.budget} />
    <Field label="Kết hợp với điểm" name="allowPoints" value={String(allowPoints)}
      onChange={(event) => setAllowPoints(event.target.value === 'true')}
      options={[[ 'true', 'Cho phép' ], [ 'false', 'Không cho phép' ]]} error={errors.allowPoints || errors.pointPolicyValid} />
    {allowPoints && <Field label="Tỷ lệ tối đa trả bằng điểm (%)" name="maxPointPercent" type="number" min={1} max={100}
      defaultValue={voucher?.maxPointPercent ?? defaultPointPercent} required hint="Tính trên số tiền còn lại sau voucher."
      error={errors.maxPointPercent} />}
    </>}
  </ActionForm>
}

function Campaigns({ campaigns }) {
  return <Section title="Chiến dịch voucher" resource={campaigns}>
    <details><summary>Tạo chiến dịch voucher</summary><VoucherForm refresh={campaigns.reload} /></details>
    {campaigns.data?.length === 0 && <EmptyState>Chưa có chiến dịch voucher.</EmptyState>}
    {campaigns.data?.map((item) => <details className="space-y-3 border-t py-3" key={item.id}>
      <summary>{item.name} · {voucherStatus[item.status] ?? item.status}</summary>
      <VoucherDescription voucher={item} />
      <p>{item.targetGroup} · {item.validFrom} đến {item.validTo} · Đã dùng {item.usedCount} lượt</p>
      <p>{item.allowPoints ? `Dùng điểm tối đa ${item.maxPointPercent}% số tiền sau voucher` : 'Voucher không dùng cùng điểm'}</p>
      {item.source === 'CAMPAIGN' && ['DRAFT', 'EXPIRED'].includes(item.status) &&
        <VoucherForm key={item.version} voucher={item} refresh={campaigns.reload} />}
      {item.source === 'CAMPAIGN' && item.status === 'DRAFT' && <ActionForm label="Phát hành"
        action={() => api.post('/owner/vouchers/' + item.id + '/publish')} after={campaigns.reload} />}
      {item.source === 'CAMPAIGN' && item.targetGroup === 'SPECIFIED' && item.status === 'PUBLISHED' &&
        <ActionForm label="Cấp voucher" action={(form) => api.post('/owner/vouchers/' + item.id + '/grants', {
          playerIds: [...new Set(form.playerIds.trim().split(/[\s,]+/).map(Number))],
        })} after={campaigns.reload}>
          <Field label="ID Player, cách nhau bằng dấu phẩy" name="playerIds" required pattern="[0-9]+([ ,]+[0-9]+)*" />
        </ActionForm>}
    </details>)}
  </Section>
}

function BatchOfferForm({ offer, eligible, refresh }) {
  const selectedVoucher = eligible.some((voucher) => voucher.id === offer?.voucherId)
    ? offer.voucherId : ''
  return <ActionForm label={offer ? 'Lưu ưu đãi' : 'Tạo ưu đãi'} after={refresh} action={(form) => {
    const payload = { ...form, minPackageAmount: Number(form.minPackageAmount), voucherId: Number(form.voucherId) }
    return offer ? api.patch('/owner/batch-offers/' + offer.id, payload) : api.post('/owner/batch-offers', payload)
  }}>
    <Field label="Tên ưu đãi" name="name" defaultValue={offer?.name} maxLength={100} required />
    <Field label="Bắt đầu" name="startDate" type="date" defaultValue={offer?.startDate ?? today()} required />
    <Field label="Kết thúc" name="endDate" type="date" defaultValue={offer?.endDate} required />
    <Field label="Số tiền thực trả tối thiểu (VND)" name="minPackageAmount" type="number" min={1}
      defaultValue={offer?.minPackageAmount} required />
    <Field label="Voucher tặng" name="voucherId" defaultValue={selectedVoucher} required
      options={[[ '', 'Chọn voucher đã phát hành' ], ...eligible.map((voucher) => [voucher.id, voucher.name])]} />
  </ActionForm>
}

function BatchOffers({ vouchers }) {
  const offers = useResource(loadBatchOffers)
  const eligible = vouchers.filter((voucher) => voucher.status === 'PUBLISHED' && voucher.targetGroup === 'SPECIFIED')
  return <div id="batch-offers"><Section title="Ưu đãi đặt theo lô" resource={offers}>
    {eligible.length ? <BatchOfferForm eligible={eligible} refresh={offers.reload} /> :
      <p>Phát hành voucher cho Player chỉ định trước khi tạo ưu đãi cho gói.</p>}
    {offers.data?.length === 0 && <p>Chưa có ưu đãi đặt theo lô.</p>}
    {offers.data?.map((offer) => <details key={offer.id} className="space-y-3 border-t py-3">
      <summary>{offer.name} · {offer.active ? 'Trong thời gian áp dụng' : 'Ngoài thời gian áp dụng'}</summary>
      <p>Gói thực trả từ {money(offer.minPackageAmount)} · Voucher {offer.voucherName || '—'} · {offer.startDate} – {offer.endDate}</p>
      {eligible.length > 0 && <BatchOfferForm offer={offer} eligible={eligible} refresh={offers.reload} />}
      <ActionForm label="Xóa ưu đãi" tone="danger" confirmation="Xóa ưu đãi đặt theo lô này?"
        action={() => api.delete('/owner/batch-offers/' + offer.id)} after={offers.reload} />
    </details>)}
  </Section></div>
}

function MilestoneForm({ milestone, refresh }) {
  return <ActionForm label={milestone ? 'Lưu mốc' : 'Thêm mốc'} after={refresh} action={(form) => {
    const settings = {
      name: form.name, milestoneAmount: Number(form.milestoneAmount),
      rewardValue: Number(form.rewardValue), voucherValidDays: Number(form.voucherValidDays),
    }
    return milestone ? api.patch('/owner/loyalty-milestones/' + milestone.id, {
      version: milestone.version, active: form.active === 'true', settings,
    }) : api.post('/owner/loyalty-milestones', settings)
  }}>
    <Field label="Tên voucher thưởng" name="name" defaultValue={milestone?.voucher.name} maxLength={100} required />
    <Field label="Mốc chi tiêu (VND)" name="milestoneAmount" type="number" min={1} defaultValue={milestone?.milestoneAmount} required />
    <Field label="Giá trị voucher (VND)" name="rewardValue" type="number" min={1} defaultValue={milestone?.voucher.discountValue} required />
    <Field label="Hạn dùng (ngày)" name="voucherValidDays" type="number" min={1} max={3650} defaultValue={milestone?.voucher.grantValidDays} required />
    {milestone && <Field label="Trạng thái" name="active" defaultValue={String(milestone.active)}
      options={[[ 'true', 'Đang áp dụng' ], [ 'false', 'Ngừng áp dụng' ]]} />}
  </ActionForm>
}

function Milestones() {
  const milestones = useResource(loadMilestones)
  return <Section title="Mốc chi tiêu nhận voucher" resource={milestones}>
    <details><summary>Thêm mốc chi tiêu</summary><MilestoneForm refresh={milestones.reload} /></details>
    {milestones.data?.length === 0 && <EmptyState>Chưa thiết lập mốc chi tiêu.</EmptyState>}
    {milestones.data?.map((item) => <details key={item.id} className="space-y-2 border-t py-3">
      <summary>{money(item.milestoneAmount)} · {item.voucher.name} · {item.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}</summary>
      <MilestoneForm key={item.version} milestone={item} refresh={milestones.reload} />
    </details>)}
  </Section>
}

export function OwnerPromotions({ location, refreshLocation }) {
  const campaigns = useResource(loadCampaigns)
  return <>
    <Campaigns campaigns={campaigns} />
    <BatchOffers vouchers={campaigns.data ?? []} />
    <Section title="Điểm thưởng">
      <ActionForm label="Lưu tỷ lệ tích điểm" action={(form) => api.patch('/owner/locations/' + location.id, {
        pointEarningRate: Number(form.pointEarningRate),
      })} after={refreshLocation}>
        <Field label="VND để tích 1 điểm" name="pointEarningRate" type="number" min={1000} max={100000} defaultValue={location.pointEarningRate ?? 10000} required />
      </ActionForm>
    </Section>
    <PointGrantForm locationId={location.id} />
    <Milestones />
  </>
}

export function AdminVouchers() {
  const vouchers = useResource(loadAdminVouchers)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const search = query.trim().toLocaleLowerCase('vi-VN')
  const visible = vouchers.data?.filter((item) => (!status || item.status === status) && (!search ||
    [item.name, item.code, item.locationId].some((value) => String(value ?? '').toLocaleLowerCase('vi-VN').includes(search))))
  return <Section title="Kiểm duyệt voucher" resource={vouchers}>
    <div className="cw-columns">
      <Field label="Tìm voucher" type="search" placeholder="Tên, mã hoặc ID địa điểm" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Field label="Trạng thái" options={[[ '', 'Tất cả' ], ...Object.entries(voucherStatus)]}
        value={status} onChange={(event) => setStatus(event.target.value)} />
    </div>
    {visible?.length === 0 && <EmptyState>{vouchers.data?.length ? 'Không có voucher phù hợp.' : 'Chưa có voucher.'}</EmptyState>}
    {visible?.map((item) => <article className="cw-voucher" key={item.id}>
      <VoucherDescription voucher={item} />
      <p>Địa điểm #{item.locationId} · {item.targetGroup} · {item.validFrom || '—'} đến {item.validTo || '—'}</p>
      {item.status === 'PUBLISHED' && <ActionForm label="Vô hiệu hóa voucher" tone="danger" confirmation="Vô hiệu hóa voucher này?"
        action={() => api.post('/admin/vouchers/' + item.id + '/disable')} after={vouchers.reload} />}
    </article>)}
  </Section>
}
