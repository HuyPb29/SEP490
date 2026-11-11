import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import api from './api'
import { getSavedUser, getSelectedLocation, getToken, roleHome } from './api/session'
import { AccountPage, AdminWorkspace } from './pages/account/AccountPages'
import { AdminVouchers, PersonalRewardsPage } from './pages/promotion/PromotionPages'
import NotificationsPage from './pages/NotificationsPage'

import FacilitySearchPage from './pages/location/FacilitySearchPage'
import FacilityDetailPage from './pages/location/FacilityDetailPage'
import AuthPage from './pages/auth/AuthPage'
import BookingSummaryPage from './pages/booking/BookingSummaryPage'
import BookingPaymentPage from './pages/booking/BookingPaymentPage'
import MyBookingsPage from './pages/booking/MyBookingsPage'
import RescheduleHistoryPage from './pages/booking/RescheduleHistoryPage'
import OpenMatchesPage from './pages/matches/OpenMatchesPage'
import StaffDashboardPage from './pages/staff/StaffDashboardPage'
import StaffConfirmPaymentPage from './pages/staff/StaffConfirmPaymentPage'
import OwnerCourtsPricingPage from './pages/owner/OwnerCourtsPricingPage'
import OwnerOpeningHoursPage from './pages/owner/OwnerOpeningHoursPage'
import OwnerFacilitySettingsPage from './pages/owner/OwnerFacilitySettingsPage'
import AdminFacilitiesPage from './pages/admin/AdminFacilitiesPage'
import MaintenanceRequestsPage from './pages/operation/MaintenanceRequestsPage'
import NotificationBell from './components/notification/NotificationBell'
import WorkspaceNav from './components/navigation/WorkspaceNav'

const PlayerComplaintsPage = lazy(() => import('./pages/feedback/CourtComplaintsPage')
  .then((module) => ({ default: module.PlayerComplaintsPage })))
const CourtComplaintsPage = lazy(() => import('./pages/feedback/CourtComplaintsPage'))
const OwnerReportPage = lazy(() => import('./pages/owner/OwnerReportPage'))
const OwnerWorkspace = lazy(() => import('./pages/owner/OwnerWorkspace'))
const MultiSessionBookingPage = lazy(() => import('./pages/booking/MultiSessionBookingPage'))

function RequireRole({ roles, selectedVenue, children }) {
  const location = useLocation()
  const user = getSavedUser()
  if (!user) return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />
  if (!roles.includes(user.role_code)) return <Navigate to={roleHome[user.role_code] ?? '/'} replace />
  if (selectedVenue && user.role_code === 'owner' && !getSelectedLocation()) {
    return <Navigate to="/owner/workspace" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function subscribeToSession(listener) {
  window.addEventListener('bms-auth-change', listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener('bms-auth-change', listener)
    window.removeEventListener('storage', listener)
  }
}

function AppContent() {
  const session = useSyncExternalStore(subscribeToSession, getToken)
  const location = useLocation()
  // Hai màn còn dùng dữ liệu mẫu, chưa gọi backend
  const isFrontendMockPage =
    location.pathname === '/open-matches' ||
    location.pathname === '/staff/dashboard'
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

      {/* UC37: chuông thông báo dùng chung, tự ẩn khi chưa đăng nhập */}
      {!isFrontendMockPage && <NotificationBell />}

      {/* Lối vào các màn hình quản lý theo vai trò; tự ẩn khi chưa đăng nhập */}
      <WorkspaceNav />

      <Suspense fallback={<p role="status" className="p-6">Đang tải trang…</p>}>
        <Routes key={session ? 'signed-in' : 'guest'}>
          {/* UC11: Tìm kiếm địa điểm (GET /api/v1/facilities/search) */}
          <Route path="/" element={<FacilitySearchPage />} />

          {/* UC12-13: Thông tin & Lịch sân (GET /api/v1/facilities/:id & /court-schedule) */}
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
          {/* UC15: Đặt nhiều buổi */}
          <Route path="/facilities/:id/package-booking" element={<MultiSessionBookingPage />} />
          {/* UC29-30: Open matches */}
          <Route path="/open-matches" element={<OpenMatchesPage />} />

          {/* UC34: Staff dashboard mock preview */}
          <Route path="/staff/complaints" element={<CourtComplaintsPage />} />
          <Route path="/staff/dashboard" element={<RequireRole roles={['staff']}><StaffDashboardPage /></RequireRole>} />
          {/* UC19 và UC21: Xác nhận thanh toán và phụ thu */}
          <Route path="/staff/confirm-payments" element={<RequireRole roles={['staff', 'owner']} selectedVenue><StaffConfirmPaymentPage /></RequireRole>} />
          {/* UC35: Báo cáo vận hành và doanh thu */}
          <Route path="/owner/reports" element={<RequireRole roles={['owner']} selectedVenue><OwnerReportPage /></RequireRole>} />
          {/* UC07-09: Sân và bảng giá của Owner */}
          <Route path="/owner/courts-pricing" element={<RequireRole roles={['owner']} selectedVenue><OwnerCourtsPricingPage /></RequireRole>} />
          {/* UC06: Admin facilities mock preview */}
          <Route path="/admin/facilities" element={<RequireRole roles={['admin']}><AdminFacilitiesPage /></RequireRole>} />

          {/* UC01-02: Đăng ký Player, xác minh OTP và quản lý phiên đăng nhập */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/owner/workspace" element={<OwnerWorkspace />} />
          <Route path="/admin/workspace" element={<AdminWorkspace><AdminVouchers /></AdminWorkspace>} />
          <Route path="/my-complaints" element={<PlayerComplaintsPage />} />
          <Route path="/my-rewards" element={<PersonalRewardsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* UC14 và F6: Tóm tắt, voucher, điểm và xác nhận đặt sân lẻ */}
          <Route path="/booking/summary" element={<BookingSummaryPage />} />

          {/* UC15: Đặt nhiều buổi định kỳ hoặc tự chọn (POST /api/booking-packages/preview & /api/booking-packages) */}
          <Route path="/booking/multi" element={<MultiSessionBookingPage />} />

          {/* UC18 và UC21: Chuyển khoản và gửi chứng từ cho booking, gói hoặc phụ thu */}
          <Route path="/booking/payment" element={<BookingPaymentPage key={location.search} />} />

          {/* UC17 và F5: Lịch sử, trạng thái đổi lịch và hủy booking của Player */}
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/my-bookings/:bookingId/reschedules" element={<RescheduleHistoryPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
