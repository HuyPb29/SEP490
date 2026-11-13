import { enrichHistoryEntry } from './bookingHistory';
import api, { getAllPages } from './index';

export function toMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function toTimeLabel(minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function getMyPointsAtFacility(locationId) {
  const balances = await getAllPages('/me/loyalty-balances');
  return balances.find((balance) => balance.locationId === Number(locationId))?.pointBalance ?? 0;
}

export async function getMyOwnedTeams() {
  const { data } = await api.get('/me/teams');
  return (data.data || [])
    .filter((team) => team.captain)
    .map((team) => ({ ...team, team_id: team.id, team_name: team.name }));
}

export async function getPublicBatchOffers(locationId, signal) {
  const { data } = await api.get('/locations/' + locationId + '/batch-offers', { signal, skipAuth: true });
  return data.data;
}

const venueDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

export function voucherGrantState({ voucher, grantStatus, expiresAt }, now = new Date()) {
  if (grantStatus !== 'AVAILABLE') return grantStatus;
  const day = venueDate.format(now);
  const expiry = expiresAt && Date.parse(/Z$|[+-]\d{2}:\d{2}$/.test(expiresAt) ? expiresAt : expiresAt + '+07:00');
  if (voucher.status === 'EXPIRED' || (voucher.validTo && voucher.validTo < day) || (expiry && expiry <= now.getTime())) return 'EXPIRED';
  if ((voucher.status && voucher.status !== 'PUBLISHED') || (voucher.validFrom && voucher.validFrom > day)) return 'UNAVAILABLE';
  return 'AVAILABLE';
}

export async function getCheckoutVouchers(locationId) {
  const [publicVouchers, grants] = await Promise.all([
    getAllPages('/locations/' + locationId + '/vouchers'),
    getAllPages('/me/vouchers'),
  ]);
  const now = new Date();
  return {
    publicVouchers,
    grants: grants.filter((grant) =>
      grant.voucher.locationId === locationId && voucherGrantState(grant, now) === 'AVAILABLE'
    ),
  };
}

export async function applyVoucherApi({ locationId, orderAmount, selection }) {
  const { data } = await api.post('/vouchers/check', { locationId, orderAmount, selection });
  return data.data;
}

export async function previewBookingApi(payload, signal) {
  const { data } = await api.post('/bookings/summary', payload, { signal });
  return data.data;
}

export async function createBookingApi(payload) {
  const { data } = await api.post('/bookings', payload);
  return data.data;
}

export async function previewBookingPackageApi(payload, signal) {
  const { data } = await api.post('/booking-packages/preview', payload, { signal });
  return data.data;
}

export async function previewDayOrderApi(payload, signal) {
  const { data } = await api.post('/booking-orders/preview', payload, { signal });
  return data.data;
}

export async function createDayOrderApi(payload) {
  const { data } = await api.post('/booking-orders', payload);
  return data.data;
}

export async function createBookingPackageApi(payload) {
  const { data } = await api.post('/booking-packages', payload);
  return data.data;
}

// UC18: Tải lên ảnh chứng từ chuyển khoản cho đơn đặt sân
export async function uploadPaymentProofApi({ bookingId, file }) {
  if (!file) {
    const msg = 'Vui lòng đính kèm ảnh chứng từ thanh toán. (MSG106)';
    const err = new Error(msg);
    err.response = { data: { code: 'MSG106', message: msg } };
    throw err;
  }
  const formData = new FormData();
  formData.append('proof', file);
  const { data } = await api.post(`/bookings/${bookingId}/payments`, formData);
  return data.data;
}

const bookingLabels = {
  holding: 'Đang giữ chỗ',
  awaiting_confirmation: 'Chờ xác nhận',
  resubmit_requested: 'Chờ bổ sung chứng từ',
  confirmed: 'Đã xác nhận',
  in_use: 'Đang chơi',
  completed: 'Đã hoàn tất',
  expired: 'Hết hạn',
  payment_rejected: 'Thanh toán bị từ chối',
  cancelled_by_player: 'Người chơi đã hủy',
  cancelled_by_facility: 'Sân hủy',
};

function bookingCard(item, packageId) {
  const status = item.status.toLowerCase();
  return {
    booking_id: item.id,
    booking_code: item.bookingCode,
    booking_type: packageId ? 'session' : 'single',
    package_id: packageId,
    location_id: item.locationId,
    facility_name: item.locationName,
    court_name: item.courtName,
    booking_date: item.playDate,
    start_time: item.startTime,
    end_time: item.endTime,
    time_range: item.startTime + ' – ' + item.endTime,
    hold_expires_at: item.holdExpiresAt,
    final_amount: item.finalAmount,
    created_at: item.createdAt,
    status,
    status_name: bookingLabels[status] || item.status,
    can_review: item.canReview === true,
    reschedule: item.reschedule,
  };
}

export async function getMyBookingsApi() {
  const [bookings, packages] = await Promise.all([
    getAllPages('/me/bookings'),
    getAllPages('/me/booking-packages'),
  ]);
  const entries = [
    ...bookings.map((item) => bookingCard(item)),
    ...packages.map((item) => {
      const status = item.status.toLowerCase();
      return {
        booking_id: item.id,
        booking_code: (item.packageType === 'DAY' ? 'Đơn #' : 'Gói #') + item.id,
        single_order: item.packageType === 'DAY',
        booking_type: 'package',
        facility_name: item.locationName,
        court_name: item.sessionCount + (item.packageType === 'DAY' ? ' sân/khung giờ' : ' buổi'),
        booking_date: item.startDate,
        time_range: item.startDate === item.endDate ? item.startDate : item.startDate + ' – ' + item.endDate,
        hold_expires_at: item.holdExpiresAt,
        final_amount: item.finalAmount,
        created_at: item.createdAt,
        status,
        status_name: bookingLabels[status] || item.status,
      };
    }),
  ];
  return Promise.all(entries.map(enrichHistoryEntry));
}

export async function getBookingDetailApi(bookingId) {
  const { data } = await api.get('/bookings/' + bookingId);
  return data.data;
}

export async function getPackageDetailApi(packageId) {
  const { data } = await api.get('/booking-packages/' + packageId);
  return data.data;
}

export async function getPackageSessionsApi(packageId) {
  const data = await getPackageDetailApi(packageId);
  return data.sessions.map((item) => ({
    ...bookingCard(item, packageId), single_order: data.packageType === 'DAY',
  }));
}

export async function cancelBookingApi(bookingId) {
  const { data } = await api.post('/bookings/' + bookingId + '/cancel');
  return data;
}

export async function cancelDayOrderApi(orderId) {
  const { data } = await api.post('/booking-orders/' + orderId + '/cancel');
  return data;
}

export async function createBookingReviewApi(bookingId, { rating, comment }) {
  const { data } = await api.post('/bookings/' + bookingId + '/reviews', {
    rating: Number(rating),
    comment: comment?.trim() || null,
  });
  return data;
}

export async function getRescheduleDeadlineApi(bookingId) {
  const { data } = await api.get('/bookings/' + bookingId + '/reschedule-deadline');
  return data.data;
}

export async function getRescheduleRequestsApi(bookingId, signal) {
  const { data } = await api.get('/bookings/' + bookingId + '/reschedule-requests', { signal });
  return data.data;
}

// UC22: Booking bị ảnh hưởng do sân hủy, bảo trì, tắt sân hoặc đổi giờ (GET /api/me/affected-bookings)
export async function getMyAffectedBookingsApi(signal) {
  const { data } = await api.get('/me/affected-bookings', { signal });
  return data.data;
}

// UC22: Player chọn hoàn tiền hoặc điểm bồi hoàn; đổi slot miễn phí cần gửi kèm slot mới
export async function getAffectedBookingApi(id) {
  const { data } = await api.get('/affected-bookings/' + id);
  return data.data;
}

export async function submitAffectedChoiceApi(affectedId, choice, slot = null) {
  const body = slot ? { choice, slot } : { choice };
  const { data } = await api.post('/affected-bookings/' + affectedId + '/submit-choice', body);
  return data.data;
}

// UC21: Xem trước chênh lệch giá khi đổi lịch (POST /api/bookings/{id}/reschedule-requests/preview)
export async function previewRescheduleApi(bookingId, slot, signal) {
  const { data } = await api.post('/bookings/' + bookingId + '/reschedule-requests/preview', slot, { signal });
  return data.data;
}

// UC21: Xác nhận tạo yêu cầu đổi lịch (POST /api/bookings/{id}/reschedule-requests)
export async function createRescheduleApi(bookingId, slot) {
  const { data } = await api.post('/bookings/' + bookingId + '/reschedule-requests', slot);
  return data.data;
}

// Lấy danh sách sân hoạt động của cơ sở để chọn slot đổi lịch (GET /api/locations/{locationId}/courts)
export async function getLocationCourtsApi(locationId, signal) {
  const { data } = await api.get('/locations/' + locationId + '/courts', { signal });
  return (data.data || []).map((court) => ({
    ...court,
    court_id: court.id,
    court_name: court.name,
  }));
}

// UC21 / FR90: Giữ kèo theo giờ mới sau khi đổi lịch (POST /api/matches/{id}/keep-after-reschedule)
export async function keepMatchAfterRescheduleApi(matchId) {
  const { data } = await api.post('/matches/' + matchId + '/keep-after-reschedule');
  return data.data;
}

// UC21 / FR90: Hủy kèo sau khi đổi lịch (POST /api/matches/{id}/cancel)
export async function cancelMatchApi(matchId) {
  const { data } = await api.post('/matches/' + matchId + '/cancel');
  return data.data;
}
