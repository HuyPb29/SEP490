import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  loginApi,
  registerPlayerApi,
  verifyOtpApi,
  resendOtpApi,
  requestOtpApi,
  resetPasswordApi,
  USE_MOCK_AUTH,
} from '../../api/authApi';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
  const [registerErrors, setRegisterErrors] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [registerApiError, setRegisterApiError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  // State DR25: Xác thực OTP & Cooldown 60s
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [forgotStep, setForgotStep] = useState(1);
  const [forgotIdentity, setForgotIdentity] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpExpiresAt, setForgotOtpExpiresAt] = useState('');
  const [forgotNowMs, setForgotNowMs] = useState(() => Date.now());
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // DR25: Bộ đếm ngược 60s giữa 2 lần gửi lại OTP
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (activeTab !== 'forgot' || forgotStep !== 2 || !forgotOtpExpiresAt) return undefined;
    const timer = setInterval(() => setForgotNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeTab, forgotStep, forgotOtpExpiresAt]);

  const forgotSecondsLeft = forgotOtpExpiresAt
    ? Math.max(0, Math.ceil((new Date(forgotOtpExpiresAt).getTime() - forgotNowMs) / 1000))
    : 0;
  const forgotCountdown = `${String(Math.floor(forgotSecondsLeft / 60)).padStart(2, '0')}:${String(forgotSecondsLeft % 60).padStart(2, '0')}`;

  // UC02: Xử lý đăng nhập (POST /api/auth/login)
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginNotice('');

    if (!loginIdentity.trim() || !loginPassword) {
      setLoginError('Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.');
      return;
    }

    setLoginLoading(true);
    try {
      const response = await loginApi({
        username_or_email: loginIdentity,
        password: loginPassword,
      });

      if (response?.success) {
        // Lưu phiên đăng nhập thông qua useAuth / authStorage
        login(response.data.access_token, response.data.user_info);
        const fromPath = location.state?.from || '/';
        navigate(fromPath);
      }
    } catch (error) {
      const code = error.response?.data?.code || error.code;
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      const message =
        status === 401 || code === 'MSG10'
          ? '[MSG10] Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
          : serverMessage && serverMessage !== 'No message available'
            ? serverMessage
            : 'Không thể đăng nhập. Vui lòng thử lại sau.';

      // MSG95: Tài khoản chưa xác thực OTP (status = 'unverified') -> chuyển sang tab OTP
      if (code === 'MSG95') {
        setOtpEmail(error.email || loginIdentity);
        setOtpMessage(message || '[MSG95] Tài khoản chưa kích hoạt. Vui lòng xác thực mã OTP để tiếp tục.');
        setOtpError('');
        setCooldown(60);
        setActiveTab('otp');
      } else {
        // MSG10 (Sai thông tin) hoặc MSG11 (Tài khoản bị khóa)
        setLoginError(message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // UC01: Kiểm tra dữ liệu đăng ký theo chuẩn SRS v18
  const validateRegisterForm = () => {
    const errors = {};
    const { username, full_name, email, phone_number, password } = registerForm;

    // DR22: 4-20 ký tự, bắt đầu bằng chữ thường a-z, chỉ chứa a-z, 0-9, ., _
    if (!/^[a-z][a-z0-9._]{3,19}$/.test(username.trim())) {
      errors.username =
        'Tên đăng nhập phải từ 4-20 ký tự, bắt đầu bằng chữ cái thường và chỉ chứa chữ cái thường, chữ số, dấu chấm hoặc gạch dưới.';
    }
    // DR24: Họ tên 2-50 ký tự, chỉ chứa chữ cái và khoảng trắng
    if (!/^[\p{L}\s]{2,50}$/u.test(full_name.trim())) {
      errors.fullName = 'Họ và tên phải từ 2-50 ký tự và chỉ chứa chữ cái cùng khoảng trắng.';
    }
    // DR17: Định dạng email hợp lệ
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    // DR01: Số điện thoại đúng 10 chữ số, bắt đầu bằng số 0
    if (!/^0\d{9}$/.test(phone_number.trim())) {
      errors.phone = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.';
    }
    // DR23: Mật khẩu 8-32 ký tự, ít nhất 1 chữ cái, 1 chữ số, không khoảng trắng
    if (
      password.length < 8 ||
      password.length > 32 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      /\s/.test(password)
    ) {
      errors.password =
        'Mật khẩu phải từ 8-32 ký tự, bao gồm ít nhất một chữ cái, một chữ số và không chứa khoảng trắng.';
    }
    return errors;
  };

  // UC01: Xử lý đăng ký Player (POST /api/v1/auth/register/player)
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setRegisterErrors({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      password: '',
    });
    setRegisterApiError('');

    const errors = validateRegisterForm();
    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      return;
    }

    setRegisterLoading(true);
    try {
      const response = await registerPlayerApi(registerForm);
      if (response?.success) {
        // DR25 / MSG08: Tự động chuyển sang tab OTP sau khi tạo tài khoản 'unverified'
        setOtpEmail(registerForm.email.trim());
        setOtpMessage(response.message || '[MSG08] Mã xác thực đã được gửi đến email của bạn.');
        setOtpCode('');
        setOtpError('');
        setCooldown(60);
        setActiveTab('otp');
      }
    } catch (error) {
      setRegisterApiError(
        error.response?.data?.message || error.message || 'Không thể tạo tài khoản. Vui lòng thử lại sau.'
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  // Xác thực mã OTP 6 chữ số (POST /api/v1/auth/verify-otp)
  const handleVerifyOtpSubmit = async (event) => {
    event.preventDefault();
    setOtpError('');
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('Mã xác thực phải gồm đúng 6 chữ số.');
      return;
    }

    setOtpLoading(true);
    try {
      const response = await verifyOtpApi({
        email: otpEmail,
        otp_code: otpCode.trim(),
        purpose: 'register',
      });
      if (response?.success) {
        // MSG94: Kích hoạt status = 'active' thành công -> quay về tab Đăng nhập
        setLoginIdentity(otpEmail);
        setLoginPassword('');
        setLoginNotice(response.message || '[MSG94] Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.');
        setActiveTab('login');
      }
    } catch (error) {
      setOtpError(
        error.response?.data?.message || error.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.'
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // Gửi lại mã OTP (POST /api/v1/auth/resend-otp)
  const handleResendOtp = async () => {
    if (cooldown > 0 || !otpEmail.trim()) return;
    setOtpError('');
    try {
      const response = await resendOtpApi({ email: otpEmail.trim(), purpose: 'register' });
      setOtpMessage(response.message || 'Mã xác thực mới đã được gửi đến email của bạn.');
      setCooldown(60);
    } catch (error) {
      setOtpError(
        error.response?.data?.message ||
          error.message ||
          'Không thể gửi lại mã xác thực.'
      );
    }
  };

  const handleRequestPasswordOtp = async (event) => {
    event.preventDefault();
    setForgotError('');
    if (!forgotIdentity.trim()) {
      setForgotError('Vui lòng nhập tên đăng nhập hoặc email.');
      return;
    }
    setForgotLoading(true);
    try {
      const response = await requestOtpApi({ username_or_email: forgotIdentity.trim() });
      const expiresAt = response.data?.otp_expires_at;
      if (!expiresAt) throw new Error('Không nhận được thời gian hết hạn OTP. Vui lòng thử lại.');
      setForgotOtpExpiresAt(expiresAt);
      setForgotNowMs(Date.now());
      setForgotOtp('');
      setForgotStep(2);
    } catch (error) {
      setForgotError(error.response?.data?.message || error.message || 'Không thể yêu cầu mã đặt lại mật khẩu.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyPasswordOtp = async (event) => {
    event.preventDefault();
    setForgotError('');
    if (!/^\d{6}$/.test(forgotOtp)) {
      setForgotError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    if (forgotSecondsLeft <= 0) {
      setForgotError('Mã OTP này đã hết hạn. Vui lòng yêu cầu mã mới để tiếp tục.');
      return;
    }
    setForgotLoading(true);
    try {
      const response = await verifyOtpApi({
        username_or_email: forgotIdentity.trim(),
        otp_code: forgotOtp,
        purpose: 'password_reset',
      });
      setForgotResetToken(response.data?.reset_token || '');
      setForgotStep(3);
    } catch (error) {
      setForgotError(error.response?.data?.message || error.message || 'Không thể xác thực mã OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setForgotError('');
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    if (
      forgotNewPassword.length < 8 ||
      forgotNewPassword.length > 32 ||
      !/[A-Za-z]/.test(forgotNewPassword) ||
      !/\d/.test(forgotNewPassword) ||
      /\s/.test(forgotNewPassword)
    ) {
      setForgotError(
        'Mật khẩu phải từ 8-32 ký tự, bao gồm ít nhất một chữ cái, một chữ số và không chứa khoảng trắng.'
      );
      return;
    }
    setForgotLoading(true);
    try {
      const response = await resetPasswordApi({
        username_or_email: forgotIdentity.trim(),
        reset_token: forgotResetToken,
        new_password: forgotNewPassword,
      });
      setLoginIdentity(forgotIdentity.trim());
      setLoginPassword('');
      setLoginNotice(response.message || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.');
      setActiveTab('login');
      setForgotStep(1);
    } catch (error) {
      setForgotError(error.response?.data?.message || error.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setForgotLoading(false);
    }
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    const errorKey = field === 'full_name' ? 'fullName' : field === 'phone_number' ? 'phone' : field;
    setRegisterErrors((prev) => ({ ...prev, [errorKey]: '' }));
    setRegisterApiError('');
  };

  return (
    <div className={styles.splitLayout}>
      <aside className={styles.leftPanel}>
        <div className={styles.brandHeader} onClick={() => navigate('/')}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>Courtly</span>
        </div>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroHeading}>Đặt sân cầu lông dễ dàng, nhanh chóng</h1>
          <p className={styles.heroDescription}>
            Một tài khoản tiện lợi để đặt sân, ghép trận giao lưu, áp dụng ưu đãi và tích điểm tại mọi địa điểm.
          </p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <section className={styles.authCard}>
          {activeTab !== 'forgot' && (
            <div className={styles.tabGroup} role="tablist" aria-label="Tài khoản">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                className={`${styles.tabBtn} ${activeTab === 'login' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'register'}
                className={`${styles.tabBtn} ${activeTab === 'register' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('register')}
              >
                Đăng ký
              </button>
            </div>
          )}

          {activeTab === 'forgot' && (
            <section className={styles.formContainer} aria-live="polite">
              {forgotStep === 1 && (
                <form onSubmit={handleRequestPasswordOtp}>
                  <h2 className={styles.cardTitle}>Quên mật khẩu · Bước 1/3</h2>
                  <p className={styles.stepDescription}>Nhập tên đăng nhập hoặc email liên kết với tài khoản của bạn.</p>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="forgot-identity">
                      Tên đăng nhập hoặc Email
                    </label>
                    <input
                      id="forgot-identity"
                      className={`${styles.input} ${forgotError ? styles.inputError : ''}`}
                      type="text"
                      autoComplete="username"
                      value={forgotIdentity}
                      onChange={(event) => {
                        setForgotIdentity(event.target.value);
                        setForgotError('');
                      }}
                      placeholder="Tên đăng nhập hoặc Email"
                    />
                    {forgotError && (
                      <p className={styles.errorText} role="alert">
                        {forgotError}
                      </p>
                    )}
                  </div>
                  <button className={styles.primaryBtn} type="submit" disabled={forgotLoading}>
                    {forgotLoading ? 'Đang gửi mã...' : 'Gửi mã OTP'}
                  </button>
                  <p className={styles.cardFooterText}>
                    <button
                      type="button"
                      className={styles.inlineSwitchBtn}
                      onClick={() => setActiveTab('login')}
                    >
                      Quay lại đăng nhập
                    </button>
                  </p>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyPasswordOtp}>
                  <h2 className={styles.cardTitle}>Xác thực mã OTP · Bước 2/3</h2>
                  <p className={styles.stepDescription}>Nhập mã 6 chữ số đã được gửi tới {forgotIdentity}.</p>
                  {USE_MOCK_AUTH && (
                    <div className={styles.testOtpHint}>
                      Mã thử nghiệm cục bộ: <strong>123456</strong>
                    </div>
                  )}
                  <div className={styles.otpExpiry} role="timer">
                    {forgotSecondsLeft > 0 ? `Mã hết hạn sau ${forgotCountdown}` : 'Mã OTP đã hết hạn'}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="forgot-otp">
                      Mã OTP (6 chữ số)
                    </label>
                    <input
                      id="forgot-otp"
                      className={`${styles.input} ${styles.otpInput} ${
                        forgotError ? styles.inputError : ''
                      }`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(event) => {
                        setForgotOtp(event.target.value.replace(/\D/g, ''));
                        setForgotError('');
                      }}
                      placeholder="000000"
                    />
                    {forgotError && (
                      <p className={styles.errorText} role="alert">
                        {forgotError}
                      </p>
                    )}
                  </div>
                  <button
                    className={styles.primaryBtn}
                    type="submit"
                    disabled={forgotLoading || forgotSecondsLeft <= 0}
                  >
                    {forgotLoading ? 'Đang xác thực...' : 'Xác thực OTP'}
                  </button>
                  <p className={styles.cardFooterText}>
                    <button
                      type="button"
                      className={styles.inlineSwitchBtn}
                      onClick={() => {
                        setForgotStep(1);
                        setForgotError('');
                      }}
                    >
                      Yêu cầu mã mới
                    </button>
                  </p>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword}>
                  <h2 className={styles.cardTitle}>Đặt lại mật khẩu · Bước 3/3</h2>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="forgot-new-password">
                      Mật khẩu mới
                    </label>
                    <input
                      id="forgot-new-password"
                      className={`${styles.input} ${forgotError ? styles.inputError : ''}`}
                      type="password"
                      autoComplete="new-password"
                      value={forgotNewPassword}
                      onChange={(event) => {
                        setForgotNewPassword(event.target.value);
                        setForgotError('');
                      }}
                      placeholder="8-32 ký tự, gồm chữ và số"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="forgot-confirm-password">
                      Xác nhận mật khẩu mới
                    </label>
                    <input
                      id="forgot-confirm-password"
                      className={`${styles.input} ${forgotError ? styles.inputError : ''}`}
                      type="password"
                      autoComplete="new-password"
                      value={forgotConfirmPassword}
                      onChange={(event) => {
                        setForgotConfirmPassword(event.target.value);
                        setForgotError('');
                      }}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    {forgotError && (
                      <p className={styles.errorText} role="alert">
                        {forgotError}
                      </p>
                    )}
                  </div>
                  <button className={styles.primaryBtn} type="submit" disabled={forgotLoading}>
                    {forgotLoading ? 'Đang lưu mật khẩu...' : 'Đặt lại mật khẩu'}
                  </button>
                </form>
              )}
            </section>
          )}

          {activeTab === 'login' && (
            <form className={styles.formContainer} onSubmit={handleLoginSubmit}>
              <h2 className={styles.cardTitle}>Chào mừng trở lại</h2>
              {loginNotice && <div className={styles.infoBanner}>{loginNotice}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-identity">
                  Tên đăng nhập hoặc Email
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
                  placeholder="Tên đăng nhập hoặc Email"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="login-password">
                  Mật khẩu
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
                  placeholder="Nhập mật khẩu của bạn"
                />
                {loginError && <p className={styles.errorText}>{loginError}</p>}
              </div>
              <div className={styles.forgotRow}>
                <button
                  type="button"
                  className={`${styles.inlineSwitchBtn} ${styles.greenLink}`}
                  onClick={() => {
                    setForgotStep(1);
                    setForgotIdentity(loginIdentity);
                    setForgotError('');
                    setForgotOtp('');
                    setForgotOtpExpiresAt('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setActiveTab('forgot');
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={loginLoading}>
                {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
              <p className={styles.cardFooterText}>
                Bạn là chủ sân?{' '}
                <Link to="/owner/register" className={styles.greenLinkBold}>
                  Đăng ký địa điểm ngay
                </Link>
              </p>
            </form>
          )}

          {activeTab === 'register' && (
            <form className={styles.formContainer} onSubmit={handleRegisterSubmit}>
              <h2 className={styles.cardTitle}>Tạo tài khoản mới</h2>
              {registerApiError && (
                <p className={styles.errorText} role="alert">
                  {registerApiError}
                </p>
              )}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-username">
                  Tên đăng nhập
                </label>
                <input
                  id="register-username"
                  className={`${styles.input} ${registerErrors.username ? styles.inputError : ''}`}
                  value={registerForm.username}
                  onChange={(event) => updateRegisterField('username', event.target.value)}
                  autoComplete="username"
                  placeholder="Ví dụ: player_01"
                />
                {registerErrors.username && (
                  <p className={styles.errorText} role="alert">
                    {registerErrors.username}
                  </p>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-name">
                  Họ và tên
                </label>
                <input
                  id="register-name"
                  className={`${styles.input} ${registerErrors.fullName ? styles.inputError : ''}`}
                  value={registerForm.full_name}
                  onChange={(event) => updateRegisterField('full_name', event.target.value)}
                  autoComplete="name"
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                />
                {registerErrors.fullName && (
                  <p className={styles.errorText} role="alert">
                    {registerErrors.fullName}
                  </p>
                )}
              </div>
              <div className={styles.twoColRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="register-email">
                    Email
                  </label>
                  <input
                    id="register-email"
                    className={`${styles.input} ${registerErrors.email ? styles.inputError : ''}`}
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => updateRegisterField('email', event.target.value)}
                    autoComplete="email"
                    placeholder="minhanh@gmail.com"
                  />
                  {registerErrors.email && (
                    <p className={styles.errorText} role="alert">
                      {registerErrors.email}
                    </p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="register-phone">
                    Số điện thoại
                  </label>
                  <input
                    id="register-phone"
                    className={`${styles.input} ${registerErrors.phone ? styles.inputError : ''}`}
                    type="tel"
                    value={registerForm.phone_number}
                    onChange={(event) => updateRegisterField('phone_number', event.target.value)}
                    autoComplete="tel"
                    placeholder="0912345678"
                  />
                  {registerErrors.phone && (
                    <p className={styles.errorText} role="alert">
                      {registerErrors.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="register-password">
                  Mật khẩu
                </label>
                <input
                  id="register-password"
                  className={`${styles.input} ${registerErrors.password ? styles.inputError : ''}`}
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => updateRegisterField('password', event.target.value)}
                  autoComplete="new-password"
                  placeholder="8-32 ký tự, gồm chữ và số"
                />
                {registerErrors.password && (
                  <p className={styles.errorText} role="alert">
                    {registerErrors.password}
                  </p>
                )}
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={registerLoading}>
                {registerLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản và nhận mã'}
              </button>
              <p className={styles.cardFooterText}>
                Đã có tài khoản?{' '}
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
            <form className={styles.formContainer} onSubmit={handleVerifyOtpSubmit}>
              <h2 className={styles.cardTitle}>Xác thực email</h2>
              {otpMessage && <div className={styles.infoBanner}>{otpMessage}</div>}
              {USE_MOCK_AUTH && (
                <div className={styles.testOtpHint}>
                  Mã thử nghiệm cục bộ: <strong>123456</strong>
                </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="otp-email">
                  Địa chỉ email
                </label>
                <input
                  id="otp-email"
                  className={styles.input}
                  type="email"
                  value={otpEmail}
                  onChange={(event) => setOtpEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="otp-code">
                  Mã xác thực 6 chữ số
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
                {otpError && <p className={styles.errorText}>{otpError}</p>}
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={otpLoading}>
                {otpLoading ? 'Đang xác thực...' : 'Xác thực mã'}
              </button>
              <p className={styles.cardFooterText}>
                Chưa nhận được mã?{' '}
                <button
                  type="button"
                  className={styles.inlineSwitchBtn}
                  disabled={cooldown > 0}
                  onClick={handleResendOtp}
                >
                  {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
                </button>
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
