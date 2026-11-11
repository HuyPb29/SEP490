import axios from 'axios';

// Toggle kết nối Backend thật/giả lập
export const USE_MOCK_AUTH = true;

// In-memory DB giả lập
const mockUsers = [
  {
    user_id: 10,
    username: 'player01',
    password: 'Password123',
    full_name: 'Minh Anh',
    email: 'minhanh@gmail.com',
    phone_number: '0912345678',
    role_id: 1,
    role_code: 'player',
    facility_id: null,
    status: 'active',
  },
  {
    user_id: 11,
    username: 'unverified01',
    password: 'Password123',
    full_name: 'Tran Van Chua Xac Thuc',
    email: 'unverified@gmail.com',
    phone_number: '0988776655',
    role_id: 1,
    role_code: 'player',
    facility_id: null,
    status: 'unverified',
  },
  {
    user_id: 12,
    username: 'locked01',
    password: 'Password123',
    full_name: 'Le Bi Khoa',
    email: 'locked@gmail.com',
    phone_number: '0977665544',
    role_id: 1,
    role_code: 'player',
    facility_id: null,
    status: 'locked',
  },
  {
    user_id: 13,
    username: 'owner01',
    password: 'Password123',
    full_name: 'Location Owner',
    email: 'owner@example.com',
    phone_number: '0912000001',
    role_id: 2,
    role_code: 'owner',
    facility_id: 1,
    status: 'active',
  },
  {
    user_id: 14,
    username: 'staff01',
    password: 'Password123',
    full_name: 'Location Staff',
    email: 'staff@example.com',
    phone_number: '0912000002',
    role_id: 3,
    role_code: 'staff',
    facility_id: 1,
    status: 'active',
  },
];

const mockPasswordOverrides = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('bms_mock_password_overrides') || '{}');
  } catch {
    return {};
  }
})();
mockUsers.forEach((user) => {
  if (mockPasswordOverrides[user.user_id]) user.password = mockPasswordOverrides[user.user_id];
});

function saveMockPassword(user, password) {
  user.password = password;
  mockPasswordOverrides[user.user_id] = password;
  try {
    sessionStorage.setItem('bms_mock_password_overrides', JSON.stringify(mockPasswordOverrides));
  } catch {
    // Keep the in-memory update when browser storage is unavailable.
  }
}

// BR (OTP): Giới hạn 5 lần sai & tối đa 5 lần gửi/giờ
const mockOtpState = {};
const mockPasswordResetTokens = {};
const STAFF_RESET_MESSAGE = 'Staff accounts cannot reset passwords here. Please contact your Location Owner to issue a new password.';

function normalizeIdentity(value = '') {
  return value.trim().toLowerCase();
}

function findMockUser(identity) {
  const normalized = normalizeIdentity(identity);
  return mockUsers.find((user) => (
    user.username.toLowerCase() === normalized || user.email.toLowerCase() === normalized
  ));
}

function isOfflineError(error) {
  return !error.response || error.response.status >= 500;
}

async function withOfflineFallback(request, mockRequest) {
  if (USE_MOCK_AUTH) return mockRequest();
  try {
    return await request();
  } catch (error) {
    if (isOfflineError(error)) return mockRequest();
    throw error;
  }
}

function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.response = { data: { code, message } };
  return error;
}

function ensureOtpSession(email) {
  const key = email.toLowerCase();
  if (!mockOtpState[key]) {
    mockOtpState[key] = {
      code: '123456',
      failedAttempts: 0,
      resendCount: 1,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 phút
    };
  }
  return mockOtpState[key];
}

async function mockLogin({ identity, password }) {
  await new Promise((r) => setTimeout(r, 300));
  const user = findMockUser(identity);
  if (!user || user.password !== password) throw createAuthError('MSG10', 'Invalid login credentials.');
  if (user.status === 'locked' || user.status === 'disabled') {
    throw createAuthError('MSG11', 'Your account has been locked. Please contact the administrator.');
  }
  if (user.status === 'unverified') {
    ensureOtpSession(user.email);
    const error = createAuthError('MSG95', 'Account is unverified. Please check your registered email for the OTP.');
    error.email = user.email;
    throw error;
  }

  return {
    success: true,
    code: 200,
    message: 'Login successful.',
    data: {
      token_type: 'Bearer',
      access_token: `mock_jwt_access_token_${user.user_id}`,
      expires_in: 86400,
      refresh_token: `mock_jwt_refresh_token_${user.user_id}`,
      user_info: {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role_id: user.role_id,
        role_code: user.role_code,
        facility_id: user.facility_id,
      },
    },
  };
}

