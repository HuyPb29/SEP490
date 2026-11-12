import { expect, test } from '@playwright/test'

test('UC01 đăng ký chỉ hoàn tất sau OTP đúng và gửi lại mã theo giới hạn', async ({ page }) => {
  let accountCreated = false
  let submitted = false
  let resent = false
  const email = 'player@example.test'
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON()
    if (path.endsWith('/register')) {
      expect(body).toEqual({ username: 'player_01', fullName: 'Nguyễn Văn An', email, phone: '0912345678', password: 'Example123' })
      submitted = true
      return route.fulfill({ status: 201, json: { success: true, data: { email } } })
    }
    if (path.endsWith('/resend-otp')) {
      expect(body).toEqual({ email, purpose: 'REGISTER' })
      if (resent) return route.fulfill({ status: 429, json: { message: 'Bạn đã gửi mã quá số lần cho phép. Vui lòng thử lại sau 12 phút. (MSG107)' } })
      resent = true
      return route.fulfill({ json: { success: true } })
    }
    expect(path).toBe('/api/auth/verify-email')
    expect(submitted).toBe(true)
    expect(body.email).toBe(email)
    if (body.otp !== '123456' || !resent) {
      return route.fulfill({ status: 400, json: { message: 'Mã xác minh không đúng. Bạn còn 4 lần nhập. (MSG95)' } })
    }
    accountCreated = true
    return route.fulfill({ json: { success: true, data: { token: 'unused-verification-token' } } })
  })

  await page.goto('/login')
  await page.clock.install()
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click()
  await page.getByRole('button', { name: 'Đăng ký và nhận mã' }).click()
  await expect(page.getByText('Vui lòng nhập tên đăng nhập.')).toBeVisible()
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('player_01')
  await page.getByLabel('Họ và tên').fill('Nguyễn Văn An')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Số điện thoại').fill('0912345678')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Example123')
  await page.getByRole('button', { name: 'Đăng ký và nhận mã' }).click()
  const notice = page.getByRole('dialog', { name: 'Mã xác minh' })
  await expect(notice).toContainText('Vui lòng nhập mã trong 10 phút.')
  await notice.getByRole('button', { name: 'Đã hiểu' }).click()
  await expect(page.getByLabel('Địa chỉ email')).toHaveValue(email)
  await expect(page.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
  expect(accountCreated).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('bms_access_token'))).toBeNull()

  await page.getByLabel('Mã xác thực gồm 6 số').fill('000001')
  await page.getByRole('button', { name: 'Xác thực mã' }).click()
  await expect(page.getByRole('alert')).toContainText('còn 4 lần nhập')
  expect(accountCreated).toBe(false)
  await page.clock.fastForward(61_000)
  await page.getByRole('button', { name: 'Gửi lại mã', exact: true }).click()
  await notice.getByRole('button', { name: 'Đã hiểu' }).click()
  await page.clock.fastForward(61_000)
  await page.getByRole('button', { name: 'Gửi lại mã', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('thử lại sau 12 phút')
  await page.getByLabel('Mã xác thực gồm 6 số').fill('123456')
  await page.getByRole('button', { name: 'Xác thực mã' }).click()
  await expect(page.getByText('Xác minh email thành công. Bạn có thể đăng nhập.')).toBeVisible()
  expect(accountCreated).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem('bms_access_token'))).toBeNull()
})
