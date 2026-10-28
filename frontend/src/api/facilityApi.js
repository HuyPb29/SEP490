import axios from 'axios';

// Cờ bật/tắt dữ liệu giả lập (Đổi thành false khi ghép với Backend thật)
export const USE_MOCK_DATA = true;

const MOCK_FACILITIES = [
  {
    facility_id: 1,
    facility_name: 'Smash Arena',
    address: '12 Trần Thái Tông',
    district: 'Cầu Giấy',
    city: 'Hà Nội',
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
    address: '88 Nguyễn Khánh Toàn',
    district: 'Cầu Giấy',
    city: 'Hà Nội',
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
    address: '25 Hồ Tùng Mậu',
    district: 'Nam Từ Liêm',
    city: 'Hà Nội',
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
    facility_name: 'Sân Cầu lông Dịch Vọng',
    address: '3 Dịch Vọng Hậu',
    district: 'Cầu Giấy',
    city: 'Hà Nội',
    latitude: 21.0312,
    longitude: 105.7851,
    contact_phone: '0933445566',
    status: 'active',
    distance_km: 3.1,
    rating: 4.5,
    courts_count: 4,
    open_hours: '6:00–21:30',
    available_slots: 1,
    pin_pos: { top: '22%', left: '68%', short_name: 'Dịch Vọng' }
  },
  {
    facility_id: 5,
    facility_name: 'Sân Bị Khóa (Test BR62)',
    address: '99 Xuân Thủy',
    district: 'Cầu Giấy',
    city: 'Hà Nội',
    latitude: 21.0368,
    longitude: 105.7821,
    contact_phone: '0944556677',
    status: 'locked', // Sẽ bị lọc bỏ theo BR62
    distance_km: 0.5,
    rating: 4.0,
    courts_count: 5,
    open_hours: '6:00–22:00',
    available_slots: 4,
    pin_pos: { top: '50%', left: '50%', short_name: 'Xuân Thủy' }
  }
];

// Công thức Haversine tính khoảng cách đường thẳng (km)
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

  // Gọi API thật khi USE_MOCK_DATA = false
  const params = { page, limit };
  if (keyword.trim()) params.keyword = keyword.trim();
  if (userLat != null && userLng != null) {
    params.user_lat = userLat;
    params.user_lng = userLng;
  }
  const response = await axios.get('/api/v1/facilities/search', { params });
  return response.data;
}