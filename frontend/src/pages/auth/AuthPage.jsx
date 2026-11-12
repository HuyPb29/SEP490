import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { loginApi, registerPlayerApi, verifyOtpApi, resendOtpApi, forgotPasswordApi, resetPasswordApi } from '../../api/authApi';
import { roleHome } from '../../api/session';
import { fieldError, messages, normalizeName, otpSendError, otpSent, validEmail, validName, validPassword, validPhone, validUsername } from '../../api/f1Rules';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionDialog = useRef(null);
  const sessionExpired = Boolean(location.state?.sessionExpired);

  useEffect(() => {
    const dialog = sessionDialog.current;
    if (sessionExpired && dialog && !dialog.open) dialog.showModal();
  }, [sessionExpired]);

  // Tab: 'login' (UC02) | 'register' (UC01) | 'otp' (DR25)
  const [activeTab, setActiveTab] = useState(location.state?.isSignUp ? 'register' : 'login');

  // State UC02: Đăng nhập
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [visiblePassword, setVisiblePassword] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [loginFields, setLoginFields] = useState({});
  const [loginNotice, setLoginNotice] = useState(location.state?.notice || '');
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
  const [registerFields, setRegisterFields] = useState({});
  const [registerLoading, setRegisterLoading] = useState(false);

  // State DR25: Xác thực OTP & Cooldown 60s
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState('REGISTER');
  const [otpSending, setOtpSending] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [otpFields, setOtpFields] = useState({});
  const [sendError, setSendError] = useState('');
  const [registrationExpired, setRegistrationExpired] = useState(false);
  const resettingPassword = otpPurpose === 'RESET_PASSWORD';
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const otpDialog = useRef(null);
  useEffect(() => {
    const dialog = otpDialog.current;
    if (activeTab === 'otp' && otpMessage && dialog && !dialog.open) dialog.showModal();
  }, [activeTab, otpMessage]);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldowns, setCooldowns] = useState({});
  const [clock, setClock] = useState(Date.now);
  const otpKey = otpPurpose + ':' + otpEmail.trim().toLowerCase();
  const cooldown = Math.max(0, Math.ceil(((cooldowns[otpKey] ?? 0) - clock) / 1000));
  const hasCooldown = Object.keys(cooldowns).length > 0;
  const [pendingRegistrationEmail, setPendingRegistrationEmail] = useState('');

  // DR25: Bộ đếm ngược 60s giữa 2 lần gửi lại OTP
  useEffect(() => {
    if (!hasCooldown) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setCooldowns((current) => Object.fromEntries(Object.entries(current).filter(([, deadline]) => deadline > now)));
    }, 1000);
    return () => clearInterval(timer);
  }, [hasCooldown]);

  // UC02: Xử lý đăng nhập (POST /api/auth/login)
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginNotice('');

    const errors = {};
    if (!loginIdentity.trim()) errors.identity = 'Nhập tên đăng nhập hoặc email.';
    if (!loginPassword) errors.password = 'Nhập mật khẩu.';
    setLoginFields(errors);
    if (Object.values(errors).some(Boolean)) return;

    setLoginLoading(true);
    try {
      const user = await loginApi({ username_or_email: loginIdentity, password: loginPassword });
      const home = roleHome[user.role.toLowerCase()] ?? '/';
      const returnTo = location.state?.returnTo;
      navigate(typeof returnTo === 'string' && /^\/(?!\/)/.test(returnTo) ? returnTo : home, { replace: true });
    } catch (error) {
      const errors = error.response?.data?.errors;
      if (errors) setLoginFields({ identity: errors.email, password: errors.password });
      else setLoginError(error.response?.data?.message || 'Không thể đăng nhập. Vui lòng thử lại.');
    } finally {
      setLoginLoading(false);
    }
  };

  // UC01: Kiểm tra dữ liệu đăng ký theo chuẩn v19
  const validateRegisterForm = () => ({
    username: fieldError(registerForm.username, 'tên đăng nhập', validUsername),
    full_name: fieldError(registerForm.full_name, 'họ tên', validName),
    email: fieldError(registerForm.email, 'email', validEmail),
    phone_number: fieldError(registerForm.phone_number, 'số điện thoại', validPhone),
    password: fieldError(registerForm.password, 'mật khẩu', validPassword),
  });

  // UC01: Xử lý đăng ký Player (POST /api/auth/register)
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setRegisterError('');
    const errors = validateRegisterForm();
    setRegisterFields(errors);
    if (Object.values(errors).some(Boolean)) return;

    setRegisterLoading(true);
    try {
      const response = await registerPlayerApi({ ...registerForm, full_name: normalizeName(registerForm.full_name) });
      if (response?.success) {
        setOtpPurpose('REGISTER');
        setOtpEmail(response.data.email);
        setPendingRegistrationEmail(response.data.email);
        setRegisterForm((form) => ({ ...form, password: '' }));
        setOtpMessage(otpSent(response.data.email));
        setRegistrationExpired(false);
        setOtpFields({});
        setSendError('');
        setOtpCode('');
        setOtpError('');
        const sentAt = Date.now();
        setClock(sentAt);
        setCooldowns((current) => ({ ...current, ['REGISTER:' + response.data.email.toLowerCase()]: sentAt + 60_000 }));
        setActiveTab('otp');
      }
    } catch (error) {
      const { errors, message } = error.response?.data ?? {};
      if (errors) {
        setRegisterFields({ ...errors, full_name: errors.fullName, phone_number: errors.phone });
      } else {
        setRegisterError(error.response?.status === 429 ? otpSendError(error) : message || 'Không thể gửi mã xác minh. Vui lòng thử lại.');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  // Xác thực mã OTP 6 chữ số (POST /api/auth/verify-email)
  const handleVerifyOtpSubmit = async (event) => {
    event.preventDefault();
    setOtpError('');
    if (registrationExpired || (resettingPassword && !resetCodeSent)) return;
    const errors = {
      otp: fieldError(otpCode, 'mã xác minh', (value) => /^\d{6}$/.test(value)),
      password: resettingPassword ? fieldError(newPassword, 'mật khẩu mới', (value) => value.length >= 8 && value.length <= 32) : undefined,
    };
    setOtpFields(errors);
    if (Object.values(errors).some(Boolean)) return;

    setOtpLoading(true);
    try {
      const email = otpEmail.trim();
      if (resettingPassword) await resetPasswordApi({ email, otp: otpCode, newPassword });
      else await verifyOtpApi({ email, otp_code: otpCode });
      setLoginIdentity(email);
      setLoginPassword('');
      setNewPassword('');
      setOtpCode('');
      if (!resettingPassword) setPendingRegistrationEmail('');
      setLoginNotice(resettingPassword ? 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' : messages.verified);
      setActiveTab('login');
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể xác minh mã. Vui lòng thử lại.';
      setOtpError(message);
      if (!resettingPassword && message.includes('Vui lòng đăng ký lại')) {
        setRegistrationExpired(true);
        setPendingRegistrationEmail('');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const openOtpForm = (purpose) => {
    setOtpPurpose(purpose);
    setRegistrationExpired(false);
    setOtpEmail(purpose === 'REGISTER' ? pendingRegistrationEmail : loginIdentity.includes('@') ? loginIdentity.trim() : '');
    setOtpCode('');
    setNewPassword('');
    setOtpFields({});
    setSendError('');
    setResetCodeSent(false);
    setOtpMessage('');
    setOtpError('');
    setActiveTab('otp');
  };

  const handleSendOtp = async () => {
    if (registrationExpired || cooldown > 0 || otpSending || otpLoading) return;
    const email = otpEmail.trim();
    const emailError = fieldError(email, 'email', validEmail);
    setOtpFields({ email: emailError });
    if (emailError) return;
    setOtpError('');
    setSendError('');
    setOtpSending(true);
    try {
      if (resettingPassword && !resetCodeSent) await forgotPasswordApi(email);
      else await resendOtpApi({ email, purpose: otpPurpose });
      if (resettingPassword) setResetCodeSent(true);
      setOtpMessage(resettingPassword ? messages.forgot : otpSent(email));
      setOtpCode('');
      const sentAt = Date.now();
      setClock(sentAt);
      setCooldowns((current) => ({ ...current, [otpKey]: sentAt + 60_000 }));
    } catch (error) {
      const message = otpSendError(error);
      setSendError(message);
      if (!resettingPassword && message.includes('Vui lòng đăng ký lại')) {
        setRegistrationExpired(true);
        setPendingRegistrationEmail('');
      }
    } finally {
      setOtpSending(false);
    }
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterError('');
    setRegisterFields((fields) => ({ ...fields, [field]: undefined }));
  };

  return (
    <div className={styles.splitLayout}>
      <dialog ref={sessionDialog} className={styles.sessionDialog} aria-labelledby="expired-session-title">
        <h2 id="expired-session-title">Phiên đăng nhập đã hết hạn (MSG06)</h2>
        <p>Vui lòng đăng nhập lại để tiếp tục.</p>
        <form method="dialog"><button className={styles.primaryBtn} type="submit">Đóng</button></form>
      </dialog>
      <aside className={styles.leftPanel}>
        <Link className={styles.brandHeader} to="/">
          <span className={styles.brandIcon} aria-hidden="true">C</span>
          <span className={styles.brandName}>Courtly</span>
        </Link>
        <div className={styles.heroCopy}>
          <p className={styles.heroHeading}>Hẹn nhau trên sân.</p>
          <p className={styles.heroDescription}>
            Đặt sân, quản lý lịch chơi và sử dụng điểm thưởng trong cùng một tài khoản.
          </p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <section className={styles.authCard}>
          <div className={styles.tabGroup} role="group" aria-label="Thao tác tài khoản">
            <button
              type="button"
              aria-pressed={activeTab === 'login'}
              className={`${styles.tabBtn} ${activeTab === 'login' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'register'}
              className={`${styles.tabBtn} ${activeTab === 'register' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Đăng ký
            </button>
            {(pendingRegistrationEmail || activeTab === 'otp' && !resettingPassword) && <button
              type="button"
              aria-pressed={activeTab === 'otp'}
              className={`${styles.tabBtn} ${activeTab === 'otp' ? styles.tabActive : ''}`}
              onClick={() => openOtpForm('REGISTER')}
            >
              Xác thực email
            </button>}
          </div>

          {activeTab === 'login' && (
            <form className={styles.formContainer} onSubmit={handleLoginSubmit}>
              <h1 className={styles.cardTitle}>Đăng nhập</h1>
              {loginNotice && <div role="status" className={loginNotice === location.state?.notice ? styles.infoBanner : styles.toast}>{loginNotice}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-identity">
                  Tên đăng nhập hoặc email
                </label>
                <input
                  id="login-identity"
                  className={styles.input}
                  type="text"
                  autoComplete="username"
                  value={loginIdentity}
                  onChange={(event) => {
                    setLoginIdentity(event.target.value);
                    setLoginFields((fields) => ({ ...fields, identity: undefined }));
                    setLoginError('');
                  }}
                  placeholder="Nhập tên đăng nhập hoặc email"
                  aria-invalid={Boolean(loginFields.identity)}
                  aria-describedby={loginFields.identity ? 'login-identity-error' : undefined}
                />
                {loginFields.identity && <p id="login-identity-error" role="alert" className={styles.errorText}>{loginFields.identity}</p>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-password">
                  Mật khẩu
                </label>
                <input
                  id="login-password"
                  className={`${styles.input} ${loginError ? styles.inputError : ''}`}
                  type={visiblePassword === 'login' ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(event) => {
                    setLoginPassword(event.target.value);
                    setLoginFields((fields) => ({ ...fields, password: undefined }));
                    setLoginError('');
                  }}
                  placeholder="Nhập mật khẩu"
                  aria-invalid={Boolean(loginFields.password)}
                  aria-describedby={loginFields.password ? 'login-password-error' : undefined}
                />
                <button type="button" className={styles.passwordToggle} aria-controls="login-password" aria-pressed={visiblePassword === 'login'}
                  onClick={() => setVisiblePassword(visiblePassword === 'login' ? null : 'login')}>{visiblePassword === 'login' ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button>
                {loginFields.password && <p id="login-password-error" role="alert" className={styles.errorText}>{loginFields.password}</p>}
                {loginError && <p role="alert" className={styles.errorText}>{loginError}</p>}
              </div>
              <div className={styles.forgotRow}>
                <button type="button" className={styles.inlineSwitchBtn} onClick={() => openOtpForm('RESET_PASSWORD')}>
                  Quên mật khẩu?
                </button>
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={loginLoading}>
                {loginLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>
          )}

          {activeTab === 'register' && (
            <form className={styles.formContainer} onSubmit={handleRegisterSubmit} noValidate>
              <h1 className={styles.cardTitle}>Tạo tài khoản người chơi</h1>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-username">
                  Tên đăng nhập
                </label>
                <input
                  id="register-username"
                  className={styles.input}
                  value={registerForm.username}
                  onChange={(event) => updateRegisterField('username', event.target.value)}
                  autoComplete="username"
                  placeholder="Ví dụ: player_01"
                  aria-invalid={Boolean(registerFields.username)}
                  aria-describedby={registerFields.username ? 'register-username-error' : undefined}
                />
                {registerFields.username && <p id="register-username-error" role="alert" className={styles.errorText}>{registerFields.username}</p>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-name">
                  Họ và tên
                </label>
                <input
                  id="register-name"
                  className={styles.input}
                  value={registerForm.full_name}
                  onChange={(event) => updateRegisterField('full_name', event.target.value)}
                  autoComplete="name"
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  aria-invalid={Boolean(registerFields.full_name)}
                  aria-describedby={registerFields.full_name ? 'register-name-error' : undefined}
                />
                {registerFields.full_name && <p id="register-name-error" role="alert" className={styles.errorText}>{registerFields.full_name}</p>}
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
                    aria-invalid={Boolean(registerFields.email)}
                  aria-describedby={registerFields.email ? 'register-email-error' : undefined}
                  />
                  {registerFields.email && <p id="register-email-error" role="alert" className={styles.errorText}>{registerFields.email}</p>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="register-phone">
                    Số điện thoại
                  </label>
                  <input
                    id="register-phone"
                    className={styles.input}
                    type="tel"
                    value={registerForm.phone_number}
                    onChange={(event) => updateRegisterField('phone_number', event.target.value)}
                    autoComplete="tel"
                    placeholder="0912345678"
                    aria-invalid={Boolean(registerFields.phone_number)}
                  aria-describedby={registerFields.phone_number ? 'register-phone-error' : undefined}
                  />
                  {registerFields.phone_number && <p id="register-phone-error" role="alert" className={styles.errorText}>{registerFields.phone_number}</p>}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-password">
                  Mật khẩu
                </label>
                <input
                  id="register-password"
                  className={styles.input}
                  type={visiblePassword === 'register' ? 'text' : 'password'}
                  value={registerForm.password}
                  onChange={(event) => updateRegisterField('password', event.target.value)}
                  autoComplete="new-password"
                  placeholder="8–32 ký tự, gồm chữ và số"
                  aria-invalid={Boolean(registerFields.password)}
                  aria-describedby={registerFields.password ? 'register-password-error' : undefined}
                />
                <button type="button" className={styles.passwordToggle} aria-controls="register-password" aria-pressed={visiblePassword === 'register'}
                  onClick={() => setVisiblePassword(visiblePassword === 'register' ? null : 'register')}>{visiblePassword === 'register' ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button>
                {registerFields.password && <p id="register-password-error" role="alert" className={styles.errorText}>{registerFields.password}</p>}
                {registerError && <p role="alert" className={styles.errorText}>{registerError}</p>}
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={registerLoading}>
                {registerLoading ? 'Đang gửi mã…' : 'Đăng ký và nhận mã'}
              </button>
              <p className={styles.cardFooterText}>
                Bạn đã có tài khoản?{' '}
                <button
                  type="button"
                  className={styles.inlineSwitchBtn}
                  onClick={() => setActiveTab('login')}
                >
                  Đăng nhập
                </button>
              </p>
            </form>
          )}

          {activeTab === 'otp' && (
            <form className={styles.formContainer} onSubmit={handleVerifyOtpSubmit} noValidate>
              <h1 className={styles.cardTitle}>{resettingPassword ? 'Đặt lại mật khẩu' : 'Xác thực email'}</h1>
              <dialog ref={otpDialog} className={styles.sessionDialog} aria-label="Mã xác minh" onClose={() => setOtpMessage('')}>
                <p>{otpMessage}</p>
                <button type="button" className={styles.primaryBtn} onClick={() => otpDialog.current.close()}>Đã hiểu</button>
              </dialog>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="otp-email">
                  Địa chỉ email
                </label>
                <input
                  id="otp-email"
                  className={styles.input}
                  type="email"
                  value={otpEmail}
                  readOnly={!resettingPassword || resetCodeSent}
                  required
                  onChange={(event) => setOtpEmail(event.target.value)}
                  autoComplete="email"
                  aria-describedby={otpFields.email ? "otp-email-error" : undefined}
                />
                {otpFields.email && <p id="otp-email-error" role="alert" className={styles.errorText}>{otpFields.email}</p>}
              </div>
              {!registrationExpired && (!resettingPassword || resetCodeSent) && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="otp-code">
                      Mã xác thực gồm 6 số
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
                      aria-describedby={otpFields.otp ? "otp-code-error" : undefined}
                    />
                    {otpFields.otp && <p id="otp-code-error" role="alert" className={styles.errorText}>{otpFields.otp}</p>}
                  </div>
                  {resettingPassword && (
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="reset-password">Mật khẩu mới</label>
                      <input id="reset-password" className={styles.input} type="password"
                        autoComplete="new-password" value={newPassword} required
                        onChange={(event) => setNewPassword(event.target.value)}
                        aria-describedby={otpFields.password ? "reset-password-error" : undefined} />
                      {otpFields.password && <p id="reset-password-error" role="alert" className={styles.errorText}>{otpFields.password}</p>}
                    </div>
                  )}
                  <button className={styles.primaryBtn} type="submit" disabled={otpLoading || otpSending}>
                    {otpLoading ? 'Đang xác thực…' : resettingPassword ? 'Đặt lại mật khẩu' : 'Xác thực mã'}
                  </button>
                </>
              )}
              {otpError && <p role="alert" className={styles.errorText}>{otpError}</p>}
              {registrationExpired ? <button type="button" className={styles.inlineSwitchBtn} onClick={() => setActiveTab('register')}>Đăng ký lại</button>
                : <button type="button" className={styles.inlineSwitchBtn}
                disabled={cooldown > 0 || otpLoading || otpSending} onClick={handleSendOtp}>
                {otpSending ? 'Đang gửi…' : cooldown > 0 ? `Gửi lại sau ${cooldown} giây`
                  : resettingPassword && !resetCodeSent ? 'Gửi mã đặt lại mật khẩu' : 'Gửi lại mã'}
              </button>}
              {sendError && <p role="alert" className={styles.errorText}>{sendError}</p>}
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
