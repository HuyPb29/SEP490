import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../api';
import { getSelectedLocation } from '../../api/session';
import ManagementLayout from '../../components/layout/ManagementLayout';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Pagination,
  StatusBadge,
  Table,
} from '../../components/common';
import { formatVnd, shortDate } from '../../utils/formatters';
import styles from './OwnerReportPage.module.css';

const vnd = (value) => formatVnd(value).replace(' đồng', 'đ');

export default function OwnerReconciliationPage({ locationId = getSelectedLocation() }) {
  return (
    <ManagementLayout
      role="owner"
      title="Đối soát doanh thu"
      subtitle="Biên bản đối soát cuối ngày của nhân viên: tổng hệ thống so với tiền thực nhận, chênh lệch và lý do."
      backTo={{ to: '/owner/reports', label: 'Về báo cáo' }}
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
  const rows = current?.data?.content ?? [];
  const mismatched = rows.filter((row) => Number(row.difference) !== 0).length;
  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
    setRevision((value) => value + 1);
  };

  if (!locationId) {
    return <EmptyState title="Chưa chọn địa điểm" description="Chọn địa điểm ở thanh bên trái để xem đối soát." />;
  }

  return (
    <div className={styles.page}>
      <section className={styles.filterBar} aria-label="Lọc theo ngày">
        <div className={styles.dateFields}>
          <FormField label="Từ ngày">
            <Input type="date" value={from} max={to || undefined} onChange={changeFilter(setFrom)} />
          </FormField>
          <FormField label="Đến ngày" error={!validDates ? 'Ngày kết thúc phải sau ngày bắt đầu.' : undefined}>
            <Input type="date" value={to} min={from || undefined} onChange={changeFilter(setTo)} />
          </FormField>
        </div>
        {(from || to) && (
          <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setPage(0); setRevision((value) => value + 1); }}>
            Xóa bộ lọc
          </Button>
        )}
      </section>

      {validDates && !current && <LoadingState message="Đang tải kết quả đối soát…" />}
      {current?.error && <ErrorState message={current.error} onRetry={() => setRevision((value) => value + 1)} />}
      {current?.data && rows.length === 0 && (
        <EmptyState
          title="Chưa có biên bản đối soát"
          description={from || to
            ? 'Không có biên bản trong khoảng ngày này. Thử bỏ bớt điều kiện lọc.'
            : 'Nhân viên lập đối soát cuối ngày từ bảng điều hành; kết quả sẽ hiện ở đây.'}
        />
      )}
      {rows.length > 0 && (
        <section className={styles.card} aria-labelledby="reconciliation-title">
          <header className={styles.cardHeader}>
            <h2 id="reconciliation-title" className={styles.cardTitle}>Biên bản đối soát</h2>
            <span className={styles.cardHint}>
              {mismatched > 0 ? `${mismatched}/${rows.length} ngày có chênh lệch trên trang này` : 'Mọi ngày trên trang này đều khớp'}
            </span>
          </header>
          <Table>
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col" className={styles.numericHead}>Tổng hệ thống</th>
                <th scope="col" className={styles.numericHead}>Thực nhận</th>
                <th scope="col" className={styles.numericHead}>Chênh lệch</th>
                <th scope="col">Lý do</th>
                <th scope="col">Nhân viên</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const difference = Number(row.difference);
                return (
                  <tr key={row.id} className={difference !== 0 ? styles.rowMismatch : undefined}>
                    <td><strong>{shortDate(row.date)}</strong></td>
                    <td className={styles.numeric}>{vnd(row.systemAmount)}</td>
                    <td className={styles.numeric}>{vnd(row.actualAmount)}</td>
                    <td className={styles.numeric}>
                      <span className={styles.differenceCell}>
                        {difference > 0 ? '+' : ''}{vnd(difference)}
                        <StatusBadge tone={difference === 0 ? 'success' : 'danger'}>{difference === 0 ? 'Khớp' : 'Lệch'}</StatusBadge>
                      </span>
                    </td>
                    <td>{row.reason || '—'}</td>
                    <td>{row.staffName || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page + 1} totalPages={current.data.totalPages} onPageChange={(next) => setPage(next - 1)} />
        </section>
      )}
    </div>
  );
}
