import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRescheduleRequestsApi } from '../../api/bookingApi'
import { getReschedulePaymentDetail, loadPaymentImage } from '../../api/bookingPaymentApi'
import PublicLayout from '../../components/layout/PublicLayout'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/common'
import { money, shortDate, uiMessage } from '../../utils/formatters'
import { bookingTimestamp } from '../../api/bookingHistory'
import styles from './RescheduleHistoryPage.module.css'
import { errorMessage, useResource } from '../workspaceSupport'

const price = (value) => money(value).replace(/\s*₫/, 'đ')
const timestamp = (value) => new Date(bookingTimestamp(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')

function PaymentProof({ paymentId, proofId }) {
  const [image, setImage] = useState(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let url
    loadPaymentImage('/api/payments/' + paymentId + '/proofs/' + proofId + '/image', controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(data)
        setImage({ url })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setImage({ error: errorMessage(error) })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [paymentId, proofId, revision])

  if (!image) return <LoadingState message="Đang tải ảnh chứng từ…" />
  if (image.error) return <ErrorState message={uiMessage(image.error)} onRetry={() => { setImage(null); setRevision((value) => value + 1) }} />
  return <img className={styles.proofImage} src={image.url} alt="Chứng từ phụ thu đã gửi" />
}

function PaymentDetails({ paymentId }) {
  const load = useCallback((signal) => getReschedulePaymentDetail(paymentId, signal), [paymentId])
  const detail = useResource(load, paymentId)
  const [proofId, setProofId] = useState(null)
  const payment = detail.data?.payment

  return <div className={styles.paymentDetails}>
    {detail.loading && <LoadingState message="Đang tải giao dịch…" />}
    {detail.error && <ErrorState message={uiMessage(detail.error)} onRetry={detail.reload} />}
    {payment && <>
      <p><StatusBadge category={payment.status === 'REJECTED' ? 'reschedule' : 'booking'} status={payment.status} /> · Phụ thu {price(payment.amountDue)}</p>
      {payment.receiptNo && <p>Biên nhận: <strong>{payment.receiptNo}</strong>{payment.confirmedAt && ' · ' + timestamp(payment.confirmedAt)}</p>}
      {payment.receivedAmount != null && <p>Đã nhận {price(payment.receivedAmount)}</p>}
      {payment.resubmitReason && <p>Lý do yêu cầu gửi lại: {payment.resubmitReason}</p>}
      <div className={styles.proofButtons}>
        {detail.data.proofs.map((proof, index) => <Button variant="secondary" key={proof.id} type="button"
          aria-pressed={proofId === proof.id} onClick={() => setProofId(proofId === proof.id ? null : proof.id)}>
          Chứng từ {index + 1}
        </Button>)}
      </div>
      {proofId && <PaymentProof key={proofId} paymentId={paymentId} proofId={proofId} />}
    </>}
  </div>
}

export function ReschedulePaymentDetail({ paymentId }) {
  const [expanded, setExpanded] = useState(false)
  return <details className={styles.paymentDisclosure}
    onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>Chi tiết giao dịch và chứng từ phụ thu</summary>
    {expanded && <PaymentDetails key={paymentId} paymentId={paymentId} />}
  </details>
}

function RequestList({ bookingId }) {
  const load = useCallback((signal) => getRescheduleRequestsApi(bookingId, signal), [bookingId])
  const requests = useResource(load, bookingId)

  return <section className={styles.requests} aria-label="Yêu cầu đã gửi">
    {requests.loading && <LoadingState message="Đang tải lịch sử đổi lịch…" />}
    {requests.error && <ErrorState message={uiMessage(requests.error)} onRetry={requests.reload} />}
    {!requests.loading && !requests.error && requests.data?.length === 0 && <EmptyState title="Chưa có yêu cầu đổi lịch"
      description="Các yêu cầu đổi lịch và kết quả xử lý sẽ xuất hiện tại đây. Mở chi tiết lịch đặt sân để xem thao tác hiện có."
      action={<Link className={styles.actionLink} to="/my-bookings">Về lịch đặt sân</Link>} />}
    {!requests.loading && !requests.error && requests.data?.map((item) => <article key={item.id} className={styles.requestCard}>
      <div className={styles.requestHeader}><h2>Yêu cầu #{item.id}</h2><StatusBadge category="reschedule" status={item.status} /></div>
      <p className={styles.scheduleLine}>{shortDate(item.newDate)} · {clock(item.newStartMinute)}–{clock(item.newEndMinute)}</p>
      <p>{item.newCourtName || 'Sân không khả dụng'}</p>
      <div className={styles.amountRow}><span>{item.free ? 'Đổi miễn phí do sân hủy' : 'Phụ thu chênh lệch'}</span><strong>{price(item.extraAmount || 0)}</strong></div>
      {['REJECTED', 'EXPIRED'].includes(item.status) && <p className={styles.notice}>Yêu cầu chưa có hiệu lực. Lịch cũ được giữ nguyên.</p>}
      {item.extraAmount > 0 && <Link className={styles.actionLink} to={'/booking/payment?rescheduleId=' + item.id}>
        {item.status === 'PENDING_PAYMENT' ? 'Thanh toán phụ thu' : 'Xem tình trạng và chứng từ phụ thu'}
      </Link>}
    </article>)}
  </section>
}

export default function RescheduleHistoryPage() {
  const { bookingId } = useParams()
  return <PublicLayout fullWidth><div className={styles.page}>
    <PageHeader title="Lịch sử đổi lịch" subtitle="Theo dõi khung giờ mới, phụ thu và kết quả xử lý từng yêu cầu."
      backTo={{ to: '/my-bookings', label: 'Về lịch đặt sân' }} />
    {/^\d+$/.test(bookingId || '') && <RequestList bookingId={bookingId} />}
  </div></PublicLayout>
}
