import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit test FE (vitest + jsdom). File riêng, không dùng vite.config.js để không kéo plugin Tailwind vào lúc test.
// Chạy: npm test (một lần), npm run test:watch (tự chạy lại khi sửa), npm run test:coverage (đo độ phủ F3/F4).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    // Ngày giờ trên màn hình tính theo giờ Việt Nam như máy chạy thật.
    env: { TZ: 'Asia/Ho_Chi_Minh' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Phần F3 (tìm và đặt sân) và F4 (thanh toán) có unit test.
      include: [
        'src/utils/slotRanges.js',
        'src/utils/packageDraft.js',
        'src/utils/checkoutPoints.js',
        'src/utils/distance.js',
        'src/utils/formatters.js',
        'src/utils/venueSchedule.js',
        'src/api/index.js',
        'src/api/bookingApi.js',
        'src/api/bookingHistory.js',
        'src/api/bookingPaymentApi.js',
        'src/api/facilityApi.js',
        'src/hooks/useFacilitySearch.js',
        'src/hooks/usePackagePreview.js',
        'src/hooks/usePublicVenue.js',
        'src/hooks/useVenueSchedule.js',
        'src/hooks/useResource.js',
        'src/components/schedule/ScheduleGrid.jsx',
        'src/components/schedule/SelectedRanges.jsx',
        'src/components/booking/BookingSummaryBar.jsx',
        'src/pages/staff/WalkInBookingDialog.jsx',
        'src/pages/staff/ReconciliationDialog.jsx',
      ],
    },
  },
})
