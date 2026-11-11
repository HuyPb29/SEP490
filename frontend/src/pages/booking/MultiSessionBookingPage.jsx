import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createBookingPackageApi, getCheckoutVouchers, getLocationCourtsApi, getMyOwnedTeams, getPublicBatchOffers,
  getMyPointsAtFacility, previewBookingPackageApi,
} from '../../api/bookingApi'
import WorkspaceLayout, { Field, Section } from '../WorkspaceLayout'
import { errorMessage, money, today } from '../workspaceSupport'

const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']
const formatTime = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')
const timeChoices = Array.from({ length: 49 }, (_, index) => [index * 30, formatTime(index * 30)])
const emptySession = () => ({ date: today(), courtId: '', startMinute: 1080, endMinute: 1140 })
const sessionRequest = ({ date, courtId, startMinute, endMinute }) =>
  ({ date, courtId: courtId ? Number(courtId) : null, startMinute: Number(startMinute), endMinute: Number(endMinute) })

function Times({ session, update }) {
  return <>
    <Field label="Bắt đầu" options={timeChoices.slice(0, -1)} value={session.startMinute}
      onChange={(event) => update({ startMinute: Number(event.target.value) })} />
    <Field label="Kết thúc" options={timeChoices.slice(1)} value={session.endMinute}
      onChange={(event) => update({ endMinute: Number(event.target.value) })} />
  </>
}

