import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { getSavedUser, getSelectedLocation, getToken } from '../../api/session';
import {
  listPendingStaffBookingPayments, getStaffBookingPaymentDetails, getStaffBookingProofImage,
  decideStaffBookingPayment, listPendingReschedulePayments, getStaffReschedulePaymentDetails, decideReschedulePayment,
} from '../../api/bookingPaymentApi';
import { F1Dialog } from '../../components/F1Feedback';
import styles from './StaffConfirmPaymentPage.module.css';

const REASONS = [
  {
    code: 'EQUIPMENT',
    label: 'Lỗi thiết bị tại quầy (không trừ lượt gửi lại)',
    text: 'Lỗi thiết bị tại quầy',
    playerAtFault: false,
  },
  {
    code: 'DELAY',
    label: 'Chưa nhận được tiền do ngân hàng trễ (không trừ lượt gửi lại của khách)',
    text: 'Chưa nhận được tiền chuyển khoản',
    playerAtFault: false,
  },
  {
    code: 'IMAGE',
    label: 'Ảnh chứng từ bị mờ hoặc thiếu thông tin (trừ 1 lượt gửi lại)',
    text: 'Ảnh chứng từ bị mờ hoặc thiếu thông tin',
    playerAtFault: true,
  },
  {
    code: 'AMOUNT',
    label: 'Sai số tiền hoặc nội dung chuyển khoản (trừ 1 lượt gửi lại)',
    text: 'Sai số tiền hoặc nội dung chuyển khoản',
    playerAtFault: true,
  },
];

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))} VND`;

function formatPaymentLabel(item) {
  if (!item) return '';
  if (item.bookingCode) return item.bookingCode;
  if (item.rescheduleRequestId) return `Đổi lịch #${item.rescheduleRequestId}`;
  if (item.packageId) return `Đơn/Gói #${item.packageId}`;
  return `Giao dịch #${item.id}`;
}

export default function StaffConfirmPaymentPage() {
  const user = getSavedUser();
  const role = user?.role_code;
  const selectedLocationId = getSelectedLocation();
  const token = getToken();
  const [params] = useSearchParams();
  const surcharge = params.get('type') === 'reschedule';
  return <PaymentDesk key={[token, selectedLocationId, surcharge].join(':')} staff={user} role={role} surcharge={surcharge} />;
}

