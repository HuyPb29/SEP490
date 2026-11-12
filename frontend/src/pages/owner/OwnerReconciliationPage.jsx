import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../api';
import { getSelectedLocation } from '../../api/session';
import ManagementLayout from '../../components/layout/ManagementLayout';
import { formatVnd } from '../../utils/formatters';
import styles from './OwnerReportPage.module.css';

const currency = { format: formatVnd };

export default function OwnerReconciliationPage({ locationId = getSelectedLocation() }) {
  return (
    <ManagementLayout
      role="owner"
      title="Kết quả đối soát doanh thu"
      subtitle="Theo dõi biên bản đối soát doanh thu ca của nhân viên"
      backTo="/owner/reports"
    >
      <ReconciliationResults key={locationId} locationId={locationId} />
    </ManagementLayout>
  );
}

function ReconciliationResults({ locationId }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const validDates = !from || !to || from <= to;
  const request = [locationId, from, to, page, revision].join(':');

  useEffect(() => {
    if (!locationId || !validDates) return undefined;
    const controller = new AbortController();
    api.get('/owner/reconciliations', {
      params: { from: from || undefined, to: to || undefined, page, size: 20 },
      headers: { 'X-Location-Id': locationId },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ request, data: data.data });
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ request, error: apiErrorMessage(error, 'Không tải được kết quả đối soát.') });
    });
    return () => controller.abort();
  }, [locationId, from, to, page, request, validDates]);

  const current = result?.request === request ? result : null;
  return (
    <div className="space-y-4">
      <div className="my-4 flex flex-wrap gap-4 items-center">
        <label className="text-sm font-medium text-slate-700">Từ ngày <input className={styles.dateInput} type="date" value={from}
          onChange={(event) => { setFrom(event.target.value); setPage(0); setRevision((value) => value + 1); }} /></label>
        <label className="text-sm font-medium text-slate-700">Đến ngày <input className={styles.dateInput} type="date" value={to}
          onChange={(event) => { setTo(event.target.value); setPage(0); setRevision((value) => value + 1); }} /></label>
      </div>
      {!validDates && <p role="alert" className="text-sm text-rose-600">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {validDates && !current && <p role="status" className="text-sm text-slate-500">Đang tải kết quả đối soát…</p>}
      {current?.error && <p role="alert" className="text-sm text-rose-600">{current.error}{' '}
        <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Thử lại</button>
      </p>}
      {current?.data?.content.length === 0 && <p role="status" className="text-sm text-slate-500">Chưa có kết quả đối soát trong khoảng ngày này.</p>}
      {current?.data?.content.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr>
              {['Ngày', 'Số tiền hệ thống', 'Tổng thực nhận', 'Chênh lệch', 'Lý do', 'Nhân viên'].map((label) =>
                <th className="px-4 py-3 font-semibold text-slate-700" key={label} scope="col">{label}</th>)}
            </tr></thead>
            <tbody>
              {current.data.content.map((row) => (
                <tr className="border-t border-slate-200 hover:bg-slate-50" key={row.id}>
                  <td className="px-4 py-3 text-slate-900">{row.date}</td>
                  <td className="px-4 py-3">{currency.format(row.systemAmount)}</td>
                  <td className="px-4 py-3">{currency.format(row.actualAmount)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: row.difference === 0 ? '#16a34a' : '#e11d48' }}>
                    {currency.format(row.difference)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.reason || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.staffName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {current?.data?.totalPages > 1 && <nav aria-label="Phân trang đối soát" className="mt-4 flex gap-4 text-sm items-center">
        <button type="button" className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-50" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</button>
        <span>Trang {page + 1}/{current.data.totalPages}</span>
        <button type="button" className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-50" disabled={page + 1 >= current.data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
      </nav>}
    </div>
  );
}