function PackageEditor({ locationId }) {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState(null)
  const [courtId, setCourtId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [type, setType] = useState('RECURRING')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState('')
  const [weekly, setWeekly] = useState([{ dayOfWeek: 1, startMinute: 1080, endMinute: 1140 }])
  const [custom, setCustom] = useState(() => [emptySession(), emptySession()])
  const [resolved, setResolved] = useState(null)
  const [voucher, setVoucher] = useState('')
  const [grant, setGrant] = useState('')
  const [points, setPoints] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    Promise.all([
      getLocationCourtsApi(locationId), getMyOwnedTeams(),
      getCheckoutVouchers(Number(locationId)), getMyPointsAtFacility(Number(locationId)),
      getPublicBatchOffers(locationId, controller.signal).catch(() => []),
    ]).then(([courts, teams, vouchers, balance, offers]) => {
      if (!active) return
      setCatalog({ courts, teams, vouchers, balance, offers })
      setCourtId(String(courts[0]?.id ?? ''))
    }).catch((failure) => { if (active) setError(errorMessage(failure)) })
    return () => { active = false; controller.abort() }
  }, [locationId])

  function updateBase(setter, value) {
    setter(value)
    setPreview(null)
    setResolved(null)
  }

  const courts = catalog?.courts.map((court) => [court.id, court.name]) ?? []
  const sessions = resolved ?? (type === 'CUSTOM' ? custom : null)
  const requestedPoints = Number(points)
  const pointsValid = Number.isInteger(requestedPoints) &&
    (requestedPoints === 0 || (requestedPoints >= 2 && requestedPoints <= (catalog?.balance ?? 0)))
  const payload = {
    packageType: type, courtId: Number(courtId), teamId: teamId ? Number(teamId) : null,
    startDate: type === 'RECURRING' ? from : null, endDate: type === 'RECURRING' ? to : null,
    weeklySlots: type === 'RECURRING' ? weekly : null, sessions: sessions?.map(sessionRequest) ?? null,
    voucherCode: voucher.trim().toUpperCase() || null, voucherGrantId: grant ? Number(grant) : null,
    pointsToUse: requestedPoints,
  }

  async function send(create = false) {
    if (busy || !courtId || !pointsValid) return
    setBusy(true)
    setError('')
    try {
      if (create) {
        const refreshed = await previewBookingPackageApi(payload)
        if (refreshed.conflictSessions || refreshed.finalAmount !== preview.finalAmount ||
          refreshed.voucherDiscount !== preview.voucherDiscount || refreshed.pointDiscount !== preview.pointDiscount) {
          setPreview(refreshed)
          setError('Lịch hoặc giá đã thay đổi. Kiểm tra lại trước khi xác nhận.')
          return
        }
        const bookingPackage = await createBookingPackageApi(payload)
        navigate('/booking/payment?packageId=' + bookingPackage.id)
      } else {
        setPreview(await previewBookingPackageApi(payload))
      }
    } catch (failure) {
      setPreview(null)
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  function editSchedule() {
    setResolved(preview.sessions.map(sessionRequest))
    setPreview(null)
  }

  function editSessions(next) {
    if (resolved) setResolved(next)
    else setCustom(next)
    setPreview(null)
  }

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); send() }}>
    {error && <p role="alert">{error}</p>}
    {!catalog && !error && <p role="status">Đang tải địa điểm…</p>}
    {catalog && <fieldset disabled={busy} className="space-y-5">
      <Section title="Lịch đặt">
        <div className="flex flex-wrap gap-3">
          <Field label="Sân" options={courts} value={courtId} onChange={(event) => updateBase(setCourtId, event.target.value)} />
          <Field label="Loại gói" options={[[ 'RECURRING', 'Định kỳ' ], [ 'CUSTOM', 'Tự chọn' ]]}
            value={type} onChange={(event) => updateBase(setType, event.target.value)} />
          <Field label="Đặt cho" options={[[ '', 'Cá nhân' ], ...catalog.teams.map((team) => [team.id, team.name])]}
            value={teamId} onChange={(event) => { setTeamId(event.target.value); setPreview(null) }} />
        </div>
        {type === 'RECURRING' && <>
          <div className="flex gap-3">
            <Field label="Từ ngày" type="date" min={today()} value={from} required onChange={(event) => updateBase(setFrom, event.target.value)} />
            <Field label="Đến ngày" type="date" min={from} value={to} required onChange={(event) => updateBase(setTo, event.target.value)} />
          </div>
          {weekly.map((slot, index) => {
            const update = (patch) => updateBase(setWeekly, weekly.map((item, i) => i === index ? { ...item, ...patch } : item))
            return <div key={index} className="flex flex-wrap items-end gap-3">
              <Field label="Ngày trong tuần" options={weekdays.map((day, i) => [i + 1, day])} value={slot.dayOfWeek}
                onChange={(event) => update({ dayOfWeek: Number(event.target.value) })} />
              <Times session={slot} update={update} />
              <button type="button" disabled={weekly.length === 1} onClick={() =>
                updateBase(setWeekly, weekly.filter((_, i) => i !== index))}>Bỏ khung giờ</button>
            </div>
          })}
          <button type="button" className="underline" onClick={() =>
            updateBase(setWeekly, [...weekly, { dayOfWeek: 1, startMinute: 1080, endMinute: 1140 }])}>Thêm khung giờ mỗi tuần</button>
        </>}
        {sessions && <>
          {resolved && <h3 className="font-semibold">Lịch sau khi xử lý buổi trùng</h3>}
          {sessions.map((slot, index) => {
            const update = (patch) => editSessions(sessions.map((item, i) => i === index ? { ...item, ...patch } : item))
            return <div key={index} className="flex flex-wrap items-end gap-3">
              <Field label="Ngày chơi" type="date" min={today()} value={slot.date} required onChange={(event) => update({ date: event.target.value })} />
              <Field label="Sân" options={[[ '', 'Sân của gói' ], ...courts]} value={slot.courtId ?? ''}
                onChange={(event) => update({ courtId: event.target.value })} />
              <Times session={slot} update={update} />
              <button type="button" disabled={sessions.length <= 2} onClick={() => editSessions(sessions.filter((_, i) => i !== index))}>Bỏ buổi</button>
            </div>
          })}
          <button type="button" className="underline" onClick={() => editSessions([...sessions, emptySession()])}>Thêm buổi</button>
        </>}
      </Section>
      {catalog.offers.length > 0 && <Section title="Ưu đãi đặt theo lô">
        <ul className="space-y-2">{catalog.offers.map((offer) => <li key={offer.id}>
          <strong>{offer.name}</strong> · Gói thực trả từ {money(offer.minPackageAmount)} nhận {offer.voucherName}.
          <span className="block text-sm">{offer.startDate} – {offer.endDate}</span>
        </li>)}</ul>
      </Section>}
      <Section title="Ưu đãi cho cả gói">
        <div className="flex flex-wrap gap-3">
          <Field label="Mã voucher" list="package-vouchers" maxLength={20} value={voucher}
            onChange={(event) => { setVoucher(event.target.value); setGrant(''); setPreview(null) }} />
          <datalist id="package-vouchers">{catalog.vouchers.publicVouchers.map((item) =>
            <option key={item.id} value={item.code}>{item.name}</option>)}</datalist>
          <Field label="Voucher cá nhân" value={grant}
            options={[[ '', 'Không chọn' ], ...catalog.vouchers.grants.map((entry) => [entry.grantId, entry.voucher.name])]}
            onChange={(event) => { setGrant(event.target.value); setVoucher(''); setPreview(null) }} />
          <Field label={'Điểm dùng · số dư ' + catalog.balance} type="number" min={0} max={catalog.balance} value={points}
            onChange={(event) => { setPoints(event.target.value); setPreview(null) }} />
        </div>
        <p>500 đ/điểm, tối thiểu 2 điểm khi sử dụng, tối đa 50% giá còn lại sau voucher.</p>
        {!pointsValid && <p role="alert">Kiểm tra lại số điểm muốn dùng.</p>}
      </Section>
      <button className="action" type="submit" disabled={!courtId || !pointsValid}>{busy ? 'Đang xử lý…' : 'Xem lịch và giá'}</button>
      {preview && <Section title={preview.locationName + ' · ' + preview.totalSessions + ' buổi'}>
        <ul className="space-y-1">{preview.sessions.map((session, index) => <li key={index}>
          {session.date} · {session.courtName} · {session.startTime}–{session.endTime}
          {session.conflict && ' · Trùng lịch (' + session.conflict + ')'}
        </li>)}</ul>
        <p>Giá {money(preview.listAmount)} · Voucher −{money(preview.voucherDiscount)} · Điểm −{money(preview.pointDiscount)}</p>
        <p className="font-semibold">Cần thanh toán {money(preview.finalAmount)}</p>
        {preview.batchOffer && <p>{preview.batchOffer.reached
          ? 'Đủ điều kiện nhận ' + preview.batchOffer.voucherName
          : preview.batchOffer.message}</p>}
        {preview.conflictSessions > 0
          ? <button type="button" className="action" onClick={editSchedule}>Chọn buổi bù hoặc bỏ buổi trùng</button>
          : <button type="button" className="action" onClick={() => send(true)}>Xác nhận đặt gói và thanh toán</button>}
      </Section>}
    </fieldset>}
  </form>
}

export default function MultiSessionBookingPage() {
  const { id } = useParams()
  return <WorkspaceLayout title="Đặt sân nhiều buổi" role="player">
    {id ? <PackageEditor key={id} locationId={id} /> : <Link className="underline" to="/">Chọn địa điểm để đặt gói</Link>}
  </WorkspaceLayout>
}
