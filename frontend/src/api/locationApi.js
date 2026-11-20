import api, { apiErrorMessage as formatApiError } from './index'
import { getSelectedLocation, getToken as getSessionToken, selectLocation } from './session'

/**
 * Lớp gọi API cho feature F2 (Quản lý địa điểm) và UC10 (Bảo trì sân).
 * Sử dụng chung instance `api` (Axios baseURL '/api') đã tự động gắn JWT và X-Location-Id.
 */

export function getToken() {
  return getSessionToken()
}

export function getStoredLocationId() {
  const id = Number(getSelectedLocation())
  return Number.isFinite(id) && id > 0 ? id : null
}

export function storeLocationId(locationId) {
  selectLocation(locationId)
}

function ownerConfig(locationId, extra = {}) {
  const selectedId = locationId ?? getStoredLocationId()
  if (!selectedId) return extra
  return {
    ...extra,
    locationId: selectedId,
    headers: {
      ...extra.headers,
      'X-Location-Id': String(selectedId),
    },
  }
}

export function apiErrorMessage(error) {
  return formatApiError(error, 'Đã có lỗi xảy ra. Vui lòng thử lại.')
}

// ---------------------------------------------------------------- UC07: địa điểm & sân

/** GET /api/owner/locations — trả về LocationDetailDto[] kèm sẵn danh sách sân. */
export async function getOwnerLocations() {
  const { data } = await api.get('/owner/locations')
  return data?.data ?? []
}

export async function uploadOwnerLocationQr(locationId, image) {
  const body = new FormData()
  body.append('image', image)
  const { data } = await api.post(`/owner/locations/${locationId}/qr`, body, ownerConfig(locationId))
  return data.data
}

/** POST /api/owner/locations/{id}/courts */
export async function createCourt(locationId, payload) {
  const { data } = await api.post(`/owner/locations/${locationId}/courts`, payload, ownerConfig(locationId))
  return data?.data
}

/** PATCH /api/owner/courts/{id} — cần X-Location-Id vì path không có id địa điểm. */
export async function updateCourt(courtId, payload, locationId) {
  const { data } = await api.patch(`/owner/courts/${courtId}`, payload, ownerConfig(locationId))
  return data?.data
}

/** PATCH /api/owner/locations/{id} — sửa hồ sơ địa điểm (UC07). */
export async function updateOwnerLocation(locationId, payload) {
  const { data } = await api.patch(`/owner/locations/${locationId}`, payload, ownerConfig(locationId))
  return data?.data
}

// ------------------------------------------------------------ UC09: bảng giá theo sân

/** GET /api/owner/courts/{id}/price-rules — trả về PriceRuleDto[] của một sân. */
export async function getCourtPriceRules(courtId, locationId) {
  const { data } = await api.get(`/owner/courts/${courtId}/price-rules`, ownerConfig(locationId))
  return data?.data ?? []
}

/** POST /api/owner/courts/{id}/price-rules */
export async function createPriceRule(courtId, payload, locationId) {
  const { data } = await api.post(`/owner/courts/${courtId}/price-rules`, payload, ownerConfig(locationId))
  return data?.data
}

/** PATCH /api/owner/price-rules/{id} — path không có id địa điểm nên phải gửi X-Location-Id. */
export async function updatePriceRule(priceRuleId, payload, locationId) {
  const { data } = await api.patch(`/owner/price-rules/${priceRuleId}`, payload, ownerConfig(locationId))
  return data?.data
}

/** DELETE /api/owner/price-rules/{id} */
export async function deletePriceRule(priceRuleId, locationId) {
  await api.delete(`/owner/price-rules/${priceRuleId}`, ownerConfig(locationId))
}

// ------------------------------------------------------------ UC06: Admin quản lý địa điểm

/** GET /api/admin/locations?status=ACTIVE|LOCKED — AdminLocationDto[]. */
export async function getAdminLocations(status) {
  const params = status ? { status } : undefined
  const { data } = await api.get('/admin/locations', { params })
  return data?.data ?? []
}

/** GET /api/admin/locations/{id} */
export async function getAdminLocation(locationId) {
  const { data } = await api.get(`/admin/locations/${locationId}`)
  return data?.data
}

