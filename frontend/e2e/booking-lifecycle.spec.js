import { expect, test } from '@playwright/test'

const player = { id: 41, username: 'e2e_player', fullName: 'Nguyễn Văn An', email: 'player@example.test', phone: '0912345678', role: 'PLAYER' }
const staff = { id: 52, username: 'e2e_staff', fullName: 'Trần Văn Bình', role: 'STAFF' }
const password = 'Example123'
const court = { id: 71, name: 'Sân 1' }
const venue = { id: 16, name: 'Sân Cầu Lông Kiểm Thử', address: '16 Đường Mẫu', latitude: 10.77, longitude: 106.69, openingHours: [] }
const price = 80_000
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const datePlus = (days) => dateFormat.format(new Date(Date.now() + days * 86_400_000))
const deadline = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString()
const envelope = (data) => ({ success: true, data })
const pageOf = (content) => ({ content, totalPages: content.length ? 1 : 0 })
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX6sAAAAASUVORK5CYII=', 'base64')
const fixtureFile = { name: 'chung-tu.png', mimeType: 'image/png', buffer: image }

function fixtureToken(role) {
  const claims = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return role + '.' + claims + '.fixture'
}

async function installFixture(context, state) {
  await context.route('/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const respond = (data, status = 200) => route.fulfill({ status, json: envelope(data) })
    const authorization = request.headers().authorization || ''
    const requireRole = (role) => expect(authorization).toContain('Bearer ' + role + '.')

    if (path === '/api/auth/register') {
      expect(request.postDataJSON()).toEqual({
        username: player.username, fullName: player.fullName, email: player.email, phone: player.phone, password,
      })
      state.registrationPending = true
      return respond({ email: player.email }, 201)
    }
    if (path === '/api/auth/verify-email') {
      expect(state.registrationPending).toBe(true)
      expect(request.postDataJSON()).toEqual({ email: player.email, otp: '123456' })
      state.verified = true
      return respond(null)
    }
    if (path === '/api/auth/login') {
      const { email, password: supplied } = request.postDataJSON()
      expect(supplied).toBe(password)
      const user = email === staff.username ? staff : player
      if (user === player) {
        expect(email).toBe(player.email)
        expect(state.verified).toBe(true)
      }
      return respond({ user, token: fixtureToken(user.role) })
    }

    if (path === '/api/locations') {
      expect([...url.searchParams.keys()].every((name) => name === 'q')).toBe(true)
      return respond([venue])
    }
    if (path === '/api/locations/16') return respond(venue)
    if (path === '/api/locations/16/courts') return respond([court])
    if (path === '/api/courts/71') return respond({ ...court, priceRules: [] })
    if (path === '/api/locations/16/reviews') return respond(pageOf([]))
    if (path === '/api/locations/16/review-summary') return respond({ averageRating: 0, reviewCount: 0 })
    if (path === '/api/locations/16/batch-offers') return respond([])
    if (path === '/api/locations/16/schedules') {
      const date = url.searchParams.get('date')
      const slots = ['18:00', '18:30', '19:00'].map((time, index) => ({
        time, startMinute: 1080 + index * 30, status: 'AVAILABLE', price,
      }))
      return respond({ date, maxDate: datePlus(7), courts: [{ courtId: court.id, name: court.name, slots }] })
    }

    if (path === '/api/me/loyalty-balances' || path === '/api/me/vouchers' || path === '/api/locations/16/vouchers') {
      requireRole('PLAYER')
      return respond(pageOf([]))
    }
    if (path === '/api/me/teams' || path === '/api/me/affected-bookings') return respond([])
    if (path === '/api/me/booking-packages') return respond(pageOf([]))
    if (path === '/api/me/bookings') {
      requireRole('PLAYER')
      return respond(pageOf([...state.bookings.values()]))
    }
    if (path === '/api/bookings/summary' || (path === '/api/bookings' && method === 'POST')) {
      requireRole('PLAYER')
      const body = request.postDataJSON()
      expect(body).toMatchObject({ courtId: court.id, date: datePlus(1), endMinute: body.startMinute + 30 })
      expect([1080, 1110]).toContain(body.startMinute)
      const startTime = body.startMinute === 1080 ? '18:00' : '18:30'
      const endTime = body.startMinute === 1080 ? '18:30' : '19:00'
      const quote = {
        locationId: venue.id, locationName: venue.name, courtId: court.id, courtName: court.name,
        date: body.date, startTime, endTime, bookerName: player.fullName, bookerPhone: player.phone,
        slots: [{ startMinute: body.startMinute, time: startTime, price }], listAmount: price,
        voucherDiscount: 0, pointDiscount: 0, finalAmount: price,
      }
      if (path.endsWith('/summary')) return respond(quote)
      const id = 100 + state.bookings.size
      const booking = {
        ...quote, id, bookingCode: 'BK-E2E-' + id, status: 'HOLDING', playDate: body.date,
        holdExpiresAt: deadline(10), createdAt: deadline(0), note: body.note,
      }
      state.bookings.set(id, booking)
      return respond(booking, 201)
    }

    const bookingMatch = path.match(/^\/api\/bookings\/(\d+)(?:\/(payment-instructions|payments))?$/)
    if (bookingMatch) {
      requireRole('PLAYER')
      const booking = state.bookings.get(Number(bookingMatch[1]))
      expect(booking).toBeDefined()
      if (bookingMatch[2] === 'payment-instructions') {
        return respond({
          bookingId: booking.id, bookingCode: booking.bookingCode, status: booking.status, amountDue: price,
          bankName: 'Ngân hàng Kiểm Thử', bankAccountNo: '000123', bankAccountHolder: 'SAN CAU LONG',
          qrImageUrl: null, holdExpiresAt: booking.holdExpiresAt,
        })
      }
      if (bookingMatch[2] === 'payments') {
        expect(method).toBe('POST')
        expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=')
        expect(request.postDataBuffer().toString()).toContain('name="proof"; filename="chung-tu.png"')
        expect(booking.status).toBe('HOLDING')
        const payment = {
          id: booking.id + 500, bookingId: booking.id, bookingCode: booking.bookingCode,
          amountDue: price, status: 'AWAITING_CONFIRMATION', resubmitsLeft: booking.id === 101 ? 1 : 3, submittedAt: deadline(0),
        }
        state.payments.set(payment.id, payment)
        Object.assign(booking, { status: payment.status, paymentId: payment.id })
        return respond(payment, 201)
      }
      return respond(booking)
    }

    if (path === '/api/staff/payments') {
      requireRole('STAFF')
      expect(url.searchParams.get('status')).toBe('AWAITING_CONFIRMATION')
      return respond(pageOf([...state.payments.values()].filter((payment) => payment.status === 'AWAITING_CONFIRMATION')))
    }

    const staffMatch = path.match(/^\/api\/staff\/payments\/(\d+)(?:\/(confirm|request-resubmission))?$/)
    if (staffMatch) {
      requireRole('STAFF')
      const payment = state.payments.get(Number(staffMatch[1]))
      expect(payment).toBeDefined()
      const booking = state.bookings.get(payment.bookingId)
      if (!staffMatch[2]) return respond({
        payment, customerName: player.fullName, customerPhone: player.phone,
        courtName: booking.courtName, playDate: booking.playDate, startTime: booking.startTime,
        endTime: booking.endTime, note: booking.note, proofs: [{ id: payment.id + 100 }],
      })
      expect(payment.status).toBe('AWAITING_CONFIRMATION')
      if (staffMatch[2] === 'confirm') {
        expect(request.postDataJSON()).toEqual({ receivedAmount: null })
        Object.assign(payment, { status: 'CONFIRMED', receiptNo: 'RC-E2E-' + payment.id, confirmedAt: deadline(0) })
        Object.assign(booking, { status: 'CONFIRMED', receiptNo: payment.receiptNo })
      } else {
        expect(request.postDataJSON()).toEqual({
          reason: 'Ảnh chứng từ bị mờ hoặc thiếu thông tin', playerAtFault: true, receivedAmount: null,
        })
        Object.assign(payment, {
          status: 'RESUBMIT_REQUESTED', resubmitsLeft: 0, resubmitDeadline: deadline(90),
          resubmitReason: 'Ảnh chứng từ bị mờ hoặc thiếu thông tin',
        })
        Object.assign(booking, {
          status: payment.status, resubmitDeadline: payment.resubmitDeadline, resubmitReason: payment.resubmitReason,
        })
      }
      return respond(payment)
    }

    const paymentMatch = path.match(/^\/api\/payments\/(\d+)(?:\/(resubmit|proofs\/\d+\/image))?$/)
    if (paymentMatch) {
      const payment = state.payments.get(Number(paymentMatch[1]))
      expect(payment).toBeDefined()
      if (paymentMatch[2]?.startsWith('proofs/')) {
        requireRole('STAFF')
        return route.fulfill({ contentType: 'image/png', body: image })
      }
      requireRole('PLAYER')
      if (paymentMatch[2] === 'resubmit') {
        expect(method).toBe('POST')
        expect(request.postDataBuffer().toString()).toContain('name="proof"; filename="chung-tu.png"')
        expect(payment.status).toBe('RESUBMIT_REQUESTED')
        expect(payment.resubmitsLeft).toBe(0)
        payment.status = 'AWAITING_CONFIRMATION'
        state.bookings.get(payment.bookingId).status = payment.status
        state.resubmittedPaymentId = payment.id
      }
      return respond(payment)
    }
    if (path === '/api/staff/dashboards/me') return respond({ locationId: venue.id, locationName: venue.name })
    if (path === '/api/staff/bookings' || path === '/api/notifications') return respond(pageOf([]))
    if (path.endsWith('/unread-count')) return respond({ unread: 0 })
    if (path === '/api/complaints/late-payment-eligibility') return respond(false)
    if (path === '/api/health') return route.fulfill({ json: { status: 'UP' } })
    return route.fulfill({ status: 404, json: { message: 'Fixture thiếu ' + method + ' ' + path } })
  })
}

