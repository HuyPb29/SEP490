import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  loginApi,
  registerPlayerApi,
  verifyOtpApi,
  resendOtpApi,
} from '../../api/authApi';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const navigate = useNavigate();

  // 'login' | 'register' | 'otp'
  const [activeTab, setActiveTab] = useState('login');

  // UC02: Login State
  const [loginIdentity, setLoginIdentity] = useState('minhanh@gmail.com');
  const [loginPassword, setLoginPassword] = useState('••••••••••');
  const [loginError, setLoginError] = useState(
    'Invalid username or password. Please try again.'
  );
  const [loginLoading, setLoginLoading] = useState(false);

  // UC01: Register State
  const [regForm, setRegForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
  });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // OTP State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // DR25 (Rate limiting): Đếm ngược 60s cho nút Gửi lại OTP
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Validation form đăng ký theo SRS v18 (DR01, DR17, DR22, DR23, DR24)
  const validateRegisterForm = () => {
    const { username, full_name, email, phone_number, password } = regForm;

    // DR22: 4-20 ký tự, bắt đầu bằng chữ thường a-z, chỉ chứa a-z, 0-9, ., _
    const usernameRegex = /^[a-z][a-z0-9._]{3,19}$/;
    if (!usernameRegex.test(username.trim())) {
      return 'Username (DR22): 4-20 characters, starts with a-z, contains only a-z, 0-9, dot (.), or underscore (_).';
    }

    // DR24: Họ tên 2-50 ký tự, chỉ chứa chữ cái có dấu và khoảng trắng
    const nameRegex = /^[\p{L}\s]{2,50}$/u;
    if (!nameRegex.test(full_name.trim())) {
      return 'Full name (DR24): 2-50 characters, letters and spaces only.';
    }

    // DR17: Email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Email (DR17): Invalid email format.';
    }

    // DR01: Số điện thoại đúng 10 chữ số, bắt đầu bằng số 0
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone_number.trim())) {
      return 'Phone number (DR01): Must be exactly 10 digits and start with 0.';
    }

    // DR23: Mật khẩu 8-32 ký tự, ít nhất 1 chữ cái, 1 chữ số, không khoảng trắng
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpace = /\s/.test(password);
    if (password.length < 8 || password.length > 32 || !hasLetter || !hasNumber || hasSpace) {
      return 'Password (DR23): 8-32 characters, at least 1 letter, 1 number, and no spaces.';
    }

    return null;
  };

  // UC02: Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginIdentity.trim() || !loginPassword) {
      setLoginError('Please enter both username/email and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await loginApi({
        username_or_email: loginIdentity,
        password: loginPassword,
      });

      if (res?.success) {
        localStorage.setItem('bms_access_token', res.data.access_token);
        localStorage.setItem('bms_refresh_token', res.data.refresh_token);
        localStorage.setItem('bms_user_info', JSON.stringify(res.data.user_info));
        navigate('/');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid credentials.';
      const code = err.response?.data?.code || err.code;

      // MSG95: Tài khoản chưa xác thực OTP -> Điều hướng sang tab OTP
      if (code === 'MSG95') {
        setOtpEmail(err.email || loginIdentity);
        setOtpMessage(msg);
        setOtpError('');
        setCooldown(60);
        setActiveTab('otp');
      } else {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // UC01: Handle Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');

    const validationErr = validateRegisterForm();
    if (validationErr) {
      setRegError(validationErr);
      return;
    }

    setRegLoading(true);
    try {
      const res = await registerPlayerApi(regForm);
      if (res?.success) {
        setOtpEmail(regForm.email.trim());
        setOtpMessage(
          res.message ||
            `Verification code sent to ${regForm.email.trim()}. Please enter it within 10 minutes.`
        );
        setOtpError('');
        setOtpCode('');
        setCooldown(60);
        setActiveTab('otp');
      }
    } catch (err) {
      setRegError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');
    setOtpMessage('');

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('OTP must be exactly 6 digits.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await verifyOtpApi({
        email: otpEmail,
        otp_code: otpCode.trim(),
        purpose: 'register',
      });

      if (res?.success) {
        // MSG94: Xác minh thành công -> Quay về tab Login
        setLoginIdentity(otpEmail);
        setLoginPassword('');
        setLoginError('');
        alert(res.message || 'Email verified successfully. You can now login.');
        setActiveTab('login');
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message || 'Invalid verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || !otpEmail.trim()) return;
    setOtpError('');
    try {
      const res = await resendOtpApi({ email: otpEmail.trim(), purpose: 'register' });
      setOtpMessage(res.message);
      setCooldown(60);
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className={styles.splitLayout}>
      <aside className={styles.leftPanel}>
        <div className={styles.brandHeader} onClick={() => navigate('/')}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>BMS</span>
        </div>

        <div className={styles.heroCopy}>
          <h1 className={styles.heroHeading}>
            Booking courts
            <br />
            made easy
          </h1>
          <p className={styles.heroDescription}>
            One account to book courts, join matches, use vouchers, and earn points everywhere.
          </p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.authCard}>
          <div className={styles.tabGroup}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'login' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'register' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'otp' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('otp')}
            >
              Verify OTP
            </button>
          </div>

          {activeTab === 'login' && (
            <form className={styles.formContainer} onSubmit={handleLoginSubmit}>
              <h2 className={styles.cardTitle}>Welcome back</h2>

              <div className={styles.formGroup}>
                <label className={styles.label}>Username or email</label>
                <input
                  type="text"
                  className={styles.input}
                  value={loginIdentity}
                  onChange={(e) => {
                    setLoginIdentity(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter username or email..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={`${styles.input} ${loginError ? styles.inputError : ''}`}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter password..."
                />
                {loginError && <p className={styles.errorText}>{loginError}</p>}
              </div>

              <div className={styles.forgotRow}>
                <a href="#forgot-password" className={styles.greenLink}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" className={styles.primaryBtn} disabled={loginLoading}>
                {loginLoading ? 'Processing...' : 'Login'}
              </button>

              <p className={styles.cardFooterText}>
                Are you a facility owner?{' '}
                <Link to="/owner/register" className={styles.greenLinkBold}>
                  Register your facility
                </Link>
              </p>
            </form>
          )}

          {activeTab === 'register' && (
            <form className={styles.formContainer} onSubmit={handleRegisterSubmit}>
              <h2 className={styles.cardTitle}>Create new account</h2>

              <div className={styles.formGroup}>
                <label className={styles.label}>Username</label>
                <input
                  type="text"
                  className={styles.input}
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="E.g., player_01 (4-20 characters)"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Full name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={regForm.full_name}
                  onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                  placeholder="E.g., Nguyen Minh Anh"
                />
              </div>

              <div className={styles.twoColRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="minhanh@gmail.com"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Phone number</label>
                  <input
                    type="tel"
                    className={styles.input}
                    value={regForm.phone_number}
                    onChange={(e) => setRegForm({ ...regForm, phone_number: e.target.value })}
                    placeholder="0912345678"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={`${styles.input} ${regError ? styles.inputError : ''}`}
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="8-32 chars, letters & numbers"
                />
                {regError && <p className={styles.errorText}>{regError}</p>}
              </div>

              <button type="submit" className={styles.primaryBtn} disabled={regLoading}>
                {regLoading ? 'Creating account...' : 'Register & Get OTP'}
              </button>

              <p className={styles.cardFooterText}>
                Already have an account?{' '}
                <button
                  type="button"
                  className={styles.inlineSwitchBtn}
                  onClick={() => setActiveTab('login')}
                >
                  Login now
                </button>
              </p>
            </form>
          )}

          {/* DR25 / MSG94 / MSG95 / MSG96 */}
          {activeTab === 'otp' && (
            <form className={styles.formContainer} onSubmit={handleVerifyOtpSubmit}>
              <h2 className={styles.cardTitle}>Verify OTP</h2>

              {otpMessage && <div className={styles.infoBanner}>{otpMessage}</div>}

              <div className={styles.formGroup}>
                <label className={styles.label}>Email address</label>
                <input
                  type="email"
                  className={styles.input}
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="Registered email..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Verification code (Test: 123456)</label>
                <input
                  type="text"
                  maxLength={6}
                  className={`${styles.input} ${styles.otpInput} ${
                    otpError ? styles.inputError : ''
                  }`}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                />
                {otpError && <p className={styles.errorText}>{otpError}</p>}
              </div>

              <button type="submit" className={styles.primaryBtn} disabled={otpLoading}>
                {otpLoading ? 'Verifying...' : 'Verify Account'}
              </button>

              <p className={styles.cardFooterText}>
                Didn't receive the code?{' '}
                <button
                  type="button"
                  className={styles.inlineSwitchBtn}
                  disabled={cooldown > 0}
                  onClick={handleResendOtp}
                >
                  {cooldown > 0 ? `Resend in (${cooldown}s)` : 'Resend OTP'}
                </button>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}