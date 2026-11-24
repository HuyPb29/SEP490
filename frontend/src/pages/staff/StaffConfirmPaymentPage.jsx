import { uiMessage } from '../../utils/formatters';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentActions } from '../../hooks/useBooking';
import { F1Dialog } from '../../components/F1Feedback';
import ManagementLayout from '../../components/layout/ManagementLayout';
import ReconciliationDialog from './ReconciliationDialog';
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

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))} đ`;

function formatPaymentLabel(item) {
  if (!item) return '';
  if (item.bookingCode) return item.bookingCode;
  if (item.rescheduleRequestId) return `Đổi lịch #${item.rescheduleRequestId}`;
  if (item.packageId) return `Đơn/Gói #${item.packageId}`;
  return `Giao dịch #${item.id}`;
}

// Loại giao dịch để Staff phân biệt nhanh trong hàng chờ.
function paymentKind(item, surcharge) {
  if (surcharge || item?.rescheduleRequestId) return { text: 'Phụ thu đổi lịch', tone: 'kindInfo' };
  if (item?.packageId) return { text: 'Đơn / gói', tone: 'kindViolet' };
  return { text: 'Đặt lẻ', tone: 'kindNeutral' };
}

// Giờ server (LocalDateTime, không có múi giờ) là giờ Việt Nam.
function minutesSince(value, now) {
  if (!value) return null;
  const time = Date.parse(value.includes('+') || value.endsWith('Z') ? value : `${value}+07:00`);
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / 60_000));
}

const isTyping = (target) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable;

export default function StaffConfirmPaymentPage() {
  const { role, selectedLocationId, token } = useAuth();
  const [params] = useSearchParams();
  const surcharge = params.get('type') === 'reschedule';
  return <PaymentDesk key={[token, selectedLocationId, surcharge].join(':')} role={role} surcharge={surcharge} />;
}

