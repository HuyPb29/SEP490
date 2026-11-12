import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage, getAllPages } from '../api'
import { useResource } from '../hooks/useResource'
import WorkspaceLayout from '../components/layout/WorkspaceLayout'
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, Pagination } from '../components/common'

const titles = {
  teams: 'Đội của tôi',
  reschedules: 'Lịch sử đổi lịch',
  reviews: 'Kiểm duyệt đánh giá',
}
const canHaveHistory = new Set(['CONFIRMED', 'IN_USE', 'COMPLETED', 'CANCELLED_BY_PLAYER', 'CANCELLED_BY_FACILITY'])

export default function NavigationPage({ kind }) {
  return <NavigationContent key={kind} kind={kind} />
}

function NavigationContent({ kind }) {
  const [page, setPage] = useState(0)
  const [target, setTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const load = useCallback(async (signal) => {
    if (kind === 'reschedules') {
      const bookings = await getAllPages('/me/bookings', { signal })
      return { content: bookings.filter(({ status }) => canHaveHistory.has(status)) }
    }
    if (kind === 'reviews') {
      const { data } = await api.get('/admin/reviews', { signal, params: { page, size: 20 } })
      return data.data
    }
    const { data } = await api.get('/me/teams', { signal })
    return { content: data.data }
  }, [kind, page])
  const resource = useResource(load, kind + ':' + page)
  const rows = resource.data?.content ?? []

  async function updateReview() {
    if (!target || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await api.patch('/admin/reviews/' + target.id, { hidden: !target.hidden })
      setTarget(null)
      resource.reload()
    } catch (error) {
      setSaveError(apiErrorMessage(error, 'Không thể cập nhật đánh giá.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspaceLayout title={titles[kind]} role={kind === 'reviews' ? 'admin' : 'player'}>
      {kind === 'reschedules' && <p className="mb-3">Chọn một booking để xem các yêu cầu đổi lịch của booking đó.</p>}
      {resource.loading ? <LoadingState /> : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.reload} />
      ) : rows.length === 0 ? <EmptyState title="Chưa có dữ liệu." /> : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li className="rounded-lg border border-slate-200 bg-white p-4" key={row.id}>
              {kind === 'teams' && <><strong>{row.name}</strong>
                <p>{row.memberCount} thành viên · {row.captain ? 'Bạn là đội trưởng' : 'Đội trưởng ' + row.captainName}</p></>}
              {kind === 'reschedules' && (
                <Link className="underline" to={'/my-bookings/' + row.id + '/reschedules'}>
                  {row.bookingCode} · {row.locationName} · {row.playDate}
                </Link>
              )}
              {kind === 'reviews' && <>
                <p><strong>{row.rating}/5</strong> · {row.hidden ? 'Đã ẩn' : 'Đang hiển thị'}</p>
                <p className="my-2 break-words">{row.comment || 'Không có nhận xét.'}</p>
                <Button variant="secondary" onClick={() => { setSaveError(''); setTarget(row) }}>
                  {row.hidden ? 'Hiện lại đánh giá' : 'Ẩn đánh giá'}
                </Button>
              </>}
            </li>
          ))}
        </ul>
      )}
      {resource.data?.totalPages > 1 && (
        <Pagination page={page + 1} totalPages={resource.data.totalPages} onPageChange={(next) => setPage(next - 1)} />
      )}
      {target && (
        <ConfirmDialog title={target.hidden ? 'Hiện lại đánh giá' : 'Ẩn đánh giá'}
          busy={saving} onClose={() => setTarget(null)} onConfirm={updateReview}>
          <p>Xác nhận thay đổi trạng thái hiển thị của đánh giá này?</p>
          {saveError && <p role="alert">{saveError}</p>}
        </ConfirmDialog>
      )}
    </WorkspaceLayout>
  )
}