const initialState = () => ({ bookings: new Map(), payments: new Map() })

async function signIn(page, identity) {
  await page.getByLabel('Tên đăng nhập hoặc email').fill(identity)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}

async function selectSlot(page, time) {
  await page.getByRole('button', { name: new RegExp(court.name + ', ' + time + ', Trống') }).click()
  await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click()
}

async function bookSlot(page, time, id) {
  await page.goto('/facilities/16')
  await page.getByRole('button', { name: 'Ngày sau' }).click()
  await expect(page.getByLabel('Chọn ngày chơi')).toHaveValue(datePlus(1))
  await selectSlot(page, time)
  await expect(page).toHaveURL(/\/booking\/summary$/)
  await page.getByRole('button', { name: /Xác nhận và thanh toán|Confirm Booking/ }).click()
  await expect(page).toHaveURL(new RegExp('/booking/payment\\?bookingId=' + id + '$'))
  await expect(page.getByText('BK-E2E-' + id, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/^0?\d:\d{2}$/).first()).toBeVisible()
  await expect(page.getByText('Ngân hàng Kiểm Thử')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Mã QR nhận thanh toán' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Tải mã QR' })).toHaveCount(0)
}

test('Guest tìm địa điểm, xem lịch và được yêu cầu đăng nhập khi đặt sân', async ({ page, context }) => {
  await installFixture(context, initialState())
  await page.goto('/')
  await page.getByRole('heading', { name: venue.name, exact: true }).click()
  await expect(page).toHaveURL(/\/facilities\/16$/)
  await expect(page.getByRole('heading', { name: 'Lịch sân' })).toBeVisible()
  await selectSlot(page, '18:00')
  const dialog = page.getByRole('dialog', { name: 'Đăng nhập để đặt sân' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Đăng nhập / Đăng ký' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Tên đăng nhập hoặc email')).toBeVisible()
})

