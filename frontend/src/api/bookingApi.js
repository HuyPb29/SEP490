import axios from 'axios';
import api, { getAllPages } from './index';

// Toggle kết nối Backend thật/giả lập
export const USE_MOCK_BOOKING = true;

const MOCK_MY_BOOKINGS = [
  {
    booking_id: 1005,
    booking_code: 'BK-24102',
    booking_type: 'single',
    status: 'holding',
    status_name: 'Holding',
    facility_id: 1,
    facility_name: 'Smash Arena',
    court_id: 102,
    court_name: 'Court 2',
    booking_date: '2026-10-24',
    start_time: '19:00:00',
    end_time: '20:00:00',
    time_range: '19:00 – 20:00',
    booker_label: 'Personal',
    total_slots: 2,
    total_list_price: 160000,
    voucher_discount_amount: 20000,
    points_discount_amount: 60000,
    final_amount: 80000,
    hold_expires_at: new Date(Date.now() + 4 * 60 * 1000 + 12 * 1000).toISOString(),
    resubmit_attempts_left: 3,
    resubmit_deadline: null,
    can_reschedule: false,
    can_cancel: false,
    can_review: false,
    can_complain: false,
    bank_info: {
      bank_name: 'Vietcombank',
      bank_account_number: '0011 0023 4567',
      bank_account_holder: 'NGUYEN VAN HUNG',
      qr_image_url: null,
      transfer_content: 'BK24102 0987654321',
    },
    created_at: '2026-10-24T10:00:00',
  },
  {
    booking_id: 1006,
    booking_code: 'BK-25104',
    booking_type: 'single',
    status: 'resubmit_requested',
    status_name: 'Resubmit Requested',
    facility_id: 2,
    facility_name: 'Green Shuttle Club',
    court_id: 204,
    court_name: 'Court 4',
    booking_date: '2026-10-25',
    start_time: '07:00:00',
    end_time: '08:30:00',
    time_range: '07:00 – 08:30',
    booker_label: 'Cau Giay Smashers',
    total_slots: 3,
    total_list_price: 150000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 150000,
    hold_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    resubmit_attempts_left: 2,
    resubmit_reason: 'Receipt image is blurry, 2 attempts left',
    resubmit_deadline: '2026-10-25T08:30:00',
    can_reschedule: false,
    can_cancel: false,
    can_review: false,
    can_complain: false,
    bank_info: {
      bank_name: 'MBBank',
      bank_account_number: '9999 8888 7777',
      bank_account_holder: 'GREEN SHUTTLE CLUB',
      qr_image_url: null,
      transfer_content: 'BK25104 0987654321',
    },
    created_at: '2026-10-24T09:30:00',
  },
  {
    booking_id: 1007,
    booking_code: 'BK-26101',
    booking_type: 'single',
    status: 'awaiting_confirmation',
    status_name: 'Awaiting Confirmation',
    facility_id: 3,
    facility_name: 'Hanoi Badminton Hub',
    court_id: 301,
    court_name: 'Court 1',
    booking_date: '2026-10-26',
    start_time: '18:00:00',
    end_time: '19:00:00',
    time_range: '18:00 – 19:00',
    booker_label: null,
    sub_note: 'Receipt submitted at 08:15',
    total_slots: 2,
    total_list_price: 120000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 120000,
    hold_expires_at: null,
    resubmit_attempts_left: 3,
    can_reschedule: false,
    can_cancel: false,
    can_review: false,
    can_complain: false,
    created_at: '2026-10-24T08:15:00',
  },
  {
    booking_id: 1008,
    booking_code: 'PK-28103',
    booking_type: 'recurring',
    status: 'confirmed',
    status_name: 'Confirmed',
    facility_id: 1,
    facility_name: 'Recurring Package · Smash Arena',
    court_id: 103,
    court_name: 'Court 3',
    booking_date: '2026-10-28',
    start_time: '19:00:00',
    end_time: '21:00:00',
    time_range: 'Tue, Thu · 19:00 – 21:00 · 24 sessions',
    booker_label: null,
    sub_note: 'Next session: 28/10',
    total_slots: 96,
    total_list_price: 3840000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 3840000,
    can_reschedule: false,
    can_cancel: false,
    can_review: false,
    can_complain: false,
    created_at: '2026-10-23T15:00:00',
  },
  {
    booking_id: 1009,
    booking_code: 'BK-30105',
    booking_type: 'single',
    status: 'confirmed',
    status_name: 'Confirmed',
    facility_id: 1,
    facility_name: 'Smash Arena',
    court_id: 105,
    court_name: 'Court 5',
    booking_date: '2026-10-30',
    start_time: '20:00:00',
    end_time: '22:00:00',
    time_range: '20:00 – 22:00',
    booker_label: 'FPT Badminton',
    sub_note: 'Reschedule deadline: 14:00 30/10',
    total_slots: 4,
    total_list_price: 320000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 320000,
    can_open_match: true,
    can_reschedule: true,
    can_cancel: true,
    can_review: false,
    can_complain: false,
    created_at: '2026-10-22T11:20:00',
  },
  {
    booking_id: 1010,
    booking_code: 'BK-20102',
    booking_type: 'single',
    status: 'completed',
    status_name: 'Completed',
    facility_id: 4,
    facility_name: 'Dich Vong',
    court_id: 402,
    court_name: 'Court 2',
    booking_date: '2026-10-20',
    start_time: '17:00:00',
    end_time: '18:00:00',
    time_range: '17:00 – 18:00',
    booker_label: null,
    sub_note: 'Not reviewed yet',
    total_slots: 2,
    total_list_price: 100000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 100000,
    can_reschedule: false,
    can_cancel: false,
    can_review: true,
    can_complain: true,
    created_at: '2026-10-19T14:00:00',
  },
  {
    booking_id: 1011,
    booking_code: 'BK-18101',
    booking_type: 'single',
    status: 'expired',
    status_name: 'Expired',
    facility_id: 1,
    facility_name: 'Smash Arena',
    court_id: 101,
    court_name: 'Court 1',
    booking_date: '2026-10-18',
    start_time: '19:00:00',
    end_time: '20:00:00',
    time_range: '19:00 – 20:00',
    booker_label: null,
    sub_note: 'Unpaid within holding time',
    total_slots: 2,
    total_list_price: 80000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 80000,
    can_reschedule: false,
    can_cancel: false,
    can_review: false,
    can_complain: false,
    created_at: '2026-10-18T18:00:00',
  },
];

