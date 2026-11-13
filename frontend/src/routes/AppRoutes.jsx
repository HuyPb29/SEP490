import NavigationPage from '../pages/NavigationPage';
import WorkspaceLayout from '../components/layout/WorkspaceLayout';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccountPage, AdminWorkspace } from '../pages/account/AccountPages';
import AdminFacilitiesPage from '../pages/admin/AdminFacilitiesPage';
import AuthPage from '../pages/auth/AuthPage';
import BookingPaymentPage from '../pages/booking/BookingPaymentPage';
import BookingSummaryPage from '../pages/booking/BookingSummaryPage';
import MyBookingsPage from '../pages/booking/MyBookingsPage';
import RescheduleHistoryPage from '../pages/booking/RescheduleHistoryPage';
import FacilityDetailPage from '../pages/location/FacilityDetailPage';
import FacilitySearchPage from '../pages/location/FacilitySearchPage';
import OpenMatchesPage from '../pages/matches/OpenMatchesPage';
import NotificationsPage from '../pages/NotificationsPage';
import MaintenanceRequestsPage from '../pages/operation/MaintenanceRequestsPage';
import OwnerCourtsPricingPage from '../pages/owner/OwnerCourtsPricingPage';
import OwnerFacilitySettingsPage from '../pages/owner/OwnerFacilitySettingsPage';
import OwnerOpeningHoursPage from '../pages/owner/OwnerOpeningHoursPage';
import { AdminVouchers, PersonalRewardsPage } from '../pages/promotion/PromotionPages';
import StaffConfirmPaymentPage from '../pages/staff/StaffConfirmPaymentPage';
import StaffDashboardPage from '../pages/staff/StaffDashboardPage';
import StaffSchedulePage from '../pages/staff/StaffSchedulePage';
import { RequireAuth, RequireRole } from './RequireRole';

const PlayerComplaintsPage = lazy(() =>
  import('../pages/feedback/CourtComplaintsPage').then((module) => ({
    default: module.PlayerComplaintsPage,
  }))
);
const CourtComplaintsPage = lazy(() => import('../pages/feedback/CourtComplaintsPage'));
const TeamsPage = lazy(() => import('../pages/team/TeamsPage'));
const OwnerReconciliationPage = lazy(() => import('../pages/owner/OwnerReconciliationPage'));
const OwnerReportPage = lazy(() => import('../pages/owner/OwnerReportPage'));
const OwnerWorkspace = lazy(() => import('../pages/owner/OwnerWorkspace'));
const MultiSessionBookingPage = lazy(() => import('../pages/booking/MultiSessionBookingPage'));

function LegacyMultiBookingRedirect() {
  const location = useLocation();
  const savedFacilityId = sessionStorage.getItem('selected_facility_id') || '1';
  return (
    <Navigate
      to={`/facilities/${savedFacilityId}/package-booking${location.search}`}
      state={location.state}
      replace
    />
  );
}

