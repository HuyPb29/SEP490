import { Button as UiButton, Input as UiInput } from '../components/ui';
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage, getAllPages } from '../api'
import { useResource } from '../hooks/useResource'
import WorkspaceLayout from '../components/layout/WorkspaceLayout'
import AdminLayout from '../components/layout/AdminLayout'
import adminStyles from './account/AdminAccounts.module.css'
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, Pagination, Tabs } from '../components/common'

const titles = {
  reschedules: 'Lịch sử đổi lịch',
  reviews: 'Kiểm duyệt đánh giá',
}
const canHaveHistory = new Set(['CONFIRMED', 'IN_USE', 'COMPLETED', 'CANCELLED_BY_PLAYER', 'CANCELLED_BY_FACILITY'])

export default function NavigationPage({ kind }) {
  return kind === 'reviews' ? <AdminReviews /> : <NavigationContent key={kind} kind={kind} />
}

const REVIEW_TABS = [['all', 'Tất cả'], ['shown', 'Đang hiển thị'], ['hidden', 'Đã ẩn']]

function Stars({ rating }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0))
  return <span className={adminStyles.stars} aria-label={value + ' trên 5 sao'}>
    {'★'.repeat(value)}<span className={adminStyles.starsOff}>{'★'.repeat(5 - value)}</span>
  </span>
}

const formatReviewTime = (value) => (value ? value.replace('T', ' ').slice(0, 16) : '')

/** UC32 #3: Admin ẩn đánh giá vi phạm quy định nội dung; đánh giá bị ẩn hiện lại được (DR13). */
function AdminReviews() {
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const load = useCallback(async (signal) => {
    const { data } = await api.get('/admin/reviews', { signal, params: { page, size: 20 } })
    return data.data
  }, [page])
  const resource = useResource(load, 'reviews:' + page)
  const text = query.trim().toLowerCase()
  const rows = (resource.data?.content ?? [])
    .filter((row) => tab === 'all' || (tab === 'hidden') === Boolean(row.hidden))
    .filter((row) => !text || [row.comment, row.playerName, row.locationName, row.ownerReply].join(' ').toLowerCase().includes(text))

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
    <AdminLayout title="Kiểm duyệt đánh giá"
      subtitle="Ẩn đánh giá vi phạm quy định nội dung. Đánh giá bị ẩn hiện lại được; Player không sửa, xóa được đánh giá.">
      <section className={adminStyles.board} aria-label="Danh sách đánh giá">
        <Tabs label="Lọc theo hiển thị" value={tab} onChange={setTab}
          items={REVIEW_TABS.map(([value, label]) => ({ value, label }))}>
        <div className={adminStyles.toolbar}>
          <UiInput className={adminStyles.search} type="search" aria-label="Lọc đánh giá"
            placeholder="Lọc nhanh theo nội dung, người đánh giá, địa điểm (trên trang đang xem)"
            value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {resource.loading ? <LoadingState /> : resource.error ? (
          <ErrorState message={resource.error} onRetry={resource.reload} />
        ) : rows.length === 0 ? <p className={adminStyles.empty}>Không có đánh giá trong mục này.</p> : (
          <ul className={adminStyles.list}>
            {rows.map((row) => (
              <li key={row.id} className={`${adminStyles.review} ${row.hidden ? adminStyles.reviewHidden : ''}`}>
                <div>
                  <Stars rating={row.rating} />
                  <span className={adminStyles.reviewMeta}>
                    <b>{row.playerName || 'Người chơi'}</b>
                    {row.locationName ? ' · ' + row.locationName : ''}
                    {row.createdAt ? ' · ' + formatReviewTime(row.createdAt) : ''}
                    {row.bookingId ? ' · booking #' + row.bookingId : ''}
                  </span>
                  <p className={adminStyles.reviewText}>{row.comment || 'Không có nhận xét.'}</p>
                  {row.ownerReply && <p className={adminStyles.reply}><b>Chủ sân phản hồi:</b> {row.ownerReply}</p>}
                </div>
                <div className={adminStyles.reviewSide}>
                  <span className={`${adminStyles.badge} ${row.hidden ? adminStyles.badgeNeutral : adminStyles.badgeSuccess}`}>
                    {row.hidden ? 'Đã ẩn' : 'Đang hiển thị'}
                  </span>
                  <UiButton variant="custom" type="button" className={row.hidden ? adminStyles.view : adminStyles.dangerSmall}
                    onClick={() => { setSaveError(''); setTarget(row) }}>
                    {row.hidden ? 'Hiện lại' : 'Ẩn đánh giá'}
                  </UiButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        {resource.data?.totalElements != null && <p className={adminStyles.footNote}>Tổng {resource.data.totalElements} đánh giá</p>}
        </Tabs>
      </section>
      {resource.data?.totalPages > 1 && (
        <Pagination page={page + 1} totalPages={resource.data.totalPages} onPageChange={(next) => setPage(next - 1)} />
      )}
      {target && (
        <ConfirmDialog title={target.hidden ? 'Hiện lại đánh giá này?' : 'Ẩn đánh giá này?'}
          busy={saving} onClose={() => setTarget(null)} onConfirm={updateReview}>
          <p>{target.hidden
            ? 'Đánh giá sẽ hiện công khai trở lại.'
            : 'Chỉ ẩn đánh giá vi phạm quy định nội dung. Đánh giá bị ẩn không còn hiện công khai; bạn có thể hiện lại sau. (MSG82)'}</p>
          {saveError && <p role="alert">{saveError}</p>}
        </ConfirmDialog>
      )}
    </AdminLayout>
  )
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
    const { data } = await api.get('/admin/reviews', { signal, params: { page, size: 20 } })
    return data.data
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
      {kind === 'reschedules' && <p className="mb-3">Chọn một đặt sân để xem các yêu cầu đổi lịch của đặt sân đó.</p>}
      {resource.loading ? <LoadingState /> : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.reload} />
      ) : rows.length === 0 ? <EmptyState title="Chưa có dữ liệu." /> : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li className="rounded-lg border border-slate-200 bg-white p-4" key={row.id}>
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