/** PATCH /api/admin/locations/{id} — body {"status":"LOCKED"} hoặc {"status":"ACTIVE"}. */
export async function updateLocationStatus(locationId, status) {
  const { data } = await api.patch(`/admin/locations/${locationId}`, { status })
  return data?.data
}

/** GET /api/admin/service-registrations?status=PENDING — đơn đăng ký sử dụng dịch vụ. */
export async function getAdminServiceRegistrations(status) {
  const params = status ? { status } : undefined
  const { data } = await api.get('/admin/service-registrations', { params })
  return data?.data ?? []
}

/** POST /api/admin/service-registrations/{id}/approve — không có body. */
export async function approveServiceRegistration(requestId) {
  const { data } = await api.post(`/admin/service-registrations/${requestId}/approve`)
  return data?.data
}

/** POST /api/admin/service-registrations/{id}/reject — body {"reason": "..."}; hệ thống gửi email MSG117. */
export async function rejectServiceRegistration(requestId, reason) {
  const { data } = await api.post(`/admin/service-registrations/${requestId}/reject`, { reason })
  return data?.data
}

/** GET /api/admin/service-registrations/{id}/proof — ảnh chứng từ chuyển khoản tiền thuê (FR11), trả Blob. */
export async function getServiceRegistrationProof(requestId) {
  const { data } = await api.get(`/admin/service-registrations/${requestId}/proof`, { responseType: 'blob' })
  return data
}

// ------------------------------------------- UC05, UC06 #8: thông tin chuyển khoản của bên vận hành (FR127)

/** Đường dẫn ảnh QR của bên vận hành, công khai; thêm version để trình duyệt tải lại khi Admin đổi ảnh. */
export function operatorQrUrl(version) {
  return `/api/service-registrations/payment-info/qr${version ? `?v=${encodeURIComponent(version)}` : ''}`
}

/** GET /api/service-registrations/payment-info — công khai: ngân hàng, số tài khoản, chủ tài khoản, mức P35. */
export async function getServiceRegistrationPaymentInfo() {
  const { data } = await api.get('/service-registrations/payment-info')
  return data?.data
}

/**
 * POST /api/service-registrations (multipart): phần "data" là JSON đơn, phần "proof" là ảnh chứng từ.
 * Trả nguyên body để lấy câu MSG99 trong message.
 */
export async function submitServiceRegistration(payload, proofFile) {
  const body = new FormData()
  body.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  body.append('proof', proofFile)
  const { data } = await api.post('/service-registrations', body)
  return data
}

/** PUT /api/admin/operator-payment-info — body {bankName, bankAccountNo, bankAccountHolder}. */
export async function updateOperatorPaymentInfo(payload) {
  const { data } = await api.put('/admin/operator-payment-info', payload)
  return data?.data
}

/** POST /api/admin/operator-payment-info/qr — multipart "image" (JPG/PNG, tối đa 5 MB). */
export async function uploadOperatorQr(image) {
  const body = new FormData()
  body.append('image', image)
  const { data } = await api.post('/admin/operator-payment-info/qr', body)
  return data?.data
}

/** GET /api/admin/locations/{id}/service-terms */
export async function getLocationServiceTerms(locationId) {
  const { data } = await api.get(`/admin/locations/${locationId}/service-terms`)
  return data?.data ?? []
}

/** POST /api/admin/locations/{id}/service-terms — gia hạn kỳ hạn dịch vụ. */
export async function createServiceTerm(locationId, payload) {
  const { data } = await api.post(`/admin/locations/${locationId}/service-terms`, payload)
  return data?.data
}

// ------------------------------------------------------------------- UC10: bảo trì sân

/** GET /api/staff/courts — sân của địa điểm mà staff đang làm việc. */
export async function getStaffCourts() {
  const { data } = await api.get('/staff/courts')
  return data?.data ?? []
}

/**
 * Danh sách yêu cầu bảo trì.
 *  - STAFF: GET /api/staff/maintenance-requests (địa điểm ghim theo tài khoản)
 *  - OWNER: GET /api/owner/maintenance-requests (địa điểm theo X-Location-Id)
 */
