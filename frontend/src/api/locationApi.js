import axios from 'axios'

/**
 * Lớp gọi API cho feature F2 (Quản lý địa điểm) và UC37 (Thông báo).
 *
 * Quy ước xác thực của dự án: JWT lưu ở localStorage.
 *  - AuthPage ghi 'bms_access_token', authApi ghi 'token' => đọc lần lượt cả hai.
 *  - Các API /api/owner/** mà path KHÔNG chứa {id} địa điểm sẽ lấy địa điểm đang chọn
 *    từ header 'X-Location-Id', nên client tự gắn header này cho mọi request owner.
 */

const TOKEN_KEYS = ['token', 'bms_access_token']
const SELECTED_LOCATION_KEY = 'bms_selected_location_id'

export function getToken() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key)
    // Bỏ qua giá trị rác do nơi khác ghi 'undefined'/'null' khi thiếu token.
    if (value && value !== 'undefined' && value !== 'null') return value
  }
  return null
}

export function getStoredLocationId() {
  const id = Number(localStorage.getItem(SELECTED_LOCATION_KEY))
  return Number.isFinite(id) && id > 0 ? id : null
}

export function storeLocationId(locationId) {
  if (locationId === null || locationId === undefined || locationId === '') {
    localStorage.removeItem(SELECTED_LOCATION_KEY)
    return
  }
  localStorage.setItem(SELECTED_LOCATION_KEY, String(locationId))
}

function createClient(locationId) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const selectedId = locationId ?? getStoredLocationId()
  if (selectedId) headers['X-Location-Id'] = String(selectedId)
  return axios.create({ baseURL: '/api', headers })
}

/** Đọc message lỗi theo đúng định dạng ApiResponse của backend. */
export function apiErrorMessage(error) {
  if (error?.response?.status === 401) return 'Please sign in with an Owner account.'
  if (error?.response?.status === 403) {
    return error.response.data?.message || 'You do not have permission for this facility.'
  }
  return error?.response?.data?.message || error?.message || 'Unexpected error.'
}

// ---------------------------------------------------------------- UC07: địa điểm & sân

/** GET /api/owner/locations — trả về LocationDetailDto[] kèm sẵn danh sách sân. */
export async function getOwnerLocations() {
  const { data } = await createClient().get('/owner/locations')
  return data?.data ?? []
}

/** POST /api/owner/locations/{id}/courts */
export async function createCourt(locationId, payload) {
  const { data } = await createClient(locationId).post(`/owner/locations/${locationId}/courts`, payload)
  return data?.data
}

/** PATCH /api/owner/courts/{id} — cần X-Location-Id vì path không có id địa điểm. */
export async function updateCourt(courtId, payload, locationId) {
  const { data } = await createClient(locationId).patch(`/owner/courts/${courtId}`, payload)
  return data?.data
}

/**
 * PATCH /api/owner/locations/{id} — sửa hồ sơ địa điểm (UC07).
 * Trường null = giữ nguyên, nên chỉ gửi những trường người dùng thật sự đổi.
 * Địa điểm đang LOCKED sẽ bị backend trả 403.
 */
export async function updateOwnerLocation(locationId, payload) {
  const { data } = await createClient(locationId).patch(`/owner/locations/${locationId}`, payload)
  return data?.data
}

// ------------------------------------------------------------ UC09: bảng giá theo sân

/** GET /api/owner/courts/{id}/price-rules — trả về PriceRuleDto[] của một sân. */
export async function getCourtPriceRules(courtId, locationId) {
  const { data } = await createClient(locationId).get(`/owner/courts/${courtId}/price-rules`)
  return data?.data ?? []
}

/** POST /api/owner/courts/{id}/price-rules */
export async function createPriceRule(courtId, payload, locationId) {
  const { data } = await createClient(locationId).post(`/owner/courts/${courtId}/price-rules`, payload)
  return data?.data
}

/** PATCH /api/owner/price-rules/{id} — path không có id địa điểm nên phải gửi X-Location-Id. */
export async function updatePriceRule(priceRuleId, payload, locationId) {
  const { data } = await createClient(locationId).patch(`/owner/price-rules/${priceRuleId}`, payload)
  return data?.data
}

/** DELETE /api/owner/price-rules/{id} */
export async function deletePriceRule(priceRuleId, locationId) {
  await createClient(locationId).delete(`/owner/price-rules/${priceRuleId}`)
}

// --------------------------------------------------------- UC09: ưu đãi đặt theo lô

