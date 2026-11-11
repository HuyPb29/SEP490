import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom'
import api from './api'

import LocationSearchPage from './pages/location/LocationSearchPage'
import LocationDetailPage from './pages/location/LocationDetailPage'
import AuthPage from './pages/auth/AuthPage'
import AccountSettingsPage from './pages/account/AccountSettingsPage'
import BookingSummaryPage from './pages/booking/BookingSummaryPage'
import BookingPaymentPage from './pages/booking/BookingPaymentPage'
import MyBookingsPage from './pages/booking/MyBookingsPage'
import OpenMatchesPage from './pages/matches/OpenMatchesPage'
import StaffDashboardPage from './pages/staff/StaffDashboardPage'
import StaffConfirmPaymentPage from './pages/staff/StaffConfirmPaymentPage'

// Owner Portal — new layout-based structure
import OwnerLayout from './pages/owner/OwnerLayout'
import OwnerStaffPage from './pages/owner/OwnerStaffPage'
import OwnerLocationSettingsPage from './pages/owner/OwnerLocationSettingsPage'
import OwnerOpeningHoursPage from './pages/owner/OwnerOpeningHoursPage'
import OwnerMaintenancePage from './pages/owner/OwnerMaintenancePage'
import OwnerPlaceholderPage from './pages/owner/OwnerPlaceholderPage'

// Legacy Owner pages (kept intact; redirect shims below)
import OwnerReportPage from './pages/owner/OwnerReportPage'
import OwnerCourtsPricingPage from './pages/owner/OwnerCourtsPricingPage'

// Admin pages
import AdminLocationsPage from './pages/admin/AdminLocationsPage'
import AdminAccountsPage from './pages/admin/AdminAccountsPage'
import AdminViolatingVouchersPage from './pages/admin/AdminViolatingVouchersPage'
import AdminViolatingReviewsPage from './pages/admin/AdminViolatingReviewsPage'

