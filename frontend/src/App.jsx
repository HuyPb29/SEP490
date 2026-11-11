import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import api from './api'

import FacilitySearchPage from './pages/location/FacilitySearchPage'
import FacilityDetailPage from './pages/location/FacilityDetailPage'
import AuthPage from './pages/auth/AuthPage'
import BookingSummaryPage from './pages/booking/BookingSummaryPage'
import BookingPaymentPage from './pages/booking/BookingPaymentPage'
import MyBookingsPage from './pages/booking/MyBookingsPage'
import MultiSessionBookingPage from './pages/booking/MultiSessionBookingPage'
import OpenMatchesPage from './pages/matches/OpenMatchesPage'
import StaffDashboardPage from './pages/staff/StaffDashboardPage'
import StaffConfirmPaymentPage from './pages/staff/StaffConfirmPaymentPage'
import OwnerReportPage from './pages/owner/OwnerReportPage'
import OwnerCourtsPricingPage from './pages/owner/OwnerCourtsPricingPage'
import OwnerOpeningHoursPage from './pages/owner/OwnerOpeningHoursPage'
import OwnerFacilitySettingsPage from './pages/owner/OwnerFacilitySettingsPage'
import AdminFacilitiesPage from './pages/admin/AdminFacilitiesPage'
import MaintenanceRequestsPage from './pages/operation/MaintenanceRequestsPage'
import NotificationsPage from './pages/notification/NotificationsPage'
import NotificationBell from './components/notification/NotificationBell'
import WorkspaceNav from './components/navigation/WorkspaceNav'

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function AppContent() {
  const location = useLocation()
  // UC15 (đặt nhiều buổi) và UC19 (xác nhận thanh toán) đã nối backend thật
  const isFrontendMockPage =
    location.pathname === '/open-matches' ||
    location.pathname === '/staff/dashboard' ||
    location.pathname === '/owner/reports'
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

      <Routes>
        {/* UC11: Tìm kiếm địa điểm (GET /api/v1/facilities/search) */}
        <Route path="/" element={<FacilitySearchPage />} />

        {/* UC12-13: Thông tin & Lịch sân (GET /api/v1/facilities/:id & /court-schedule) */}
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        {/* UC15: Đặt nhiều buổi */}
        <Route path="/facilities/:id/package-booking" element={<MultiSessionBookingPage />} />
        {/* UC29-30: Open matches */}
        <Route path="/open-matches" element={<OpenMatchesPage />} />

        {/* UC34: Staff dashboard mock preview */}
        <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
        {/* UC19: Staff xác nhận thanh toán (GET/POST /api/staff/payments) */}
        <Route path="/staff/confirm-payments" element={<StaffConfirmPaymentPage />} />
        {/* UC35: Owner operational and revenue reports mock preview */}
        <Route path="/owner/reports" element={<OwnerReportPage />} />
        {/* UC07-09: Owner courts and pricing (GET /api/owner/locations, PATCH /api/owner/courts/:id) */}
        <Route path="/owner/courts-pricing" element={<OwnerCourtsPricingPage />} />
        {/* UC08: Giờ mở cửa, cấu hình slot, ngày ngoại lệ (GET/PUT /api/owner/locations/:id/opening-hours) */}
        <Route path="/owner/opening-hours" element={<OwnerOpeningHoursPage />} />
        {/* UC07: Hồ sơ địa điểm (PATCH /api/owner/locations/:id) */}
        <Route path="/owner/facility-settings" element={<OwnerFacilitySettingsPage />} />
        {/* UC06: Admin quản lý địa điểm (GET /api/admin/locations, POST /api/admin/service-registrations/:id/approve) */}
        <Route path="/admin/facilities" element={<AdminFacilitiesPage />} />

        {/* UC10: Bảo trì sân — Staff tạo/huỷ, Owner duyệt/từ chối (GET /api/staff|owner/maintenance-requests) */}
        <Route path="/maintenance" element={<MaintenanceRequestsPage />} />

        {/* UC37: Thông báo tự động (GET /api/notifications, PATCH /api/notifications/:id/read) */}
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* UC01-02: Đăng ký & Đăng nhập Player (POST /api/v1/auth/login & /register/player) */}
        <Route path="/login" element={<AuthPage />} />

        {/* UC14: Tóm tắt & Xác nhận đặt sân lẻ (POST /api/v1/vouchers/apply & POST /api/bookings) */}
        <Route path="/booking/summary" element={<BookingSummaryPage />} />

        {/* UC15: Đặt nhiều buổi định kỳ hoặc tự chọn (POST /api/booking-packages/preview & /api/booking-packages) */}
        <Route path="/booking/multi" element={<MultiSessionBookingPage />} />

        {/* UC18: Thanh toán chuyển khoản & Gửi chứng từ (POST /api/v1/bookings/:id/payment-proof) */}
        <Route path="/booking/payment" element={<BookingPaymentPage />} />

        {/* UC17: Lịch sử booking của Player (GET /api/v1/players/me/bookings & POST /api/v1/bookings/:id/cancel) */}
        <Route path="/my-bookings" element={<MyBookingsPage />} />
      </Routes>
    </>
  )
}