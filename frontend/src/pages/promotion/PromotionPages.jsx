import { useCallback, useState } from 'react'
import api, { getAllPages } from '../../api'
import WorkspaceLayout, { ActionForm, Field, Section } from '../WorkspaceLayout'
import { money, today, useResource } from '../workspaceSupport'

const loadPersonalVouchers = (signal) => getAllPages('/me/vouchers', { signal })
const loadBalances = (signal) => getAllPages('/me/loyalty-balances', { signal })
const loadCampaigns = (signal) => getAllPages('/owner/vouchers', { signal })
const loadBatchOffers = (signal) => api.get('/owner/batch-offers', { signal }).then((response) => response.data.data)
const loadAdminVouchers = (signal) => getAllPages('/admin/vouchers', { signal })
const loadMilestones = (signal) => api.get('/owner/loyalty-milestones', { signal }).then((response) => response.data.data)
const optionalNumber = (value) => value === '' || value == null ? null : Number(value)

function VoucherDescription({ voucher }) {
  return <p>{voucher.name} · {voucher.discountType === 'PERCENT' ? voucher.discountValue + '%' : money(voucher.discountValue)}
    {voucher.code && ' · ' + voucher.code}{voucher.status && ' · ' + voucher.status}</p>
}

function PersonalRewards() {
  const vouchers = useResource(loadPersonalVouchers)
  const balances = useResource(loadBalances)
  const [location, setLocation] = useState('')
  const loadHistory = useCallback((signal) => getAllPages('/me/loyalty-transactions', {
    signal, params: { locationId: location || undefined },
  }), [location])
  const history = useResource(loadHistory, location)
  const locationNames = useResource(useCallback(async (signal) => {
    const { data } = await api.get('/locations', { signal, params: { size: 50 } })
    return data.data.content
  }, []))
  const name = (id) => locationNames.data?.find((item) => item.id === id)?.name || 'Địa điểm #' + id

  return <>
    <Section title="Voucher của tôi" resource={vouchers}>
      {vouchers.data?.length === 0 && <p>Chưa có voucher.</p>}
      {vouchers.data?.map((entry) => <article key={entry.grantId} className="border-t py-2">
        <VoucherDescription voucher={entry.voucher} />
        <p>{name(entry.voucher.locationId)} · {entry.grantStatus} · Hạn dùng {entry.expiresAt || entry.voucher.validTo || '—'}</p>
      </article>)}
    </Section>
    <Section title="Điểm của tôi" resource={balances}>
      {balances.data?.length === 0 && <p>Chưa có điểm.</p>}
      {balances.data?.map((item) => <p key={item.id}>{name(item.locationId)} · {item.pointBalance} điểm · Chi tiêu tích lũy {money(item.totalPaid)}</p>)}
    </Section>
    <Section title="Lịch sử điểm" resource={history}>
      <Field label="Địa điểm" value={location} onChange={(event) => setLocation(event.target.value)}
        options={[[ '', 'Tất cả' ], ...(balances.data ?? []).map((item) => [item.locationId, name(item.locationId)])]} />
      {history.data?.length === 0 && <p>Chưa có giao dịch điểm.</p>}
      {history.data?.map((item) => <p className="border-t py-2" key={item.id}>
        {item.createdAt} · {item.type} · {item.points} điểm · Số dư {item.balanceAfter}
        {item.earningRate && ' · Tỷ lệ ' + money(item.earningRate) + '/điểm'}
        {item.reason && ' · ' + item.reason}
      </p>)}
    </Section>
  </>
}

export function PersonalRewardsPage() {
  return <WorkspaceLayout title="Ưu đãi của tôi" role="player"><PersonalRewards /></WorkspaceLayout>
}

