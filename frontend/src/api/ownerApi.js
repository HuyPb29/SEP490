/**
 * ownerApi.js — Owner Portal API layer
 * All functions try the real backend first; on network/server error they
 * fall back to in-memory mock data so the UI works fully offline.
 *
 * Data is keyed by locationId (number).
 */
import axios from 'axios'

// ─── Mock data ────────────────────────────────────────────────────────────────

/** Locations owned by the current owner (numeric IDs match MOCK_FACILITIES in locationApi) */
export const MOCK_OWNER_LOCATIONS = [
  { id: 1, name: 'Smash Arena' },
  { id: 2, name: 'Green Shuttle Club' },
  { id: 3, name: 'Hanoi Badminton Hub' },
]

const MOCK_STAFF = {
  1: [
    {
      id: 101,
      username: 'staff_nam',
      full_name: 'Nguyen Van Nam',
      phone: '0901234561',
      is_locked: false,
    },
    {
      id: 102,
      username: 'staff_huong',
      full_name: 'Tran Thi Huong',
      phone: '0901234562',
      is_locked: false,
    },
    {
      id: 103,
      username: 'staff_long',
      full_name: 'Le Van Long',
      phone: '0901234563',
      is_locked: true,
    },
  ],
  2: [
    {
      id: 201,
      username: 'staff_bich',
      full_name: 'Pham Thi Bich',
      phone: '0902234561',
      is_locked: false,
    },
    {
      id: 202,
      username: 'staff_tung',
      full_name: 'Hoang Van Tung',
      phone: '0902234562',
      is_locked: false,
    },
  ],
  3: [
    {
      id: 301,
      username: 'staff_mai',
      full_name: 'Do Thi Mai',
      phone: '0903234561',
      is_locked: false,
    },
  ],
}

const MOCK_SETTINGS = {
  1: {
    // Group 1 — Basic Location Info
    facility_name: 'Smash Arena',
    address: '12 Tran Thai Tong',
    district: 'Cau Giay',
    city: 'Hanoi',
    contact_hotline: '0912345678',
    latitude: 21.0362,
    longitude: 105.7885,
    // Group 2 — VietQR & Bank Payment Info
    bank_name: 'Vietcombank',
    bank_account_number: '1234567890',
    account_holder_name: 'NGUYEN VAN A',
    qr_image_url: null,
    // Group 3 — Operational Parameters (editable)
    p01_booking_lead_time_days: 30,
    p09_loyalty_point_earn_rate: 10000,
    p14_cumulative_milestones: [
      { milestone_amount: 1000000, reward_voucher_value: 50000 },
      { milestone_amount: 5000000, reward_voucher_value: 300000 },
    ],
  },
  2: {
    facility_name: 'Green Shuttle Club',
    address: '88 Nguyen Khanh Toan',
    district: 'Cau Giay',
    city: 'Hanoi',
    contact_hotline: '0987654321',
    latitude: 21.0381,
    longitude: 105.7982,
    bank_name: 'Techcombank',
    bank_account_number: '9876543210',
    account_holder_name: 'TRAN THI B',
    qr_image_url: null,
    p01_booking_lead_time_days: 30,
    p09_loyalty_point_earn_rate: 10000,
    p14_cumulative_milestones: [
      { milestone_amount: 2000000, reward_voucher_value: 100000 },
    ],
  },
  3: {
    facility_name: 'Hanoi Badminton Hub',
    address: '25 Ho Tung Mau',
    district: 'Nam Tu Liem',
    city: 'Hanoi',
    contact_hotline: '0909112233',
    latitude: 21.0375,
    longitude: 105.7731,
    bank_name: 'MB Bank',
    bank_account_number: '1122334455',
    account_holder_name: 'LE VAN C',
    qr_image_url: null,
    p01_booking_lead_time_days: 30,
    p09_loyalty_point_earn_rate: 10000,
    p14_cumulative_milestones: [],
  },
}

const MOCK_OPENING_HOURS = {
  1: {
    standard_hours: [
      { day_of_week: 'Monday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Tuesday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Wednesday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Thursday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Friday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Saturday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Sunday', open_time: '05:00', close_time: '23:00', is_closed: false },
    ],
    exception_dates: [
      {
        id: 'exp-1',
        date: '2026-12-25',
        is_closed: true,
        open_time: '',
        close_time: '',
        note: 'Christmas Holiday',
      },
      {
        id: 'exp-2',
        date: '2026-12-31',
        is_closed: false,
        open_time: '06:00',
        close_time: '18:00',
        note: 'New Year Eve Early Close',
      },
    ],
  },
  2: {
    standard_hours: [
      { day_of_week: 'Monday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Tuesday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Wednesday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Thursday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Friday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Saturday', open_time: '06:00', close_time: '22:00', is_closed: false },
      { day_of_week: 'Sunday', open_time: '06:00', close_time: '22:00', is_closed: false },
    ],
    exception_dates: [],
  },
  3: {
    standard_hours: [
      { day_of_week: 'Monday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Tuesday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Wednesday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Thursday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Friday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Saturday', open_time: '05:30', close_time: '23:00', is_closed: false },
      { day_of_week: 'Sunday', open_time: '05:30', close_time: '23:00', is_closed: false },
    ],
    exception_dates: [],
  },
}