export async function getMyPointsAtFacility(locationId) {
  const balances = await getAllPages('/me/loyalty-balances');
  return balances.find((balance) => balance.locationId === locationId)?.pointBalance ?? 0;
}

export async function getMyOwnedTeams() {
  const { data } = await api.get('/me/teams');
  return data.data.filter((team) => team.captain);
}

export async function getPublicBatchOffers(locationId, signal) {
  const { data } = await api.get('/locations/' + locationId + '/batch-offers', { signal, skipAuth: true });
  return data.data;
}

export async function getCheckoutVouchers(locationId) {
  const [publicVouchers, grants] = await Promise.all([
    getAllPages('/locations/' + locationId + '/vouchers'),
    getAllPages('/me/vouchers'),
  ]);
  return { publicVouchers, grants: grants.filter(({ voucher, grantStatus }) =>
    voucher.locationId === locationId && voucher.status === 'PUBLISHED' && grantStatus === 'AVAILABLE') };
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

export async function previewBookingPackageApi(payload) {
  const { data } = await api.post('/booking-packages/preview', payload);
  return data.data;
}

export async function createBookingPackageApi(payload) {
  const { data } = await api.post('/booking-packages', payload);
  return data.data;
}

// UC18: Tải lên ảnh chứng từ chuyển khoản (POST /api/v1/bookings/{booking_id}/payment-proof)
export async function uploadPaymentProofApi({ bookingId, file, note = '', resubmitAttemptsLeft = 3 }) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 400));

    // MSG106: Bắt buộc đính kèm ảnh chứng từ
    if (!file) {
      const msg = 'Please attach a payment receipt image.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG106', message: msg } };
      throw err;
    }

    // BR34 / P06 / MSG52: Kiểm tra giới hạn tối đa 3 lần gửi lại chứng từ
    if (resubmitAttemptsLeft <= 0) {
      const msg = 'You have reached the maximum number of resubmission attempts or the deadline has passed.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG52', message: msg } };
      throw err;
    }

    const target = MOCK_MY_BOOKINGS.find((b) => b.booking_id === bookingId);
    if (target) {
      target.status = 'awaiting_confirmation';
      target.status_name = 'Awaiting Confirmation';
      target.sub_note = 'Receipt submitted just now';
    }

    return {
      success: true,
      code: 200,
      message: 'Payment proof submitted. Please wait for staff verification.',
      data: {
        booking_id: bookingId,
        status: 'awaiting_confirmation',
        file_name: file.name,
        submitted_at: new Date().toISOString(),
      },
    };
  }

  const formData = new FormData();
  formData.append('proof_image', file);
  if (note.trim()) {
    formData.append('note', note.trim());
  }

  const res = await axios.post(`/api/v1/bookings/${bookingId}/payment-proof`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: 'Bearer ' + localStorage.getItem('token'),
    },
  });
  return res.data;
}