/** Default owner location id used when redirecting legacy routes */
const DEFAULT_OWNER_LOCATION_ID = 1

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function AppContent() {
  const location = useLocation()

  const isOwnerPortal    = location.pathname.startsWith('/owner/locations/')
  const isLegacyOwner    = location.pathname === '/owner/reports' || location.pathname === '/owner/courts-pricing'
  const isMultiSessionBooking =
    location.pathname === '/booking/multi' || location.pathname.endsWith('/package-booking')
  const isFrontendMockPage =
    isMultiSessionBooking ||
    location.pathname === '/open-matches' ||
    location.pathname === '/staff/dashboard' ||
    location.pathname === '/staff/confirm-payments' ||
    isLegacyOwner ||
    location.pathname === '/admin/locations' ||
    location.pathname === '/admin/facilities' ||
    location.pathname === '/admin/accounts' ||
    location.pathname === '/admin/violating-vouchers' ||
    location.pathname === '/admin/violating-reviews' ||
    isOwnerPortal

  const [status, setStatus] = useState(() => (isFrontendMockPage ? 'mock preview' : 'checking...'))

  useEffect(() => {
    if (isFrontendMockPage) return
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('backend offline'))
  }, [isFrontendMockPage])
  const displayedStatus = isFrontendMockPage ? 'mock preview' : status

  return (
    <>
      {!isFrontendMockPage && (
        <div className="fixed bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded shadow-sm border border-slate-200 z-50 pointer-events-none">
          BE: {displayedStatus}
        </div>
      )}

      <Routes>
        {/* UC11: Tìm kiếm địa điểm (GET /api/v1/facilities/search) */}
        <Route path="/" element={<LocationSearchPage />} />

        {/* UC12-13: Location details and shared booking flow. */}
        <Route path="/locations/:id" element={<LocationDetailPage />} />
        <Route path="/locations/:id/package-booking" element={<LocationDetailPage />} />
        <Route path="/facilities/:id" element={<LegacyLocationRedirect />} />
        <Route path="/facilities/:id/package-booking" element={<LegacyLocationRedirect bookingMode="custom" />} />
        <Route path="/admin/facilities" element={<Navigate to="/admin/locations" replace />} />

        {/* UC29-30: Open matches */}
        <Route path="/open-matches" element={<OpenMatchesPage />} />

        {/* UC34: Staff dashboard mock preview */}
        <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
        {/* UC19: Staff payment confirmation mock preview */}
        <Route path="/staff/confirm-payments" element={<StaffConfirmPaymentPage />} />

        {/* ── Legacy Owner routes — redirect to new :id-based structure ── */}
        {/* UC35: redirect to new layout (default location 1) */}
        <Route path="/owner/reports" element={<Navigate to={`/owner/locations/${DEFAULT_OWNER_LOCATION_ID}/reports`} replace />} />
        {/* UC07-09: redirect to new layout */}
        <Route path="/owner/courts-pricing" element={<Navigate to={`/owner/locations/${DEFAULT_OWNER_LOCATION_ID}/courts`} replace />} />
        {/* /owner → redirect to default location reports */}
        <Route path="/owner" element={<Navigate to={`/owner/locations/${DEFAULT_OWNER_LOCATION_ID}/reports`} replace />} />

        {/* ── Owner Portal (new layout with sidebar) ── */}
        <Route path="/owner/locations/:id" element={<OwnerLayout />}>
          {/* Default tab: redirect to reports */}
          <Route index element={<Navigate to="reports" replace />} />

          {/* Implemented tabs */}
          <Route path="staff"       element={<OwnerStaffPage />} />
          <Route path="settings"    element={<OwnerLocationSettingsPage />} />
          <Route path="hours"       element={<OwnerOpeningHoursPage />} />
          <Route path="maintenance" element={<OwnerMaintenancePage />} />

          {/* Legacy pages served inside the new layout */}
          <Route path="reports" element={<OwnerReportPage embedded />} />
          <Route path="courts"  element={<OwnerCourtsPricingPage embedded />} />

          {/* Placeholder tabs for future sprints */}
          <Route path="vouchers"    element={<OwnerPlaceholderPage tab="vouchers" />} />
          <Route path="complaints"  element={<OwnerPlaceholderPage tab="complaints" />} />
          <Route path="refunds"     element={<OwnerPlaceholderPage tab="refunds" />} />
          <Route path="reviews"     element={<OwnerPlaceholderPage tab="reviews" />} />
        </Route>

        {/* UC06: Admin locations mock preview */}
        <Route path="/admin/locations" element={<AdminLocationsPage />} />
        {/* UC04: Admin user accounts mock preview */}
        <Route path="/admin/accounts" element={<AdminAccountsPage />} />
        {/* UC24: Admin violating vouchers mock preview */}
        <Route path="/admin/violating-vouchers" element={<AdminViolatingVouchersPage />} />
        {/* UC32: Admin violating reviews mock preview */}
        <Route path="/admin/violating-reviews" element={<AdminViolatingReviewsPage />} />

        {/* UC01-02: Đăng ký & Đăng nhập Player (POST /api/v1/auth/login & /register/player) */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/account/settings" element={<AccountSettingsPage />} />

        {/* UC14: Tóm tắt & Xác nhận đặt sân lẻ (POST /api/v1/vouchers/apply & POST /api/bookings) */}
        <Route path="/booking/summary" element={<BookingSummaryPage />} />

        {/* UC15: Đặt nhiều buổi định kỳ hoặc tự chọn (POST /api/booking-packages/preview & /api/booking-packages) */}
        <Route path="/booking/multi" element={<Navigate to="/" replace state={{ bookingMode: 'custom' }} />} />

        {/* UC18: Thanh toán chuyển khoản & Gửi chứng từ (POST /api/v1/bookings/:id/payment-proof) */}
        <Route path="/booking/payment" element={<BookingPaymentPage />} />

        {/* UC17: Lịch sử booking của Player (GET /api/v1/players/me/bookings & POST /api/v1/bookings/:id/cancel) */}
        <Route path="/my-bookings" element={<MyBookingsPage />} />
      </Routes>
    </>
  )
}

function LegacyLocationRedirect({ bookingMode }) {
  const { id } = useParams()
  return <Navigate to={`/locations/${id}`} replace state={bookingMode ? { bookingMode } : undefined} />
}
