import axios from 'axios';

// Toggle kết nối Backend thật/giả lập
export const USE_MOCK_DATA = false;
// UC11 đã nối Backend thật; UC12, UC13 vẫn dùng USE_MOCK_DATA
function mapLocationSummary(location) {
  return {
    facility_id: location.id,
    facility_name: location.name,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    distance_km: location.distanceKm ?? null,
  };
}

export async function searchFacilities({ keyword = '', signal } = {}) {
  const params = keyword.trim() ? { q: keyword.trim() } : {}
  const response = await axios.get('/api/locations', { params, signal })
  return { success: true, data: { items: response.data.data.map(mapLocationSummary) } }
}

// Mock data & API cho UC12 & UC13
const MOCK_FACILITY_DETAILS = {
  1: {
    facility_id: 1,
    facility_name: 'Smash Arena',
    rating: 4.9,
    review_count: 128,
    address: '12 Tran Thai Tong, Cau Giay, Hanoi',
    open_hours: '5:00–23:00 daily',
    courts_count: 8,
    contact_phone: '0912 345 678',
    price_table: [
      { time_range: '5:00 – 16:00', weekday_price: '60,000 VND / slot', weekend_price: '70,000 VND / slot' },
      { time_range: '16:00 – 23:00', weekday_price: '80,000 VND / slot', weekend_price: '90,000 VND / slot' },
    ],
    reviews: [
      {
        review_id: 101,
        reviewer_name: 'Tuan Nguyen',
        stars: 5,
        comment: 'New court mats, non-glare lighting. Staff verified payment quickly.',
        owner_reply: 'Owner: Thank you, see you again!',
      },
      {
        review_id: 102,
        reviewer_name: 'Ha Linh',
        stars: 4,
        comment: 'Peak hours are a bit hard to book, should book a few days in advance.',
        owner_reply: null,
      },
    ],
  },
};

const TIME_HEADERS = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];

const MOCK_COURT_SCHEDULE = [
  {
    court_id: 1,
    court_name: 'Court 1',
    slots: [
      { time: '17:00', status: 'booked', price: 80000 },
      { time: '17:30', status: 'booked', price: 80000 },
      { time: '18:00', status: 'booked', price: 80000 },
      { time: '18:30', status: 'booked', price: 80000 },
      { time: '19:00', status: 'available', price: 80000 },
      { time: '19:30', status: 'available', price: 80000 },
      { time: '20:00', status: 'available', price: 80000 },
      { time: '20:30', status: 'available', price: 80000 },
    ],
  },
  {
    court_id: 2,
    court_name: 'Court 2',
    slots: [
      { time: '17:00', status: 'available', price: 80000 },
      { time: '17:30', status: 'available', price: 80000 },
      { time: '18:00', status: 'available', price: 80000 },
      { time: '18:30', status: 'available', price: 80000 },
      { time: '19:00', status: 'available', price: 80000, defaultSelected: true },
      { time: '19:30', status: 'available', price: 80000, defaultSelected: true },
      { time: '20:00', status: 'holding', price: 80000 },
      { time: '20:30', status: 'holding', price: 80000 },
    ],
  },
  {
    court_id: 3,
    court_name: 'Court 3',
    slots: [
      { time: '17:00', status: 'maintenance', price: 80000 },
      { time: '17:30', status: 'maintenance', price: 80000 },
      { time: '18:00', status: 'maintenance', price: 80000 },
      { time: '18:30', status: 'maintenance', price: 80000 },
      { time: '19:00', status: 'maintenance', price: 80000 },
      { time: '19:30', status: 'maintenance', price: 80000 },
      { time: '20:00', status: 'available', price: 80000 },
      { time: '20:30', status: 'available', price: 80000 },
    ],
  },
  {
    court_id: 4,
    court_name: 'Court 4',
    slots: [
      { time: '17:00', status: 'available', price: 80000 },
      { time: '17:30', status: 'available', price: 80000 },
      { time: '18:00', status: 'booked', price: 80000 },
      { time: '18:30', status: 'booked', price: 80000 },
      { time: '19:00', status: 'booked', price: 80000 },
      { time: '19:30', status: 'booked', price: 80000 },
      { time: '20:00', status: 'available', price: 80000 },
      { time: '20:30', status: 'available', price: 80000 },
    ],
  },
  {
    court_id: 5,
    court_name: 'Court 5',
    slots: [
      { time: '17:00', status: 'available', price: 80000 },
      { time: '17:30', status: 'available', price: 80000 },
      { time: '18:00', status: 'available', price: 80000 },
      { time: '18:30', status: 'available', price: 80000 },
      { time: '19:00', status: 'available', price: 80000 },
      { time: '19:30', status: 'booked', price: 80000 },
      { time: '20:00', status: 'booked', price: 80000 },
      { time: '20:30', status: 'booked', price: 80000 },
    ],
  },
];

export async function getFacilityDetailAndSchedule(facilityId = 1, playDate = '2026-10-24') {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 200));
    const detail = MOCK_FACILITY_DETAILS[facilityId] || MOCK_FACILITY_DETAILS[1];
    return {
      success: true,
      data: {
        facility: detail,
        play_date: playDate,
        time_headers: TIME_HEADERS,
        courts: MOCK_COURT_SCHEDULE,
      },
    };
  }

  // Backend returns ApiResponse<LocationDetailResponse> and ApiResponse<ScheduleResponse>.
  try {
    const [detailRes, scheduleRes] = await Promise.all([
      axios.get(`/api/locations/${facilityId}`),
      axios.get(`/api/locations/${facilityId}/schedules`, {
        params: { date: playDate },
      }),
    ]);

    const detail = detailRes.data?.data;
    const schedule = scheduleRes.data?.data;
    if (!detail || !Array.isArray(schedule?.courts)) {
      throw new Error('Unexpected facility detail or schedule response.');
    }

    const mappedCourts = schedule.courts.map((court) => ({
      court_id: court.courtId,
      court_name: court.name,
      slots: (court.slots || []).map((slot) => ({
        time: slot.time,
        status: String(slot.status || '').toLowerCase(),
        price: slot.price ?? 0,
        bookingInfo: slot.bookerName
          ? {
              name: slot.bookerName,
              phone: slot.bookerPhone,
              note: slot.note,
            }
          : null,
      })),
    }));

    const openingHours = detail.openingHours || [];
    const mappedFacility = {
      ...detail,
      facility_id: detail.id,
      facility_name: detail.name,
      contact_phone: detail.contactPhone,
      open_hours: openingHours
        .map((hours) => `${hours.openTime}–${hours.closeTime}`)
        .join(', '),
      courts_count: mappedCourts.length,
      rating: detail.rating ?? null,
      review_count: detail.reviewCount ?? 0,
      price_table: detail.price_table || [],
      reviews: detail.reviews || [],
    };

    return {
      success: true,
      data: {
        facility: mappedFacility,
        play_date: schedule.date || playDate,
        time_headers: mappedCourts[0]?.slots.map((slot) => slot.time) || [],
        courts: mappedCourts,
      },
    };
  } catch (error) {
    console.error("Error loading facility data:", error);
    return {
      success: false,
      data: null,
      error: error.response?.data?.message || error.message || 'Could not load facility details.',
    };
  }
}