const bookingLabels = {
  holding: 'Holding',
  awaiting_confirmation: 'Awaiting Confirmation',
  resubmit_requested: 'Receipt Requested',
  confirmed: 'Confirmed',
  in_use: 'In Use',
  completed: 'Completed',
  expired: 'Expired',
  payment_rejected: 'Payment Rejected',
  cancelled_by_player: 'Cancelled by Player',
  cancelled_by_facility: 'Cancelled by Facility',
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
    can_cancel: status === 'confirmed' && Date.parse(item.playDate + 'T' + item.startTime + ':00+07:00') > Date.now(),
  };
}

export async function getMyBookingsApi() {
  const [bookings, packages] = await Promise.all([
    getAllPages('/me/bookings'),
    getAllPages('/me/booking-packages'),
  ]);
  return [
    ...bookings.map((item) => bookingCard(item)),
    ...packages.map((item) => {
      const status = item.status.toLowerCase();
      return {
        booking_id: item.id,
        booking_code: 'Package #' + item.id,
        booking_type: 'package',
        facility_name: item.locationName,
        court_name: item.sessionCount + ' sessions',
        booking_date: item.startDate,
        time_range: item.startDate + ' – ' + item.endDate,
        hold_expires_at: item.holdExpiresAt,
        final_amount: item.finalAmount,
        created_at: item.createdAt,
        status,
        status_name: bookingLabels[status] || item.status,
      };
    }),
  ];
}

export async function getPackageSessionsApi(packageId) {
  const { data } = await api.get('/booking-packages/' + packageId);
  return data.data.sessions.map((item) => bookingCard(item, packageId));
}

export async function cancelBookingApi(bookingId) {
  const { data } = await api.post('/bookings/' + bookingId + '/cancel');
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
export async function getMyAffectedBookingsApi() {
  const { data } = await api.get('/me/affected-bookings');
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
export async function previewRescheduleApi(bookingId, slot) {
  const { data } = await api.post('/bookings/' + bookingId + '/reschedule-requests/preview', slot);
  return data.data;
}

// UC21: Xác nhận tạo yêu cầu đổi lịch (POST /api/bookings/{id}/reschedule-requests)
export async function createRescheduleApi(bookingId, slot) {
  const { data } = await api.post('/bookings/' + bookingId + '/reschedule-requests', slot);
  return data.data;
}

// Lấy danh sách sân hoạt động của cơ sở để chọn slot đổi lịch (GET /api/locations/{locationId}/courts)
export async function getLocationCourtsApi(locationId) {
  const { data } = await api.get('/locations/' + locationId + '/courts');
  return data.data;
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