function VoucherForm({ voucher, refresh }) {
  const [target, setTarget] = useState(voucher?.targetGroup || 'ALL_PLAYERS')
  const campaignPath = '/owner/vouchers'
  return <ActionForm label={voucher ? 'Lưu voucher' : 'Tạo bản nháp'} after={refresh} action={(form) => {
    const payload = {
      ...form, code: form.code?.trim() || null, discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount), grantValidDays: optionalNumber(form.grantValidDays),
      maxUsesPerPlayer: optionalNumber(form.maxUsesPerPlayer), maxTotalUses: optionalNumber(form.maxTotalUses),
      budget: optionalNumber(form.budget),
    }
    return voucher
      ? api.patch(campaignPath + '/' + voucher.id, { version: voucher.version, voucher: payload })
      : api.post(campaignPath, payload)
  }}>
    <Field label="Tên voucher" name="name" defaultValue={voucher?.name} maxLength={100} required />
    <Field label="Đối tượng" name="targetGroup" value={target} onChange={(event) => setTarget(event.target.value)} options={[
      ['ALL_PLAYERS', 'Tất cả Player'], ['NEW_PLAYERS', 'Player mới'], ['SPECIFIED', 'Player chỉ định'],
    ]} />
    {target !== 'SPECIFIED' && <Field label="Mã voucher" name="code" defaultValue={voucher?.code || ''} maxLength={20} required />}
    <Field label="Kiểu giảm" name="discountType" defaultValue={voucher?.discountType} options={[[ 'AMOUNT', 'Số tiền (VND)' ], [ 'PERCENT', 'Phần trăm' ]]} />
    <Field label="Mức giảm" name="discountValue" type="number" min={1} defaultValue={voucher?.discountValue} required />
    <Field label="Đơn tối thiểu (VND)" name="minOrderAmount" type="number" min={0} defaultValue={voucher?.minOrderAmount ?? 0} required />
    <Field label="Từ ngày" name="validFrom" type="date" defaultValue={voucher?.validFrom ?? today()} required />
    <Field label="Đến ngày" name="validTo" type="date" defaultValue={voucher?.validTo} required />
    {target === 'SPECIFIED' && <Field label="Hạn voucher cá nhân (ngày)" name="grantValidDays" type="number" min={1} max={3650} defaultValue={voucher?.grantValidDays} />}
    <Field label="Lượt mỗi người" name="maxUsesPerPlayer" type="number" min={1} defaultValue={voucher?.maxUsesPerPlayer} />
    <Field label="Tổng lượt" name="maxTotalUses" type="number" min={1} defaultValue={voucher?.maxTotalUses} />
    <Field label="Ngân sách (VND)" name="budget" type="number" min={1} defaultValue={voucher?.budget} />
  </ActionForm>
}

function Campaigns({ campaigns }) {
  return <Section title="Chiến dịch voucher" resource={campaigns}>
    <VoucherForm refresh={campaigns.reload} />
    {campaigns.data?.length === 0 && <p>Chưa có chiến dịch.</p>}
    {campaigns.data?.map((item) => <details className="space-y-3 border-t py-3" key={item.id}>
      <summary>{item.name} · {item.status}</summary>
      <VoucherDescription voucher={item} />
      <p>{item.targetGroup} · {item.validFrom} đến {item.validTo} · Đã dùng {item.usedCount} lượt</p>
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
  const eligible = vouchers.filter((voucher) => voucher.status === 'PUBLISHED')
  return <div id="batch-offers"><Section title="Ưu đãi đặt theo lô" resource={offers}>
    {eligible.length ? <BatchOfferForm eligible={eligible} refresh={offers.reload} /> :
      <p>Phát hành voucher trước khi tạo ưu đãi cho gói.</p>}
    {offers.data?.length === 0 && <p>Chưa có ưu đãi đặt theo lô.</p>}
    {offers.data?.map((offer) => <details key={offer.id} className="space-y-3 border-t py-3">
      <summary>{offer.name} · {offer.active ? 'Trong thời gian áp dụng' : 'Ngoài thời gian áp dụng'}</summary>
      <p>Gói thực trả từ {money(offer.minPackageAmount)} · Voucher {offer.voucherName || '—'} · {offer.startDate} – {offer.endDate}</p>
      {eligible.length > 0 && <BatchOfferForm offer={offer} eligible={eligible} refresh={offers.reload} />}
      <ActionForm label="Xóa ưu đãi" confirmation="Xóa ưu đãi đặt theo lô này?"
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
    <MilestoneForm refresh={milestones.reload} />
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
      <ActionForm label="Cộng điểm bồi hoàn" action={(form) => api.post('/owner/loyalty-adjustments', {
        ...form, bookingId: Number(form.bookingId), points: Number(form.points),
      })}>
        <Field label="ID booking của Player" name="bookingId" type="number" min={1} required />
        <Field label="Điểm cộng" name="points" type="number" min={1} required />
        <Field label="Lý do" name="reason" maxLength={255} required />
      </ActionForm>
    </Section>
    <Milestones />
  </>
}

export function AdminVouchers() {
  const vouchers = useResource(loadAdminVouchers)
  return <Section title="Kiểm duyệt voucher" resource={vouchers}>
    {vouchers.data?.length === 0 && <p>Chưa có voucher.</p>}
    {vouchers.data?.map((item) => <article className="space-y-2 border-t py-2" key={item.id}>
      <VoucherDescription voucher={item} />
      <p>Địa điểm #{item.locationId} · {item.targetGroup} · {item.validFrom || '—'} đến {item.validTo || '—'}</p>
      {item.status === 'PUBLISHED' && <ActionForm label="Vô hiệu hóa voucher" confirmation="Vô hiệu hóa voucher này?"
        action={() => api.post('/admin/vouchers/' + item.id + '/disable')} after={vouchers.reload} />}
    </article>)}
  </Section>
}
