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
];

// BR (OTP): Giới hạn 5 lần sai & tối đa 5 lần gửi/giờ
const mockOtpState = {};

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

// UC02: Đăng nhập (POST /api/v1/auth/login)
export async function loginApi({ username_or_email, password }) {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 300));
    const input = username_or_email.trim().toLowerCase();

    const user = mockUsers.find(
      (u) => u.username.toLowerCase() === input || u.email.toLowerCase() === input
    );

    // MSG10: Sai tên đăng nhập, email hoặc mật khẩu (HTTP 401)
    if (!user || user.password !== password) {
      const msg = 'Invalid login credentials.';
      const err = new Error(msg);
      err.response = { data: { message: msg, code: 'MSG10' } };
      throw err;
    }

    // MSG11: Tài khoản bị khóa hoặc vô hiệu hóa (HTTP 403)
    if (user.status === 'locked' || user.status === 'disabled') {
      const msg = 'Your account has been locked. Please contact the administrator.';
      const err = new Error(msg);
      err.response = { data: { message: msg, code: 'MSG11' } };
      throw err;
    }

    // MSG95: Tài khoản chưa xác thực OTP (HTTP 403)
    if (user.status === 'unverified') {
      ensureOtpSession(user.email);
      const msg = 'Account is unverified. Please check your registered email for the OTP.';
      const err = new Error(msg);
      // Gắn thêm email vào lỗi để UI đẩy sang màn OTP
      err.email = user.email; 
      err.response = { data: { message: msg, code: 'MSG95' } };
      throw err;
    }

    return {
      success: true,
      code: 200,
      message: 'Login successful.',
      data: {
        token_type: 'Bearer',
        access_token: 'mock_jwt_access_token_' + user.user_id,
        expires_in: 86400,
        refresh_token: 'mock_jwt_refresh_token_' + user.user_id,
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

  const res = await axios.post('/api/v1/auth/login', { username_or_email, password });
  return res.data;
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

// Xác thực OTP (POST /api/v1/auth/verify-otp)
export async function verifyOtpApi({ email, otp_code, purpose = 'register' }) {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 300));
    const normEmail = email.trim().toLowerCase();
    const session = ensureOtpSession(normEmail);

    if (Date.now() > session.expiresAt || session.failedAttempts >= 5) {
      const msg = 'The verification code has expired or was entered incorrectly 5 times. Please request a new code.';
      const err = new Error(msg);
      err.response = { data: { message: msg, code: 'MSG96' } };
      throw err;
    }

    if (otp_code.trim() !== session.code) {
      session.failedAttempts += 1;
      const remaining = Math.max(0, 5 - session.failedAttempts);
      if (remaining === 0) {
        const msg = 'You have entered incorrectly 5 times. The current OTP is invalid, please click Resend OTP.';
        const err = new Error(msg);
        err.response = { data: { message: msg, code: 'MSG96' } };
        throw err;
      }
      const msg = `Incorrect verification code. You have ${remaining} attempts left.`;
      const err = new Error(msg);
      err.response = { data: { message: msg, code: 'MSG95' } };
      throw err;
    }

    const user = mockUsers.find((u) => u.email.toLowerCase() === normEmail);
    if (user) {
      user.status = 'active';
    }

    return {
      success: true,
      code: 200,
      message: 'Email verified successfully. You can now log in.',
    };
  }

  const res = await axios.post('/api/v1/auth/verify-otp', { email, otp_code, purpose });
  return res.data;
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