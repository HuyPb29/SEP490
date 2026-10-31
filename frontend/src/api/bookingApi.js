import axios from 'axios';

// Toggle kết nối Backend thật/giả lập
export const USE_MOCK_BOOKING = true;

// DR03, BR09: Danh sách Đội do Player làm chủ
const MOCK_OWNED_TEAMS = [
  { team_id: 1, team_name: 'Cau Giay Smashers' },
  { team_id: 2, team_name: 'FPT Badminton' },
];

// BR60: Kho Voucher giả lập theo cơ sở
const MOCK_VOUCHERS = {
  DISC20K: {
    voucher_code: 'DISC20K',
    discount_amount: 20000,
    min_order_amount: 100000,
    description: '20,000 VND off for orders from 100,000 VND.',
    is_active: true,
  },
  SUMMER2026: {
    voucher_code: 'SUMMER2026',
    discount_amount: 20000,
    min_order_amount: 100000,
    description: '20,000 VND off for orders from 100,000 VND.',
    is_active: true,
  },
  USEDUP: {
    voucher_code: 'USEDUP',
    discount_amount: 50000,
    min_order_amount: 100000,
    is_active: false,
  },
};

// UC17: Danh sách 7 booking mẫu khớp 100% với Mockup 6_Player_UC17_Lich_su_booking.png
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
    hold_expires_at: new Date(Date.now() + 4 * 60 * 1000 + 12 * 1000).toISOString(), // 04:12
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
    resubmit_attempts_left: 2, // P06 / BR34: Còn 2 lần gửi lại
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
    sub_note: 'Reschedule deadline: 14:00 30/10', // BR25: Giờ chơi - min(6h, 50% * T)
    total_slots: 4,
    total_list_price: 320000,
    voucher_discount_amount: 0,
    points_discount_amount: 0,
    final_amount: 320000,
    can_open_match: true,
    can_reschedule: true, // BR25 & BR29 (P04 = tối đa 1 lần)
    can_cancel: true, // BR07: Chỉ cho hủy khi ở trạng thái confirmed trước giờ chơi
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
    can_review: true, // DR13 / BR21: Đánh giá 1 lần duy nhất khi completed
    can_complain: true, // BR49 / P23: Khiếu nại trong vòng 24h
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
    sub_note: 'Unpaid within holding time', // MSG33: Quá 5 phút giữ chỗ không báo thanh toán
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

// FR89, BR60: Lấy điểm khả dụng (GET /api/v1/facilities/{facility_id}/my-points)
export async function getMyPointsAtFacility(facilityId = 1) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 150));
    return {
      success: true,
      code: 200,
      data: {
        facility_id: facilityId,
        available_points: 120,
        point_value_vnd: 500, // P10: 1 điểm = 500 VNĐ
        max_discount_Ratio: 0.5, // P13: Tối đa 50% số tiền sau voucher
      },
    };
  }

  const res = await axios.get(`/api/v1/facilities/${facilityId}/my-points`);
  return res.data;
}

// DR03, BR09: Lấy danh sách đội do Player làm chủ (GET /api/v1/teams/my-owned)
export async function getMyOwnedTeams() {
  if (USE_MOCK_BOOKING) {
    return {
      success: true,
      code: 200,
      data: MOCK_OWNED_TEAMS,
    };
  }

  const res = await axios.get('/api/v1/teams/my-owned');
  return res.data;
}

// DR08: Áp dụng Voucher (POST /api/v1/vouchers/apply)
export async function applyVoucherApi({ facility_id, total_list_price, voucher_code }) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 250));
    const code = (voucher_code || '').trim().toUpperCase();
    const found = MOCK_VOUCHERS[code];

    // MSG34 / MSG108: Mã không tồn tại, hết hạn hoặc hết lượt
    if (!found || !found.is_active) {
      const msg = 'Voucher code does not exist, has expired, or has reached its usage limit.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG34', message: msg } };
      throw err;
    }

    if (total_list_price < found.min_order_amount) {
      const msg = `Order does not meet the minimum value of ${found.min_order_amount.toLocaleString('en-US')} VND to apply code ${code}.`;
      const err = new Error(msg);
      err.response = { data: { code: 'MSG34', message: msg } };
      throw err;
    }

    return {
      success: true,
      code: 200,
      data: {
        facility_id,
        voucher_code: found.voucher_code,
        discount_amount: found.discount_amount,
        min_order_amount: found.min_order_amount,
        description: found.description,
      },
    };
  }

  const res = await axios.post('/api/v1/vouchers/apply', {
    facility_id,
    total_list_price,
    voucher_code,
  });
  return res.data;
}