const MOCK_MAINTENANCE_REQUESTS = {
  1: [
    {
      id: 1001,
      court_id: 1,
      court_name: 'Court 1',
      maintenance_date: '2026-11-20',
      start_time: '08:00',
      end_time: '12:00',
      reason: 'Yonex mat replacement and tension fix',
      requested_by: 'Nguyen Van Nam (@staff_nam)',
      affected_bookings_count: 2, // Test affected > 0 (triggers MSG15 modal)
      status: 'Pending',
      rejection_note: null,
      created_at: '2026-11-10 14:30',
    },
    {
      id: 1002,
      court_id: 2,
      court_name: 'Court 2',
      maintenance_date: '2026-11-21',
      start_time: '13:00',
      end_time: '15:00',
      reason: 'LED lighting fixture inspection and bulb replacement',
      requested_by: 'Tran Thi Huong (@staff_huong)',
      affected_bookings_count: 0, // Test affected === 0 (direct approval)
      status: 'Pending',
      rejection_note: null,
      created_at: '2026-11-10 16:15',
    },
    {
      id: 1003,
      court_id: 6,
      court_name: 'Court 6',
      maintenance_date: '2026-11-05',
      start_time: '07:00',
      end_time: '11:00',
      reason: 'Net post welding and base stabilization',
      requested_by: 'Nguyen Van Nam (@staff_nam)',
      affected_bookings_count: 1,
      status: 'Approved',
      rejection_note: null,
      created_at: '2026-11-04 09:00',
    },
    {
      id: 1004,
      court_id: 3,
      court_name: 'Court 3',
      maintenance_date: '2026-11-08',
      start_time: '18:00',
      end_time: '20:00',
      reason: 'Cosmetic repainting requested during prime evening slot',
      requested_by: 'Le Van Long (@staff_long)',
      affected_bookings_count: 4,
      status: 'Rejected',
      rejection_note: 'Non-urgent aesthetic work scheduled during peak customer hours. Please reschedule to morning.',
      created_at: '2026-11-07 10:20',
    },
  ],
  2: [
    {
      id: 2001,
      court_id: 1,
      court_name: 'Court 1',
      maintenance_date: '2026-11-25',
      start_time: '09:00',
      end_time: '11:30',
      reason: 'Floor cleaning and anti-slip coating',
      requested_by: 'Pham Thi Bich (@staff_bich)',
      affected_bookings_count: 1,
      status: 'Pending',
      rejection_note: null,
      created_at: '2026-11-11 08:00',
    },
  ],
  3: [],
}

// In-memory mutable copies (survive page interactions; reset on hard-refresh)
let _mockStaff = JSON.parse(JSON.stringify(MOCK_STAFF))
let _mockSettings = JSON.parse(JSON.stringify(MOCK_SETTINGS))
let _mockOpeningHours = JSON.parse(JSON.stringify(MOCK_OPENING_HOURS))
let _mockMaintenanceRequests = JSON.parse(JSON.stringify(MOCK_MAINTENANCE_REQUESTS))
let _nextStaffId = 400
let _nextExceptionId = 10

function getDefaultSettings(locationId) {
  return {
    facility_name: `Location ${locationId}`,
    address: '',
    district: '',
    city: '',
    contact_hotline: '',
    latitude: null,
    longitude: null,
    bank_name: '',
    bank_account_number: '',
    account_holder_name: '',
    qr_image_url: null,
    p01_booking_lead_time_days: 30,
    p09_loyalty_point_earn_rate: 10000,
    p14_cumulative_milestones: [],
  }
}

function getDefaultStaff() {
  return []
}

function getDefaultOpeningHours() {
  return {
    standard_hours: [
      { day_of_week: 'Monday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Tuesday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Wednesday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Thursday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Friday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Saturday', open_time: '05:00', close_time: '23:00', is_closed: false },
      { day_of_week: 'Sunday', open_time: '05:00', close_time: '23:00', is_closed: false },
    ],
    exception_dates: [],
  }
}

/** Simulate async network delay (mock only) */
function delay(ms = 150) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Owner Locations ───────────────────────────────────────────────────────────

