import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRescheduleRequestsApi } from '../../api/bookingChangeApi'
import { getReschedulePaymentDetail, loadPaymentImage } from '../../api/bookingPaymentApi'
import WorkspaceLayout, { Section } from '../WorkspaceLayout'
import { errorMessage, money, useResource } from '../workspaceSupport'

const requestStatus = {
  PENDING_PAYMENT: 'Chờ thanh toán phụ thu',
  AWAITING_CONFIRMATION: 'Chờ xử lý phụ thu',
  APPROVED: 'Đã đổi lịch',
  REJECTED: 'Bị từ chối · giữ lịch cũ',
  EXPIRED: 'Hết hạn · giữ lịch cũ',
}

const paymentStatus = {
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  RESUBMIT_REQUESTED: 'Cần gửi lại chứng từ',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã từ chối',
}

const clock = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')

function PaymentProof({ paymentId, proofId }) {
  const [image, setImage] = useState(null)
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
  }, [paymentId, proofId])

  if (!image) return <p role="status">Đang tải ảnh…</p>
  if (image.error) return <p role="alert">{image.error}</p>
  return <img className="max-h-96 max-w-full rounded-lg object-contain" src={image.url} alt="Chứng từ phụ thu đã gửi" />
}

function PaymentDetails({ paymentId }) {
  const load = useCallback((signal) => getReschedulePaymentDetail(paymentId, signal), [paymentId])
  const detail = useResource(load, paymentId)
  const [proofId, setProofId] = useState(null)
  const payment = detail.data?.payment

  return <div className="space-y-2">
    {detail.loading && <p role="status">Đang tải giao dịch…</p>}
    {detail.error && <p role="alert">{detail.error} <button type="button" onClick={detail.reload}>Thử lại</button></p>}
    {payment && <>
      <p>{paymentStatus[payment.status] ?? payment.status} · Phụ thu {money(payment.amountDue)}</p>
      {payment.receivedAmount != null && <p>Đã nhận {money(payment.receivedAmount)}</p>}
      {payment.resubmitReason && <p>Lý do yêu cầu gửi lại: {payment.resubmitReason}</p>}
      <div className="flex flex-wrap gap-3">
        {detail.data.proofs.map((proof, index) => <button key={proof.id} type="button" className="underline"
          aria-pressed={proofId === proof.id} onClick={() => setProofId(proofId === proof.id ? null : proof.id)}>
          Chứng từ {index + 1}
        </button>)}
      </div>
      {proofId && <PaymentProof key={proofId} paymentId={paymentId} proofId={proofId} />}
    </>}
  </div>
}

export function ReschedulePaymentDetail({ paymentId }) {
  const [expanded, setExpanded] = useState(false)
  return <details className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer font-semibold">Chi tiết giao dịch và chứng từ phụ thu</summary>
    {expanded && <PaymentDetails key={paymentId} paymentId={paymentId} />}
  </details>
}

function RequestList({ bookingId }) {
  const load = useCallback((signal) => getRescheduleRequestsApi(bookingId, signal), [bookingId])
  const requests = useResource(load, bookingId)

  return <Section title="Yêu cầu đã gửi" resource={requests}>
    {requests.data?.length === 0 && <p>Booking này chưa có yêu cầu đổi lịch.</p>}
    {requests.data?.map((item) => <article key={item.id} className="space-y-2 border-t py-3">
      <h3 className="font-semibold">#{item.id} · {requestStatus[item.status] ?? item.status}</h3>
      <p>Slot yêu cầu: {item.newDate} · Sân #{item.newCourtId} · {clock(item.newStartMinute)}–{clock(item.newEndMinute)}</p>
      <p>{item.free ? 'Đổi miễn phí do sân hủy' : 'Phụ thu ' + money(item.extraAmount)}</p>
      {item.extraAmount > 0 && <Link className="underline" to={'/booking/payment?rescheduleId=' + item.id}>
        {item.status === 'PENDING_PAYMENT' ? 'Thanh toán phụ thu' : 'Xem tình trạng và chứng từ phụ thu'}
      </Link>}
    </article>)}
  </Section>
}

export default function RescheduleHistoryPage() {
  const { bookingId } = useParams()
  return <WorkspaceLayout title="Lịch sử đổi lịch" role="player">
    {/^\d+$/.test(bookingId || '') && <RequestList bookingId={bookingId} />}
  </WorkspaceLayout>
}
