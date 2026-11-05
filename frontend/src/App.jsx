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

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function AppContent() {
  const location = useLocation()
  const isMultiSessionBooking =
    location.pathname === '/booking/multi' || location.pathname.endsWith('/package-booking')
  const isFrontendMockPage = isMultiSessionBooking || location.pathname === '/open-matches'
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
        <Route path="/" element={<FacilitySearchPage />} />

        {/* UC12-13: Thông tin & Lịch sân (GET /api/v1/facilities/:id & /court-schedule) */}
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        {/* UC15: Đặt nhiều buổi */}
        <Route path="/facilities/:id/package-booking" element={<MultiSessionBookingPage />} />
        {/* UC29-30: Open matches */}
        <Route path="/open-matches" element={<OpenMatchesPage />} />

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