/**
 * Get all locations owned by the current owner.
 * Returns: [{ id, name }, …]
 */
export async function getOwnerLocations() {
  try {
    const res = await axios.get('/api/owner/locations')
    const data = res.data?.data ?? res.data
    if (Array.isArray(data) && data.length > 0) {
      return data.map((loc) => ({ id: loc.id ?? loc.facility_id, name: loc.name ?? loc.facility_name }))
    }
    throw new Error('Empty or unexpected response')
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      return MOCK_OWNER_LOCATIONS
    }
    throw err
  }
}

// ─── Staff CRUD ────────────────────────────────────────────────────────────────

/**
 * Get staff list for a location.
 * Returns: [{ id, username, full_name, phone, is_locked }, …]
 */
export async function getStaffByLocation(locationId) {
  const lid = Number(locationId)
  try {
    const res = await axios.get(`/api/owner/locations/${lid}/staff`)
    const data = res.data?.data ?? res.data
    if (Array.isArray(data)) return data
    throw new Error('Unexpected response')
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      return JSON.parse(JSON.stringify(_mockStaff[lid] ?? getDefaultStaff(lid)))
    }
    throw err
  }
}

/**
 * Add a new staff member to a location.
 * payload: { username, full_name, phone, password }
 * Returns the created staff object.
 */
export async function addStaff(locationId, payload) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(`/api/owner/locations/${lid}/staff`, payload)
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const newStaff = {
        id: _nextStaffId++,
        username: payload.username,
        full_name: payload.full_name,
        phone: payload.phone,
        is_locked: false,
      }
      if (!_mockStaff[lid]) _mockStaff[lid] = []
      _mockStaff[lid].push(newStaff)
      return { ...newStaff }
    }
    throw err
  }
}

/**
 * Update an existing staff member's info.
 * payload: { full_name, phone }
 */
export async function updateStaff(locationId, staffId, payload) {
  const lid = Number(locationId)
  try {
    const res = await axios.put(`/api/owner/locations/${lid}/staff/${staffId}`, payload)
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const list = _mockStaff[lid] ?? []
      const idx = list.findIndex((s) => s.id === staffId)
      if (idx === -1) throw new Error('Staff not found')
      list[idx] = { ...list[idx], ...payload }
      return { ...list[idx] }
    }
    throw err
  }
}

/**
 * Reset a staff member's password (FR07, DR31).
 * payload: { new_password }
 */
export async function resetStaffPassword(locationId, staffId, payload) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(
      `/api/owner/locations/${lid}/staff/${staffId}/reset-password`,
      payload,
    )
    return res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      // Password not stored in mock — just validate staffId exists
      const list = _mockStaff[lid] ?? []
      if (!list.find((s) => s.id === staffId)) throw new Error('Staff not found')
      return { success: true }
    }
    throw err
  }
}

/**
 * Lock a staff account (BR59, DR30).
 */
export async function lockStaff(locationId, staffId) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(`/api/owner/locations/${lid}/staff/${staffId}/lock`)
    return res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const list = _mockStaff[lid] ?? []
      const item = list.find((s) => s.id === staffId)
      if (!item) throw new Error('Staff not found')
      item.is_locked = true
      return { success: true }
    }
    throw err
  }
}

/**
 * Unlock a staff account (BR59, DR30).
 */
export async function unlockStaff(locationId, staffId) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(`/api/owner/locations/${lid}/staff/${staffId}/unlock`)
    return res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const list = _mockStaff[lid] ?? []
      const item = list.find((s) => s.id === staffId)
      if (!item) throw new Error('Staff not found')
      item.is_locked = false
      return { success: true }
    }
    throw err
  }
}

// ─── Location Settings ─────────────────────────────────────────────────────────

/**
 * Get settings for a location (FR16, FR17, BR60).
 */
export async function getLocationSettings(locationId) {
  const lid = Number(locationId)
  try {
    const res = await axios.get(`/api/owner/locations/${lid}/settings`)
    const data = res.data?.data ?? res.data
    if (data && typeof data === 'object') return data
    throw new Error('Unexpected response')
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      return JSON.parse(JSON.stringify(_mockSettings[lid] ?? getDefaultSettings(lid)))
    }
    throw err
  }
}

/**
 * Update settings for a location (FR16, FR17, BR60).
 * payload: Partial settings object.
 */
export async function updateLocationSettings(locationId, payload) {
  const lid = Number(locationId)
  try {
    const res = await axios.put(`/api/owner/locations/${lid}/settings`, payload)
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      if (!_mockSettings[lid]) _mockSettings[lid] = getDefaultSettings(lid)
      _mockSettings[lid] = { ..._mockSettings[lid], ...payload }
      return { ..._mockSettings[lid] }
    }
    throw err
  }
}

