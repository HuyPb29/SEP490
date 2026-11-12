import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage } from '../../api'
import { getSelectedLocation } from '../../api/session'
import styles from './OwnerReportPage.module.css'

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export default function OwnerReconciliationPage({ locationId = getSelectedLocation() }) {
  return <ReconciliationResults key={locationId} locationId={locationId} />
}

function ReconciliationResults({ locationId }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  const validDates = !from || !to || from <= to
  const request = [locationId, from, to, page, revision].join(':')

  useEffect(() => {
    if (!locationId || !validDates) return undefined
    const controller = new AbortController()
    api.get('/owner/reconciliations', {
      params: { from: from || undefined, to: to || undefined, page, size: 20 },
      headers: { 'X-Location-Id': locationId },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ request, data: data.data })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ request, error: apiErrorMessage(error, 'Không tải được kết quả đối soát.') })
    })
    return () => controller.abort()
  }, [locationId, from, to, page, request, validDates])

  const current = result?.request === request ? result : null
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link to="/owner/reports" className="underline">Về báo cáo doanh thu</Link>
      <h1 className={styles.heading}>Kết quả đối soát doanh thu</h1>
      <div className="my-4 flex flex-wrap gap-4">
        <label>Từ ngày <input className={styles.dateInput} type="date" value={from}
          onChange={(event) => { setFrom(event.target.value); setPage(0); setRevision((value) => value + 1) }} /></label>
        <label>Đến ngày <input className={styles.dateInput} type="date" value={to}
          onChange={(event) => { setTo(event.target.value); setPage(0); setRevision((value) => value + 1) }} /></label>
      </div>
      {!validDates && <p role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {validDates && !current && <p role="status">Đang tải kết quả đối soát…</p>}
      {current?.error && <p role="alert">{current.error}{' '}
        <button type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
      </p>}
      {current?.data?.content.length === 0 && <p role="status">Chưa có kết quả đối soát trong khoảng ngày này.</p>}
      {current?.data?.content.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left">
            <thead><tr>
              {['Ngày', 'Số tiền hệ thống', 'Tổng thực nhận', 'Chênh lệch', 'Lý do', 'Nhân viên'].map((label) =>
                <th className="px-4 py-3" key={label} scope="col">{label}</th>)}
            </tr></thead>
            <tbody>
              {current.data.content.map((row) => (
                <tr className="border-t border-slate-200" key={row.id}>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{currency.format(row.systemAmount)}</td>
                  <td className="px-4 py-3">{currency.format(row.actualAmount)}</td>
                  <td className="px-4 py-3">{currency.format(row.difference)}</td>
                  <td className="px-4 py-3">{row.reason || '—'}</td>
                  <td className="px-4 py-3">{row.staffName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {current?.data?.totalPages > 1 && <nav aria-label="Phân trang đối soát" className="mt-4 flex gap-4">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</button>
        <span>Trang {page + 1}/{current.data.totalPages}</span>
        <button type="button" disabled={page + 1 >= current.data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
      </nav>}
    </main>
  )
}
