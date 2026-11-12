import { useState } from 'react'
import { usePointGrant } from '../../hooks/usePointGrant'
import { ActionForm, EmptyState, Field, Section } from '../WorkspaceLayout'
import { formatSlotTime } from '../workspaceSupport'

const initialSearch = { q: '', page: 0 }

function Lookup({ title, label, search, onSearch, resource, empty, children }) {
  return <Section title={title} resource={resource}>
    <Field label={label} type="search" maxLength={100} value={search.q}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      onChange={(event) => onSearch({ q: event.target.value, page: 0 })} />
    {resource.data?.content.length === 0 && <EmptyState>{empty}</EmptyState>}
    {resource.data?.totalPages > 1 && <div className="flex flex-wrap items-center gap-2">
      <button className="cw-secondary" type="button" disabled={search.page === 0}
        onClick={() => onSearch({ ...search, page: search.page - 1 })}>Trang trước</button>
      <span>Trang {search.page + 1}/{resource.data.totalPages}</span>
      <button className="cw-secondary" type="button" disabled={search.page + 1 >= resource.data.totalPages}
        onClick={() => onSearch({ ...search, page: search.page + 1 })}>Trang sau</button>
    </div>}
    {children}
  </Section>
}

export default function PointGrantForm({ locationId }) {
  const [playerSearch, setPlayerSearch] = useState(initialSearch)
  const [bookingSearch, setBookingSearch] = useState(initialSearch)
  const [playerId, setPlayerId] = useState('')
  const [bookingId, setBookingId] = useState('')
  const { players, bookings, grant } = usePointGrant(locationId, playerId, playerSearch, bookingSearch)

  function selectPlayer(id) {
    setPlayerId(id)
    setBookingId('')
    setBookingSearch(initialSearch)
  }

  const playerOptions = players.data?.content.map((item) => [item.id, `${item.fullName} · ${item.username}`]) ?? []
  const bookingOptions = bookings.data?.content.map((item) => [item.id,
    `${item.bookingCode} · ${item.playDate} · ${formatSlotTime(item.startMinute)}–${formatSlotTime(item.endMinute)}`,
  ]) ?? []

  return <Section title="Cộng điểm bồi hoàn">
    <ActionForm label="Cộng điểm" successMessage="Đã cộng điểm bồi hoàn."
      action={(form) => grant({
        playerId: Number(form.playerId), bookingId: Number(form.bookingId),
        points: Number(form.points), reason: form.reason.trim(),
      })} after={() => selectPlayer('')}>
      {(errors) => <>
        <Lookup title="Người nhận" label="Tìm theo họ tên hoặc tên đăng nhập"
          search={playerSearch} onSearch={(search) => { setPlayerSearch(search); selectPlayer('') }}
          resource={players} empty="Không có Player phù hợp tại địa điểm này.">
          <Field label="Player nhận điểm" name="playerId" required value={playerId}
            onChange={(event) => selectPlayer(event.target.value)}
            options={[[ '', 'Chọn Player' ], ...playerOptions]} error={errors.playerId} />
        </Lookup>
        {playerId && <Lookup title="Lịch đặt sân" label="Tìm theo mã booking"
          search={bookingSearch} onSearch={(search) => { setBookingSearch(search); setBookingId('') }}
          resource={bookings} empty="Không có booking phù hợp cho Player này.">
          <Field label="Booking liên quan" name="bookingId" required value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            options={[[ '', 'Chọn booking' ], ...bookingOptions]} error={errors.bookingId} />
        </Lookup>}
        <Field label="Điểm cộng" name="points" type="number" min={1} max={2147483647} required error={errors.points} />
        <Field label="Lý do" name="reason" maxLength={255} required error={errors.reason} />
      </>}
    </ActionForm>
  </Section>
}
