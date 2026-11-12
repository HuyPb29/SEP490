import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const player = { id: 41, username: 'player1', fullName: 'Nguyễn Văn An', email: 'player@bms.vn', role: 'PLAYER' };
const staff = { id: 52, username: 'staff1', fullName: 'Trần Văn Bình', role: 'STAFF', locationId: 16 };
const owner = { id: 63, username: 'owner1', fullName: 'Lê Văn Chủ', role: 'OWNER' };
const admin = { id: 74, username: 'admin1', fullName: 'Phạm Quản Trị', role: 'ADMIN' };

const venue = {
  id: 16,
  facility_id: 16,
  facility_name: 'Sân Cầu Lông Ngôi Sao',
  name: 'Sân Cầu Lông Ngôi Sao',
  address: '123 Đường Cầu Lông, Quận 1',
  district: 'Quận 1',
  city: 'TP. Hồ Chí Minh',
  contact_phone: '0901234567',
  open_hours: '06:00 – 23:00',
  courts_count: 6,
  rating: 4.8,
  review_count: 42,
  status: 'ACTIVE',
  available_slots: 12,
  latitude: 10.77,
  longitude: 106.69,
};

function envelope(data) {
  return { success: true, data };
}

async function setupMockApi(context) {
  await context.route('/api/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const respond = (data, status = 200) => route.fulfill({ status, json: envelope(data) });

    if (p === '/api/health') return respond({ status: 'UP' });
    if (p === '/api/notifications/unread-count') return respond({ unread: 2 });
    if (p === '/api/notifications') return respond({ content: [], totalPages: 0 });

    if (p === '/api/locations' || p === '/api/facilities') {
      return respond([venue]);
    }
    if (p === '/api/locations/16') return respond(venue);
    if (p === '/api/locations/16/courts') {
      return respond([
        { id: 1, name: 'Sân 1', active: true },
        { id: 2, name: 'Sân 2', active: true },
        { id: 3, name: 'Sân 3', active: true },
      ]);
    }
    if (p === '/api/locations/16/schedules') {
      const slots = ['08:00', '08:30', '09:00', '17:00', '17:30', '18:00', '18:30', '19:00'].map((time, idx) => ({
        time,
        startMinute: 480 + idx * 30,
        status: idx % 3 === 0 ? 'BOOKED' : 'AVAILABLE',
        price: 80000,
      }));
      return respond({
        date: '2026-11-15',
        maxDate: '2026-11-22',
        courts: [{ courtId: 1, name: 'Sân 1', slots }, { courtId: 2, name: 'Sân 2', slots }],
      });
    }
    if (p === '/api/locations/16/reviews') return respond({ content: [], totalPages: 0 });
    if (p === '/api/locations/16/review-summary') return respond({ averageRating: 4.8, reviewCount: 42 });
    if (p === '/api/locations/16/batch-offers') return respond([]);

    if (p === '/api/me/bookings') {
      return respond({
        content: [
          {
            id: 101,
            bookingCode: 'BK-2026-101',
            status: 'CONFIRMED',
            locationId: 16,
            locationName: 'Sân Cầu Lông Ngôi Sao',
            courtName: 'Sân 1',
            playDate: '2026-11-15',
            startTime: '18:00',
            endTime: '19:30',
            finalAmount: 240000,
          },
          {
            id: 102,
            bookingCode: 'BK-2026-102',
            status: 'HOLDING',
            locationId: 16,
            locationName: 'Sân Cầu Lông Ngôi Sao',
            courtName: 'Sân 2',
            playDate: '2026-11-16',
            startTime: '19:00',
            endTime: '20:00',
            finalAmount: 160000,
            holdExpiresAt: new Date(Date.now() + 600000).toISOString(),
          },
        ],
        totalPages: 1,
      });
    }

    if (p === '/api/bookings/102/payment-instructions') {
      return respond({
        bookingId: 102,
        bookingCode: 'BK-2026-102',
        status: 'HOLDING',
        amountDue: 160000,
        bankName: 'Vietcombank',
        bankAccountNo: '0123456789',
        bankAccountHolder: 'CONG TY SAN CAU LONG',
        qrImageUrl: null,
        holdExpiresAt: new Date(Date.now() + 600000).toISOString(),
      });
    }

    if (p === '/api/staff/dashboard') {
      return respond({
        locationId: 16,
        locationName: 'Sân Cầu Lông Ngôi Sao',
        date: '2026-11-12',
        courtCount: 3,
        paymentsAwaitingConfirmation: 2,
        complaintsToForward: 1,
        activeCourts: 3,
      });
    }

    if (p === '/api/staff/courts') {
      return respond([
        { id: 1, name: 'Sân 1', active: true },
        { id: 2, name: 'Sân 2', active: true },
        { id: 3, name: 'Sân 3', active: true },
      ]);
    }

    if (p === '/api/staff/bookings') {
      return respond({ content: [], totalPages: 0 });
    }

    if (p === '/api/staff/payments/pending') {
      return respond({
        content: [
          {
            id: 201,
            bookingCode: 'BK-2026-102',
            amountDue: 160000,
            status: 'AWAITING_CONFIRMATION',
            submittedAt: '2026-11-12T09:15:00',
            resubmitsLeft: 3,
          },
        ],
        totalPages: 1,
      });
    }

    if (p === '/api/owner/locations') {
      return respond([venue]);
    }
    if (p === '/api/owner/refunds') return respond([]);
    if (p === '/api/owner/vouchers') return respond({ content: [], totalPages: 0 });

    if (p === '/api/admin/locations') {
      return respond([venue]);
    }
    if (p === '/api/admin/service-registrations') {
      return respond([
          {
            id: 501,
            locationName: 'Sân Cầu Lông Bình Minh',
            courtCount: 4,
            address: '456 Đường Lê Lợi, TP. Thủ Đức',
            requesterName: 'Nguyễn Văn Minh',
            contactPhone: '0987654321',
            contactEmail: 'minh@example.com',
            createdAt: '2026-11-11T14:30:00',
          },
      ]);
    }

    return respond([]);
  });
}