// ─── Opening Hours (UC08, FR18, FR19, FR62, BR01, BR04, BR17) ─────────────────

/**
 * Get standard weekly hours and exception dates for a location.
 */
export async function getOpeningHoursApi(locationId) {
  const lid = Number(locationId)
  try {
    const res = await axios.get(`/api/owner/locations/${lid}/opening-hours`)
    const data = res.data?.data ?? res.data
    if (data && typeof data === 'object') return data
    throw new Error('Unexpected response')
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      return JSON.parse(JSON.stringify(_mockOpeningHours[lid] ?? getDefaultOpeningHours(lid)))
    }
    throw err
  }
}

/**
 * Update opening hours for a location.
 * Validates court pricing range (MSG42) and checks for confirmed booking impacts (BR17 & MSG15).
 */
export async function updateOpeningHoursApi(locationId, payload, { confirmAffected = false } = {}) {
  const lid = Number(locationId)

  // 1. Pricing coverage validation (MSG42):
  // Check if any open day has open_time < "05:00" or close_time > "23:00"
  const openDays = [
    ...(payload.standard_hours || []).filter((d) => !d.is_closed),
    ...(payload.exception_dates || []).filter((d) => !d.is_closed && d.open_time && d.close_time),
  ]
  const exceedsPricing = openDays.some(
    (d) => (d.open_time && d.open_time < '05:00') || (d.close_time && d.close_time > '23:00')
  )
  if (exceedsPricing) {
    throw new Error(
      '[MSG42] Cannot save: the selected time range exceeds configured court pricing hours (05:00 - 23:00). Please configure pricing rules first.'
    )
  }

  try {
    const res = await axios.put(`/api/owner/locations/${lid}/opening-hours`, payload, {
      params: { confirmAffected },
    })
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()

      // 2. Check impact on confirmed bookings when narrowing hours or closing (BR17 & MSG15):
      const hasNarrowedOrClosed =
        (payload.standard_hours || []).some(
          (d) => d.is_closed || (d.open_time && d.open_time > '05:00') || (d.close_time && d.close_time < '23:00')
        ) ||
        (payload.exception_dates || []).some(
          (d) => d.is_closed || (d.open_time && d.open_time > '05:00') || (d.close_time && d.close_time < '23:00')
        )

      if (hasNarrowedOrClosed && !confirmAffected) {
        return {
          requires_confirmation: true,
          affected_bookings_count: 3,
        }
      }

      // Save into mock
      _mockOpeningHours[lid] = JSON.parse(JSON.stringify(payload))
      return {
        success: true,
        data: _mockOpeningHours[lid],
        message: '[MSG03] Opening hours updated successfully. Affected customers have been notified (MSG67).',
      }
    }
    throw err
  }
}

// ─── Maintenance Approval (UC10, FR23, FR24, FR25, BR16, BR17, BF-08) ─────────

/**
 * Get maintenance requests for a location.
 */
export async function getMaintenanceRequestsApi(locationId) {
  const lid = Number(locationId)
  try {
    const res = await axios.get(`/api/owner/locations/${lid}/maintenance-requests`)
    const data = res.data?.data ?? res.data
    if (Array.isArray(data)) return data
    throw new Error('Unexpected response')
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      return JSON.parse(JSON.stringify(_mockMaintenanceRequests[lid] ?? []))
    }
    throw err
  }
}

/**
 * Approve a maintenance request (BR16, BR17).
 */
export async function approveMaintenanceRequestApi(locationId, requestId) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(`/api/owner/locations/${lid}/maintenance-requests/${requestId}/approve`)
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const list = _mockMaintenanceRequests[lid] ?? []
      const item = list.find((r) => r.id === Number(requestId))
      if (!item) throw new Error('Maintenance request not found.')
      item.status = 'Approved'
      return { success: true, data: item }
    }
    throw err
  }
}

/**
 * Reject a maintenance request with optional rejection note (Report 3 BF-08).
 */
export async function rejectMaintenanceRequestApi(locationId, requestId, { note = '' } = {}) {
  const lid = Number(locationId)
  try {
    const res = await axios.post(`/api/owner/locations/${lid}/maintenance-requests/${requestId}/reject`, { note })
    return res.data?.data ?? res.data
  } catch (err) {
    if (!err.response || err.response.status >= 500) {
      await delay()
      const list = _mockMaintenanceRequests[lid] ?? []
      const item = list.find((r) => r.id === Number(requestId))
      if (!item) throw new Error('Maintenance request not found.')
      item.status = 'Rejected'
      item.rejection_note = note || ''
      return { success: true, data: item }
    }
    throw err
  }
}