function PaymentDesk({ staff, role, surcharge }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('paymentId') || searchParams.get('booking');

  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [detailError, setDetailError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [amountError, setAmountError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [decision, setDecision] = useState(null);
  const [actualAmount, setActualAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [selectedProofId, setSelectedProofId] = useState(null);
  const [proof, setProof] = useState(null);
  const [isProofOpen, setIsProofOpen] = useState(false);

  const reload = () => {
    setLoadingQueue(true);
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setQueueError('');
    setActualAmount('');
    setReasonCode('');
    setAmountError('');
    setReasonError('');
    setIsProofOpen(false);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const load = surcharge ? listPendingReschedulePayments : listPendingStaffBookingPayments;
    load(signal).then((items) => {
      if (signal.aborted) return;
      const list = items.filter((item) => item.status === 'AWAITING_CONFIRMATION');
      setQueue(list);
      const matched = requestedId && list.find((item) => String(item.id) === requestedId || item.bookingCode === requestedId);
      setSelectedId((current) => list.find(({ id }) => id === current)?.id ?? (matched || list[0])?.id ?? null);
      setQueueError('');
    }).catch((error) => {
      if (signal.aborted) return;
      setQueue([]);
      setSelectedId(null);
      setQueueError(apiErrorMessage(error, 'Không tải được danh sách giao dịch chờ xác nhận.'));
    }).finally(() => {
      if (!signal.aborted) setLoadingQueue(false);
    });
    return () => controller.abort();
  }, [requestedId, revision, surcharge]);

  useEffect(() => {
    if (!selectedId || loadingQueue) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const load = surcharge ? getStaffReschedulePaymentDetails : getStaffBookingPaymentDetails;
    load(selectedId, signal).then((data) => {
      if (signal.aborted) return;
      setDetail(data);
      setDetailError(null);
      const proofs = data.proofs ?? [];
      setSelectedProofId((surcharge ? proofs.at(-1) : proofs[0])?.id ?? null);
    }).catch((error) => {
      if (!signal.aborted) setDetailError({ id: selectedId, message: apiErrorMessage(error, 'Không tải được chi tiết giao dịch.') });
    });
    return () => controller.abort();
  }, [selectedId, loadingQueue, surcharge]);

  const payment = detail?.payment || detail;
  const activeDetail = !loadingQueue && selectedId && payment?.id === selectedId ? detail : null;
  const activePayment = activeDetail ? payment : null;
  const canDecide = activePayment?.status === 'AWAITING_CONFIRMATION';
  const proofs = surcharge ? (activeDetail?.proofs ?? []).slice().reverse() : activeDetail?.proofs ?? [];
  const activeProofId = proofs.some(({ id }) => id === selectedProofId) ? selectedProofId : null;
  const proofKey = selectedId && activeProofId ? selectedId + ':' + activeProofId : '';
  const activeProofUrl = proof?.key === proofKey ? proof.url : '';
  const proofError = proof?.key === proofKey ? proof.error : '';

  useEffect(() => {
    if (!proofKey) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    getStaffBookingProofImage(selectedId, activeProofId, signal).then((blob) => {
      if (signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setProof({ key: proofKey, url: objectUrl });
    }).catch((error) => {
      if (!signal.aborted) setProof({ key: proofKey, error: apiErrorMessage(error, 'Không tải được ảnh chứng từ.') });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId, activeProofId, proofKey]);

  const amountDue = Number(activePayment?.amountDue ?? 0);
  const validAmount = !actualAmount || /^[0-9]{1,12}$/.test(actualAmount);
  const parsedReceived = actualAmount === '' ? amountDue : Number(actualAmount);
  const isShortfall = validAmount && parsedReceived < amountDue;
  const isOverpaid = validAmount && parsedReceived > amountDue;
  const reason = REASONS.find((item) => item.code === reasonCode);
  const query = filter.trim().toLowerCase();
  const filteredQueue = queue.filter((item) => (formatPaymentLabel(item) + ' ' + item.id).toLowerCase().includes(query));

  const handleSelectTransaction = (item) => {
    if (item.id === selectedId) return;
    setSelectedId(item.id);
    setDetail(null);
    setDetailError(null);
    setSelectedProofId(null);
    setProof(null);
    setIsProofOpen(false);
    setActualAmount('');
    setReasonCode('');
    setAmountError('');
    setReasonError('');
    setErrorMessage('');
    setMessage('');
  };

  const prepare = (action) => {
    if (!canDecide || isProcessing) return;
    setAmountError('');
    setReasonError('');
    setErrorMessage('');
    if (action !== 'reject' && !validAmount) {
      setAmountError('Số tiền thực nhận phải là số nguyên không âm, tối đa 12 chữ số. (MSG02)');
      return;
    }
    if (action === 'confirm' && isShortfall) {
      setAmountError('Khách còn thiếu tiền. Vui lòng yêu cầu bổ sung chứng từ.');
      return;
    }
    if (action !== 'confirm' && !reason) {
      setReasonError('Vui lòng chọn lý do. (MSG01)');
      return;
    }
    setDecision({ action, id: selectedId });
  };

  const perform = async () => {
    if (!decision || decision.id !== selectedId || !canDecide || isProcessing) return;
    const { action, id } = decision;
    setDecision(null);
    setIsProcessing(true);
    const submit = surcharge ? decideReschedulePayment : decideStaffBookingPayment;
    const label = formatPaymentLabel(activePayment);
    try {
      let result;
      if (action === 'confirm') {
        result = await submit(id, action, { receivedAmount: isOverpaid ? parsedReceived : null });
        const receipt = result.receiptNo ? ' Biên nhận ' + result.receiptNo + '.' : '';
        const excess = isOverpaid ? ' Đã thông báo Chủ sân về khoản chuyển thừa. (MSG55)' : '';
        setMessage(result.status === 'EXPIRED' ? 'Đã hết hạn thanh toán. (MSG33)'
          : 'Đã xác nhận thanh toán cho ' + label + '. (MSG46)' + receipt + excess);
      } else if (action === 'request-resubmission') {
        result = await submit(id, action, { reason: reason.text, playerAtFault: reason.playerAtFault,
          receivedAmount: isShortfall ? parsedReceived : null });
        const deadline = result.resubmitDeadline ? ' Hạn gửi lại ' + result.resubmitDeadline.replace('T', ' ') + '.' : '';
        const attempts = result.resubmitsLeft != null
          ? (result.resubmitsLeft > 0 ? ' Còn ' + result.resubmitsLeft + ' lượt bổ sung.' : ' Yêu cầu bổ sung cuối đang mở.')
          : '';
        setMessage(result.status === 'REJECTED' ? 'Đã hết lượt hoặc hết hạn gửi lại chứng từ. (MSG52)'
          : 'Đã yêu cầu bổ sung chứng từ cho ' + label + '. (MSG50)' + deadline + attempts);
      } else {
        await submit(id, action, { reason: reason.text });
        setMessage('Đã từ chối thanh toán cho ' + label + '. (MSG51)');
      }
      reload();
    } catch (error) {
      const fields = error.response?.data?.errors;
      const message = apiErrorMessage(error, 'Không thể xử lý giao dịch.');
      if (fields?.receivedAmount) setAmountError(fields.receivedAmount);
      else if (fields?.reason) setReasonError(fields.reason);
      else {
        setErrorMessage(message);
        if (message.includes('MSG54') || error.response?.status === 409) {
          reload();
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const dialogMessage = decision?.action === 'confirm'
    ? 'Xác nhận đã đối chiếu và nhận đủ ' + formatMoney(parsedReceived) + ' cho ' + formatPaymentLabel(activePayment) + '? (MSG53)'
    : decision?.action === 'reject'
      ? 'Từ chối thanh toán ' + formatPaymentLabel(activePayment) + '?'
      : isShortfall
        ? 'Ghi nhận ' + formatMoney(parsedReceived) + ' và yêu cầu chuyển thêm ' + formatMoney(amountDue - parsedReceived) + '?'
        : 'Gửi yêu cầu bổ sung chứng từ với lý do “' + reason?.text + '”?';

  const resubmitsLeft =
    activePayment?.resubmitsLeft ?? Math.max(0, 3 - Number(activePayment?.resubmitCount ?? 0));

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">ϟ</span>
          <span>Courtly</span>
        </div>
        <div className={styles.facility}>
          <span>{role === 'owner' ? 'Chủ sân' : 'Nhân viên tại'}</span>
          <strong>{staff?.full_name || 'Cụm sân'}</strong>
        </div>
        <nav className={styles.navigation} aria-label="Điều hướng nhân viên">
          <button
            className={styles.navItem}
            type="button"
            onClick={() =>
              navigate(role === 'owner' ? '/owner/workspace' : '/staff/dashboard')
            }
          >
            {role === 'owner' ? 'Quản lý cụm sân' : 'Bảng điều hành'}
          </button>
          {role === 'staff' && <button
            className={styles.navItem}
            type="button"
            onClick={() => navigate('/staff/dashboard?modal=counter')}
          >
            Đặt sân tại quầy
          </button>}
          <button
            className={`${styles.navItem} ${styles.activeNav}`}
            type="button"
            onClick={() => navigate('/staff/confirm-payments')}
          >
            Xác nhận thanh toán (UC19)
          </button>
          <button
            className={styles.navItem}
            type="button"
            onClick={() => navigate(role === 'owner' ? '/owner/reconciliations' : '/staff/dashboard?modal=reconciliation')}
          >
            Đối soát cuối ngày (UC20)
          </button>
          <button className={styles.navItem} type="button" onClick={() => navigate('/maintenance')}>
            Yêu cầu bảo trì
          </button>
          {role === 'staff' && (
            <button
              className={styles.navItem}
              type="button"
              onClick={() => navigate('/staff/complaints')}
            >
              Khiếu nại
            </button>
          )}
        </nav>
      </aside>

      <main className={styles.main}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h1 className={styles.pageTitle} style={{ margin: 0 }}>
            {surcharge ? 'Xác nhận phụ thu đổi lịch (UC21)' : 'Xác nhận thanh toán đặt sân (UC19)'}
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={!surcharge ? styles.confirmButton : styles.resubmitButton}
              style={{ minHeight: 36, padding: '0 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              disabled={isProcessing}
              onClick={() => navigate('/staff/confirm-payments')}
            >
              Thanh toán đặt sân
            </button>
            <button
              type="button"
              className={surcharge ? styles.confirmButton : styles.resubmitButton}
              style={{ minHeight: 36, padding: '0 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              disabled={isProcessing}
              onClick={() => navigate('/staff/confirm-payments?type=reschedule')}
            >
              Phụ thu đổi lịch
            </button>
            <button
              type="button"
              className={styles.resubmitButton}
              style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}
              disabled={loadingQueue || isProcessing}
              onClick={reload}
            >
              Làm mới
            </button>
          </div>
        </div>

        {message && (
          <p
            className={styles.actionMessage}
            role="status"
            style={{
              margin: '0 0 14px',
              padding: '10px 14px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
            }}
          >
            {message}
          </p>
        )}
        {(queueError || errorMessage) && (
          <p className={styles.errorMessage} role="alert" style={{ marginBottom: 14 }}>
            {queueError || errorMessage}
          </p>
        )}

        <div className={styles.workspace}>
          <section className={styles.bookingList} aria-label="Danh sách giao dịch chờ xác nhận">
            <div style={{ padding: '6px 6px 8px' }}>
              <input
                type="search"
                placeholder="Tìm theo mã đơn BK... hoặc ID"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={styles.amountInput}
                style={{ height: 34, fontSize: 12 }}
              />
            </div>

            {loadingQueue && (
              <div className={styles.emptyList}>Đang tải hàng chờ xác nhận…</div>
            )}

            {!loadingQueue && filteredQueue.map((item) => (
              <button
                className={`${styles.bookingItem} ${selectedId === item.id ? styles.bookingSelected : ''}`}
                key={item.id}
                type="button"
                onClick={() => handleSelectTransaction(item)}
                disabled={isProcessing}
              >
                <span className={styles.bookingTopline}>
                  <strong>{formatPaymentLabel(item)}</strong>
                  <strong>{formatMoney(item.amountDue)}</strong>
                </span>
                <span className={styles.bookingMeta}>
                  Mã GD #{item.id} · Còn {item.resubmitsLeft ?? Math.max(0, 3 - (item.resubmitCount ?? 0))} lượt gửi lại
                </span>
                <span className={styles.waiting}>
                  {item.submittedAt ? `Gửi lúc ${item.submittedAt.replace('T', ' ')}` : 'Đang chờ xác nhận'}
                </span>
              </button>
            ))}

            {!loadingQueue && !queueError && filteredQueue.length === 0 && (
              <div className={styles.emptyList}>
                Không có giao dịch nào đang chờ xác nhận.
              </div>
            )}
          </section>

          {selectedId && (
            <section className={styles.detailCard} aria-label="Chi tiết giao dịch đang chọn">
              {detailError?.id === selectedId ? (
                <p role="alert">{detailError.message} <button type="button" onClick={reload}>Thử lại</button></p>
              ) : !activePayment ? (
                <p role="status">Đang tải chi tiết giao dịch…</p>
              ) : (
                <>
                  <header className={styles.detailHeader}>
                    <h2>
                      {formatPaymentLabel(activePayment)}
                      {activeDetail?.customerName ? ` · ${activeDetail.customerName}` : ''}
                    </h2>
                    <span className={styles.statusBadge}>
                      {canDecide ? 'Chờ xác nhận · Còn ' + resubmitsLeft + '/3 lượt bổ sung' : 'Giao dịch đã được xử lý. (MSG54)'}
                    </span>
                  </header>

                  {proofs.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {proofs.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { if (p.id !== selectedProofId) { setProof(null); setSelectedProofId(p.id); } }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: selectedProofId === p.id ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                            background: selectedProofId === p.id ? '#e8f5ee' : '#fff',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Ảnh lần {proofs.length - idx}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={styles.detailBody}>
                    <button
                      className={styles.proofPreview}
                      type="button"
                      onClick={() => setIsProofOpen(true)}
                      aria-label="Phóng to ảnh chứng từ"
                      disabled={!activeProofUrl}
                      style={{ overflow: 'hidden', padding: activeProofUrl ? 8 : 16 }}
                    >
                      {activeProofUrl ? (
                        <img
                          src={activeProofUrl}
                          alt="Chứng từ chuyển khoản"
                          style={{
                            maxWidth: '100%',
                            maxHeight: 240,
                            objectFit: 'contain',
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <>
                          <svg viewBox="0 0 32 32" aria-hidden="true">
                            <rect x="4" y="5" width="24" height="22" rx="2" />
                            <circle cx="12" cy="12" r="2" />
                            <path d="m6 24 7-7 4 4 4-5 5 7" />
                          </svg>
                          <strong role={proofError ? 'alert' : 'status'}>{proofError || (activeProofId ? 'Đang tải ảnh chứng từ…' : 'Giao dịch chưa có chứng từ.')}</strong>
                        </>
                      )}
                      {activeProofUrl && <small>Nhấn để phóng to</small>}
                    </button>

                    <div className={styles.paymentInfo}>
                      <dl className={styles.infoList}>
                        {surcharge ? (
                          <div>
                            <dt>Yêu cầu đổi lịch</dt>
                            <dd>#{activePayment.rescheduleRequestId || selectedId}</dd>
                          </div>
                        ) : (
                          <>
                            <div>
                              <dt>Sân</dt>
                              <dd>
                                {activeDetail?.courtName ||
                                  (activeDetail?.sessions?.length
                                    ? `${activeDetail.sessions.length} buổi trong gói/đơn`
                                    : '—')}
                              </dd>
                            </div>
                            <div>
                              <dt>Thời gian chơi</dt>
                              <dd>
                                {activeDetail?.playDate
                                  ? `${activeDetail.playDate} · ${activeDetail.startTime}–${activeDetail.endTime}`
                                  : activeDetail?.sessions?.[0]
                                    ? `${activeDetail.sessions[0].playDate} · ${activeDetail.sessions[0].startTime}–${activeDetail.sessions[0].endTime}`
                                    : '—'}
                              </dd>
                            </div>
                            <div>
                              <dt>Khách hàng / SĐT</dt>
                              <dd>
                                {activeDetail?.customerName || 'Khách đặt online'}
                                {activeDetail?.customerPhone ? ` · ${activeDetail.customerPhone}` : ''}
                              </dd>
                            </div>
                            <div>
                              <dt>Nội dung CK chuẩn</dt>
                              <dd>
                                {activePayment.bookingCode || `PK${activePayment.packageId || activePayment.id}`}
                              </dd>
                            </div>
                          </>
                        )}
                        <div>
                          <dt>Số tiền phải thu</dt>
                          <dd style={{ color: '#0d9651', fontSize: 14 }}>{formatMoney(amountDue)}</dd>
                        </div>
                        {activePayment.receivedAmount != null && (
                          <div>
                            <dt>Đã nhận trước đó</dt>
                            <dd>{formatMoney(activePayment.receivedAmount)}</dd>
                          </div>
                        )}
                      </dl>

                      {activeDetail?.sessions?.length > 0 && (
                        <div
                          style={{
                            maxHeight: 110,
                            overflowY: 'auto',
                            marginBottom: 10,
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: 11.5,
                          }}
                        >
                          <strong style={{ display: 'block', marginBottom: 4 }}>
                            Danh sách buổi ({activeDetail.sessions.length}):
                          </strong>
                          {activeDetail.sessions.map((s) => (
                            <div key={s.bookingCode} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                              <span>{s.bookingCode} · {s.courtName}</span>
                              <span>{s.playDate} ({s.startTime}–{s.endTime})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeDetail?.note && (
                        <p className={styles.ownerNote}>
                          <strong>Ghi chú cho chủ sân (DR20):</strong> {activeDetail.note}
                        </p>
                      )}

                      <label className={styles.amountLabel} htmlFor="actual-amount">
                        Số tiền thực tế nhận được (nhập khi khách chuyển thừa hoặc chuyển thiếu)
                      </label>
                      <input
                        className={styles.amountInput}
                        id="actual-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder={formatMoney(amountDue)}
                        value={actualAmount}
                        onChange={(event) => { setActualAmount(event.target.value); setAmountError(''); }}
                        aria-invalid={Boolean(amountError)}
                        aria-describedby={amountError ? 'amount-error' : undefined}
                        disabled={!canDecide || isProcessing}
                      />
                      {amountError && <p id="amount-error" className={styles.errorMessage} role="alert">{amountError}</p>}
                      {isShortfall && (
                        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>
                          Khách còn thiếu {formatMoney(amountDue - parsedReceived)} (BR05). Không thể xác nhận; hãy nhấn &ldquo;Yêu cầu gửi lại chứng từ&rdquo; để khách chuyển bù phần thiếu.
                        </p>
                      )}
                      {isOverpaid && (
                        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#0d9651', fontWeight: 600 }}>
                          Khách chuyển thừa {formatMoney(parsedReceived - amountDue)} (BR51). Hệ thống sẽ ghi nhận doanh thu {formatMoney(amountDue)} và lưu phần thừa để đối soát (MSG55).
                        </p>
                      )}
                    </div>
                  </div>

                  {canDecide && <section className={styles.reasonBox}>
                    <label htmlFor="payment-reason">
                      Lý do (khi Yêu cầu gửi lại chứng từ hoặc Từ chối)
                    </label>
                    <select
                      id="payment-reason"
                      value={reasonCode}
                      onChange={(event) => { setReasonCode(event.target.value); setReasonError(''); }}
                      aria-invalid={Boolean(reasonError)}
                      aria-describedby={reasonError ? "reason-error" : undefined}
                    >
                      <option value="">Chọn lý do</option>
                      {REASONS.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {reasonError && <p id="reason-error" className={styles.errorMessage} role="alert">{reasonError}</p>}
                    <p>
                      Người chơi còn <strong>{resubmitsLeft}</strong> lượt gửi lại chứng từ (tối đa 3 lần · P06). Căn cứ xác nhận là tiền thực về tài khoản ngân hàng của địa điểm (BR33).
                    </p>
                  </section>}

                  {canDecide && <div className={styles.actions}>
                    <button
                      className={styles.rejectButton}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => prepare('reject')}
                    >
                      Từ chối thanh toán
                    </button>
                    <button
                      className={styles.resubmitButton}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => prepare('request-resubmission')}
                    >
                      Yêu cầu gửi lại chứng từ
                    </button>
                    <button
                      className={styles.confirmButton}
                      type="button"
                      disabled={isProcessing || isShortfall}
                      onClick={() => prepare('confirm')}
                    >
                      Xác nhận đã nhận tiền
                    </button>
                  </div>}
                </>
              )}
            </section>
          )}
        </div>
      </main>

      {decision && <F1Dialog title="Xác nhận thao tác" message={dialogMessage}
        onClose={() => setDecision(null)} onConfirm={perform} />}

      {isProofOpen && activePayment && (
        <div
          className={styles.proofOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsProofOpen(false);
          }}
        >
          <section
            className={styles.proofModal}
            role="dialog"
            aria-modal="true"
            aria-label="Ảnh chứng từ thanh toán"
          >
            <button
              className={styles.closeProof}
              type="button"
              onClick={() => setIsProofOpen(false)}
            >
              Đóng
            </button>
            <div className={styles.proofLarge}>
              {activeProofUrl ? (
                <img
                  src={activeProofUrl}
                  alt="Chứng từ thanh toán"
                  style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }}
                />
              ) : (
                <>
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <rect x="4" y="5" width="24" height="22" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="m6 24 7-7 4 4 4-5 5 7" />
                  </svg>
                  <p role={proofError ? 'alert' : 'status'}>
                    {proofError || 'Giao dịch chưa có ảnh chứng từ.'}
                  </p>
                </>
              )}
              <strong>Chứng từ thanh toán · {formatPaymentLabel(activePayment)}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