test('F1 → F3 → F4: đăng ký, đặt sân, xác nhận và bổ sung chứng từ', async ({ browser, page, context }) => {
  test.setTimeout(60_000)
  const state = initialState()
  await installFixture(context, state)
  const staffContext = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  try {
    await installFixture(staffContext, state)
    const staffPage = await staffContext.newPage()

    await test.step('1. Đăng ký, xác thực OTP rồi đăng nhập', async () => {
      await page.goto('/login')
      await page.getByRole('button', { name: 'Đăng ký', exact: true }).click()
      await page.getByLabel('Tên đăng nhập', { exact: true }).fill(player.username)
      await page.getByLabel('Họ và tên').fill(player.fullName)
      await page.getByLabel('Email', { exact: true }).fill(player.email)
      await page.getByLabel('Số điện thoại').fill(player.phone)
      await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Đăng ký và nhận mã' }).click()
      await page.getByRole('dialog', { name: 'Mã xác minh' }).getByRole('button', { name: 'Đã hiểu' }).click()
      expect(state.verified).toBeUndefined()
      await page.getByLabel('Mã xác thực gồm 6 số').fill('123456')
      await page.getByRole('button', { name: 'Xác thực mã' }).click()
      await expect(page.getByText('Xác minh email thành công. Bạn có thể đăng nhập.')).toBeVisible()
      await signIn(page, player.email)
      await expect(page).toHaveURL((url) => url.pathname === '/')
    })

    await test.step('2. Đặt sân lẻ và thấy đồng hồ giữ chỗ', async () => {
      await bookSlot(page, '18:00', 100)
      const timer = page.getByText(/^0?\d:\d{2}$/).first()
      const initial = await timer.textContent()
      await expect(timer).not.toHaveText(initial)
    })

    await test.step('3. Player gửi ảnh, Staff xác nhận, Player thấy biên nhận', async () => {
      await page.getByRole('button', { name: 'Báo đã thanh toán' }).click()
      await expect(page.getByText(/MSG106/)).toBeVisible()
      await page.getByLabel('Ảnh chứng từ thanh toán').setInputFiles(fixtureFile)
      await page.getByLabel('Ảnh chứng từ thanh toán').setInputFiles({ name: 'loi.txt', mimeType: 'text/plain', buffer: Buffer.from('test') })
      await expect(page.getByText(/MSG02/)).toBeVisible()
      await expect(page.getByText(fixtureFile.name)).toHaveCount(0)
      await page.getByLabel('Ảnh chứng từ thanh toán').setInputFiles(fixtureFile)
      await page.getByRole('button', { name: 'Báo đã thanh toán' }).click()
      await expect(page.getByText(/MSG48/)).toBeVisible()
      await staffPage.goto('/login')
      await signIn(staffPage, staff.username)
      await expect(staffPage).toHaveURL(/\/staff\/dashboard$/)
      await staffPage.goto('/staff/confirm-payments?paymentId=600')
      await expect(staffPage.getByRole('img', { name: 'Chứng từ chuyển khoản' })).toBeVisible()
      await staffPage.getByRole('button', { name: 'Xác nhận đã nhận tiền' }).click()
      const dialog = staffPage.getByRole('dialog', { name: 'Xác nhận thao tác' })
      await expect(dialog).toContainText('MSG53')
      await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
      await expect(staffPage.getByRole('status')).toContainText('RC-E2E-600')
      expect(state.bookings.get(100).status).toBe('CONFIRMED')
      await page.bringToFront()
      await expect(page.getByRole('heading', { name: 'Biên nhận thanh toán' })).toBeVisible({ timeout: 12_000 })
      await expect(page.getByText('RC-E2E-600', { exact: true })).toBeVisible()
      await page.goto('/my-bookings')
      const row = page.locator('article').filter({ hasText: 'BK-E2E-100' })
      await expect(row).toContainText(/Đã xác nhận|Confirmed/)
      await row.getByRole('button', { name: 'Xem chi tiết' }).click()
      await expect(page.getByRole('dialog')).toContainText('RC-E2E-600')
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click()
    })

    await test.step('4. Staff yêu cầu bổ sung và Player gửi lại ở lượt cuối', async () => {
      await bookSlot(page, '18:30', 101)
      await page.getByLabel('Ảnh chứng từ thanh toán').setInputFiles(fixtureFile)
      await page.getByRole('button', { name: 'Báo đã thanh toán' }).click()
      await expect(page.getByText(/MSG48/)).toBeVisible()
      await staffPage.goto('/staff/confirm-payments?paymentId=601')
      await expect(staffPage.getByRole('img', { name: 'Chứng từ chuyển khoản' })).toBeVisible()
      await staffPage.getByLabel('Lý do (khi Yêu cầu gửi lại chứng từ hoặc Từ chối)').selectOption('IMAGE')
      await staffPage.getByRole('button', { name: 'Yêu cầu gửi lại chứng từ' }).click()
      await staffPage.getByRole('dialog', { name: 'Xác nhận thao tác' }).getByRole('button', { name: 'Xác nhận', exact: true }).click()
      await expect(staffPage.getByRole('status')).toContainText('MSG50')
      await page.bringToFront()
      await expect(page.getByText(/Yêu cầu bổ sung cuối đang mở/)).toBeVisible({ timeout: 12_000 })
      await page.goto('/my-bookings')
      const row = page.locator('article').filter({ hasText: 'BK-E2E-101' })
      await row.getByRole('button', { name: 'Gửi lại chứng từ' }).click()
      await expect(page).toHaveURL(/\/booking\/payment\?bookingId=101$/)
      await page.getByLabel('Ảnh chứng từ thanh toán').setInputFiles(fixtureFile)
      await page.getByRole('button', { name: 'Gửi lại chứng từ', exact: true }).click()
      await expect(page.getByText(/MSG48/)).toBeVisible()
      expect(state.resubmittedPaymentId).toBe(601)
      expect(state.bookings.get(101).status).toBe('AWAITING_CONFIRMATION')
    })
  } finally {
    await staffContext.close()
  }
})
