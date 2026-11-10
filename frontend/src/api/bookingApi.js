import api from './index';

// F3/F4 nối backend thật (UC14–UC19). Mock cũ đã bỏ; xem lịch sử git nếu cần dữ liệu mẫu.

const STATUS_NAMES = {
  holding: 'Holding',
  awaiting_confirmation: 'Awaiting Confirmation',
  resubmit_requested: 'Resubmit Requested',
  confirmed: 'Confirmed',
  in_use: 'In Use',
  completed: 'Completed',
  payment_rejected: 'Payment Rejected',
  expired: 'Expired',
  cancelled_by_player: 'Cancelled by Player',
  cancelled_by_facility: 'Cancelled by Facility',
};

const lower = (value) => String(value || '').toLowerCase();
const toNumber = (value) => Number(value ?? 0);

/** "HH:mm" hoặc "HH:mm:ss" → số phút tính từ 00:00 (backend dùng startMinute/endMinute). */
export function toMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Số phút → "HH:mm"; 1440 hiển thị là 24:00. */
export function toTimeLabel(minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

const packageCode = (packageId) => `PK-${packageId}`;

// ===================== UC14: đặt sân lẻ =====================

/** FR75: số điểm Player đang có tại địa điểm (GET /api/me/loyalty-balances). */
export async function getMyPointsAtFacility(facilityId) {
  const res = await api.get('/me/loyalty-balances', { params: { size: 100 } });
  const balances = res.data?.data?.content || [];
  const balance = balances.find((item) => item.locationId === Number(facilityId));
  return {
    success: true,
    data: {
      facility_id: facilityId,
      available_points: balance?.pointBalance ?? 0,
      point_value_vnd: 500, // P10
    },
  };
}

/** FR37, BR09: đội Player làm chủ (GET /api/me/teams, lọc captain). */
export async function getMyOwnedTeams() {
  const res = await api.get('/me/teams');
  const teams = (res.data?.data || []).filter((team) => team.captain);
  return {
    success: true,
    data: teams.map((team) => ({ team_id: team.id, team_name: team.name })),
  };
}

/**
 * Lựa chọn của màn tóm tắt → BookingRequest của backend. selection: { courtId, date, startTime, endTime }
 * (giờ dạng "HH:mm", endTime là giờ kết thúc của slot cuối).
 */
function toBookingRequest({ selection, voucherCode, pointsToUse, note, teamId }) {
  return {
    courtId: selection.courtId,
    date: selection.date,
    startMinute: toMinutes(selection.startTime),
    endMinute: toMinutes(selection.endTime),
    voucherCode: voucherCode || null,
    voucherGrantId: null,
    pointsToUse: pointsToUse || 0,
    note: note || null,
    teamId: teamId || null,
  };
}

/** UC14 #3–#5: tính tiền ở màn tóm tắt (POST /api/bookings/summary). Không giữ chỗ, không trừ voucher/điểm. */
export async function previewBookingSummaryApi(params) {
  const res = await api.post('/bookings/summary', toBookingRequest(params));
  const data = res.data?.data;
  return {
    success: true,
    data: {
      ...data,
      listAmount: toNumber(data?.listAmount),
      voucherDiscount: toNumber(data?.voucherDiscount),
      pointDiscount: toNumber(data?.pointDiscount),
      finalAmount: toNumber(data?.finalAmount),
    },
  };
}

/** UC14 #4: kiểm tra mã voucher bằng chính API tóm tắt, để số giảm khớp với lúc tạo booking. */
export async function applyVoucherApi({ selection, voucher_code }) {
  const res = await previewBookingSummaryApi({ selection, voucherCode: voucher_code, pointsToUse: 0 });
  const discount = res.data.voucherDiscount;
  return {
    success: true,
    data: {
      voucher_code,
      discount_amount: discount,
      description: `-${discount.toLocaleString('vi-VN')} VND`,
    },
  };
}

/** UC14 #6–#8: tạo booking, giữ chỗ (POST /api/bookings); trả dữ liệu màn thanh toán UC18. */
export async function createBookingApi(params) {
  const res = await api.post('/bookings', toBookingRequest(params));
  const booking = res.data?.data;
  return {
    success: true,
    message: res.data?.message,
    data: await loadPaymentContextApi({ kind: 'booking', id: booking.id }),
  };
}

// ===================== UC14, BR64: đơn đặt lẻ nhiều dải trong một ngày =====================

/**
 * Gom các slot đã chọn (cùng một ngày) thành dải: các slot liền nhau trên cùng một sân là một dải (BR01).
 * slots: [{ courtId, courtName, time: "HH:mm", price }]. Trả [{ courtId, courtName, startTime, endTime, slots }].
 */
export function groupSlotsIntoRanges(slots) {
  const sorted = [...slots].sort((a, b) => a.courtId - b.courtId || toMinutes(a.time) - toMinutes(b.time));
  const ranges = [];
  sorted.forEach((slot) => {
    const start = toMinutes(slot.time);
    const last = ranges[ranges.length - 1];
    if (last && last.courtId === slot.courtId && toMinutes(last.endTime) === start) {
      last.endTime = toTimeLabel(start + 30);
      last.slots.push(slot);
    } else {
      ranges.push({
        courtId: slot.courtId,
        courtName: slot.courtName,
        startTime: slot.time,
        endTime: toTimeLabel(start + 30),
        slots: [slot],
      });
    }
  });
  return ranges;
}

function toOrderRequest({ date, ranges, voucherCode, pointsToUse, note, teamId }) {
  return {
    date,
    ranges: ranges.map((range) => ({
      courtId: range.courtId,
      startMinute: toMinutes(range.startTime),
      endMinute: toMinutes(range.endTime),
    })),
    voucherCode: voucherCode || null,
    voucherGrantId: null,
    pointsToUse: pointsToUse || 0,
    note: note || null,
    teamId: teamId || null,
  };
}

/** UC14 #3–5 (đơn): tính tiền cả đơn, dải bị trùng (POST /api/booking-orders/preview). */
export async function previewOrderApi(params) {
  const res = await api.post('/booking-orders/preview', toOrderRequest(params));
  const data = res.data?.data;
  return {
    success: true,
    data: {
      ...data,
      listAmount: toNumber(data?.listAmount),
      voucherDiscount: toNumber(data?.voucherDiscount),
      pointDiscount: toNumber(data?.pointDiscount),
      finalAmount: toNumber(data?.finalAmount),
    },
  };
}

/** UC14 #6–8 (đơn): tạo đơn giữ chỗ 10 phút (POST /api/booking-orders); trả dữ liệu màn thanh toán UC18. */
export async function createOrderApi(params) {
  const res = await api.post('/booking-orders', toOrderRequest(params));
  const order = res.data?.data;
  return {
    success: true,
    message: res.data?.message,
    data: await loadPaymentContextApi({ kind: 'package', id: order.id, extra: { booking_code: orderCode(order.id) } }),
  };
}

/** UC22, BR64: hủy cả đơn (POST /api/booking-orders/{id}/cancel). */
export async function cancelOrderApi(orderId) {
  const res = await api.post(`/booking-orders/${orderId}/cancel`);
  return res.data;
}

const orderCode = (orderId) => `OD-${orderId}`;

// ===================== UC15: đặt nhiều buổi =====================

/** Danh sách sân của địa điểm (GET /api/locations/{id}/courts). */
export async function getLocationCourtsApi(locationId) {
  const res = await api.get(`/locations/${locationId}/courts`);
  return (res.data?.data || []).map((court) => ({ court_id: court.id, court_name: court.name }));
}

/** UC15 #4, #5, #10: sinh buổi, đánh dấu buổi trùng (POST /api/booking-packages/preview). request là PackageRequest. */
export async function previewBookingPackageApi(request) {
  const res = await api.post('/booking-packages/preview', request);
  return res.data?.data;
}

/** UC15 #8, #11: xác nhận lịch, tạo gói giữ chỗ 15 phút (POST /api/booking-packages); trả dữ liệu màn UC18. */
export async function createBookingPackageApi(request) {
  const res = await api.post('/booking-packages', request);
  const pkg = res.data?.data;
  return {
    success: true,
    message: res.data?.message,
    data: await loadPaymentContextApi({ kind: 'package', id: pkg.id }),
  };
}

// ===================== UC18: thanh toán =====================

/**
 * Dữ liệu cho màn thanh toán (sessionStorage 'active_holding_booking'): số tiền, tài khoản nhận, hạn giữ chỗ.
 * kind 'booking' | 'package'. Với booking chờ bổ sung, extra mang payment_id, lý do và hạn gửi lại.
 */
export async function loadPaymentContextApi({ kind, id, extra = {} }) {
  const path = kind === 'package' ? `/booking-packages/${id}` : `/bookings/${id}`;
  let instructions = null;
  try {
    const res = await api.get(`${path}/payment-instructions`);
    instructions = res.data?.data;
  } catch (err) {
    if (!extra.status) throw err;
  }
  const code = instructions?.bookingCode || extra.booking_code || (kind === 'package' ? packageCode(id) : `#${id}`);
  return {
    kind,
    booking_id: id,
    booking_code: code,
    status: lower(instructions?.status || extra.status),
    hold_expires_at: instructions?.holdExpiresAt || extra.hold_expires_at || null,
    payment_id: extra.payment_id ?? null,
    resubmit_reason: extra.resubmit_reason ?? null,
    resubmit_attempts_left: extra.resubmit_attempts_left ?? 3,
    pricing_summary: {
      final_amount: toNumber(instructions?.amountDue ?? extra.final_amount),
    },
    bank_info: {
      bank_name: instructions?.bankName || '',
      bank_account_number: instructions?.bankAccountNo || '',
      bank_account_holder: instructions?.bankAccountHolder || '',
      qr_image_url: instructions?.qrImageUrl || null,
      transfer_content: code,
    },
  };
}

/**
 * UC18 #2–#4: gửi ảnh chứng từ. Booking chờ bổ sung gửi lại theo payment_id (POST /api/payments/{id}/resubmit);
 * còn lại báo chuyển khoản lần đầu cho booking hoặc gói.
 */
export async function uploadPaymentProofApi({ context, file }) {
  const form = new FormData();
  form.append('proof', file);
  let url;
  if (context.status === 'resubmit_requested' && context.payment_id) {
    url = `/payments/${context.payment_id}/resubmit`;
  } else if (context.kind === 'package') {
    url = `/booking-packages/${context.booking_id}/payments`;
  } else {
    url = `/bookings/${context.booking_id}/payments`;
  }
  const res = await api.post(url, form);
  return res.data;
}

// ===================== UC17: lịch sử booking =====================

function mapSingleBooking(item) {
  const status = lower(item.status);
  return {
    kind: 'booking',
    entity_id: item.id,
    booking_id: item.id,
    booking_code: item.bookingCode,
    booking_type: 'single',
    status,
    status_name: STATUS_NAMES[status] || item.status,
    facility_id: item.locationId,
    facility_name: item.locationName,
    court_name: item.courtName,
    booking_date: item.playDate,
    time_range: `${item.startTime} – ${item.endTime}`,
    final_amount: toNumber(item.finalAmount),
    hold_expires_at: item.holdExpiresAt,
    created_at: item.createdAt,
    can_cancel: status === 'confirmed',
    can_reschedule: false,
    can_open_match: false,
    can_complain: false,
  };
}

function mapPackage(item) {
  const status = lower(item.status);
  // BR64: đơn đặt lẻ lưu như gói loại DAY
  const isOrder = item.packageType === 'DAY';
  return {
    kind: 'package',
    is_order: isOrder,
    entity_id: item.id,
    booking_id: `P${item.id}`,
    booking_code: isOrder ? orderCode(item.id) : packageCode(item.id),
    booking_type: isOrder ? 'order' : 'recurring',
    status,
    status_name: STATUS_NAMES[status] || item.status,
    facility_id: item.locationId,
    facility_name: isOrder ? `Order · ${item.locationName}` : `Package · ${item.locationName}`,
    court_name: isOrder ? `${item.sessionCount} bookings` : `${item.sessionCount} sessions`,
    booking_date: item.startDate,
    time_range: isOrder
      ? `${item.startDate} · ${item.sessionCount} bookings`
      : `${item.startDate} – ${item.endDate} · ${item.sessionCount} sessions`,
    final_amount: toNumber(item.finalAmount),
    hold_expires_at: item.holdExpiresAt,
    created_at: item.createdAt,
    // BR64: hủy đơn là hủy cả đơn
    can_cancel: isOrder && status === 'confirmed',
    can_reschedule: false,
    can_open_match: false,
    can_complain: false,
  };
}

/** Booking chờ bổ sung cần payment_id, lý do, hạn và số lượt còn lại để gửi lại chứng từ (BR34). */
async function withResubmitInfo(item) {
  if (item.status !== 'resubmit_requested') return item;
  const path = item.kind === 'package' ? `/booking-packages/${item.entity_id}` : `/bookings/${item.entity_id}`;
  const detail = (await api.get(path)).data?.data;
  if (!detail?.paymentId) return item;
  const payment = (await api.get(`/payments/${detail.paymentId}`)).data?.data;
  return {
    ...item,
    payment_id: detail.paymentId,
    resubmit_reason: detail.resubmitReason,
    resubmit_deadline: detail.resubmitDeadline,
    resubmit_attempts_left: payment?.resubmitsLeft ?? 0,
  };
}

/** UC17 #1–#3: booking lẻ và gói của Player (GET /api/me/bookings, /api/me/booking-packages). */
export async function getMyBookingsApi() {
  const [bookingsRes, packagesRes] = await Promise.all([
    api.get('/me/bookings', { params: { size: 100 } }),
    api.get('/me/booking-packages', { params: { size: 100 } }),
  ]);
  const items = [
    ...(bookingsRes.data?.data?.content || []).map(mapSingleBooking),
    ...(packagesRes.data?.data?.content || []).map(mapPackage),
  ];
  return {
    success: true,
    data: { items: await Promise.all(items.map(withResubmitInfo)) },
  };
}

/** UC17 #5: dữ liệu màn thanh toán khi bấm Tiếp tục thanh toán / Gửi lại chứng từ. */
export async function loadPaymentContextForItemApi(item) {
  return loadPaymentContextApi({
    kind: item.kind,
    id: item.entity_id,
    extra: {
      booking_code: item.booking_code,
      status: item.status,
      final_amount: item.final_amount,
      // Booking chờ bổ sung không còn giữ chỗ; đồng hồ của màn thanh toán đếm đến hạn gửi lại.
      hold_expires_at: item.status === 'resubmit_requested' ? item.resubmit_deadline : item.hold_expires_at,
      payment_id: item.payment_id,
      resubmit_reason: item.resubmit_reason,
      resubmit_attempts_left: item.resubmit_attempts_left,
    },
  });
}

/** UC22 #1, BR07: Player hủy booking đã xác nhận (POST /api/bookings/{id}/cancel). */
export async function cancelBookingApi(bookingId) {
  const res = await api.post(`/bookings/${bookingId}/cancel`);
  return res.data;
}

// ===================== UC19: Staff xác nhận thanh toán =====================

function waitingLabel(submittedAt) {
  if (!submittedAt) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'}`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDayMonth(date) {
  if (!date) return '';
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function mapStaffPayment(detail) {
  const payment = detail.payment;
  const isPackage = payment.packageId != null;
  const sessions = detail.sessions || [];
  // Đơn đặt lẻ (BR64): mọi booking cùng một ngày; hiện từng dải thay vì số buổi
  const oneDay = isPackage && sessions.length > 0 && sessions.every((s) => s.playDate === sessions[0].playDate);
  const code = payment.bookingCode || (oneDay ? orderCode(payment.packageId) : packageCode(payment.packageId));
  const proofs = detail.proofs || [];
  return {
    id: payment.id,
    code,
    customer: detail.customerName,
    court: isPackage ? (oneDay ? [...new Set(sessions.map((s) => s.courtName))].join(', ') : `${sessions.length} sessions`) : detail.courtName,
    playDate: isPackage && !oneDay
      ? `${formatDayMonth(sessions[0]?.playDate)} – ${formatDayMonth(sessions[sessions.length - 1]?.playDate)}`
      : formatDayMonth(isPackage ? sessions[0]?.playDate : detail.playDate),
    playTime: isPackage
      ? (oneDay ? sessions.map((s) => `${s.courtName} ${s.startTime}–${s.endTime}`).join('; ') : `${sessions.length} sessions`)
      : `${detail.startTime} – ${detail.endTime}`,
    listTime: isPackage ? formatDayMonth(sessions[0]?.playDate) : detail.startTime,
    phone: detail.customerPhone,
    transferContent: code,
    amountDue: toNumber(payment.amountDue),
    actualAmount: toNumber(payment.amountDue),
    waiting: waitingLabel(payment.submittedAt),
    overdue: false,
    attempt: 3 - (payment.resubmitsLeft ?? 3) + 1,
    resubmissionsLeft: payment.resubmitsLeft ?? 3,
    note: detail.note || '',
    sessions,
    proofImageUrl: proofs.length ? proofs[proofs.length - 1].imageUrl : null,
  };
}

/** UC19 #1–#2: giao dịch chờ xác nhận của địa điểm, kèm chi tiết (GET /api/staff/payments, /{id}). */
export async function listPendingPaymentsApi() {
  const res = await api.get('/staff/payments', { params: { size: 50 } });
  const payments = res.data?.data?.content || [];
  const details = await Promise.all(payments.map((payment) => api.get(`/staff/payments/${payment.id}`)));
  return details.map((detail) => mapStaffPayment(detail.data.data));
}

/** UC19 #3: xác nhận; receivedAmount là số thực nhận khi khách chuyển thừa (BR51). */
export async function confirmPaymentApi(paymentId, receivedAmount) {
  const res = await api.post(`/staff/payments/${paymentId}/confirm`, { receivedAmount: receivedAmount || null });
  return res.data;
}

/** UC19 #4: yêu cầu bổ sung; playerAtFault = false thì không trừ lượt gửi lại (BR34). */
export async function requestResubmissionApi(paymentId, reason, playerAtFault) {
  const res = await api.post(`/staff/payments/${paymentId}/request-resubmission`, { reason, playerAtFault });
  return res.data;
}

/** UC19 #5: từ chối thanh toán. */
export async function rejectPaymentApi(paymentId, reason) {
  const res = await api.post(`/staff/payments/${paymentId}/reject`, { reason });
  return res.data;
}
