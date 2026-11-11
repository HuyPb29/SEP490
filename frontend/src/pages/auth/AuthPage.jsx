import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  loginApi,
  registerPlayerApi,
  verifyOtpApi,
  resendOtpApi,
  forgotPasswordApi,
  resetPasswordApi,
} from '../../api/authApi';
import { roleHome } from '../../api/session';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Tab: 'login' (UC02) | 'register' (UC01) | 'otp' (DR25)
  const [activeTab, setActiveTab] = useState(location.state?.isSignUp ? 'register' : 'login');

  // State UC02: Đăng nhập
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // State UC01: Đăng ký tài khoản Player
  const [registerForm, setRegisterForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
  });
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  // State DR25: Xác thực OTP & Cooldown 60s
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState('REGISTER');
  const [otpSending, setOtpSending] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const resettingPassword = otpPurpose === 'RESET_PASSWORD';
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // DR25: Bộ đếm ngược 60s giữa 2 lần gửi lại OTP
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // UC02: Xử lý đăng nhập (POST /api/auth/login)
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginNotice('');

    if (!loginIdentity.trim() || !loginPassword) {
      setLoginError('Enter your username or email and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const user = await loginApi({ username_or_email: loginIdentity, password: loginPassword });
      const home = roleHome[user.role.toLowerCase()] ?? '/';
      const returnTo = location.state?.returnTo;
      navigate(typeof returnTo === 'string' && /^\/(?!\/)/.test(returnTo) ? returnTo : home, { replace: true });
    } catch (error) {
      setLoginError(error.response?.data?.message || 'We couldn’t sign you in. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // UC01: Kiểm tra dữ liệu đăng ký theo chuẩn v19
  const validateRegisterForm = () => {
    const { username, full_name, email, phone_number, password } = registerForm;

    // DR22: 4-20 ký tự, bắt đầu bằng chữ thường a-z, chỉ chứa a-z, 0-9, ., _
    if (!/^[a-z][a-z0-9._]{3,19}$/.test(username.trim())) {
      return 'Username must be 4-20 characters, start with a lowercase letter, and contain only letters, numbers, periods, or underscores.';
    }
    // DR24: Họ tên 2-50 ký tự, chỉ chứa chữ cái và khoảng trắng
    if (!/^[\p{L}\s]{2,50}$/u.test(full_name.trim())) {
      return 'Full name must be 2-50 characters and contain only letters and spaces.';
    }
    // DR17: Định dạng email hợp lệ
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    // DR01: Số điện thoại đúng 10 chữ số, bắt đầu bằng số 0
    if (!/^0\d{9}$/.test(phone_number.trim())) {
      return 'Phone number must contain 10 digits and start with 0.';
    }
    // DR23: Mật khẩu 8-32 ký tự, ít nhất 1 chữ cái, 1 chữ số, không khoảng trắng
    if (
      password.length < 8 ||
      password.length > 32 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      /\s/.test(password)
    ) {
      return 'Password must be 8-32 characters, include at least one letter and one number, and contain no spaces.';
    }
    return '';
  };

  // UC01: Xử lý đăng ký Player (POST /api/auth/register)
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setRegisterError('');
    const validationError = validateRegisterForm();
    if (validationError) {
      setRegisterError(validationError);
      return;
    }

    setRegisterLoading(true);
    try {
      const response = await registerPlayerApi(registerForm);
      if (response?.success) {
        setOtpPurpose('REGISTER');
        setOtpEmail(response.data.email);
        setRegisterForm((form) => ({ ...form, password: '' }));
        setOtpMessage(response.message || 'A verification code has been sent to your email.');
        setOtpCode('');
        setOtpError('');
        setCooldown(60);
        setActiveTab('otp');
      }
    } catch (error) {
      setRegisterError(
        error.response?.data?.message || error.message || 'Could not create your account.'
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  // Xác thực mã OTP 6 chữ số (POST /api/auth/verify-email)
  const handleVerifyOtpSubmit = async (event) => {
    event.preventDefault();
    setOtpError('');
    if (resettingPassword && !resetCodeSent) return;
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('The verification code must be exactly 6 digits.');
      return;
    }

    setOtpLoading(true);
    try {
      const email = otpEmail.trim();
      const response = resettingPassword
        ? await resetPasswordApi({ email, otp: otpCode.trim(), newPassword })
        : await verifyOtpApi({ email, otp_code: otpCode.trim() });
      setLoginIdentity(email);
      setLoginPassword('');
      setNewPassword('');
      setOtpCode('');
      setLoginNotice(response.message || (resettingPassword ? 'Password reset. You can now sign in.' : 'Email verified. You can now sign in.'));
      setActiveTab('login');
    } catch (error) {
      setOtpError(
        error.response?.data?.message || error.message || 'Invalid verification code.'
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const openOtpForm = (purpose) => {
    setOtpPurpose(purpose);
    setOtpEmail(purpose === 'RESET_PASSWORD' && loginIdentity.includes('@') ? loginIdentity.trim() : '');
    setOtpCode('');
    setNewPassword('');
    setResetCodeSent(false);
    setOtpMessage('');
    setOtpError('');
    setCooldown(0);
    setActiveTab('otp');
  };

  const handleSendOtp = async () => {
    if (cooldown > 0 || otpSending || otpLoading) return;
    const email = otpEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError('Enter a valid email address.');
      return;
    }
    setOtpError('');
    setOtpSending(true);
    try {
      const response = resettingPassword && !resetCodeSent
        ? await forgotPasswordApi(email)
        : await resendOtpApi({ email, purpose: otpPurpose });
      if (resettingPassword) setResetCodeSent(true);
      setOtpMessage(response.message || 'Check your email for the verification code.');
      setCooldown(60);
    } catch (error) {
      setOtpError(error.response?.data?.message || 'Could not send the verification code.');
    } finally {
      setOtpSending(false);
    }
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterError('');
  };

  return (
    <div className={styles.splitLayout}>
      <aside className={styles.leftPanel}>
        <div className={styles.brandHeader} onClick={() => navigate('/')}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>Courtly</span>
        </div>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroHeading}>Book badminton courts with ease</h1>
          <p className={styles.heroDescription}>
            One account to book courts, join matches, use vouchers, and earn points at every venue.
          </p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <section className={styles.authCard}>
          <div className={styles.tabGroup} role="tablist" aria-label="Account">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'login'}
              className={`${styles.tabBtn} ${activeTab === 'login' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              className={`${styles.tabBtn} ${activeTab === 'register' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Sign up
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'otp'}
              className={`${styles.tabBtn} ${activeTab === 'otp' ? styles.tabActive : ''}`}
              onClick={() => openOtpForm('REGISTER')}
            >
              Verify email
            </button>
          </div>

          {activeTab === 'login' && (
            <form className={styles.formContainer} onSubmit={handleLoginSubmit}>
              <h2 className={styles.cardTitle}>Welcome back</h2>
              {loginNotice && <div className={styles.infoBanner}>{loginNotice}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-identity">
                  Username or email
                </label>
                <input
                  id="login-identity"
                  className={styles.input}
                  type="text"
                  autoComplete="username"
                  value={loginIdentity}
                  onChange={(event) => {
                    setLoginIdentity(event.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter your username or email"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  className={`${styles.input} ${loginError ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(event) => {
                    setLoginPassword(event.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter your password"
                />
                {loginError && <p className={styles.errorText}>{loginError}</p>}
              </div>
              <div className={styles.forgotRow}>
                <button type="button" className={styles.inlineSwitchBtn} onClick={() => openOtpForm('RESET_PASSWORD')}>
                  Forgot password?
                </button>
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={loginLoading}>
                {loginLoading ? 'Signing in...' : 'Sign in'}
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
              <h2 className={styles.cardTitle}>Create your account</h2>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-username">
                  Username
                </label>
                <input
                  id="register-username"
                  className={styles.input}
                  value={registerForm.username}
                  onChange={(event) => updateRegisterField('username', event.target.value)}
                  autoComplete="username"
                  placeholder="e.g. player_01"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-name">
                  Full name
                </label>
                <input
                  id="register-name"
                  className={styles.input}
                  value={registerForm.full_name}
                  onChange={(event) => updateRegisterField('full_name', event.target.value)}
                  autoComplete="name"
                  placeholder="e.g. Nguyen Minh Anh"
                />
              </div>
              <div className={styles.twoColRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="register-email">
                    Email
                  </label>
                  <input
                    id="register-email"
                    className={styles.input}
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => updateRegisterField('email', event.target.value)}
                    autoComplete="email"
                    placeholder="minhanh@gmail.com"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="register-phone">
                    Phone number
                  </label>
                  <input
                    id="register-phone"
                    className={styles.input}
                    type="tel"
                    value={registerForm.phone_number}
                    onChange={(event) => updateRegisterField('phone_number', event.target.value)}
                    autoComplete="tel"
                    placeholder="0912345678"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-password">
                  Password
                </label>
                <input
                  id="register-password"
                  className={`${styles.input} ${registerError ? styles.inputError : ''}`}
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => updateRegisterField('password', event.target.value)}
                  autoComplete="new-password"
                  placeholder="8-32 chars, letters & numbers"
                />
                {registerError && <p className={styles.errorText}>{registerError}</p>}
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={registerLoading}>
                {registerLoading ? 'Creating account...' : 'Create account and get code'}
              </button>
              <p className={styles.cardFooterText}>
                Already have an account?{' '}
                <button
                  type="button"
                  className={styles.inlineSwitchBtn}
                  onClick={() => setActiveTab('login')}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {activeTab === 'otp' && (
            <form className={styles.formContainer} onSubmit={handleVerifyOtpSubmit}>
              <h2 className={styles.cardTitle}>{resettingPassword ? 'Reset your password' : 'Verify your email'}</h2>
              {otpMessage && <div className={styles.infoBanner}>{otpMessage}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="otp-email">
                  Email address
                </label>
                <input
                  id="otp-email"
                  className={styles.input}
                  type="email"
                  value={otpEmail}
                  readOnly={resettingPassword && resetCodeSent}
                  required
                  onChange={(event) => setOtpEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
              {(!resettingPassword || resetCodeSent) && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="otp-code">
                      6-digit verification code
                    </label>
                    <input
                      id="otp-code"
                      className={`${styles.input} ${styles.otpInput} ${
                        otpError ? styles.inputError : ''
                      }`}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                      autoComplete="one-time-code"
                    />
                  </div>
                  {resettingPassword && (
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="reset-password">New password</label>
                      <input id="reset-password" className={styles.input} type="password"
                        autoComplete="new-password" value={newPassword} required
                        minLength={8} maxLength={32} onChange={(event) => setNewPassword(event.target.value)} />
                    </div>
                  )}
                  <button className={styles.primaryBtn} type="submit" disabled={otpLoading || otpSending}>
                    {otpLoading ? 'Verifying...' : resettingPassword ? 'Reset password' : 'Verify code'}
                  </button>
                </>
              )}
              {otpError && <p role="alert" className={styles.errorText}>{otpError}</p>}
              <button type="button" className={styles.inlineSwitchBtn}
                disabled={cooldown > 0 || otpLoading || otpSending} onClick={handleSendOtp}>
                {otpSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s`
                  : resettingPassword && !resetCodeSent ? 'Send reset code' : 'Resend code'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}