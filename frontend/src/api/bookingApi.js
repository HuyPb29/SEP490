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

const MOCK_PACKAGE_CONFLICT_DATES = ['2026-11-12', '2026-11-24'];

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
    hold_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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

  const res = await axios.get(`/api/v1/facilities/${facilityId}/my-points`, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('token'),
    },
  });
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
  }, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('token'),
    },
  });
  return res.data;
}

// UC14: Tạo Booking lẻ / Chốt đơn (POST /api/bookings)
export async function createBookingApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 350));

    // MSG109: Kiểm tra ghi chú quá 200 ký tự
    if (payload.guest_note && payload.guest_note.length > 200) {
      const msg = 'Note to location owner cannot exceed 200 characters.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG109', message: msg } };
      throw err;
    }

    // BR03 / P02: Giữ chỗ đặt lẻ 10 phút
    const holdExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const bookingCode = 'BK-24102';

    return {
      success: true,
      code: 201,
      message: 'Booking created successfully. Please complete payment within 10 minutes.',
      data: {
        booking_id: 1005,
        booking_code: bookingCode,
        booking_type: 'single',
        total_slots: payload.slots?.length || 1,
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

  // 1. Dịch giờ (String "HH:mm") sang tổng số phút (Integer) cho Backend
  const parseToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // 2. Chuyển đổi (Map) Payload Frontend sang BookingRequest DTO của Backend
  const backendPayload = {
    courtId: payload.court_id,
    date: payload.booking_date, // "2026-11-04"
    startMinute: parseToMinutes(payload.slots?.[0]?.start_time),
    endMinute: parseToMinutes(payload.slots?.[payload.slots.length - 1]?.end_time),
    voucherCode: payload.voucher_code || null,
    voucherGrantId: null,
    pointsToUse: payload.points_used || 0,
    note: payload.guest_note || null,
    teamId: payload.team_id || null,
  };

  try {
    // 3. Lấy token từ localStorage và gửi kèm payload lên Backend
    const token = localStorage.getItem('token');
    const res = await axios.post('/api/bookings', backendPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  } catch (error) {
    console.error('Lỗi đặt sân Backend:', error.response?.data);
    throw error;
  }
}

export async function previewBookingSummaryApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 150));
    return { success: true, code: 200, data: payload };
  }

  const [startHour, startMinute] = (payload.slots?.[0]?.start_time || '00:00').split(':').map(Number);
  const lastSlotTime = payload.slots?.[payload.slots.length - 1]?.end_time || '00:30';
  const [endHour, endMinute] = lastSlotTime.split(':').map(Number);
  const res = await axios.post('/api/bookings/summary', {
    courtId: payload.court_id,
    date: payload.booking_date,
    startMinute: startHour * 60 + startMinute,
    endMinute: endHour * 60 + endMinute,
    voucherCode: payload.voucher_code || null,
    pointsToUse: payload.points_used || 0,
    note: payload.guest_note || null,
    teamId: payload.team_id || null,
  });
  return res.data;
}

export async function previewBookingOrderApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 150));
    return { success: true, code: 200, data: payload };
  }

  const res = await axios.post('/api/booking-orders/preview', payload);
  return res.data;
}

export async function createBookingOrderApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 350));
    const holdExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const totalSlots = (payload.bookings || []).reduce(
      (total, booking) => total + (booking.slots?.length || 0),
      0
    );
    return {
      success: true,
      code: 201,
      data: {
        booking_id: Date.now(),
        booking_code: 'BO-26113',
        booking_type: 'order',
        total_slots: totalSlots,
        status: 'holding',
        hold_expires_at: holdExpires,
        pricing_summary: {
          total_list_price: payload.total_list_price || 0,
          voucher_discount_amount: payload.voucher_discount_amount || 0,
          points_discount_amount: (payload.points_used || 0) * 500,
          final_amount: payload.final_amount || 0,
          points_used: payload.points_used || 0,
        },
        bank_info: {
          bank_name: 'Vietcombank',
          bank_account_number: '0011 0023 4567',
          bank_account_holder: 'NGUYEN VAN HUNG',
          qr_image_url: null,
          transfer_content: 'BO26113 0987654321',
        },
      },
    };
  }

  const res = await axios.post('/api/booking-orders', payload);
  return res.data;
}