// UC14: Tạo Booking / Chốt đơn (POST /api/v1/bookings)
export async function createBookingApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 350));

    // MSG109: Kiểm tra ghi chú quá 200 ký tự
    if (payload.guest_note && payload.guest_note.length > 200) {
      const msg = 'Note to facility owner cannot exceed 200 characters.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG109', message: msg } };
      throw err;
    }

    // BR03 / P02: Giữ chỗ đếm ngược 5 phút cố định
    const holdExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const bookingCode = 'BK-24102';

    return {
      success: true,
      code: 201,
      message: 'Booking created successfully. Please complete payment within 5 minutes.',
      data: {
        booking_id: 1005,
        booking_code: bookingCode,
        status: 'holding',
        hold_expires_at: holdExpires,
        resubmit_attempts_left: 3, // P06: Tối đa 3 lần gửi lại chứng từ
        pricing_summary: {
          total_list_price: payload.total_list_price || 160000,
          voucher_discount_amount: payload.voucher_discount_amount || 0,
          points_discount_amount: (payload.points_used || 0) * 500,
          final_amount: payload.final_amount || 80000,
          points_used: payload.points_used || 0,
        },
        bank_info: {
          bank_name: 'Vietcombank',
          bank_account_number: '0011 0023 4567',
          bank_account_holder: 'NGUYEN VAN HUNG',
          qr_image_url: null,
          transfer_content: 'BK24102 0987654321',
        },
      },
    };
  }

  const res = await axios.post('/api/v1/bookings', payload);
  return res.data;
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

    // Cập nhật luôn bản ghi tương ứng trong MOCK_MY_BOOKINGS sang awaiting_confirmation
    const target = MOCK_MY_BOOKINGS.find((b) => b.booking_id === bookingId);
    if (target) {
      target.status = 'awaiting_confirmation';
      target.status_name = 'Awaiting Confirmation';
      target.sub_note = 'Receipt submitted just now';
    }

    // MSG48 / BR03 / OI02: Chuyển trạng thái sang awaiting_confirmation (không tự hủy sau 5 phút nữa)
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
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// UC17: Lấy danh sách lịch sử booking của Player (GET /api/v1/players/me/bookings)
export async function getMyBookingsApi({ tab = 'all', status = '', page = 1, limit = 10 } = {}) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 200));

    // Đồng bộ mốc hold_expires_at hoặc trạng thái từ sessionStorage (nếu vừa thao tác ở UC14/UC18)
    try {
      const savedActive = sessionStorage.getItem('active_holding_booking');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        const match = MOCK_MY_BOOKINGS.find((b) => b.booking_id === parsed.booking_id);
        if (match && parsed.hold_expires_at) {
          match.hold_expires_at = parsed.hold_expires_at;
          if (parsed.status === 'awaiting_confirmation') {
            match.status = 'awaiting_confirmation';
            match.status_name = 'Awaiting Confirmation';
            match.sub_note = 'Receipt submitted just now';
          }
        }
      }
    } catch {
      // Ignore JSON error
    }

    const pendingStatuses = ['holding', 'resubmit_requested', 'awaiting_confirmation'];
    const confirmedStatuses = ['confirmed', 'in_use'];
    const pastStatuses = [
      'completed',
      'cancelled_by_player',
      'cancelled_by_facility',
      'expired',
      'payment_rejected',
    ];

    // Quy tắc sắp xếp UC17: Các booking chờ thanh toán bắt buộc luôn xếp lên đầu, sau đó theo created_at DESC
    const sorted = [...MOCK_MY_BOOKINGS].sort((a, b) => {
      const aPending = pendingStatuses.includes(a.status) ? 1 : 0;
      const bPending = pendingStatuses.includes(b.status) ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    let filtered = sorted;
    if (tab === 'pending_payment') {
      filtered = sorted.filter((b) => pendingStatuses.includes(b.status));
    } else if (tab === 'confirmed') {
      filtered = sorted.filter((b) => confirmedStatuses.includes(b.status));
    } else if (tab === 'past') {
      filtered = sorted.filter((b) => pastStatuses.includes(b.status));
    }

    if (status) {
      filtered = filtered.filter((b) => b.status === status);
    }

    const pendingCount = MOCK_MY_BOOKINGS.filter((b) => pendingStatuses.includes(b.status)).length;

    return {
      success: true,
      code: 200,
      message: 'Fetched bookings successfully.',
      data: {
        items: filtered,
        pending_count: pendingCount,
        pagination: {
          page,
          limit,
          total_items: filtered.length,
          total_pages: 1,
        },
      },
    };
  }

  const params = { page, limit };
  if (tab && tab !== 'all') params.tab = tab;
  if (status) params.status = status;

  const res = await axios.get('/api/v1/players/me/bookings', { params });
  return res.data;
}

// UC17 / BR07 / MSG66: Player tự hủy booking ở trạng thái confirmed (Không hoàn tiền, điểm & voucher)
export async function cancelBookingApi(bookingId) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 250));
    const found = MOCK_MY_BOOKINGS.find((b) => b.booking_id === bookingId);

    if (!found || found.status !== 'confirmed') {
      const msg = 'Only confirmed bookings before play time can be cancelled.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG65', message: msg } };
      throw err;
    }

    found.status = 'cancelled_by_player';
    found.status_name = 'Cancelled by Player';
    found.can_cancel = false;
    found.can_reschedule = false;
    found.can_open_match = false;
    found.sub_note = 'Cancelled by player (non-refundable per BR07)';

    return {
      success: true,
      code: 200,
      message: `Booking ${found.booking_code} has been cancelled.`,
      data: found,
    };
  }

  const res = await axios.post(`/api/v1/bookings/${bookingId}/cancel`);
  return res.data;
}