// UC02: Login identity accepts either username or email.
export async function loginApi({ username_or_email, username, email, password }) {
  const identity = username_or_email || username || email || '';
  return withOfflineFallback(async () => {
    const res = await axios.post('/api/auth/login', { email: identity, password });
    const { data: loginData, ...response } = res.data;
    const accessToken = loginData.token;
    const user = loginData.user;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    return {
      ...response,
      data: {
        access_token: accessToken,
        user_info: {
          user_id: user.id,
          username: user.username,
          full_name: user.fullName,
          email: user.email,
          phone_number: user.phone,
          role_code: user.role?.toLowerCase(),
          facility_id: user.locationId,
        },
      },
    };
  }, () => mockLogin({ identity, password }));
}

// UC01: Đăng ký Player (POST /api/v1/auth/register/player)
export async function registerPlayerApi({ username, password, full_name, email, phone_number }) {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 350));
    const normUser = username.trim().toLowerCase();
    const normEmail = email.trim().toLowerCase();
    const normPhone = phone_number.trim();

    if (mockUsers.some((u) => u.username.toLowerCase() === normUser)) {
      const msg = 'This username already exists in the system.';
      const err = new Error(msg);
      err.response = { data: { message: msg } };
      throw err;
    }
    if (mockUsers.some((u) => u.email.toLowerCase() === normEmail)) {
      const msg = 'This email is already registered.';
      const err = new Error(msg);
      err.response = { data: { message: msg } };
      throw err;
    }
    if (mockUsers.some((u) => u.phone_number === normPhone)) {
      const msg = 'This phone number is already in use.';
      const err = new Error(msg);
      err.response = { data: { message: msg } };
      throw err;
    }

    const newUser = {
      user_id: mockUsers.length + 10,
      username: normUser,
      password,
      full_name: full_name.trim(),
      email: normEmail,
      phone_number: normPhone,
      role_id: 1,
      role_code: 'player',
      facility_id: null,
      status: 'unverified',
    };
    mockUsers.push(newUser);
    ensureOtpSession(normEmail);

    return {
      success: true,
      code: 201,
      message: `A verification code has been sent to ${normEmail}. Please enter it within 10 minutes.`,
      data: {
        email: normEmail,
        status: 'unverified',
      },
    };
  }

  const res = await axios.post('/api/v1/auth/register/player', {
    username,
    password,
    full_name,
    email,
    phone_number,
  });
  return res.data;
}

async function mockVerifyOtp({ email, username_or_email, otp_code, purpose = 'register' }) {
  await new Promise((r) => setTimeout(r, 300));
  const identity = username_or_email || email || '';
  const user = findMockUser(identity);
  const emailAddress = user?.email.toLowerCase() || normalizeIdentity(identity);
  const session = ensureOtpSession(emailAddress);

  if (!/^\d{6}$/.test(String(otp_code || '').trim())) {
    throw createAuthError('MSG95', 'The verification code must be exactly 6 digits.');
  }
  if (Date.now() >= session.expiresAt || session.failedAttempts >= 5) {
    throw createAuthError('MSG96', 'The verification code has expired or was entered incorrectly 5 times. Please request a new code.');
  }
  if (String(otp_code).trim() !== session.code) {
    session.failedAttempts += 1;
    const remaining = Math.max(0, 5 - session.failedAttempts);
    if (remaining === 0) {
      throw createAuthError('MSG96', 'You have entered incorrectly 5 times. The current OTP is invalid, please request a new code.');
    }
    throw createAuthError('MSG95', `Incorrect verification code. You have ${remaining} attempts left.`);
  }

  if (purpose === 'password_reset') {
    if (!user || user.role_code.toLowerCase() === 'staff') throw createAuthError('MSG_OTP_INVALID', 'The password reset session is invalid.');
    const resetToken = `mock-reset-${user.user_id}-${Date.now()}`;
    mockPasswordResetTokens[resetToken] = user.email.toLowerCase();
    return {
      success: true,
      code: 200,
      message: 'Code verified. Set a new password.',
      data: { reset_token: resetToken },
    };
  }

  if (user) user.status = 'active';
  return { success: true, code: 200, message: 'Email verified successfully. You can now log in.' };
}

export async function verifyOtpApi({ email, username_or_email, otp_code, purpose = 'register' }) {
  const identity = username_or_email || email || '';
  return withOfflineFallback(async () => {
    const endpoint = purpose === 'password_reset'
      ? '/api/auth/password/verify-otp'
      : '/api/v1/auth/verify-otp';
    return (await axios.post(endpoint, { email: identity, username_or_email: identity, otp_code, purpose })).data;
  }, () => mockVerifyOtp({ email: identity, username_or_email: identity, otp_code, purpose }));
}