// UC15: Kiểm tra lịch & buổi trùng trước khi chốt gói (POST /api/booking-packages/preview)
export async function previewBookingPackageApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 200));
    let sessions = payload.sessions || [];
    if (payload.packageType === 'RECURRING' && (!payload.sessions || payload.sessions.length === 0)) {
      sessions = [];
      const current = new Date(`${payload.startDate}T00:00:00`);
      const end = new Date(`${payload.endDate}T00:00:00`);
      while (current <= end) {
        const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
        (payload.weeklySlots || []).filter((slot) => slot.dayOfWeek === dayOfWeek).forEach((slot) => {
          sessions.push({
            date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
            courtId: payload.courtId,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
            startTime: `${String(Math.floor(slot.startMinute / 60)).padStart(2, '0')}:${String(slot.startMinute % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(slot.endMinute / 60)).padStart(2, '0')}:${String(slot.endMinute % 60).padStart(2, '0')}`,
          });
        });
        current.setDate(current.getDate() + 1);
      }
    }
    sessions = sessions.map((session) => ({
      ...session,
      is_conflicted: Boolean(
        session.is_conflicted || session.mock_conflict || session.conflict ||
        MOCK_PACKAGE_CONFLICT_DATES.includes(session.date)
      ),
    }));
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const latestAllowedDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    const hasLateSession = sessions.some((session) => {
      const [year, month, day] = session.date.split('-').map(Number);
      return new Date(year, month - 1, day) > latestAllowedDate;
    });
    if (hasLateSession) {
      const msg = 'MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG115', message: msg } };
      throw err;
    }

    const listAmount = sessions.reduce((total, session) => (
      total + (session.is_conflicted ? 0 : Math.max(0, session.endMinute - session.startMinute) / 30 * 80000)
    ), 0);
    const voucherCode = (payload.voucherCode || '').trim().toUpperCase();
    const voucher = voucherCode ? MOCK_VOUCHERS[voucherCode] : null;
    if (voucherCode && (!voucher?.is_active || listAmount < voucher.min_order_amount)) {
      const msg = `MSG34: Mã voucher ${voucherCode} không hợp lệ hoặc đơn hàng chưa đạt giá trị tối thiểu.`;
      const err = new Error(msg);
      err.response = { data: { code: 'MSG34', message: msg } };
      throw err;
    }
    const voucherDiscount = voucher?.discount_amount || 0;
    const remaining = Math.max(0, listAmount - voucherDiscount);
    const pointsUsed = Math.min(payload.pointsToUse || 0, Math.floor(remaining * 0.5 / 500));
    const pointDiscount = pointsUsed * 500;
    const finalAmount = Math.max(0, remaining - pointDiscount);
    return {
      success: true,
      code: 200,
      data: {
        ...payload,
        sessions,
        totalSessions: sessions.length,
        conflictSessions: sessions.filter((session) => session.is_conflicted).length,
        listAmount,
        voucherDiscount,
        pointsUsed,
        pointDiscount,
        finalAmount,
      },
    };
  }

  const res = await axios.post('/api/booking-packages/preview', payload);
  return res.data;
}