function PaymentDesk({ role, surcharge }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('paymentId') || searchParams.get('booking');
  const {
    listPendingStaffBookingPayments,
    getStaffBookingPaymentDetails,
    getStaffBookingProofImage,
    decideStaffBookingPayment,
    listPendingReschedulePayments,
    getStaffReschedulePaymentDetails,
    decideReschedulePayment,
  } = usePaymentActions();

  const [queue, setQueue] = useState([]);
  const [otherCount, setOtherCount] = useState(null);
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
  const [rotation, setRotation] = useState(0);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
    setRotation(0);
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
      setNow(Date.now());
      const matched = requestedId && list.find((item) => String(item.id) === requestedId || item.bookingCode === requestedId);
      setSelectedId((current) => matched?.id ?? list.find(({ id }) => id === current)?.id ?? list[0]?.id ?? null);
      setQueueError('');
    }).catch((error) => {
      if (signal.aborted) return;
      setQueue([]);
      setSelectedId(null);
      setQueueError(apiErrorMessage(error, 'Không tải được danh sách giao dịch chờ xác nhận.'));
    }).finally(() => {
      if (!signal.aborted) setLoadingQueue(false);
    });
    // Số giao dịch chờ của hàng còn lại, hiện trên tab để Staff không bỏ sót.
    const other = surcharge ? listPendingStaffBookingPayments : listPendingReschedulePayments;
    other(signal).then((items) => {
      if (!signal.aborted) setOtherCount(items.filter((item) => item.status === 'AWAITING_CONFIRMATION').length);
    }).catch(() => {
      if (!signal.aborted) setOtherCount(null);
    });
    return () => controller.abort();
  }, [requestedId, revision, surcharge, listPendingReschedulePayments, listPendingStaffBookingPayments]);

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
  }, [selectedId, loadingQueue, surcharge, getStaffReschedulePaymentDetails, getStaffBookingPaymentDetails]);

  // Cập nhật số phút đã chờ mỗi 30 giây.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const payment = detail?.payment || detail;
  const activeDetail = !loadingQueue && selectedId && payment?.id === selectedId ? detail : null;
  const activePayment = activeDetail ? payment : null;
  const queueItem = queue.find(({ id }) => id === selectedId);
  // D182 (BR58): chờ quá 15 phút (P24) trong giờ mở cửa thì báo đỏ, Staff vẫn xử lý; quá 25 phút (P24 + P36)
  // thì giao dịch đã chuyển cho chủ sân, Staff chỉ xem, Owner vẫn xử lý.
  const transferredToOwner = activePayment?.transferredToOwner ?? Boolean(queueItem?.transferredToOwner);
  const overdue = activePayment?.overdue ?? Boolean(queueItem?.overdue);
  const canDecide = activePayment?.status === 'AWAITING_CONFIRMATION' && !(transferredToOwner && role !== 'owner');
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
  }, [selectedId, activeProofId, proofKey, getStaffBookingProofImage]);

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
    setRotation(0);
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
      setAmountError('Số tiền thực nhận phải là số nguyên không âm, tối đa 12 chữ số.');
      return;
    }
    if (action === 'confirm' && isShortfall) {
      setAmountError('Khách còn thiếu tiền. Vui lòng yêu cầu bổ sung chứng từ.');
      return;
    }
    if (action !== 'confirm' && !reason) {
      setReasonError('Vui lòng chọn lý do.');
      return;
    }
    setDecision({ action, id: selectedId });
  };

  const perform = async () => {
    if (!decision || decision.id !== selectedId || !canDecide || isProcessing) return;
    const { action, id } = decision;
    setDecision(null);
    setIsProcessing(true);
    setMessage('');
    setErrorMessage('');
    const submit = surcharge ? decideReschedulePayment : decideStaffBookingPayment;
    const label = formatPaymentLabel(activePayment);
    try {
      let result;
      if (action === 'confirm') {
        result = await submit(id, action, { receivedAmount: isOverpaid ? parsedReceived : null });
        const receipt = result.receiptNo ? ' Biên nhận ' + result.receiptNo + '.' : '';
        const excess = isOverpaid ? ' Đã thông báo Chủ sân về khoản chuyển thừa.' : '';
        if (result.status === 'EXPIRED') setMessage('Đã hết hạn thanh toán.');
        else if (surcharge && result.status !== 'APPROVED') {
          setErrorMessage("Đổi lịch không thành công. đặt sân giữ giờ cũ.");
        } else setMessage('Đã xác nhận thanh toán cho ' + label + '.' + receipt + excess);
      } else if (action === 'request-resubmission') {
        result = await submit(id, action, { reason: reason.text, playerAtFault: reason.playerAtFault,
          receivedAmount: isShortfall ? parsedReceived : null });
        const deadline = result.resubmitDeadline ? ' Hạn gửi lại ' + result.resubmitDeadline.replace('T', ' ') + '.' : '';
        const attempts = result.resubmitsLeft != null
          ? (result.resubmitsLeft > 0 ? ' Còn ' + result.resubmitsLeft + ' lượt bổ sung.' : ' Yêu cầu bổ sung cuối đang mở.')
          : '';
        setMessage(result.status === 'REJECTED' ? 'Đã hết lượt hoặc hết hạn gửi lại chứng từ.'
          : 'Đã yêu cầu bổ sung chứng từ cho ' + label + '.' + deadline + attempts);
      } else {
        result = await submit(id, action, { reason: reason.text });
        setMessage(result?.status === 'EXPIRED' ? 'Đã hết hạn thanh toán.'
          : 'Đã từ chối thanh toán cho ' + label + '.');
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

  // Phím tắt: A = xác nhận, R = yêu cầu bổ sung (bỏ qua khi đang gõ trong ô nhập hoặc đang mở hộp thoại).
  const prepareRef = useRef(prepare);
  useEffect(() => { prepareRef.current = prepare; });
  const shortcutsOn = canDecide && !isProcessing && !decision && !isProofOpen && !showReconciliation;
  useEffect(() => {
    if (!shortcutsOn) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'a') { event.preventDefault(); prepareRef.current('confirm'); }
      if (key === 'r') { event.preventDefault(); prepareRef.current('request-resubmission'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn]);

  const dialogMessage = decision?.action === 'confirm'
    ? 'Xác nhận đã đối chiếu và nhận đủ ' + formatMoney(parsedReceived) + ' cho ' + formatPaymentLabel(activePayment) + '?'
    : decision?.action === 'reject'
      ? 'Từ chối thanh toán ' + formatPaymentLabel(activePayment) + '?'
      : isShortfall
        ? 'Ghi nhận ' + formatMoney(parsedReceived) + ' và yêu cầu chuyển thêm ' + formatMoney(amountDue - parsedReceived) + '?'
        : 'Gửi yêu cầu bổ sung chứng từ với lý do “' + reason?.text + '”?';

  const resubmitsLeft =
    activePayment?.resubmitsLeft ?? Math.max(0, 3 - Number(activePayment?.resubmitCount ?? 0));
  const waited = minutesSince(activePayment?.submittedAt ?? queueItem?.submittedAt, now);
  const kind = paymentKind(activePayment, surcharge);
  const statusBadge = activePayment?.status !== 'AWAITING_CONFIRMATION'
    ? { text: 'Đã được xử lý', tone: styles.badgeNeutral }
    : transferredToOwner ? { text: 'Đã chuyển cho chủ sân', tone: styles.badgeNeutral }
      : overdue ? { text: 'Quá 15 phút', tone: styles.badgeDanger }
        : { text: 'Chờ xác nhận', tone: styles.badgeWarning };
  const bookingCount = surcharge ? otherCount : queue.length;
  const surchargeCount = surcharge ? queue.length : otherCount;

  return (
    <ManagementLayout
      role={role === 'owner' ? 'owner' : 'staff'}
      title="Xác nhận thanh toán"
      subtitle="Kiểm tra tiền đã về tài khoản của địa điểm (app ngân hàng tại quầy) rồi mới xác nhận. Ảnh chứng từ chỉ để tham khảo."
      actions={<>
        {role !== 'owner' && (
          <button type="button" className={styles.secondaryButton} disabled={isProcessing} onClick={() => setShowReconciliation(true)}>
            Đối soát cuối ngày
          </button>
        )}
        <button type="button" className={styles.secondaryButton} disabled={loadingQueue || isProcessing} onClick={reload}>
          Làm mới
        </button>
      </>}
    >
      {message && <p className={styles.successBanner} role="status">{message}</p>}
      {(queueError || errorMessage) && (
        <p className={styles.errorBanner} role="alert">{uiMessage(queueError || errorMessage)}</p>
      )}

      <div className={styles.workspace}>
        <section className={styles.queue} aria-label="Danh sách giao dịch chờ xác nhận">
          <div className={styles.queueTabs} role="tablist" aria-label="Loại giao dịch">
            <button type="button" role="tab" aria-selected={!surcharge} disabled={isProcessing}
              className={!surcharge ? styles.tabOn : ''} onClick={() => navigate('/staff/confirm-payments')}>
              Thanh toán đặt sân{bookingCount != null && <span className={styles.count}>{bookingCount}</span>}
            </button>
            <button type="button" role="tab" aria-selected={surcharge} disabled={isProcessing}
              className={surcharge ? styles.tabOn : ''} onClick={() => navigate('/staff/confirm-payments?type=reschedule')}>
              Phụ thu đổi lịch{surchargeCount != null && <span className={styles.count}>{surchargeCount}</span>}
            </button>
          </div>
          <div className={styles.searchRow}>
            <input type="search" placeholder="Tìm theo mã BK… hoặc mã giao dịch" aria-label="Tìm giao dịch"
              value={filter} onChange={(e) => setFilter(e.target.value)} className={styles.searchInput} />
          </div>

          {loadingQueue && <div className={styles.emptyList}>Đang tải hàng chờ xác nhận…</div>}

          {!loadingQueue && filteredQueue.map((item) => {
            const itemKind = paymentKind(item, surcharge);
            const itemWaited = minutesSince(item.submittedAt, now);
            const rowTone = item.transferredToOwner ? styles.itemMoved : item.overdue ? styles.itemUrgent : '';
            return (
              <button
                className={`${styles.queueItem} ${rowTone} ${selectedId === item.id ? styles.itemSelected : ''}`}
                key={item.id}
                type="button"
                onClick={() => handleSelectTransaction(item)}
                disabled={isProcessing}
              >
                <span className={styles.itemTop}>
                  <strong>{item.transferredToOwner ? '🔒 ' : ''}{formatPaymentLabel(item)}</strong>
                  <strong>{formatMoney(item.amountDue)}</strong>
                </span>
                <span className={styles.itemMeta}>
                  <span className={`${styles.kind} ${styles[itemKind.tone]}`}>{itemKind.text}</span>
                  {item.submittedAt ? ` Gửi ${item.submittedAt.slice(11, 16)}` : ''}
                  {' · '}Mã GD #{item.id}
                </span>
                <span className={item.transferredToOwner ? styles.waitMoved : item.overdue ? styles.waitUrgent : styles.wait}>
                  {item.transferredToOwner ? 'Đã chuyển cho chủ sân'
                    : item.overdue ? 'Quá 15 phút · Xử lý gấp'
                      : itemWaited != null ? `Chờ ${itemWaited} phút` : 'Chờ xác nhận'}
                </span>
              </button>
            );
          })}

          {!loadingQueue && !queueError && filteredQueue.length === 0 && (
            <div className={styles.emptyList}>Không có giao dịch nào đang chờ xác nhận.</div>
          )}
          <p className={styles.queueNote}>Cũ nhất xếp trên. Thời gian chờ chỉ tính trong giờ mở cửa.</p>
        </section>

        <section className={styles.detail} aria-label="Chi tiết giao dịch đang chọn">
          {!selectedId ? (
            <p className={styles.detailEmpty}>{loadingQueue ? 'Đang tải…' : 'Chọn một giao dịch trong hàng chờ để xem chi tiết.'}</p>
          ) : detailError?.id === selectedId ? (
            <p className={styles.detailEmpty} role="alert">{uiMessage(detailError.message)}{' '}
              <button type="button" className={styles.linkButton} onClick={reload}>Thử lại</button></p>
          ) : !activePayment ? (
            <p className={styles.detailEmpty} role="status">Đang tải chi tiết giao dịch…</p>
          ) : (
            <>
              <header className={styles.detailHeader}>
                <div>
                  <h2>{formatPaymentLabel(activePayment)}{activeDetail?.customerName ? ` · ${activeDetail.customerName}` : ''}</h2>
                  <p>
                    <span className={`${styles.kind} ${styles[kind.tone]}`}>{kind.text}</span>
                    {' '}Mã giao dịch #{activePayment.id}
                    {activePayment.submittedAt ? ` · Gửi chứng từ lúc ${activePayment.submittedAt.replace('T', ' ').slice(0, 16)}` : ''}
                    {' · '}Còn {resubmitsLeft}/3 lượt yêu cầu bổ sung
                  </p>
                </div>
                <span className={`${styles.badge} ${statusBadge.tone}`}>{statusBadge.text}</span>
              </header>

              {transferredToOwner && activePayment.status === 'AWAITING_CONFIRMATION' && (
                <p role="status" className={styles.noticeNeutral}>
                  {role === 'owner'
                    ? 'Giao dịch đã chờ quá 25 phút mà nhân viên chưa xác nhận nên được chuyển cho bạn xử lý.'
                    : 'Giao dịch đã chờ quá 25 phút mà chưa được xác nhận nên đã được chuyển cho chủ sân xử lý. (MSG118)'}
                </p>
              )}
              {overdue && !transferredToOwner && activePayment.status === 'AWAITING_CONFIRMATION' && (
                <p role="alert" className={styles.noticeDanger}>
                  <b>!</b> Giao dịch đã chờ{waited != null ? <> <b>{waited} phút</b></> : ' quá 15 phút'}. Hãy kiểm tra tiền về và xử lý ngay;
                  quá 25 phút trong giờ mở cửa giao dịch sẽ được chuyển cho chủ sân và bạn không xử lý được nữa.
                </p>
              )}

              <div className={styles.detailBody}>
                <div className={styles.infoColumn}>
                  <div className={styles.amountBox}>
                    <div>
                      <span>Số tiền phải thu</span>
                      <strong>{formatMoney(amountDue)}</strong>
                    </div>
                    {activePayment.receivedAmount != null && (
                      <small>Đã nhận trước đó {formatMoney(activePayment.receivedAmount)}</small>
                    )}
                  </div>

                  <dl className={styles.infoList}>
                    {surcharge ? (
                      <><dt>Yêu cầu đổi lịch</dt><dd>#{activePayment.rescheduleRequestId || selectedId}</dd></>
                    ) : (
                      <>
                        <dt>Khách / SĐT</dt>
                        <dd>{activeDetail?.customerName || 'Khách đặt trực tuyến'}{activeDetail?.customerPhone ? ` · ${activeDetail.customerPhone}` : ''}</dd>
                        <dt>Sân</dt>
                        <dd>{activeDetail?.courtName || (activeDetail?.sessions?.length ? `${activeDetail.sessions.length} buổi trong gói/đơn` : '—')}</dd>
                        <dt>Thời gian chơi</dt>
                        <dd>
                          {activeDetail?.playDate
                            ? `${activeDetail.playDate} · ${activeDetail.startTime}–${activeDetail.endTime}`
                            : activeDetail?.sessions?.[0]
                              ? `${activeDetail.sessions[0].playDate} · ${activeDetail.sessions[0].startTime}–${activeDetail.sessions[0].endTime}`
                              : '—'}
                        </dd>
                        <dt>Nội dung CK chuẩn</dt>
                        <dd className={styles.mono}>{activePayment.bookingCode || `PK${activePayment.packageId || activePayment.id}`}</dd>
                      </>
                    )}
                  </dl>

                  {activeDetail?.sessions?.length > 0 && (
                    <div className={styles.sessions}>
                      <strong>Danh sách buổi ({activeDetail.sessions.length})</strong>
                      {activeDetail.sessions.map((s) => (
                        <div key={s.bookingCode}>
                          <span>{s.bookingCode} · {s.courtName}</span>
                          <span>{s.playDate} ({s.startTime}–{s.endTime})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDetail?.note && (
                    <p className={styles.ownerNote}><strong>Ghi chú cho chủ sân:</strong> {activeDetail.note}</p>
                  )}

                  {canDecide && (
                    <div className={styles.formBlock}>
                      <label className={styles.fieldLabel} htmlFor="actual-amount">
                        Số tiền thực nhận <span>(chỉ nhập khi khách chuyển thừa hoặc thiếu)</span>
                      </label>
                      <input
                        className={styles.input}
                        id="actual-amount"
                        type="text"
                        inputMode="numeric"
                        placeholder={String(amountDue)}
                        value={actualAmount}
                        onChange={(event) => { setActualAmount(event.target.value); setAmountError(''); }}
                        aria-invalid={Boolean(amountError)}
                        aria-describedby={amountError ? 'amount-error' : undefined}
                        disabled={isProcessing}
                      />
                      {amountError && <p id="amount-error" className={styles.fieldError} role="alert">{amountError}</p>}
                      {isShortfall && (
                        <p className={styles.hintWarning}>
                          Khách còn thiếu {formatMoney(amountDue - parsedReceived)}. Không thể xác nhận; hãy bấm &ldquo;Yêu cầu bổ sung&rdquo; để khách chuyển bù phần thiếu.
                        </p>
                      )}
                      {isOverpaid && (
                        <p className={styles.hintSuccess}>
                          Khách chuyển thừa {formatMoney(parsedReceived - amountDue)}. Doanh thu ghi {formatMoney(amountDue)}, phần thừa lưu để đối soát và báo chủ sân.
                        </p>
                      )}

                      <label className={styles.fieldLabel} htmlFor="payment-reason">
                        Lý do <span>(khi yêu cầu bổ sung hoặc từ chối)</span>
                      </label>
                      <select
                        id="payment-reason"
                        className={styles.input}
                        value={reasonCode}
                        onChange={(event) => { setReasonCode(event.target.value); setReasonError(''); }}
                        aria-invalid={Boolean(reasonError)}
                        aria-describedby={reasonError ? 'reason-error' : undefined}
                      >
                        <option value="">Chọn lý do</option>
                        {REASONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                      </select>
                      {reasonError && <p id="reason-error" className={styles.fieldError} role="alert">{reasonError}</p>}
                      <p className={styles.muted}>
                        Người chơi còn <strong>{resubmitsLeft}</strong> lượt gửi lại chứng từ (tối đa 3 lần). Căn cứ xác nhận là tiền thực về tài khoản ngân hàng của địa điểm.
                      </p>
                    </div>
                  )}
                </div>

                <div className={styles.proofPanel}>
                  <div className={styles.proofTools}>
                    <span>Ảnh chứng từ{proofs.length > 0 ? ` (${proofs.length})` : ''}</span>
                    <span>
                      <button type="button" disabled={!activeProofUrl} onClick={() => setRotation((deg) => (deg + 90) % 360)}>⟲ Xoay</button>
                      <button type="button" disabled={!activeProofUrl} onClick={() => setIsProofOpen(true)}>＋ Phóng to</button>
                    </span>
                  </div>
                  <button className={styles.proofPreview} type="button" onClick={() => setIsProofOpen(true)}
                    aria-label="Phóng to ảnh chứng từ" disabled={!activeProofUrl}>
                    {activeProofUrl ? (
                      <img src={activeProofUrl} alt="Chứng từ chuyển khoản" style={{ transform: `rotate(${rotation}deg)` }} />
                    ) : (
                      <span role={proofError ? 'alert' : 'status'}>
                        {proofError || (activeProofId ? 'Đang tải ảnh chứng từ…' : 'Giao dịch chưa có chứng từ.')}
                      </span>
                    )}
                  </button>
                  {proofs.length > 1 && (
                    <div className={styles.proofThumbs} role="group" aria-label="Chọn ảnh chứng từ">
                      {proofs.map((p, idx) => (
                        <button key={p.id} type="button" aria-pressed={selectedProofId === p.id}
                          className={selectedProofId === p.id ? styles.thumbOn : ''}
                          onClick={() => { if (p.id !== selectedProofId) { setProof(null); setRotation(0); setSelectedProofId(p.id); } }}>
                          Lần {proofs.length - idx}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {canDecide && (
                <footer className={styles.actions}>
                  <span className={styles.shortcutHint}>Phím tắt: <kbd>A</kbd> xác nhận · <kbd>R</kbd> yêu cầu bổ sung</span>
                  <div>
                    <button className={styles.dangerButton} type="button" disabled={isProcessing} onClick={() => prepare('reject')}>
                      Từ chối
                    </button>
                    <button className={styles.secondaryButton} type="button" disabled={isProcessing} onClick={() => prepare('request-resubmission')}>
                      Yêu cầu bổ sung
                    </button>
                    <button className={styles.primaryButton} type="button" disabled={isProcessing || isShortfall} onClick={() => prepare('confirm')}>
                      ✓ Xác nhận đã nhận tiền
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </section>
      </div>

      {decision && <F1Dialog title="Xác nhận thao tác" message={dialogMessage}
        onClose={() => setDecision(null)} onConfirm={perform} />}

      {showReconciliation && <ReconciliationDialog onClose={() => setShowReconciliation(false)} />}

      {isProofOpen && activePayment && (
        <div className={styles.proofOverlay} role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setIsProofOpen(false); }}>
          <section className={styles.proofModal} role="dialog" aria-modal="true" aria-label="Ảnh chứng từ thanh toán">
            <header>
              <strong>Chứng từ thanh toán · {formatPaymentLabel(activePayment)}</strong>
              <span>
                <button type="button" onClick={() => setRotation((deg) => (deg + 90) % 360)}>⟲ Xoay</button>
                <button type="button" onClick={() => setIsProofOpen(false)}>Đóng</button>
              </span>
            </header>
            <div className={styles.proofLarge}>
              {activeProofUrl
                ? <img src={activeProofUrl} alt="Chứng từ thanh toán" style={{ transform: `rotate(${rotation}deg)` }} />
                : <p role={proofError ? 'alert' : 'status'}>{proofError || 'Giao dịch chưa có ảnh chứng từ.'}</p>}
            </div>
          </section>
        </div>
      )}
    </ManagementLayout>
  );
}
