import { Button as UiButton } from '../../components/ui';
import { useState } from 'react'
import { usePointGrant } from '../../hooks/usePointGrant'
import { ActionForm, EmptyState, Field, Section } from '../WorkspaceLayout'
import { formatSlotTime } from '../workspaceSupport'
import { LoadingState, ErrorState } from '../../components/common/States'
import styles from './PromotionPages.module.css'

const initialSearch = { q: '', page: 0 }

function Lookup({ title, label, search, onSearch, resource, empty, searchInput, children }) {
  return <div className={styles.grantLookup} role="group" aria-label={title}>
    <Field label={label} type="search" maxLength={100} value={search.q}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      onChange={(event) => onSearch({ q: event.target.value, page: 0 })} {...searchInput} />
    {resource?.loading && <LoadingState />}
    {resource?.error && <ErrorState message={resource.error} onRetry={resource.reload} />}
    {resource?.data?.content.length === 0 && <EmptyState>{empty}</EmptyState>}
    {resource?.data?.totalPages > 1 && <div className="flex flex-wrap items-center gap-2">
      <UiButton variant="secondary" className="cw-secondary" type="button" disabled={search.page === 0}
        onClick={() => onSearch({ ...search, page: search.page - 1 })}>Trang trước</UiButton>
      <span>Trang {search.page + 1}/{resource.data.totalPages}</span>
      <UiButton variant="secondary" className="cw-secondary" type="button" disabled={search.page + 1 >= resource.data.totalPages}
        onClick={() => onSearch({ ...search, page: search.page + 1 })}>Trang sau</UiButton>
    </div>}
    {children}
  </div>
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

  const playerOptions = players?.data?.content.map((item) => [item.id, `${item.fullName} · ${item.username}`]) ?? []
  const bookingOptions = bookings.data?.content.map((item) => [item.id,
    `${item.bookingCode} · ${item.playDate} · ${formatSlotTime(item.startMinute)}–${formatSlotTime(item.endMinute)}`,
  ]) ?? []

  return <Section title="Cộng điểm bồi hoàn">
    <div className={styles.pointGrant}>
    <ActionForm label="Cộng điểm" successMessage="Đã cộng điểm bồi hoàn."
      action={(form) => grant({
        playerId: Number(form.playerId), bookingId: Number(form.bookingId),
        points: Number(form.points), reason: form.reason.trim(),
      })} after={() => selectPlayer('')}>
      {(errors) => <>
        <div className={styles.grantLookups}>
        <Lookup title="Người nhận" label="Tìm theo họ tên hoặc tên đăng nhập"
          search={playerSearch} onSearch={(search) => { setPlayerSearch(search); selectPlayer('') }}
          searchInput={{ name: 'playerQuery', required: true, pattern: '.*\\S.*', error: errors.playerQuery }}
          resource={players} empty="Không tìm thấy người chơi phù hợp tại địa điểm này.">
          {players && <Field label="Người chơi nhận điểm" name="playerId" required value={playerId}
            onChange={(event) => selectPlayer(event.target.value)}
            options={[[ '', 'Chọn người chơi' ], ...playerOptions]} error={errors.playerId} />}
        </Lookup>
        {playerId && <Lookup title="Lịch đặt sân" label="Tìm theo mã đặt sân"
          search={bookingSearch} onSearch={(search) => { setBookingSearch(search); setBookingId('') }}
          resource={bookings} empty="Không có lịch đặt sân phù hợp cho người chơi này.">
          <Field label="Lịch đặt sân liên quan" name="bookingId" required value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            options={[[ '', 'Chọn lịch đặt sân' ], ...bookingOptions]} error={errors.bookingId} />
        </Lookup>}
        </div>
        <Field label="Điểm cộng" name="points" type="number" min={1} max={2147483647} required error={errors.points} />
        <Field label="Lý do" name="reason" maxLength={255} required error={errors.reason} />
      </>}
    </ActionForm>
    </div>
  </Section>
}