async function setAuthSession(page, user) {
  await page.evaluate((u) => {
    localStorage.clear();
    sessionStorage.clear();
    if (u) {
      const tok = u.role + '.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.fixture';
      localStorage.setItem('token', tok);
      localStorage.setItem('bms_access_token', tok);
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('bms_user_info', JSON.stringify({
        user_id: u.id,
        username: u.username,
        full_name: u.fullName,
        email: u.email || '',
        phone: u.phone || '',
        role_code: u.role.toLowerCase(),
      }));
      sessionStorage.setItem('selected_facility_id', '16');
      localStorage.setItem('bms_selected_location_id', '16');
    }
  }, user);
}

const targets = [
  { name: '01_login', path: '/login', user: null },
  { name: '02_facility_list', path: '/', user: null },
  { name: '03_venue_schedule', path: '/facilities/16', user: null },
  { name: '04_my_bookings', path: '/my-bookings', user: player },
  { name: '05_booking_payment', path: '/booking/payment?bookingId=102', user: player },
  { name: '06_staff_dashboard', path: '/staff/dashboard', user: staff },
  { name: '07_owner_workspace', path: '/owner/workspace', user: owner },
  { name: '08_admin_facilities', path: '/admin/facilities', user: admin },
];

for (const target of targets) {
  test(`Capture ${target.name} (360px & 1280px)`, async ({ page, context }) => {
    await setupMockApi(context);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Desktop: 1280px
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    await setAuthSession(page, target.user);
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(outDir, `${target.name}_1280px.png`), fullPage: false });

    // Mobile: 360px
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(outDir, `${target.name}_360px.png`), fullPage: false });
    expect(pageErrors).toEqual([]);
  });
}
