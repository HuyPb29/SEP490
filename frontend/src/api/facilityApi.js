import axios from 'axios';

// Toggle kết nối Backend thật/giả lập
export const USE_MOCK_DATA = true;

const MOCK_FACILITIES = [
  {
    facility_id: 1,
    facility_name: 'Smash Arena',
    address: '12 Tran Thai Tong',
    district: 'Cau Giay',
    city: 'Hanoi',
    latitude: 21.0362,
    longitude: 105.7885,
    contact_phone: '0912345678',
    status: 'active',
    distance_km: 0.8,
    rating: 4.9,
    courts_count: 8,
    open_hours: '5:00–23:00',
    available_slots: 6,
    pin_pos: { top: '38%', left: '46%', short_name: 'Smash Arena' }
  },
  {
    facility_id: 2,
    facility_name: 'Green Shuttle Club',
    address: '88 Nguyen Khanh Toan',
    district: 'Cau Giay',
    city: 'Hanoi',
    latitude: 21.0381,
    longitude: 105.7982,
    contact_phone: '0987654321',
    status: 'active',
    distance_km: 1.6,
    rating: 4.7,
    courts_count: 6,
    open_hours: '6:00–22:00',
    available_slots: 2,
    pin_pos: { top: '66%', left: '68%', short_name: 'Green Shuttle' }
  },
  {
    facility_id: 3,
    facility_name: 'Hanoi Badminton Hub',
    address: '25 Ho Tung Mau',
    district: 'Nam Tu Liem',
    city: 'Hanoi',
    latitude: 21.0375,
    longitude: 105.7731,
    contact_phone: '0909112233',
    status: 'active',
    distance_km: 2.4,
    rating: 4.8,
    courts_count: 10,
    open_hours: '5:30–23:00',
    available_slots: 11,
    pin_pos: { top: '72%', left: '25%', short_name: 'Badminton Hub' }
  },
  {
    facility_id: 4,
    facility_name: 'Dich Vong Badminton Court',
    address: '3 Dich Vong Hau',
    district: 'Cau Giay',
    city: 'Hanoi',
    latitude: 21.0312,
    longitude: 105.7851,
    contact_phone: '0933445566',
    status: 'active',
    distance_km: 3.1,
    rating: 4.5,
    courts_count: 4,
    open_hours: '6:00–21:30',
    available_slots: 1,
    pin_pos: { top: '22%', left: '68%', short_name: 'Dich Vong' }
  },
  {
    facility_id: 5,
    facility_name: 'Locked Court (Test BR62)',
    address: '99 Xuan Thuy',
    district: 'Cau Giay',
    city: 'Hanoi',
    latitude: 21.0368,
    longitude: 105.7821,
    contact_phone: '0944556677',
    status: 'locked', // Test BR62
    distance_km: 0.5,
    rating: 4.0,
    courts_count: 5,
    open_hours: '6:00–22:00',
    available_slots: 4,
    pin_pos: { top: '50%', left: '50%', short_name: 'Xuan Thuy' }
  }
];

function calcHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

export async function searchFacilities({ keyword = '', userLat = null, userLng = null, page = 1, limit = 20 }) {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 250));
    const kw = keyword.trim().toLowerCase();

    // BR62: Chỉ lấy địa điểm có status = 'active'
    let items = MOCK_FACILITIES.filter((item) => item.status === 'active');

    if (kw) {
      items = items.filter(
        (item) =>
          item.facility_name.toLowerCase().includes(kw) ||
          item.address.toLowerCase().includes(kw) ||
          item.district.toLowerCase().includes(kw)
      );
    }

    if (userLat != null && userLng != null) {
      items = items.map((item) => ({
        ...item,
        distance_km: calcHaversineKm(userLat, userLng, item.latitude, item.longitude),
      }));
    }

    items.sort((a, b) => a.distance_km - b.distance_km);

    return {
      success: true,
      code: 200,
      data: {
        items,
        pagination: { page, limit, total_items: items.length, total_pages: 1 },
      },
    };
  }

  const params = { page, limit };
  if (keyword.trim()) params.keyword = keyword.trim();
  if (userLat != null && userLng != null) {
    params.user_lat = userLat;
    params.user_lng = userLng;
  }
  const response = await axios.get('/api/v1/facilities/search', { params });
  return response.data;
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

  // Tích hợp API thật theo chuẩn tài liệu V18
  try {
    const [detailRes, scheduleRes] = await Promise.all([
      axios.get(`/api/v1/facilities/${facilityId}`),
      axios.get(`/api/v1/facilities/${facilityId}/court-schedule`, {
        params: { date: playDate },
      }),
    ]);

    return {
      success: true,
      data: {
        facility: detailRes.data.data,
        courts: scheduleRes.data.data.schedule_grid.map(court => ({
          court_id: court.court_id,
          court_name: court.court_name,
          slots: court.slots.map(slot => ({
            time: slot.slot_time.substring(0, 5),
            status: slot.status,
            price: slot.price_per_slot,
            bookingInfo: slot.booking_info // BR57: Sẽ là null với Guest/Player
          }))
        }))
      },
    };
  } catch (error) {
    console.error("Error loading facility data:", error);
    return { success: false, data: null };
  }
}