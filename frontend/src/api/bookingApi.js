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