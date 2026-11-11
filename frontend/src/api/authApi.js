import api from './index'
import { saveSession, clearSession } from './session'

const publicRequest = { skipAuth: true }

export async function loginApi({ username_or_email, password }) {
  const { data } = await api.post('/auth/login', { email: username_or_email.trim(), password }, publicRequest)
  saveSession(data.data)
  return data.data.user
}

export async function registerPlayerApi({ username, password, full_name, email, phone_number }) {
  const { data } = await api.post('/auth/register', {
    username: username.trim(),
    password,
    fullName: full_name.trim(),
    email: email.trim(),
    phone: phone_number.trim(),
  }, publicRequest)
  return data
}

export async function verifyOtpApi({ email, otp_code }) {
  const { data } = await api.post('/auth/verify-email', { email, otp: otp_code }, publicRequest)
  return data
}

export async function resendOtpApi({ email, purpose = 'REGISTER' }) {
  const { data } = await api.post('/auth/resend-otp', { email, purpose }, publicRequest)
  return data
}

export async function forgotPasswordApi(email) {
  const { data } = await api.post('/auth/forgot-password', { email }, publicRequest)
  return data
}

export async function resetPasswordApi({ email, otp, newPassword }) {
  const { data } = await api.post('/auth/reset-password', { email, otp, newPassword }, publicRequest)
  return data
}

export async function logoutApi() {
  try {
    await api.post('/auth/logout')
  } catch (error) {
    if (error.response?.status !== 401) throw error
  }
  clearSession()
}