// UC15: Xác nhận tạo gói đặt nhiều buổi & giữ chỗ 15 phút (POST /api/booking-packages)
export async function createBookingPackageApi(payload) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 350));

    const validSessions = payload.sessions?.filter((s) => !s.is_conflicted && !s.conflict) || [];
    const conflictedSessions = payload.sessions?.filter((s) => s.is_conflicted || s.conflict) || [];

    // BR50 / MSG44: Chặn nếu vẫn còn buổi bị trùng chưa chọn slot bù hoặc chưa bấm bỏ
    if (conflictedSessions.length > 0) {
      const conflictList = conflictedSessions
        .map((s) => `${s.date || s.display_date} (${s.startTime || s.time_label || ''}–${s.endTime || ''}, ${s.courtName || s.court_name || ''})`)
        .join(', ');
      const msg = `MSG44: Bạn có ${conflictedSessions.length} buổi vừa bị đặt trùng: ${conflictList}. Các buổi này đã được đánh dấu trên lịch, vui lòng chọn slot bù hoặc bỏ buổi.`;
      const err = new Error(msg);
      err.response = { data: { code: 'MSG44', message: msg } };
      throw err;
    }

    // BR27 / MSG92: Sau khi xử lý buổi trùng, gói bắt buộc phải còn ít nhất 2 buổi
    const distinctDays = new Set(validSessions.map((session) => session.date)).size;
    if (payload.packageType === 'CUSTOM' && validSessions.length < 2) {
      const msg = 'MSG91: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG91', message: msg } };
      throw err;
    }
    if (payload.packageType === 'CUSTOM' && distinctDays < 2) {
      const msg = 'MSG92: Gói phải có ít nhất 2 buổi nằm trong ít nhất 2 ngày khác nhau.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG92', message: msg } };
      throw err;
    }

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const latestAllowedDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    const outsideThreeMonths = validSessions.some((session) => {
      const [year, month, day] = session.date.split('-').map(Number);
      return new Date(year, month - 1, day) > latestAllowedDate;
    });
    if (outsideThreeMonths) {
      const msg = 'MSG115: Buổi đặt không được vượt quá 3 tháng kể từ ngày đặt.';
      const err = new Error(msg);
      err.response = { data: { code: 'MSG115', message: msg } };
      throw err;
    }

    // BR53 / P27: Giữ chỗ gói cố định 15 phút
    const holdExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const packageCode = 'PK-26113';
    const totalAmount = payload.total_amount || payload.total_list_price || validSessions.length * 4 * 80000;
    const voucherDiscount = payload.voucher_discount_amount || 0;
    const pointsDiscount = payload.points_discount_amount || (payload.points_used || payload.pointsToUse || 0) * 500;
    const finalAmount = payload.final_amount ?? Math.max(0, totalAmount - voucherDiscount - pointsDiscount);

    const newPackageRecord = {
      booking_id: 1099,
      booking_code: packageCode,
      booking_type: payload.packageType?.toLowerCase() || 'package',
      status: 'holding',
      status_name: 'Holding',
      facility_id: payload.facility_id || 1,
      facility_name: `Multi-Session Package · ${payload.facility_name || 'Smash Arena'}`,
      court_id: 103,
      court_name: payload.court_name || 'Court 3',
      booking_date: validSessions[0]?.date || '2026-11-03',
      start_time: `${payload.start_time || '19:00'}:00`,
      end_time: `${payload.end_time || '21:00'}:00`,
      time_range: `${payload.start_time || '19:00'} – ${payload.end_time || '21:00'} · ${validSessions.length} sessions`,
      booker_label: payload.booker_label || 'Cau Giay Smashers',
      total_slots: validSessions.reduce((total, session) => (
        total + Math.max(1, (session.endMinute - session.startMinute) / 30)
      ), 0),
      total_list_price: totalAmount,
      voucher_discount_amount: voucherDiscount,
      points_discount_amount: pointsDiscount,
      final_amount: finalAmount,
      hold_expires_at: holdExpires,
      resubmit_attempts_left: 3,
      bank_info: {
        bank_name: 'Vietcombank',
        bank_account_number: '0011 0023 4567',
        bank_account_holder: 'NGUYEN VAN HUNG',
        qr_image_url: null,
        transfer_content: `${packageCode} 0987654321`,
      },
      created_at: new Date().toISOString(),
    };

    // Đẩy gói vừa tạo lên đầu danh sách UC17
    MOCK_MY_BOOKINGS.unshift(newPackageRecord);

    return {
      success: true,
      code: 201,
      message:
        'Package schedule confirmed. Your slots are held for 15 minutes (P27).',
      data: {
        booking_id: newPackageRecord.booking_id,
        booking_code: packageCode,
        booking_type: payload.packageType?.toLowerCase() || 'package',
        total_slots: newPackageRecord.total_slots,
        status: 'holding',
        hold_expires_at: holdExpires,
        resubmit_attempts_left: 3,
        pricing_summary: {
          total_list_price: totalAmount,
          voucher_discount_amount: voucherDiscount,
          points_discount_amount: pointsDiscount,
          final_amount: finalAmount,
          points_used: payload.points_used || payload.pointsToUse || 0,
        },
        bank_info: newPackageRecord.bank_info,
      },
    };
  }

  const res = await axios.post('/api/booking-packages', payload);
  return res.data;
}