// Gửi lại OTP (POST /api/v1/auth/resend-otp)
export async function resendOtpApi({ email, purpose = 'register' }) {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 250));
    const normEmail = email.trim().toLowerCase();
    const session = ensureOtpSession(normEmail);

    if (session.resendCount >= 5) {
      const msg = 'You have requested the code too many times (5 times/hour). Please try again after 60 minutes.';
      const err = new Error(msg);
      err.response = { data: { message: msg, code: 'MSG107' } };
      throw err;
    }

    session.resendCount += 1;
    session.failedAttempts = 0;
    session.code = '123456';
    session.expiresAt = Date.now() + 10 * 60 * 1000;

    return {
      success: true,
      code: 200,
      message: `A new verification code has been sent to ${normEmail}. Please enter it within 10 minutes.`,
    };
  }

  const res = await axios.post('/api/v1/auth/resend-otp', { email, purpose });
  return res.data;
}

function validatePassword(password) {
  return password.length >= 8 && password.length <= 32 &&
    /[A-Za-z]/.test(password) && /\d/.test(password) && !/\s/.test(password);
}

function getStoredUserInfo() {
  try {
    return JSON.parse(localStorage.getItem('bms_user_info') || '{}');
  } catch {
    return {};
  }
}

async function mockRequestOtp(identity) {
  await new Promise((r) => setTimeout(r, 250));
  const normalized = normalizeIdentity(identity);
  const user = findMockUser(normalized);
  if (normalized.includes('staff') || user?.role_code?.toLowerCase() === 'staff') {
    throw createAuthError('MSG_STAFF_RESET_BLOCKED', STAFF_RESET_MESSAGE);
  }
  if (!user) throw createAuthError('MSG_USER_NOT_FOUND', 'No account was found for that username or email.');

  const session = ensureOtpSession(user.email);
  session.code = '123456';
  session.failedAttempts = 0;
  session.expiresAt = Date.now() + 10 * 60 * 1000;
  return {
    success: true,
    code: 200,
    message: 'A 6-digit password reset code has been sent.',
    data: {
      username_or_email: normalized,
      otp_expires_at: new Date(session.expiresAt).toISOString(),
    },
  };
}

export async function requestOtpApi({ username_or_email, username, email }) {
  const identity = username_or_email || username || email || '';
  return withOfflineFallback(
    async () => (await axios.post('/api/auth/password/request-otp', { username_or_email: identity })).data,
    () => mockRequestOtp(identity)
  );
}

export async function resetPasswordApi({ username_or_email, reset_token, new_password }) {
  return withOfflineFallback(async () => (
    await axios.post('/api/auth/password/reset', {
      username_or_email,
      reset_token,
      new_password,
    })
  ).data, async () => {
    await new Promise((r) => setTimeout(r, 250));
    if (!validatePassword(new_password)) {
      throw createAuthError('MSG_PASSWORD_POLICY', 'Password must be 8-32 characters, include at least one letter and one number, and contain no spaces.');
    }
    const emailAddress = mockPasswordResetTokens[reset_token];
    const user = emailAddress && mockUsers.find((item) => item.email.toLowerCase() === emailAddress);
    if (!user || user.email.toLowerCase() !== findMockUser(username_or_email)?.email.toLowerCase()) {
      throw createAuthError('MSG_OTP_INVALID', 'The password reset session is invalid. Request a new code.');
    }
    saveMockPassword(user, new_password);
    delete mockPasswordResetTokens[reset_token];
    return { success: true, code: 200, message: 'Password reset successfully.' };
  });
}

export async function changePasswordApi({ currentPassword, newPassword }) {
  return withOfflineFallback(async () => (
    await axios.post('/api/auth/password/change', { currentPassword, newPassword }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('bms_access_token') || ''}` },
    })
  ).data, async () => {
    await new Promise((r) => setTimeout(r, 250));
    const userInfo = getStoredUserInfo();
    const role = String(userInfo.role_code || userInfo.role || '').toLowerCase();
    if (role === 'staff') throw createAuthError('MSG_STAFF_PASSWORD_BLOCKED', STAFF_RESET_MESSAGE);
    const user = findMockUser(userInfo.username || userInfo.email || '');
    if (!user || user.password !== currentPassword) {
      throw createAuthError('MSG113', 'MSG113: Incorrect current password. Please try again.');
    }
    if (!validatePassword(newPassword)) {
      throw createAuthError('MSG_PASSWORD_POLICY', 'Password must be 8-32 characters, include at least one letter and one number, and contain no spaces.');
    }
    saveMockPassword(user, newPassword);
    return {
      success: true,
      code: 200,
      message: 'MSG114: Password changed successfully.',
    };
  });
}