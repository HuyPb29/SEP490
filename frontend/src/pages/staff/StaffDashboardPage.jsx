import { ConfirmDialog } from '../../components/common/Modal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { apiErrorMessage, getAllPages } from '../../api';
import { getLocationCourtsApi } from '../../api/bookingApi';
import WalkInBookingDialog from './WalkInBookingDialog'
import ReconciliationDialog from './ReconciliationDialog';
import ManagementLayout from '../../components/layout/ManagementLayout';
import styles from './StaffDashboardPage.module.css';

const clock = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const STATES = {
  HOLDING: 'Đang giữ chỗ',
  CONFIRMED: 'Đã xác nhận',
  IN_USE: 'Đang chơi',
  COMPLETED: 'Đã hoàn tất',
  EXPIRED: 'Hết hạn',
  CANCELLED_BY_FACILITY: 'Địa điểm đã hủy',
  CANCELLED_BY_PLAYER: 'Khách đã hủy',
  PAYMENT_REJECTED: 'Thanh toán bị từ chối',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  RESUBMIT_REQUESTED: 'Chờ bổ sung',
};

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))} VND`;
const todayStr = () => new Date().toLocaleDateString('en-CA');

function parseLocalExpiry(holdExpiresAt) {
  if (!holdExpiresAt) return 0;
  return Date.parse(
    holdExpiresAt.includes('+') || holdExpiresAt.endsWith('Z')
      ? holdExpiresAt
      : `${holdExpiresAt}+07:00`
  );
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [dashboard, setDashboard] = useState(null);
  const [courts, setCourts] = useState([]);
  const [counterBookings, setCounterBookings] = useState([]);
  const [counterDate, setCounterDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Modal Đặt sân tại quầy (UC16)
  const [showCounterBooking, setShowCounterBooking] = useState(
    () => new URLSearchParams(location.search).get('modal') === 'counter'
  );
  const [counterCourt, setCounterCourt] = useState(null);

  // Modal Đối soát doanh thu cuối ngày (UC20)
  const [showReconciliation, setShowReconciliation] = useState(
    () => new URLSearchParams(location.search).get('modal') === 'reconciliation'
  );

  const loadAll = useCallback(async () => {
    try {
      const dashRes = await api.get('/staff/dashboards/me');
      const dashData = dashRes.data.data;
      setDashboard(dashData);
      setError('');

      if (dashData?.locationId) {
        const [courtList, counterList] = await Promise.all([
          getLocationCourtsApi(dashData.locationId).catch(() => []),
          getAllPages('/staff/bookings', { params: { date: counterDate } }).catch(() => []),
        ]);
        setCourts(courtList || []);
        setCounterBookings(counterList || []);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tải được dữ liệu bảng điều hành.'));
    } finally {
      setLoading(false);
    }
  }, [counterDate]);

  useEffect(() => {
    Promise.resolve().then(() => loadAll());
    const timer = setInterval(() => {
      setNow(Date.now());
      loadAll();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadAll]);

  // Đồng hồ đếm ngược mỗi giây cho các booking đang giữ chỗ 5 phút tại quầy (P02 / BR43)
  useEffect(() => {
    const hasHolding = counterBookings.some((item) => item.status === 'HOLDING' && item.holdExpiresAt);
    if (!hasHolding) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counterBookings]);

  const todayBookings = useMemo(() => dashboard?.todayBookings ?? [], [dashboard]);
  const pendingPayments = useMemo(() => dashboard?.pendingPayments ?? [], [dashboard]);
  const overduePayments = useMemo(() => pendingPayments.filter((p) => p.overdue), [pendingPayments]);

  const nowDate = useMemo(() => new Date(now), [now]);
  const nowMinute = nowDate.getHours() * 60 + nowDate.getMinutes();
  const dayStartMs = dashboard?.date ? Date.parse(`${dashboard.date}T00:00:00+07:00`) : 0;

  // Cảnh báo sân sắp hết giờ trong 5 phút (UC34 / P19)
  const endingBookings = useMemo(() => {
    return todayBookings.filter((booking) => {
      const remaining = dayStartMs + booking.endMinute * 60_000 - now;
      return booking.status === 'IN_USE' && remaining > 0 && remaining <= 5 * 60_000;
    });
  }, [todayBookings, dayStartMs, now]);

  // Tính trạng thái trực quan từng sân trên lưới Court Status (UC34)
  const courtTiles = useMemo(() => {
    if (dashboard?.courts?.length > 0) {
      return dashboard.courts.map((c) => {
        if (c.status === 'MAINTENANCE') {
          return {
            id: c.courtId,
            name: c.courtName,
            status: 'Bảo trì',
            detail: c.maintenanceUntil ? `Đến ${c.maintenanceUntil.replace('T', ' ')}` : 'Tạm ngưng phục vụ',
            type: 'maintenance',
          };
        }
        if (c.status === 'IN_USE') {
          return {
            id: c.courtId,
            name: c.courtName,
            status: 'Đang sử dụng',
            detail: `${c.untilMinute != null ? `Đến ${clock(c.untilMinute)}` : ''}${c.bookingCode ? ` · ${c.bookingCode}` : ''}`,
            type: 'inUse',
          };
        }
        if (c.status === 'HOLDING') {
          return {
            id: c.courtId,
            name: c.courtName,
            status: 'Đang giữ chỗ',
            detail: `${c.untilMinute != null ? `Đến ${clock(c.untilMinute)}` : ''}${c.bookingCode ? ` · ${c.bookingCode}` : ''}`,
            type: 'awaiting',
          };
        }
        return {
          id: c.courtId,
          name: c.courtName,
          status: 'Đang trống',
          detail: c.nextStartMinute != null ? `Ca kế: ${clock(c.nextStartMinute)}` : 'Nhấn để đặt tại quầy',
          type: 'available',
        };
      });
    }
    return courts.map((court) => {
      const cId = court.court_id ?? court.id;
      const cName = court.court_name ?? court.name;
      if (court.active === false || court.status === 'MAINTENANCE') {
        return {
          id: cId,
          name: cName,
          status: 'Bảo trì',
          detail: 'Tạm ngưng phục vụ',
          type: 'maintenance',
        };
      }
      const inUseBooking = todayBookings.find(
        (b) =>
          (b.courtId === cId || b.courtName === cName) &&
          (b.status === 'IN_USE' ||
            (b.status === 'CONFIRMED' && b.startMinute <= nowMinute && nowMinute < b.endMinute))
      );
      if (inUseBooking) {
        return {
          id: cId,
          name: cName,
          status: 'Đang sử dụng',
          detail: `Đến ${clock(inUseBooking.endMinute)} · ${inUseBooking.bookingCode}`,
          type: 'inUse',
        };
      }
      const holdingBooking = todayBookings.find(
        (b) =>
          (b.courtId === cId || b.courtName === cName) &&
          (b.status === 'HOLDING' || b.status === 'AWAITING_CONFIRMATION' || b.status === 'RESUBMIT_REQUESTED') &&
          b.endMinute > nowMinute
      );
      if (holdingBooking) {
        return {
          id: cId,
          name: cName,
          status: 'Đang giữ chỗ',
          detail: `${clock(holdingBooking.startMinute)}–${clock(holdingBooking.endMinute)}`,
          type: 'awaiting',
        };
      }
      const nextConfirmed = todayBookings
        .filter((b) => (b.courtId === cId || b.courtName === cName) && b.status === 'CONFIRMED' && b.startMinute > nowMinute)
        .sort((a, b) => a.startMinute - b.startMinute)[0];

      return {
        id: cId,
        name: cName,
        status: 'Đang trống',
        detail: nextConfirmed ? `Ca kế: ${clock(nextConfirmed.startMinute)}` : 'Nhấn để đặt tại quầy',
        type: 'available',
      };
    });
  }, [dashboard, courts, todayBookings, nowMinute]);

  const courtsInUseCount = courtTiles.filter((c) => c.type === 'inUse').length;
  const totalCourtsCount = courtTiles.length;
  const remainingBookingsCount = todayBookings.filter(
    (b) => b.endMinute > nowMinute && b.status !== 'EXPIRED' && !String(b.status).startsWith('CANCELLED')
  ).length;

  const statCards = [
    {
      label: 'Sân đang sử dụng',
      value: `${courtsInUseCount}/${totalCourtsCount}`,
      note: `${Math.max(0, totalCourtsCount - courtsInUseCount)} sân đang trống`,
    },
    {
      label: 'Lượt đặt hôm nay',
      value: String(todayBookings.length),
      note: `${remainingBookingsCount} lượt còn lại · ${dashboard?.complaintsToForward ?? 0} khiếu nại`,
    },
    {
      label: 'Chờ xác nhận TT',
      value: String(dashboard?.paymentsAwaitingConfirmation ?? pendingPayments.length),
      note: `${overduePayments.length} giao dịch chờ quá 15 phút`,
    },
    {
      label: 'Doanh thu hôm nay',
      value: formatMoney(dashboard?.todayRevenue ?? 0),
      note: 'Trước đối soát cuối ngày',
    },
  ];

  const openCounterBooking = (selectedCourtId) => {
    setCounterCourt(selectedCourtId);
    setShowCounterBooking(true);
  };

  const openPaymentConfirmation = (payment) => {
    if (!payment) {
      navigate('/staff/confirm-payments');
      return;
    }
    const idParam = payment.id ? `?paymentId=${encodeURIComponent(payment.id)}` : '';
    const typeParam = payment.reschedule ? `${idParam ? '&' : '?'}type=reschedule` : '';
    navigate(`/staff/confirm-payments${idParam}${typeParam}`);
  };

  const [counterPayment, setCounterPayment] = useState(null);
  const [confirmingCounter, setConfirmingCounter] = useState(false);
  const [counterPaymentError, setCounterPaymentError] = useState('');

  const handleConfirmCounterPayment = async () => {
    if (confirmingCounter || !counterPayment) return;
    const current = counterBookings.find((item) => item.id === counterPayment.id);
    if (!current || current.status !== 'HOLDING' || parseLocalExpiry(current.holdExpiresAt) <= Date.now()) {
      setCounterPaymentError('Đơn đã hết hạn hoặc đã được xử lý. Vui lòng tải lại danh sách.');
      return;
    }
    setConfirmingCounter(true);
    setCounterPaymentError('');
    try {
      await api.post('/staff/bookings/' + current.id + '/confirm');
      setCounterPayment(null);
      await loadAll();
    } catch (error) {
      setCounterPaymentError(apiErrorMessage(error, 'Không thể xác nhận thanh toán tại quầy.'));
      if (error.response?.status === 409) await loadAll();
    } finally {
      setConfirmingCounter(false);
    }
  };

  return (
    <ManagementLayout
      role="staff"
      title="Bảng điều hành nhân viên"
      subtitle={`${dashboard?.locationName ? `${dashboard.locationName} · ` : ''}Ngày ${dashboard?.date || todayStr()} · ${nowDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
          <button className={styles.primaryButton} type="button" onClick={() => openCounterBooking()}>
            + Đặt sân tại quầy
          </button>
        </div>
      }
      locationName={dashboard?.locationName}
      locationId={dashboard?.locationId}
      badges={{
        payments: dashboard?.paymentsAwaitingConfirmation ?? pendingPayments.length,
        complaints: Number(dashboard?.complaintsToForward) || 0,
      }}
      onOpenCounterBooking={() => openCounterBooking()}
      onOpenReconciliation={() => {
        setReconSuccess('');
        setShowReconciliation(true);
      }}
    >

        {error && (
          <div className={styles.urgentBanner} role="alert" style={{ marginBottom: 16 }}>
            <span>{error}</span>
            <button className={styles.handleButton} type="button" onClick={loadAll}>
              Thử lại
            </button>
          </div>
        )}

        <section className={styles.alerts} aria-label="Cảnh báo vận hành">
          {overduePayments.length > 0 && (
            <div className={styles.urgentBanner} role="alert">
              <span>
                Khẩn cấp: Có {overduePayments.length} giao dịch ({overduePayments[0]?.label || `#${overduePayments[0]?.id}`}) đã chờ xác nhận quá 15 phút trong giờ mở cửa!
              </span>
              <button
                className={styles.handleButton}
                type="button"
                onClick={() => openPaymentConfirmation(overduePayments[0])}
              >
                Xử lý ngay
              </button>
            </div>
          )}
          {endingBookings.length > 0 && (
            <div className={styles.warningBanner} role="status">
              Sắp hết giờ chơi trong 5 phút: {endingBookings.map((b) => `${b.courtName} (${b.bookingCode} · kết thúc ${clock(b.endMinute)})`).join(', ')}
            </div>
          )}
        </section>

        <section className={styles.statsGrid} aria-label="Thống kê trong ngày">
          {statCards.map((card) => (
            <article className={styles.statCard} key={card.label}>
              <h2 className={styles.statLabel}>{card.label}</h2>
              <p className={styles.statValue}>{card.value}</p>
              <p className={styles.statNote}>{card.note}</p>
            </article>
          ))}
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader} style={{ marginBottom: 12 }}>
              <h2 className={styles.panelTitle}>Trạng thái sân hiện tại</h2>
              {dashboard?.locationId && (
                <button
                  className={styles.viewAllButton}
                  type="button"
                  onClick={() => navigate(`/facilities/${dashboard.locationId}`)}
                >
                  Xem bảng lịch sân ›
                </button>
              )}
            </div>
            {courtTiles.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Chưa có dữ liệu sân hoạt động.</p>
            ) : (
              <div className={styles.courtGrid}>
                {courtTiles.map((court) =>
                  court.type === 'available' ? (
                    <button
                      className={`${styles.courtTile} ${styles[court.type]}`}
                      key={court.id}
                      type="button"
                      onClick={() => openCounterBooking(court.id)}
                    >
                      <strong>{court.name}</strong>
                      <span>{court.status}</span>
                      <small>{court.detail}</small>
                    </button>
                  ) : (
                    <div className={`${styles.courtTile} ${styles[court.type]}`} key={court.id}>
                      <strong>{court.name}</strong>
                      <span>{court.status}</span>
                      <small>{court.detail}</small>
                    </div>
                  )
                )}
              </div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Thanh toán chờ xác nhận (UC19)</h2>
              <button
                className={styles.viewAllButton}
                type="button"
                onClick={() => openPaymentConfirmation(pendingPayments[0])}
              >
                Mở bàn xác nhận ›
              </button>
            </div>
            <div className={styles.transactionList}>
              {pendingPayments.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13, margin: '14px 0 4px' }}>
                  Hiện không có giao dịch nào đang chờ xác nhận.
                </p>
              ) : (
                pendingPayments.map((payment) => (
                  <button
                    className={styles.transactionRow}
                    key={`${payment.reschedule ? 'rs' : 'bk'}-${payment.id}`}
                    type="button"
                    onClick={() => openPaymentConfirmation(payment)}
                  >
                    <span className={styles.transactionDetails}>
                      <strong>{payment.label || `Giao dịch #${payment.id}`}</strong>
                      <small>{payment.submittedAt ? `Gửi lúc ${payment.submittedAt.replace('T', ' ')}` : 'Đang chờ kiểm tra chứng từ'}</small>
                    </span>
                    <span className={styles.transactionAmount}>
                      <strong>{formatMoney(payment.amountDue)}</strong>
                      <small className={payment.overdue ? styles.overdueText : ''}>
                        {payment.overdue ? 'Quá hạn 15 phút!' : 'Chờ xác nhận'}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </article>
        </section>

        <section className={styles.contentGrid} style={{ marginTop: 16 }}>
          <article className={styles.panel}>
            <div className={styles.panelHeader} style={{ marginBottom: 10 }}>
              <h2 className={styles.panelTitle}>Đơn đặt sân tại quầy (UC16)</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={counterDate}
                  onChange={(e) => setCounterDate(e.target.value)}
                  style={{
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                  }}
                />
                <button className={styles.viewAllButton} type="button" onClick={() => openCounterBooking()}>
                  + Giữ chỗ mới
                </button>
              </div>
            </div>
            <div className={styles.transactionList}>
              {counterBookings.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0' }}>
                  Ngày {counterDate} chưa có lượt đặt sân tại quầy.
                </p>
              ) : (
                counterBookings.map((item) => {
                  const remainingMs =
                    item.status === 'HOLDING' && item.holdExpiresAt
                      ? parseLocalExpiry(item.holdExpiresAt) - now
                      : 0;
                  const expiredHold = item.status === 'HOLDING' && item.holdExpiresAt && remainingMs <= 0;

                  return (
                    <div
                      className={styles.transactionRow}
                      key={item.id}
                      style={{ cursor: 'default' }}
                    >
                      <span className={styles.transactionDetails}>
                        <strong>
                          {item.bookingCode} · {item.customerName}
                          {item.customerPhone ? ` (${item.customerPhone})` : ''}
                        </strong>
                        <small>
                          {item.courtName} · {item.startTime}–{item.endTime} · {formatMoney(item.finalAmount)}
                          {item.receiptNo ? ` · Biên nhận: ${item.receiptNo}` : ''}
                        </small>
                        {item.status === 'HOLDING' && item.holdExpiresAt && (
                          <small className={expiredHold ? styles.overdueText : ''} style={{ color: expiredHold ? '#b91c1c' : '#b45309', fontWeight: 700 }}>
                            {expiredHold
                              ? 'Đã hết thời gian giữ chỗ. Slot đã được nhả. (MSG33)'
                              : `Đang giữ chỗ 5 phút · Còn lại: ${formatRemaining(remainingMs)}`}
                          </small>
                        )}
                      </span>
                      <span className={styles.transactionAmount}>
                        {item.status === 'HOLDING' && item.holdExpiresAt && !expiredHold ? (
                          <button
                            type="button"
                            className={styles.primaryButton}
                            style={{ minHeight: 32, fontSize: 11.5, padding: '0 12px' }}
                            onClick={() => { setCounterPayment(item); setCounterPaymentError(''); }}
                          >
                            Xác nhận đã nhận tiền
                          </button>
                        ) : (
                          <strong style={{ color: item.status === 'CONFIRMED' ? '#15803d' : '#64748b' }}>
                            {expiredHold ? STATES.EXPIRED : (STATES[item.status] || item.status)}
                          </strong>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader} style={{ marginBottom: 10 }}>
              <h2 className={styles.panelTitle}>Lịch chơi trong ngày ({todayBookings.length})</h2>
              <button
                className={styles.viewAllButton}
                type="button"
                onClick={() => setShowReconciliation(true)}
              >
                Đối soát doanh thu ›
              </button>
            </div>
            <div className={styles.transactionList}>
              {todayBookings.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0' }}>
                  Hôm nay chưa có lịch chơi nào.
                </p>
              ) : (
                todayBookings.map((booking) => (
                  <div className={styles.transactionRow} key={booking.id} style={{ cursor: 'default' }}>
                    <span className={styles.transactionDetails}>
                      <strong>
                        {booking.courtName} · {clock(booking.startMinute)}–{clock(booking.endMinute)}
                      </strong>
                      <small>
                        {booking.bookingCode}
                        {booking.customerName ? ` · ${booking.customerName}` : ''}
                      </small>
                    </span>
                    <span className={styles.transactionAmount}>
                      <strong
                        style={{
                          color:
                            booking.status === 'IN_USE' || booking.status === 'CONFIRMED'
                              ? '#0d9651'
                              : '#475569',
                        }}
                      >
                        {STATES[booking.status] ?? booking.status}
                      </strong>
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

      {showCounterBooking && (
        <WalkInBookingDialog initialCourt={counterCourt} onClose={() => setShowCounterBooking(false)} onChanged={loadAll} />
      )}

      {counterPayment && (
        <ConfirmDialog title="Xác nhận đã nhận tiền" busy={confirmingCounter}
          onClose={() => setCounterPayment(null)} onConfirm={handleConfirmCounterPayment}>
          <p>Đã nhận đủ {formatMoney(counterPayment.finalAmount)} cho đơn {counterPayment.bookingCode}?</p>
          {counterPaymentError && <p role="alert">{counterPaymentError}</p>}
        </ConfirmDialog>
      )}

      {showReconciliation && <ReconciliationDialog onClose={() => setShowReconciliation(false)} />}
    </ManagementLayout>
  );
}