export async function getMaintenanceRequests(role, status, locationId) {
  const params = status ? { status } : undefined
  const path = role === 'OWNER' ? '/owner/maintenance-requests' : '/staff/maintenance-requests'
  const config = role === 'OWNER' ? ownerConfig(locationId, { params }) : { params }
  const { data } = await api.get(path, config)
  return data?.data ?? []
}

/** POST /api/staff/maintenance-requests — body {courtId, startAt, endAt, reason}. */
export async function createMaintenanceRequest(payload, locationId) {
  const { data } = await api.post('/staff/maintenance-requests', payload, locationId ? ownerConfig(locationId) : undefined)
  return data?.data
}

/** POST /api/staff/maintenance-requests/{id}/cancel — chỉ người tạo, chỉ khi PENDING. */
export async function cancelMaintenanceRequest(requestId, reason, locationId) {
  const { data } = await api.post(`/staff/maintenance-requests/${requestId}/cancel`, { reason: reason || null },
    locationId ? ownerConfig(locationId) : undefined)
  return data?.data
}

/** GET MSG15: booking đã xác nhận bị ảnh hưởng trước khi duyệt bảo trì. */
export async function getMaintenanceImpact(requestId, locationId) {
  const { data } = await api.get(`/owner/maintenance-requests/${requestId}/impact`, ownerConfig(locationId))
  return data.data
}

/** POST: xác nhận đúng phiên bản danh sách booking Owner đã xem. */
export async function approveMaintenanceRequest(requestId, locationId, bookings = []) {
  const expectedBookings = bookings.map(({ id, version }) => ({ id, version }))
  const { data } = await api.post(`/owner/maintenance-requests/${requestId}/approve`, { expectedBookings }, ownerConfig(locationId))
  return data?.data
}

/** POST /api/owner/maintenance-requests/{id}/reject — body {reason}. */
export async function rejectMaintenanceRequest(requestId, reason, locationId) {
  const { data } = await api.post(`/owner/maintenance-requests/${requestId}/reject`, { reason }, ownerConfig(locationId))
  return data?.data
}

// --------------------------------------- UC08: giờ mở cửa, cấu hình slot, ngày ngoại lệ

/** GET /api/owner/locations/{id}/opening-hours */
export async function getOpeningHours(locationId) {
  const { data } = await api.get(`/owner/locations/${locationId}/opening-hours`, ownerConfig(locationId))
  return data?.data ?? []
}

/** PUT /api/owner/locations/{id}/opening-hours — thay thế TOÀN PHẦN. */
export async function updateOpeningHours(locationId, hours) {
  const { data } = await api.put(`/owner/locations/${locationId}/opening-hours`, { hours }, ownerConfig(locationId))
  return data?.data ?? []
}

/** GET /api/owner/locations/{id}/opening-exceptions?from=&to= */
export async function getOpeningExceptions(locationId, { from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  const { data } = await api.get(`/owner/locations/${locationId}/opening-exceptions`, ownerConfig(locationId, { params }))
  return data?.data ?? []
}

/** POST /api/owner/locations/{id}/opening-exceptions */
export async function createOpeningException(locationId, payload) {
  const { data } = await api.post(`/owner/locations/${locationId}/opening-exceptions`, payload, ownerConfig(locationId))
  return data?.data
}

/** PATCH /api/owner/opening-exceptions/{id} */
export async function updateOpeningException(exceptionId, payload, locationId) {
  const { data } = await api.patch(`/owner/opening-exceptions/${exceptionId}`, payload, ownerConfig(locationId))
  return data?.data
}

/** DELETE /api/owner/opening-exceptions/{id} */
export async function deleteOpeningException(exceptionId, locationId) {
  await api.delete(`/owner/opening-exceptions/${exceptionId}`, ownerConfig(locationId))
}

/** GET /api/owner/courts/{id}/slot-settings */
export async function getSlotSetting(courtId, locationId) {
  const { data } = await api.get(`/owner/courts/${courtId}/slot-settings`, ownerConfig(locationId))
  return data?.data
}

/** PUT /api/owner/courts/{id}/slot-settings */
export async function updateSlotSetting(courtId, payload, locationId) {
  const { data } = await api.put(`/owner/courts/${courtId}/slot-settings`, payload, ownerConfig(locationId))
  return data?.data
}