/** GET /api/owner/batch-offers — ưu đãi của địa điểm đang chọn (X-Location-Id). */
export async function getBatchOffers(locationId) {
  const { data } = await createClient(locationId).get('/owner/batch-offers')
  return data?.data ?? []
}

/** POST /api/owner/batch-offers */
export async function createBatchOffer(payload, locationId) {
  const { data } = await createClient(locationId).post('/owner/batch-offers', payload)
  return data?.data
}

/** PATCH /api/owner/batch-offers/{id} */
export async function updateBatchOffer(offerId, payload, locationId) {
  const { data } = await createClient(locationId).patch(`/owner/batch-offers/${offerId}`, payload)
  return data?.data
}

/** DELETE /api/owner/batch-offers/{id} */
export async function deleteBatchOffer(offerId, locationId) {
  await createClient(locationId).delete(`/owner/batch-offers/${offerId}`)
}

/**
 * GET /api/owner/vouchers — chỉ lấy voucher PUBLISHED để gắn vào ưu đãi.
 * Endpoint thuộc feature voucher nhưng chỉ đọc, không sửa dữ liệu của feature khác.
 */
export async function getPublishedVouchers(locationId) {
  const { data } = await createClient(locationId).get('/owner/vouchers', {
    params: { status: 'PUBLISHED', page: 0, size: 100 },
  })
  return data?.data?.content ?? []
}

// ------------------------------------------------------------ UC06: Admin quản lý địa điểm

/**
 * Client cho API admin: chỉ gắn Authorization, KHÔNG gắn X-Location-Id.
 * Admin thao tác trên mọi địa điểm nên không có khái niệm "địa điểm đang chọn".
 */
function createAdminClient() {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return axios.create({ baseURL: '/api', headers })
}

/** GET /api/admin/locations?status=ACTIVE|LOCKED — AdminLocationDto[]. */
export async function getAdminLocations(status) {
  const params = status ? { status } : undefined
  const { data } = await createAdminClient().get('/admin/locations', { params })
  return data?.data ?? []
}

/** GET /api/admin/locations/{id} */
export async function getAdminLocation(locationId) {
  const { data } = await createAdminClient().get(`/admin/locations/${locationId}`)
  return data?.data
}

/** PATCH /api/admin/locations/{id} — body {"status":"LOCKED"} hoặc {"status":"ACTIVE"}. */
export async function updateLocationStatus(locationId, status) {
  const { data } = await createAdminClient().patch(`/admin/locations/${locationId}`, { status })
  return data?.data
}

/** GET /api/admin/service-registrations?status=PENDING — đơn đăng ký sử dụng dịch vụ. */
export async function getAdminServiceRegistrations(status) {
  const params = status ? { status } : undefined
  const { data } = await createAdminClient().get('/admin/service-registrations', { params })
  return data?.data ?? []
}

/** POST /api/admin/service-registrations/{id}/approve — không có body. */
export async function approveServiceRegistration(requestId) {
  const { data } = await createAdminClient().post(`/admin/service-registrations/${requestId}/approve`)
  return data?.data
}

/** POST /api/admin/service-registrations/{id}/reject — body {"reason": "..."}. */
export async function rejectServiceRegistration(requestId, reason) {
  const { data } = await createAdminClient()
    .post(`/admin/service-registrations/${requestId}/reject`, { reason })
  return data?.data
}

/** GET /api/admin/locations/{id}/service-terms */
export async function getLocationServiceTerms(locationId) {
  const { data } = await createAdminClient().get(`/admin/locations/${locationId}/service-terms`)
  return data?.data ?? []
}

/**
 * POST /api/admin/locations/{id}/service-terms — gia hạn kỳ hạn dịch vụ.
 * Backend yêu cầu kỳ hạn tối thiểu 12 tháng và không được trùng kỳ hạn đã có.
 */
export async function createServiceTerm(locationId, payload) {
  const { data } = await createAdminClient()
    .post(`/admin/locations/${locationId}/service-terms`, payload)
  return data?.data
}

// ------------------------------------------------------------------- UC10: bảo trì sân

/**
 * GET /api/staff/courts — sân của địa điểm mà staff đang làm việc.
 * Staff không gọi được /api/owner/** nên cần endpoint riêng này để chọn sân.
 */
export async function getStaffCourts() {
  const { data } = await createAdminClient().get('/staff/courts')
  return data?.data ?? []
}

