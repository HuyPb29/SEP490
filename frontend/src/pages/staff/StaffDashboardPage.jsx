import { Button as UiButton, DatePicker as UiDatePicker } from '../../components/ui';
import { ConfirmDialog } from '../../components/common/Modal';
import { subscribeLiveRefresh } from '../../utils/liveRefresh';
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
  CANCELLED_BY_FACILITY: 'Sân hủy',
  CANCELLED_BY_PLAYER: 'Khách đã hủy',
  PAYMENT_REJECTED: 'Thanh toán bị từ chối',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  RESUBMIT_REQUESTED: 'Chờ bổ sung',
};

const COURT_BADGE = {
  inUse: 'Đang sử dụng',
  ending: 'Sắp hết giờ',
  awaiting: 'Đang giữ chỗ',
  available: 'Trống',
  maintenance: 'Bảo trì',
};

// UC34 #4: làm nổi sân còn dưới 5 phút là hết giờ chơi.
const ENDING_SOON_MS = 5 * 60_000;

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))} đ`;
const todayStr = () => new Date().toLocaleDateString('en-CA');
const hhmm = (date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// Giờ server (LocalDateTime, không có múi giờ) là giờ Việt Nam.
function parseServerTime(value) {
  if (!value) return 0;
  return Date.parse(value.includes('+') || value.endsWith('Z') ? value : `${value}+07:00`);
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function formatDay(dateStr) {
  const date = dateStr ? new Date(`${dateStr}T00:00:00+07:00`) : new Date();
  const text = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const [updatedAt, setUpdatedAt] = useState(null);

  // Modal Đặt sân tại quầy (UC16)
  const [showCounterBooking, setShowCounterBooking] = useState(
    () => new URLSearchParams(location.search).get('modal') === 'counter'
  );
  const [counterCourt, setCounterCourt] = useState(null);

  // Modal Đối soát doanh thu cuối ngày (UC20)
  const [showReconciliation, setShowReconciliation] = useState(
    () => new URLSearchParams(location.search).get('modal') === 'reconciliation'
  );

  const loadAll = useCallback(async (quiet = false) => {
    if (quiet !== true) setLoading(true);
    try {
      const dashRes = await api.get('/staff/dashboards/me');
      const dashData = dashRes.data.data;
      setDashboard(dashData);
      setError('');
      setUpdatedAt(new Date());

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
    return subscribeLiveRefresh(() => loadAll(true));
  }, [loadAll]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayBookings = useMemo(() => dashboard?.todayBookings ?? [], [dashboard]);
  const pendingPayments = useMemo(() => dashboard?.pendingPayments ?? [], [dashboard]);
  // D182 (BR58, FR120): chờ từ 10 phút (cảnh báo vận hành) trong giờ mở cửa thì báo đỏ, Staff vẫn xử lý được;
  // quá thêm 10 phút (P36) thì giao dịch đã chuyển cho chủ sân, Staff chỉ xem.
  const overdueMinutes = dashboard?.paymentOverdueMinutes ?? 10;
  const transferMinutes = dashboard?.paymentTransferMinutes ?? 25;
  const urgentPayments = useMemo(
    () => pendingPayments.filter((p) => p.overdue && !p.transferredToOwner), [pendingPayments]);
  const transferredPayments = useMemo(() => pendingPayments.filter((p) => p.transferredToOwner), [pendingPayments]);
  // Phụ thu đổi lịch (UC21) Staff còn xử lý được: hiện banner và nhãn riêng để không lẫn với thanh toán đặt sân.
  // Đổi lịch miễn phí không sinh giao dịch nên không xuất hiện ở đây.
  const surchargePayments = useMemo(
    () => pendingPayments.filter((p) => p.reschedule && !p.transferredToOwner), [pendingPayments]);

  const nowDate = useMemo(() => new Date(now), [now]);
  const nowMinute = nowDate.getHours() * 60 + nowDate.getMinutes();
  const dayStartMs = dashboard?.date ? Date.parse(`${dashboard.date}T00:00:00+07:00`) : 0;

  const bookingByCode = useMemo(
    () => new Map(todayBookings.map((booking) => [booking.bookingCode, booking])), [todayBookings]);

  // Trạng thái từng sân lúc này (UC34 #1). Ưu tiên dữ liệu sân của API bảng điều hành; tên khách lấy từ lịch hôm nay.
  const courtTiles = useMemo(() => {
    if (dashboard?.courts?.length > 0) {
      return dashboard.courts.map((c) => {
        const current = c.bookingCode ? bookingByCode.get(c.bookingCode) : null;
        const next = c.nextBookingCode ? bookingByCode.get(c.nextBookingCode) : null;
        if (c.status === 'MAINTENANCE') {
          return {
            id: c.courtId, name: c.courtName, type: 'maintenance',
            detail: c.maintenanceUntil ? `Đến ${c.maintenanceUntil.replace('T', ' ').slice(0, 16)}` : 'Tạm ngưng phục vụ',
          };
        }
        if (c.status === 'IN_USE' || c.status === 'HOLDING') {
          return {
            id: c.courtId, name: c.courtName, type: c.status === 'IN_USE' ? 'inUse' : 'awaiting',
            who: current?.customerName || c.bookingCode,
            startMinute: current?.startMinute, endMinute: c.untilMinute ?? current?.endMinute,
            bookingCode: c.bookingCode,
          };
        }
        return {
          id: c.courtId, name: c.courtName, type: 'available',
          detail: c.nextStartMinute != null
            ? `Booking tiếp: ${clock(c.nextStartMinute)}${next?.customerName ? ` · ${next.customerName}` : ''}`
            : 'Trống đến hết ngày',
        };
      });
    }
    return courts.map((court) => {
      const cId = court.court_id ?? court.id;
      const cName = court.court_name ?? court.name;
      if (court.active === false || court.status === 'MAINTENANCE') {
        return { id: cId, name: cName, type: 'maintenance', detail: 'Tạm ngưng phục vụ' };
      }
      const inUseBooking = todayBookings.find(
        (b) => b.courtName === cName
          && (b.status === 'IN_USE' || (b.status === 'CONFIRMED' && b.startMinute <= nowMinute && nowMinute < b.endMinute))
      );
      if (inUseBooking) {
        return {
          id: cId, name: cName, type: 'inUse', who: inUseBooking.customerName || inUseBooking.bookingCode,
          startMinute: inUseBooking.startMinute, endMinute: inUseBooking.endMinute, bookingCode: inUseBooking.bookingCode,
        };
      }
      const nextConfirmed = todayBookings
        .filter((b) => b.courtName === cName && b.status === 'CONFIRMED' && b.startMinute > nowMinute)
        .sort((a, b) => a.startMinute - b.startMinute)[0];
      return {
        id: cId, name: cName, type: 'available',
        detail: nextConfirmed
          ? `Booking tiếp: ${clock(nextConfirmed.startMinute)}${nextConfirmed.customerName ? ` · ${nextConfirmed.customerName}` : ''}`
          : 'Trống đến hết ngày',
      };
    });
  }, [dashboard, courts, todayBookings, bookingByCode, nowMinute]);

  // Thời gian còn lại của sân đang chơi; dưới 5 phút thì làm nổi (UC34 #4).
  const tiles = useMemo(() => courtTiles.map((court) => {
    if (court.type !== 'inUse' || court.endMinute == null || !dayStartMs) return court;
    const remaining = dayStartMs + court.endMinute * 60_000 - now;
    return { ...court, remaining, ending: remaining > 0 && remaining <= ENDING_SOON_MS };
  }), [courtTiles, dayStartMs, now]);
  const endingTiles = tiles.filter((court) => court.ending);
  const hasInUse = tiles.some((court) => court.type === 'inUse');

  // Đồng hồ đếm từng giây khi có sân đang chơi hoặc đơn tại quầy đang giữ chỗ 10 phút (P34, BR43).
  const hasHolding = counterBookings.some((item) => item.status === 'HOLDING' && item.holdExpiresAt);
  useEffect(() => {
    if (!hasHolding && !hasInUse) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasHolding, hasInUse]);

  const courtsInUseCount = tiles.filter((c) => c.type === 'inUse').length;
  const maintenanceCount = tiles.filter((c) => c.type === 'maintenance').length;
  const freeCount = tiles.filter((c) => c.type === 'available').length;
  const remainingBookingsCount = todayBookings.filter(
    (b) => b.endMinute > nowMinute && b.status !== 'EXPIRED' && !String(b.status).startsWith('CANCELLED')
  ).length;

  // Lịch hôm nay dạng dòng thời gian theo sân (UC34 #2).
  const timeline = useMemo(() => {
    const names = tiles.length > 0 ? tiles.map((court) => court.name) : [...new Set(todayBookings.map((b) => b.courtName))];
    const starts = todayBookings.map((b) => b.startMinute);
    const ends = todayBookings.map((b) => b.endMinute);
    let fromHour = Math.floor(Math.min(nowMinute, ...starts) / 60);
    let toHour = Math.ceil(Math.max(nowMinute + 60, ...ends) / 60);
    if (toHour - fromHour < 8) {
      fromHour = Math.max(0, Math.min(fromHour, toHour - 8));
      toHour = Math.min(24, fromHour + 8);
    }
    const span = (toHour - fromHour) * 60;
    const pct = (minute) => `${((minute - fromHour * 60) / span) * 100}%`;
    return {
      hours: Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i),
      rows: names.map((name) => ({
        name,
        blocks: todayBookings.filter((b) => b.courtName === name).map((b) => ({
          ...b, left: pct(b.startMinute), width: `${((b.endMinute - b.startMinute) / span) * 100}%`,
        })),
      })),
      nowLeft: nowMinute >= fromHour * 60 && nowMinute <= toHour * 60 ? pct(nowMinute) : null,
    };
  }, [tiles, todayBookings, nowMinute]);

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
    if (!current || current.status !== 'HOLDING' || parseServerTime(current.holdExpiresAt) <= Date.now()) {
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

  const paymentLabel = (payment) => payment.label || `Giao dịch #${payment.id}`;
  const waitedMinutes = (payment) => (payment.submittedAt
    ? Math.max(0, Math.floor((now - parseServerTime(payment.submittedAt)) / 60_000)) : null);

  return (
    <ManagementLayout
      role="staff"
      title="Bảng điều hành"
      subtitle={
        <>
          {formatDay(dashboard?.date)}{dashboard?.locationName ? ` · ${dashboard.locationName}` : ''}
          {' · '}
          {updatedAt ? `Cập nhật lúc ${hhmm(updatedAt)} · tự làm mới 30 giây` : 'Đang tải…'}
          {' · '}
          <UiButton variant="ghost" className={styles.inlineLink} type="button" onClick={loadAll} disabled={loading}>
            Làm mới
          </UiButton>
        </>
      }
      actions={
        <>
          <UiButton variant="secondary" className={styles.secondaryButton} type="button" onClick={() => setShowReconciliation(true)}>
            Đối soát cuối ngày{dashboard?.reconciledToday ? ' ✓' : ''}
          </UiButton>
          <UiButton variant="primary" className={styles.primaryButton} type="button" onClick={() => openCounterBooking()}>
            + Đặt tại quầy
          </UiButton>
        </>
      }
      locationName={dashboard?.locationName}
      locationId={dashboard?.locationId}
      badges={{
        payments: dashboard?.paymentsAwaitingConfirmation ?? pendingPayments.length,
        complaints: Number(dashboard?.complaintsToForward) || 0,
      }}
    >
      <div className={styles.board}>
        {(error || urgentPayments.length > 0 || transferredPayments.length > 0 || surchargePayments.length > 0
          || endingTiles.length > 0) && (
          <section className={styles.alerts} aria-label="Cảnh báo vận hành">
            {error && (
              <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                <span>{error}</span>
                <UiButton variant="custom" className={styles.alertButton} type="button" onClick={loadAll}>Thử lại</UiButton>
              </div>
            )}
            {urgentPayments.length > 0 && (
              <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                <span>
                  <b>!</b>{' '}
                  <strong>
                    {urgentPayments.length === 1
                      ? `Giao dịch ${paymentLabel(urgentPayments[0])} (${formatMoney(urgentPayments[0].amountDue)})`
                      : `${urgentPayments.length} giao dịch`}
                  </strong>{' '}
                  đã chờ xác nhận quá {overdueMinutes} phút. Hãy kiểm tra tiền về và xử lý ngay; quá {transferMinutes} phút
                  giao dịch sẽ được chuyển cho chủ sân.
                </span>
                <UiButton variant="custom" className={`${styles.alertButton} ${styles.alertButtonDanger}`} type="button"
                  onClick={() => openPaymentConfirmation(urgentPayments[0])}>
                  Xử lý ngay
                </UiButton>
              </div>
            )}
            {transferredPayments.length > 0 && (
              <div className={`${styles.alert} ${styles.alertNeutral}`} role="status">
                <span>
                  <b>↗</b>{' '}
                  <strong>
                    {transferredPayments.length === 1 ? paymentLabel(transferredPayments[0]) : `${transferredPayments.length} giao dịch`}
                  </strong>{' '}
                  đã chờ quá {transferMinutes} phút trong giờ mở cửa và đã được chuyển cho chủ sân xử lý. Bạn chỉ xem được.
                </span>
                <UiButton variant="custom" className={styles.alertButton} type="button" onClick={() => openPaymentConfirmation(transferredPayments[0])}>
                  Xem giao dịch
                </UiButton>
              </div>
            )}
            {surchargePayments.length > 0 && (
              <div className={`${styles.alert} ${styles.alertInfo}`} role="status">
                <span>
                  <span className={styles.surchargeTag}>Phụ thu đổi lịch</span>{' '}
                  {surchargePayments.length === 1
                    ? `${surchargePayments[0].label} · ${formatMoney(surchargePayments[0].amountDue)} đang chờ xác nhận.`
                    : `${surchargePayments.length} phụ thu đổi lịch đang chờ xác nhận.`}
                </span>
                <UiButton variant="custom" className={styles.alertButton} type="button" onClick={() => openPaymentConfirmation(surchargePayments[0])}>
                  Xác nhận phụ thu
                </UiButton>
              </div>
            )}
            {endingTiles.length > 0 && (
              <div className={`${styles.alert} ${styles.alertWarning}`} role="status">
                <span>
                  <b>⏱</b>{' '}
                  {endingTiles.map((court) => (
                    <span key={court.id}>
                      <strong>{court.name}</strong> kết thúc lúc {clock(court.endMinute)} (còn {Math.ceil(court.remaining / 60_000)} phút)
                      {court.who ? ` — ${court.who}` : ''}{court.bookingCode && court.who !== court.bookingCode ? `, ${court.bookingCode}` : ''}.{' '}
                    </span>
                  ))}
                </span>
                <UiButton variant="custom" className={styles.alertButton} type="button" onClick={() => navigate('/staff/schedule')}>
                  Xem lịch sân
                </UiButton>
              </div>
            )}
          </section>
        )}

        <section className={styles.kpis} aria-label="Thống kê trong ngày">
          <article className={styles.kpi}>
            <h2>Sân đang sử dụng</h2>
            <p className={styles.kpiValue}>{courtsInUseCount} <span>/ {tiles.length} sân</span></p>
            <p className={styles.kpiNote}>{maintenanceCount} sân bảo trì · {freeCount} sân trống</p>
          </article>
          <article className={styles.kpi}>
            <h2>Lượt đặt hôm nay</h2>
            <p className={styles.kpiValue}>{todayBookings.length}</p>
            <p className={styles.kpiNote}>{remainingBookingsCount} lượt còn lại · {dashboard?.complaintsToForward ?? 0} khiếu nại chờ chuyển</p>
          </article>
          <article className={`${styles.kpi} ${urgentPayments.length > 0 ? styles.kpiHot : ''}`}>
            <h2>Chờ xác nhận thanh toán</h2>
            <p className={styles.kpiValue}>{dashboard?.paymentsAwaitingConfirmation ?? pendingPayments.length}</p>
            <p className={styles.kpiNote}>
              <span className={urgentPayments.length > 0 ? styles.textDanger : ''}>{urgentPayments.length} quá {overdueMinutes} phút</span>
              {' · '}{transferredPayments.length} đã chuyển cho chủ sân
            </p>
          </article>
          <article className={styles.kpi}>
            <h2>Doanh thu hôm nay</h2>
            <p className={styles.kpiValue}>{new Intl.NumberFormat('vi-VN').format(Number(dashboard?.todayRevenue ?? 0))} <span>đ</span></p>
            <p className={styles.kpiNote}>{dashboard?.reconciledToday ? 'Đã đối soát hôm nay' : 'Trước đối soát cuối ngày'}</p>
          </article>
        </section>

        <div className={styles.grid}>
          <div className={styles.column}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Trạng thái sân lúc này</h2>
                <UiButton variant="ghost" className={styles.linkButton} type="button" onClick={() => navigate('/staff/schedule')}>
                  Xem lịch sân ›
                </UiButton>
              </header>
              {tiles.length === 0 ? (
                <p className={styles.empty}>{loading ? 'Đang tải trạng thái sân…' : 'Chưa có dữ liệu sân hoạt động.'}</p>
              ) : (
                <div className={styles.courtGrid}>
                  {tiles.map((court) => {
                    const kind = court.ending ? 'ending' : court.type;
                    return (
                      <article key={court.id} className={`${styles.court} ${styles[kind]}`}>
                        <h3>{court.name}</h3>
                        <span className={styles.courtBadge}>{COURT_BADGE[kind]}</span>
                        {court.who && <strong className={styles.courtWho}>{court.who}</strong>}
                        {court.endMinute != null && (
                          <span className={styles.courtTime}>
                            {court.startMinute != null ? `${clock(court.startMinute)}–` : 'Đến '}{clock(court.endMinute)}
                            {court.remaining > 0 ? ' · còn' : ''}
                          </span>
                        )}
                        {court.remaining > 0 && <span className={styles.countdown}>{formatRemaining(court.remaining)}</span>}
                        {court.detail && <span className={styles.courtTime}>{court.detail}</span>}
                        {court.type === 'available' && (
                          <UiButton variant="custom" className={styles.courtAction} type="button" onClick={() => openCounterBooking(court.id)}>
                            Đặt tại quầy
                          </UiButton>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Lịch hôm nay</h2>
                <small className={styles.muted}>Chỉ booking đã xác nhận · {todayBookings.length} lượt</small>
              </header>
              {timeline.rows.length === 0 ? (
                <p className={styles.empty}>Hôm nay chưa có lịch chơi nào.</p>
              ) : (
                <div className={styles.timeline} role="table" aria-label="Lịch hôm nay theo sân">
                  <div className={styles.tlRow} role="row">
                    <span role="columnheader" />
                    <div className={styles.tlHours} style={{ gridTemplateColumns: `repeat(${timeline.hours.length}, 1fr)` }}>
                      {timeline.hours.map((hour) => <span key={hour}>{hour}h</span>)}
                    </div>
                  </div>
                  {timeline.rows.map((row, index) => (
                    <div className={styles.tlRow} role="row" key={row.name}>
                      <span className={styles.tlCourt} role="rowheader">{row.name}</span>
                      <div className={styles.tlTrack} role="cell"
                        style={{ backgroundSize: `calc(100% / ${timeline.hours.length}) 100%` }}>
                        {row.blocks.map((b) => (
                          <span key={b.id} className={`${styles.tlBlock} ${styles['tl' + b.status] ?? ''}`}
                            style={{ left: b.left, width: b.width }}
                            title={`${clock(b.startMinute)}–${clock(b.endMinute)} · ${b.bookingCode}${b.customerName ? ` · ${b.customerName}` : ''}${b.customerPhone ? ` · ${b.customerPhone}` : ''} · ${STATES[b.status] ?? b.status}`}>
                            {b.customerName || b.bookingCode}
                          </span>
                        ))}
                        {timeline.nowLeft && (
                          <span className={styles.tlNow} style={{ left: timeline.nowLeft }}>
                            {index === timeline.rows.length - 1 && <em>{hhmm(nowDate)}</em>}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Thanh toán chờ xác nhận</h2>
                <UiButton variant="ghost" className={styles.linkButton} type="button"
                  onClick={() => openPaymentConfirmation(pendingPayments.find((p) => !p.transferredToOwner) ?? pendingPayments[0])}>
                  Mở bàn xác nhận ›
                </UiButton>
              </header>
              {pendingPayments.length === 0 ? (
                <p className={styles.empty}>Hiện không có giao dịch nào đang chờ xác nhận.</p>
              ) : (
                <ul className={styles.list}>
                  {pendingPayments.map((payment) => {
                    const waited = waitedMinutes(payment);
                    const rowClass = payment.transferredToOwner ? styles.rowMoved : payment.overdue ? styles.rowUrgent : '';
                    return (
                      <li key={`${payment.reschedule ? 'rs' : 'bk'}-${payment.id}`}>
                        <UiButton variant="custom" className={`${styles.row} ${rowClass}`} type="button" onClick={() => openPaymentConfirmation(payment)}>
                          <span className={styles.rowMain}>
                            <strong>
                              {payment.reschedule && <span className={styles.surchargeTag}>Phụ thu đổi lịch</span>}
                              {paymentLabel(payment)}
                            </strong>
                            <small>{payment.submittedAt ? `Gửi lúc ${payment.submittedAt.slice(11, 16)}` : 'Đang chờ kiểm tra chứng từ'}</small>
                          </span>
                          <span className={styles.rowSide}>
                            <strong>{formatMoney(payment.amountDue)}</strong>
                            <small className={payment.overdue && !payment.transferredToOwner ? styles.textDanger : ''}>
                              {payment.transferredToOwner ? 'Đã chuyển cho chủ sân'
                                : payment.overdue ? `Quá ${overdueMinutes} phút · Xử lý gấp`
                                  : waited != null ? `Chờ ${waited} phút` : 'Chờ xác nhận'}
                            </small>
                          </span>
                        </UiButton>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className={styles.footnote}>
                Quá <b>{overdueMinutes} phút</b> trong giờ mở cửa: báo đỏ, vẫn xử lý được. Quá <b>{transferMinutes} phút</b>:
                tự chuyển cho chủ sân, bạn chỉ xem.
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Đơn đặt tại quầy</h2>
                <UiDatePicker className={styles.dateInput} aria-label="Ngày chơi của đơn tại quầy"
                  value={counterDate} onChange={(e) => setCounterDate(e.target.value)} />
              </header>
              {counterBookings.length === 0 ? (
                <p className={styles.empty}>Ngày {counterDate.split('-').reverse().join('/')} chưa có lượt đặt sân tại quầy.</p>
              ) : (
                <ul className={styles.list}>
                  {counterBookings.map((item) => {
                    const holding = item.status === 'HOLDING' && item.holdExpiresAt;
                    const remainingMs = holding ? parseServerTime(item.holdExpiresAt) - now : 0;
                    const expiredHold = holding && remainingMs <= 0;
                    return (
                      <li key={item.id} className={`${styles.row} ${styles.rowStatic}`}>
                        <span className={styles.rowMain}>
                          <strong>{item.customerName}{item.customerPhone ? ` · ${item.customerPhone}` : ''}</strong>
                          <small>
                            {item.bookingCode} · {item.courtName} · {item.startTime}–{item.endTime}
                            {item.receiptNo ? ` · Biên nhận ${item.receiptNo}` : ''}
                          </small>
                          {holding && (
                            <small className={expiredHold ? styles.textDanger : styles.textWarning}>
                              {expiredHold
                                ? 'Đã hết thời gian giữ chỗ, khung giờ đã được nhả. (MSG33)'
                                : `Đang giữ chỗ 10 phút · còn ${formatRemaining(remainingMs)}`}
                            </small>
                          )}
                        </span>
                        <span className={styles.rowSide}>
                          <strong>{formatMoney(item.finalAmount)}</strong>
                          {holding && !expiredHold ? (
                            <UiButton variant="primary" type="button" className={styles.smallPrimary}
                              onClick={() => { setCounterPayment(item); setCounterPaymentError(''); }}>
                              Xác nhận đã nhận tiền
                            </UiButton>
                          ) : (
                            <small className={item.status === 'CONFIRMED' ? styles.textSuccess : ''}>
                              {expiredHold ? STATES.EXPIRED : (STATES[item.status] || item.status)}
                            </small>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

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
