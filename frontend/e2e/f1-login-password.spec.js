import { expect, test } from '@playwright/test'

function fixtureToken(lifetime = 3600) {
  const claims = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url')
  return 'fixture.' + claims + '.fixture'
}

const roleCases = [
  { role: 'PLAYER', identity: 'player@example.test', destination: '/' },
  { role: 'STAFF', identity: 'staff_01', destination: '/staff/dashboard' },
  { role: 'OWNER', identity: 'owner@example.test', destination: '/owner/workspace' },
  { role: 'ADMIN', identity: 'admin_01', destination: '/admin/workspace' },
]

test('UC02 đăng nhập theo 4 vai trò, giữ returnTo hợp lệ và xử lý phiên hết hạn', async ({ page }) => {
  const identities = new Map(roleCases.map((item) => [item.identity, item.role]))
  await page.route('/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/login') {
      const { email, password } = request.postDataJSON()
      expect(password).toBe('Example123')
      expect(identities.has(email)).toBe(true)
      return route.fulfill({ json: { success: true, data: {
        token: fixtureToken(),
        user: { id: 1, username: email, fullName: 'Tài khoản kiểm thử', role: identities.get(email) },
      } } })
    }
    if (path === '/api/locations' || path === '/api/owner/locations') {
      return route.fulfill({ json: { success: true, data: [] } })
    }
    if (path === '/api/admin/accounts') return route.fulfill({ json: { success: true, data: { content: [], totalPages: 0 } } })
    if (path === '/api/users/me') return route.fulfill({ json: { success: true, data: { role: 'PLAYER', fullName: 'Tài khoản kiểm thử' } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unread: 0 } } })
    if (path === '/api/health') return route.fulfill({ json: { status: 'UP' } })
    return route.fulfill({ status: 404, json: { message: 'Không có dữ liệu kiểm thử cho màn đích.' } })
  })

  const signIn = async (identity) => {
    await page.getByLabel('Tên đăng nhập hoặc email').fill(identity)
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Example123')
    await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  }

  for (const item of roleCases) {
    await test.step(item.role, async () => {
      await page.goto('/login')
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await signIn(item.identity)
      await expect(page).toHaveURL((url) => url.pathname === item.destination)
      expect(await page.evaluate(() => Boolean(localStorage.getItem('bms_access_token')))).toBe(true)
    })
  }

  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto('/admin/workspace')
  await expect(page).toHaveURL(/\/login$/)
  await signIn(roleCases[0].identity)
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await page.goto('/admin/workspace')
  const denied = page.getByRole('dialog', { name: 'Thông báo' })
  await expect(denied).toContainText('Bạn không có quyền thực hiện thao tác này.')
  await denied.getByRole('button', { name: 'Đã hiểu' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await page.goto('/account')
  await page.evaluate((token) => {
    localStorage.setItem('bms_access_token', token)
    window.dispatchEvent(new Event('bms-auth-change'))
  }, fixtureToken(-60))
  await expect(page).toHaveURL(/\/login$/)
  const expiry = page.getByRole('dialog', { name: 'Phiên đăng nhập' })
  await expect(expiry).toContainText('Phiên đăng nhập đã hết hạn.')
  await expiry.getByRole('button', { name: 'Đã hiểu' }).click()
  await signIn(roleCases[0].identity)
  await expect(page).toHaveURL(/\/account$/)
})

test('UC02 quên mật khẩu theo thứ tự email, OTP và mật khẩu mới', async ({ page }) => {
  const email = 'player@example.test'
  let codeSent = false
  let codeResent = false
  let passwordChanged = false
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = route.request().postDataJSON()
    expect(body.email).toBe(email)
    if (path.endsWith('/forgot-password')) {
      expect(body).toEqual({ email })
      codeSent = true
      return route.fulfill({ json: { success: true } })
    }
    if (path.endsWith('/resend-otp')) {
      expect(body).toEqual({ email, purpose: 'RESET_PASSWORD' })
      codeResent = true
      return route.fulfill({ json: { success: true } })
    }
    expect(path).toBe('/api/auth/reset-password')
    expect(codeSent).toBe(true)
    expect(body.newPassword).toBe('NewExample123')
    if (body.otp === '000000') {
      return route.fulfill({ status: 400, json: { message: 'Mã xác minh đã hết hạn. Vui lòng gửi mã mới. (MSG96)' } })
    }
    expect(body.otp).toBe('123456')
    expect(codeResent).toBe(true)
    passwordChanged = true
    return route.fulfill({ json: { success: true } })
  })

  await page.goto('/login')
  await page.clock.install()
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click()
  await expect(page.getByLabel('Mã xác thực gồm 6 số')).toHaveCount(0)
  await page.getByLabel('Địa chỉ email').fill(email)
  await page.getByRole('button', { name: 'Gửi mã đặt lại mật khẩu' }).click()
  const notice = page.getByRole('dialog', { name: 'Mã xác minh' })
  await expect(notice).toContainText('Nếu email đã được đăng ký')
  await notice.getByRole('button', { name: 'Đã hiểu' }).click()
  await page.getByLabel('Mã xác thực gồm 6 số').fill('000000')
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('onlyletters')
  await page.getByLabel('Xác nhận mật khẩu mới').fill('NewExample123')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click()
  await expect(page.getByText('Mật khẩu mới không đúng định dạng.')).toBeVisible()
  await expect(page.getByText('Xác nhận mật khẩu mới không khớp.')).toBeVisible()

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewExample123')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click()
  await expect(page.getByText(/Mã xác minh đã hết hạn/)).toBeVisible()
  expect(passwordChanged).toBe(false)
  await page.clock.fastForward(61_000)
  await page.getByRole('button', { name: 'Gửi lại mã', exact: true }).click()
  await notice.getByRole('button', { name: 'Đã hiểu' }).click()
  await page.getByLabel('Mã xác thực gồm 6 số').fill('123456')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click()
  await expect(page.getByText('Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.')).toBeVisible()
  expect(passwordChanged).toBe(true)
})