export default function AppRoutes() {
  const { token, selectedLocationId } = useAuth();
  const location = useLocation();

  return (
    <Suspense fallback={<p role="status" className="p-6">Đang tải trang…</p>}>
      <Routes key={token ? 'signed-in' : 'guest'}>
        {/* UC11: Tìm kiếm địa điểm */}
        <Route path="/" element={<FacilitySearchPage />} />

        {/* UC12-13: Thông tin & Lịch sân */}
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />

        {/* UC15: Đặt nhiều buổi định kỳ hoặc tự chọn */}
        <Route
          path="/facilities/:id/package-booking"
          element={
            <RequireRole roles={['player']}>
              <MultiSessionBookingPage />
            </RequireRole>
          }
        />
        <Route path="/booking/multi" element={<LegacyMultiBookingRedirect />} />

        {/* UC29-30: Open matches */}
        <Route path="/open-matches" element={<OpenMatchesPage />} />

        {/* UC34: Bảng điều hành Staff */}
        <Route
          path="/staff/complaints"
          element={
            <RequireRole roles={['staff']}>
              <CourtComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/staff/dashboard"
          element={
            <RequireRole roles={['staff']}>
              <StaffDashboardPage />
            </RequireRole>
          }
        />
        {/* UC13: Lịch sân của Staff */}
        <Route
          path="/staff/schedule"
          element={
            <RequireRole roles={['staff']}>
              <StaffSchedulePage />
            </RequireRole>
          }
        />

        {/* UC19 và UC21: Xác nhận thanh toán và phụ thu */}
        <Route
          path="/staff/confirm-payments"
          element={
            <RequireRole roles={['staff', 'owner']} selectedVenue>
              <StaffConfirmPaymentPage />
            </RequireRole>
          }
        />

        <Route path="/owner/reconciliations" element={
          <RequireRole roles={['owner']} selectedVenue>
            <OwnerReconciliationPage locationId={selectedLocationId} />
          </RequireRole>
        } />

        {/* UC35: Báo cáo vận hành và doanh thu */}
        <Route
          path="/owner/reports"
          element={
            <RequireRole roles={['owner']} selectedVenue>
              <OwnerReportPage />
            </RequireRole>
          }
        />

        {/* UC07-09: Sân và bảng giá của Owner */}
        <Route
          path="/owner/courts-pricing"
          element={
            <RequireRole roles={['owner']} selectedVenue>
              <OwnerCourtsPricingPage />
            </RequireRole>
          }
        />

        {/* UC06: Admin quản lý địa điểm và đơn đăng ký dịch vụ */}
        <Route
          path="/admin/facilities"
          element={
            <RequireRole roles={['admin']}>
              <AdminFacilitiesPage />
            </RequireRole>
          }
        />

        {/* UC08: Giờ mở cửa, cấu hình slot, ngày ngoại lệ */}
        <Route
          path="/owner/opening-hours"
          element={
            <RequireRole roles={['owner']} selectedVenue>
              <OwnerOpeningHoursPage />
            </RequireRole>
          }
        />

        {/* UC07: Hồ sơ địa điểm */}
        <Route
          path="/owner/facility-settings"
          element={
            <RequireRole roles={['owner']} selectedVenue>
              <OwnerFacilitySettingsPage />
            </RequireRole>
          }
        />

        {/* UC10: Bảo trì sân: Staff tạo/hủy, Owner duyệt/từ chối */}
        <Route
          path="/maintenance"
          element={
            <RequireRole roles={['staff', 'owner']} selectedVenue>
              <MaintenanceRequestsPage />
            </RequireRole>
          }
        />

        {/* UC01-03: Đăng ký, xác minh OTP, đăng nhập và quên mật khẩu */}
        <Route path="/register" element={<Navigate to="/login?mode=register" state={location.state} replace />} />
        <Route path="/locations" element={<Navigate to="/" replace />} />
        <Route path="/matches" element={<Navigate to="/open-matches" replace />} />
        <Route path="/my-vouchers" element={<Navigate to="/my-rewards" replace />} />
        <Route path="/complaints" element={<Navigate to="/my-complaints" replace />} />
        <Route path="/change-password" element={<Navigate to="/account#change-password" replace />} />
        <Route path="/owner/courts" element={<Navigate to="/owner/courts-pricing" replace />} />
        <Route path="/admin/accounts" element={<Navigate to="/admin/workspace" replace />} />
        <Route path="/teams" element={<RequireRole roles={['player']}><TeamsPage /></RequireRole>} />
        <Route path="/my-reschedules" element={<RequireRole roles={['player']}><NavigationPage kind="reschedules" /></RequireRole>} />
        <Route path="/admin/vouchers" element={<RequireRole roles={['admin']}>
          <WorkspaceLayout title="Kiểm duyệt voucher" role="admin"><AdminVouchers /></WorkspaceLayout>
        </RequireRole>} />
        <Route path="/admin/reviews" element={<RequireRole roles={['admin']}><NavigationPage kind="reviews" /></RequireRole>} />
        <Route path="/login" element={<AuthPage />} />

        {/* UC04 & F1: Quản lý tài khoản theo vai trò */}
        <Route
          path="/account"
          element={
            <RequireRole roles={['player', 'owner']}>
              <AccountPage />
            </RequireRole>
          }
        />
        <Route
          path="/owner/workspace"
          element={
            <RequireRole roles={['owner']}>
              <OwnerWorkspace />
            </RequireRole>
          }
        />
        <Route
          path="/admin/workspace"
          element={
            <RequireRole roles={['admin']}>
              <AdminWorkspace>
                <AdminVouchers />
              </AdminWorkspace>
            </RequireRole>
          }
        />
        <Route
          path="/my-complaints"
          element={
            <RequireRole roles={['player']}>
              <PlayerComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/my-rewards"
          element={
            <RequireRole roles={['player']}>
              <PersonalRewardsPage />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />

        {/* UC14, BR64 và F6: Tóm tắt, voucher, điểm và xác nhận đặt sân */}
        <Route
          path="/booking/summary"
          element={
            <RequireRole roles={['player']}>
              <BookingSummaryPage />
            </RequireRole>
          }
        />

        {/* UC18 và UC21: Chuyển khoản và gửi chứng từ cho booking, gói hoặc phụ thu */}
        <Route
          path="/booking/payment"
          element={
            <RequireRole roles={['player']}>
              <BookingPaymentPage key={location.search} />
            </RequireRole>
          }
        />

        {/* UC17 và F5: Lịch sử, trạng thái đổi lịch và hủy booking của Player */}
        <Route
          path="/my-bookings"
          element={
            <RequireRole roles={['player']}>
              <MyBookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="/my-bookings/:bookingId/reschedules"
          element={
            <RequireRole roles={['player']}>
              <RescheduleHistoryPage />
            </RequireRole>
          }
        />
      </Routes>
    </Suspense>
  );
}
