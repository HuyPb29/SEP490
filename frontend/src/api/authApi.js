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
    full_name: 'Trần Văn Chưa Xác Thực',
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
    full_name: 'Lê Bị Khóa',
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
      const error = new Error('Thông tin đăng nhập không đúng.');
      error.status = 401;
      error.code = 'MSG10';
      throw error;
    }

    // MSG11: Tài khoản bị khóa hoặc vô hiệu hóa (HTTP 403)
    if (user.status === 'locked' || user.status === 'disabled') {
      const error = new Error('Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.');
      error.status = 403;
      error.code = 'MSG11';
      throw error;
    }

    // MSG95: Tài khoản chưa xác thực OTP (HTTP 403)
    if (user.status === 'unverified') {
      ensureOtpSession(user.email);
      const error = new Error(
        'Tài khoản chưa được xác minh. Vui lòng mở email đã đăng ký để nhập mã OTP.'
      );
      error.status = 403;
      error.code = 'MSG95';
      error.email = user.email;
      throw error;
    }

    return {
      success: true,
      code: 200,
      message: 'Đăng nhập thành công',
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
      const err = new Error('Tên đăng nhập đã tồn tại trong hệ thống.');
      err.status = 400;
      throw err;
    }
    if (mockUsers.some((u) => u.email.toLowerCase() === normEmail)) {
      const err = new Error('Email này đã được đăng ký.');
      err.status = 400;
      throw err;
    }
    if (mockUsers.some((u) => u.phone_number === normPhone)) {
      const err = new Error('Số điện thoại này đã được sử dụng.');
      err.status = 400;
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
      message: `Mã xác minh đã được gửi tới ${normEmail}. Vui lòng nhập mã trong 10 phút.`,
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
      const err = new Error(
        'Mã xác minh đã hết hiệu lực hoặc nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.'
      );
      err.code = 'MSG96';
      throw err;
    }

    if (otp_code.trim() !== session.code) {
      session.failedAttempts += 1;
      const remaining = Math.max(0, 5 - session.failedAttempts);
      if (remaining === 0) {
        const err = new Error(
          'Bạn đã nhập sai quá 5 lần. Mã OTP hiện tại đã bị hủy, vui lòng bấm Gửi lại OTP.'
        );
        err.code = 'MSG96';
        throw err;
      }
      const err = new Error(`Mã xác minh không đúng. Bạn còn ${remaining} lần nhập.`);
      err.code = 'MSG95';
      throw err;
    }

    const user = mockUsers.find((u) => u.email.toLowerCase() === normEmail);
    if (user) {
      user.status = 'active';
    }

    return {
      success: true,
      code: 200,
      message: 'Xác minh email thành công. Bạn có thể đăng nhập.',
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
      const err = new Error(
        'Bạn đã gửi mã quá số lần cho phép (5 lần/giờ). Vui lòng thử lại sau 60 phút.'
      );
      err.code = 'MSG107';
      throw err;
    }

    session.resendCount += 1;
    session.failedAttempts = 0;
    session.code = '123456';
    session.expiresAt = Date.now() + 10 * 60 * 1000;

    return {
      success: true,
      code: 200,
      message: `Mã xác minh mới đã được gửi tới ${normEmail}. Vui lòng nhập mã trong 10 phút.`,
    };
  }

  const res = await axios.post('/api/v1/auth/resend-otp', { email, purpose });
  return res.data;
}