function isPackagePayment({ bookingType, totalSlots }) {
  return bookingType === 'recurring' || bookingType === 'package' || Number(totalSlots) > 1;
}

const MOCK_PAYMENT_INFO = {
  bank_name: 'Vietcombank',
  bank_account_number: '0011 0023 4567',
  bank_account_holder: 'NGUYEN VAN HUNG',
  qr_image_url: null,
};

// UC18: Lấy hướng dẫn chuyển khoản theo loại booking.
export async function getBookingPaymentInstructionsApi({ bookingId, bookingType, totalSlots = 1 }) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 200));
    let activeBooking = {};
    try {
      activeBooking = JSON.parse(sessionStorage.getItem('active_holding_booking') || '{}');
    } catch {
      // Ignore invalid session data
    }
    return {
      success: true,
      code: 200,
      data: {
        ...MOCK_PAYMENT_INFO,
        ...(activeBooking.booking_id === bookingId ? activeBooking.bank_info : {}),
      },
    };
  }

  let res;
  if (isPackagePayment({ bookingType, totalSlots })) {
    res = await axios.get(`/api/booking-packages/${bookingId}/payment-instructions`);
  } else {
    res = await axios.get(`/api/bookings/${bookingId}/payment-instructions`);
  }
  return res.data;
}

// UC18: Lấy QR thanh toán theo loại booking.
export async function getBookingPaymentQrApi({ bookingId, bookingType, totalSlots = 1 }) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 200));
    return { success: true, code: 200, data: { qr_image_url: null } };
  }

  let res;
  if (isPackagePayment({ bookingType, totalSlots })) {
    res = await axios.get(`/api/booking-packages/${bookingId}/payment-instructions/qr`);
  } else {
    res = await axios.get(`/api/bookings/${bookingId}/payment-instructions/qr`);
  }
  return res.data;
}

// UC18: Tải lên ảnh chứng từ theo loại booking.
export async function uploadPaymentProofApi({
  bookingId,
  bookingType,
  totalSlots = 1,
  file,
  note = '',
  resubmitAttemptsLeft = 3,
}) {
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

  let res;
  if (isPackagePayment({ bookingType, totalSlots })) {
    res = await axios.post(`/api/booking-packages/${bookingId}/payments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
  } else {
    res = await axios.post(`/api/v1/bookings/${bookingId}/payment-proof`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
  }
  return res.data;
}

// UC17: Lấy danh sách lịch sử booking của Player (GET /api/v1/players/me/bookings)
export async function getMyBookingsApi({ tab = 'all', status = '', page = 1, limit = 10 } = {}) {
  if (USE_MOCK_BOOKING) {
    await new Promise((r) => setTimeout(r, 200));

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

// UC17 / BR07 / MSG66: Player tự hủy booking ở trạng thái confirmed
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