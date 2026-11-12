import api from './index'

const targets = {
  booking: '/bookings',
  package: '/booking-packages',
  reschedule: '/reschedule-requests',
}

export async function loadPayment({ kind, id }, signal) {
  const path = `${targets[kind]}/${id}`
  const { data: { data: detail } } = await api.get(path, { signal })
  const payment = kind === 'reschedule' && detail.extraAmount > 0 && detail.status !== 'PENDING_PAYMENT'
    ? (await api.get(`${path}/payment`, { signal })).data.data
    : kind !== 'reschedule' && detail.paymentId
      ? (await api.get(`/payments/${detail.paymentId}`, { signal })).data.data
      : null
  const resubmitting = (payment?.status ?? detail.status) === 'RESUBMIT_REQUESTED'
  const awaiting = detail.status === 'AWAITING_CONFIRMATION' && !resubmitting
  const canPay = detail.status === (kind === 'reschedule' ? 'PENDING_PAYMENT' : 'HOLDING')
    || (resubmitting && Boolean(payment?.id ?? detail.paymentId))
  const result = {
    code: detail.bookingCode || (kind === 'reschedule' ? `Đổi lịch #${id}`
      : detail.packageType === 'DAY' ? `Đơn #${id}` : `Gói #${id}`),
    bookingId: kind === 'reschedule' ? detail.bookingId : kind === 'package' ? detail.sessions?.[0]?.id : id,
    status: detail.status,
    amount: detail.extraAmount ?? detail.finalAmount,
    awaiting,
    canPay,
    paymentId: payment?.id ?? detail.paymentId,
    resubmitting,
    deadline: resubmitting ? (payment?.resubmitDeadline ?? detail.resubmitDeadline) : detail.holdExpiresAt,
    reason: payment?.resubmitReason ?? detail.resubmitReason,
    resubmitsLeft: payment?.resubmitsLeft ?? detail.resubmitsLeft ?? detail.remainingResubmissions,
    receivedAmount: payment?.receivedAmount,
    rejectReason: payment?.rejectReason,
    receiptNo: payment?.receiptNo ?? detail.receiptNo,
    confirmedAt: payment?.confirmedAt,
    submittedAt: payment?.submittedAt,
  }
  if (!canPay) return result
  try {
    const { data: { data: instructions } } = await api.get(`${path}/payment-instructions`, { signal })
    return { ...result, instructions, amount: instructions.amountDue,
      deadline: result.deadline ?? instructions.holdExpiresAt }
  } catch (cause) {
    const message = cause.response?.data?.message || ''
    if (message.includes('MSG33') || message.includes('MSG52')) {
      return { ...result, status: 'EXPIRED', canPay: false }
    }
    if (cause.response?.status === 409) {
      const { data: { data: current } } = await api.get(path, { signal })
      if (current.status !== detail.status) return { ...result, status: current.status, canPay: false,
        awaiting: current.status === 'AWAITING_CONFIRMATION', receiptNo: current.receiptNo,
        paymentId: current.paymentId }
    }
    throw cause
  }
}

export async function submitPaymentProof({ kind, id }, payment, proof) {
  const body = new FormData()
  body.append('proof', proof)
  const paymentResource = kind === 'reschedule' ? 'reschedule-payments' : 'payments'
  const path = payment.resubmitting
    ? `/${paymentResource}/${payment.paymentId}/resubmit`
    : `${targets[kind]}/${id}/payments`
  const { data } = await api.post(path, body)
  return data.data
}

export async function loadPaymentImage(path, signal) {
  if (!path?.startsWith('/api/') || path.includes('\\')) throw new Error('Invalid image path.')
  const { data } = await api.get(path.slice('/api'.length), { responseType: 'blob', signal })
  return data
}

export async function getReschedulePaymentDetail(paymentId, signal) {
  const { data } = await api.get(`/reschedule-payments/${paymentId}`, { signal })
  return data.data
}

export async function listPendingReschedulePayments(signal) {
  const { data } = await api.get('/staff/reschedule-payments', { signal })
  return data.data
}

export async function getLatestRescheduleProof(paymentId, signal) {
  const { data } = await api.get(`/staff/reschedule-payments/${paymentId}`, { signal })
  const proof = data.data.proofs.at(-1)
  return proof ? loadPaymentImage(`/api/payments/${paymentId}/proofs/${proof.id}/image`, signal) : null
}

export async function decideReschedulePayment(paymentId, decision, payload) {
  const { data } = await api.post(`/staff/reschedule-payments/${paymentId}/${decision}`, payload)
  return data.data
}

export async function listPendingStaffBookingPayments(signal) {
  // Danh sách chỉ có thông tin thanh toán phẳng; màn Staff cần khách, sân, giờ chơi, chứng từ
  // nên tải thêm chi tiết từng giao dịch: { payment, customerName, courtName, ..., proofs }.
  const { data } = await api.get('/staff/payments?status=AWAITING_CONFIRMATION&size=50', { signal });
  const payments = data.data.content;
  return Promise.all(payments.map(async (payment) => {
    const res = await api.get('/staff/payments/' + payment.id, { signal });
    return res.data.data;
  }));
}

export async function getStaffBookingProofImage(paymentId, proofId, signal) {
  return loadPaymentImage('/api/payments/' + paymentId + '/proofs/' + proofId + '/image', signal);
}

export async function decideStaffBookingPayment(paymentId, decision, payload) {
  const path = '/staff/payments/' + paymentId + '/' + decision;
  const { data } = await api.post(path, payload);
  return data.data;
}