/**
 * Danh sách yêu cầu bảo trì.
 *  - STAFF: GET /api/staff/maintenance-requests (địa điểm ghim theo tài khoản)
 *  - OWNER: GET /api/owner/maintenance-requests (địa điểm theo X-Location-Id)
 */
export async function getMaintenanceRequests(role, status) {
  const params = status ? { status } : undefined
  const client = role === 'OWNER' ? createClient() : createAdminClient()
  const path = role === 'OWNER' ? '/owner/maintenance-requests' : '/staff/maintenance-requests'
  const { data } = await client.get(path, { params })
  return data?.data ?? []
}

/** POST /api/staff/maintenance-requests — body {courtId, startAt, endAt, reason}. */
export async function createMaintenanceRequest(payload) {
  const { data } = await createAdminClient().post('/staff/maintenance-requests', payload)
  return data?.data
}

/** POST /api/staff/maintenance-requests/{id}/cancel — chỉ người tạo, chỉ khi PENDING. */
export async function cancelMaintenanceRequest(requestId, reason) {
  const { data } = await createAdminClient()
    .post(`/staff/maintenance-requests/${requestId}/cancel`, { reason: reason || null })
  return data?.data
}

/** POST /api/owner/maintenance-requests/{id}/approve — không có body. */
export async function approveMaintenanceRequest(requestId) {
  const { data } = await createClient().post(`/owner/maintenance-requests/${requestId}/approve`)
  return data?.data
}

/** POST /api/owner/maintenance-requests/{id}/reject — body {reason}. */
export async function rejectMaintenanceRequest(requestId, reason) {
  const { data } = await createClient()
    .post(`/owner/maintenance-requests/${requestId}/reject`, { reason })
  return data?.data
}

// --------------------------------------- UC08: giờ mở cửa, cấu hình slot, ngày ngoại lệ

/**
 * GET /api/owner/locations/{id}/opening-hours
 * Luôn trả đủ 7 ngày (1 = Thứ 2 … 7 = Chủ nhật); ngày chưa cấu hình có configured = false.
 */
export async function getOpeningHours(locationId) {
  const { data } = await createClient(locationId).get(`/owner/locations/${locationId}/opening-hours`)
  return data?.data ?? []
}

/**
 * PUT /api/owner/locations/{id}/opening-hours — thay thế TOÀN PHẦN.
 * Ngày không gửi lên sẽ bị xoá cấu hình, nên phải gửi đủ những ngày muốn giữ.
 */
export async function updateOpeningHours(locationId, hours) {
  const { data } = await createClient(locationId)
    .put(`/owner/locations/${locationId}/opening-hours`, { hours })
  return data?.data ?? []
}

/** GET /api/owner/locations/{id}/opening-exceptions?from=&to= (yyyy-MM-dd, tuỳ chọn). */
export async function getOpeningExceptions(locationId, { from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  const { data } = await createClient(locationId)
    .get(`/owner/locations/${locationId}/opening-exceptions`, { params })
  return data?.data ?? []
}

/** POST /api/owner/locations/{id}/opening-exceptions — body {exceptionDate, openMinute, closeMinute, note}. */
export async function createOpeningException(locationId, payload) {
  const { data } = await createClient(locationId)
    .post(`/owner/locations/${locationId}/opening-exceptions`, payload)
  return data?.data
}

/** PATCH /api/owner/opening-exceptions/{id} — path không có id địa điểm nên phải gửi X-Location-Id. */
export async function updateOpeningException(exceptionId, payload, locationId) {
  const { data } = await createClient(locationId)
    .patch(`/owner/opening-exceptions/${exceptionId}`, payload)
  return data?.data
}

/** DELETE /api/owner/opening-exceptions/{id} */
export async function deleteOpeningException(exceptionId, locationId) {
  await createClient(locationId).delete(`/owner/opening-exceptions/${exceptionId}`)
}

/**
 * GET /api/owner/courts/{id}/slot-settings
 * Cấu hình slot thuộc về ĐỊA ĐIỂM chứ không phải riêng sân, nên DTO trả cả locationId.
 */
export async function getSlotSetting(courtId, locationId) {
  const { data } = await createClient(locationId).get(`/owner/courts/${courtId}/slot-settings`)
  return data?.data
}

/** PUT /api/owner/courts/{id}/slot-settings — thay thế toàn phần, cả 3 trường đều bắt buộc. */
export async function updateSlotSetting(courtId, payload, locationId) {
  const { data } = await createClient(locationId).put(`/owner/courts/${courtId}/slot-settings`, payload)
  return data?.data
}
