import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import api from './api'

import FacilitySearchPage from './pages/location/FacilitySearchPage'
import FacilityDetailPage from './pages/location/FacilityDetailPage'
import AuthPage from './pages/auth/AuthPage'
import BookingSummaryPage from './pages/booking/BookingSummaryPage'
import BookingPaymentPage from './pages/booking/BookingPaymentPage'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('backend offline'))
  }, [])

  return (
    <BrowserRouter>
      {/* Backend Health Check Badge */}
      <div className="fixed bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded shadow-sm border border-slate-200 z-50 pointer-events-none">
        BE: {status}
      </div>

      <Routes>
        {/* UC11: Tìm kiếm địa điểm (GET /api/v1/facilities/search) */}
        <Route path="/" element={<FacilitySearchPage />} />

        {/* UC12-13: Thông tin & Lịch sân (GET /api/v1/facilities/:id & /court-schedule) */}
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />

        {/* UC01-02: Đăng ký & Đăng nhập Player (POST /api/v1/auth/login & /register/player) */}
        <Route path="/login" element={<AuthPage />} />

        {/* UC14: Tóm tắt & Xác nhận đặt sân (POST /api/v1/vouchers/apply & POST /api/v1/bookings) */}
        <Route path="/booking/summary" element={<BookingSummaryPage />} />

        {/* UC18: Thanh toán chuyển khoản & Gửi chứng từ (POST /api/v1/bookings/:id/payment-proof) */}
        <Route path="/booking/payment" element={<BookingPaymentPage />} />
      </Routes>
    </BrowserRouter>
  )
}