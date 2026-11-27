import { uiMessage } from '../../utils/formatters';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { useAuth } from '../../hooks/useAuth';
import { fieldError, messages, normalizeName, otpSendError, otpSent, validEmail, validName, validPassword, validPhone, validUsername } from '../../api/f1Rules';
import { Button, FormField, Input, Tabs, PasswordField, OtpInput } from '../../components/common';
import styles from './AuthPage.module.css';
import courtPhoto from '../../assets/badminton-court.jpg';

export default function AuthPage() {
  const location = useLocation();
  const cardRef = useRef(null);
  const {
    user: currentUser,
    login: loginApi,
    registerPlayer: registerPlayerApi,
    verifyOtp: verifyOtpApi,
    resendOtp: resendOtpApi,
    forgotPassword: forgotPasswordApi,
    resetPassword: resetPasswordApi,
  } = useAuth();
  // Tab: 'login' (UC02) | 'register' (UC01) | 'otp' (DR25)
  const [requestedTab, setActiveTab] = useState(
    location.state?.isSignUp || new URLSearchParams(location.search).get('mode') === 'register'
      ? 'register'
      : 'login'
  );
  const activeTab = currentUser && requestedTab === 'register' ? 'login' : requestedTab;

  useEffect(() => {
    if (activeTab === 'otp') cardRef.current?.querySelector('h1')?.focus();
  }, [activeTab]);

  // State UC02: Đăng nhập
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerConfirmation, setRegisterConfirmation] = useState('');
  const [otpDeadlines, setOtpDeadlines] = useState({});
  const [sentTimes, setSentTimes] = useState({});
  const [loginError, setLoginError] = useState('');
  const [loginFields, setLoginFields] = useState({});
  const [loginNotice, setLoginNotice] = useState(location.state?.passwordChanged ? messages.changed : location.state?.notice || '');
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpFields, setOtpFields] = useState({});
  const [sendError, setSendError] = useState('');
  const [registrationExpired, setRegistrationExpired] = useState(false);
  const resettingPassword = otpPurpose === 'RESET_PASSWORD';
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldowns, setCooldowns] = useState({});
  const [clock, setClock] = useState(Date.now);
  const otpKey = otpPurpose + ':' + otpEmail.trim().toLowerCase();
  const cooldown = Math.max(0, Math.ceil(((cooldowns[otpKey] ?? 0) - clock) / 1000));
  const otpSeconds = Math.max(0, Math.ceil(((otpDeadlines[otpKey] ?? clock) - clock) / 1000));
  const emailSendTimes = sentTimes[otpEmail.trim().toLowerCase()] || [];
  const observedRemaining = Math.max(0, Math.min(5 - emailSendTimes.filter(time => clock - time < 3_600_000).length, 10 - emailSendTimes.filter(time => clock - time < 86_400_000).length));
  const hasCooldown = Object.keys(cooldowns).length > 0 || Object.keys(otpDeadlines).length > 0;
  function recordOtpSent(email, purpose, sentAt, preserveDeadline = false) {
    const key = purpose + ':' + email.trim().toLowerCase();
    setOtpDeadlines(current => ({ ...current, [key]: preserveDeadline && current[key] ? current[key] : sentAt + 600_000 }));
    setSentTimes(current => ({ ...current, [email.trim().toLowerCase()]: [...(current[email.trim().toLowerCase()] || []), sentAt] }));
  }
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
    if (loginLoading) return;
    setLoginError('');
    setLoginNotice('');

    const errors = {};
    errors.identity = fieldError(loginIdentity, 'tên đăng nhập hoặc email', (value) =>
      !value.includes('@') || validEmail(value));
    errors.password = fieldError(loginPassword, 'mật khẩu');
    setLoginFields(errors);
    if (Object.values(errors).some(Boolean)) return;

    setLoginLoading(true);
    try {
      await loginApi({ username_or_email: loginIdentity, password: loginPassword });
    } catch (error) {
      const errors = error.response?.data?.errors;
      if (errors) setLoginFields({ identity: errors.email, password: errors.password });
      else setLoginError(error.response?.data?.message?.includes('MSG10') ? 'Thông tin đăng nhập không đúng.'
        : error.response?.data?.message?.includes('MSG11') ? 'Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.'
        : error.response?.data?.message || 'Không thể đăng nhập. Vui lòng thử lại.');
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
    confirmation: fieldError(registerConfirmation, 'xác nhận mật khẩu') || (registerConfirmation !== registerForm.password ? 'Xác nhận mật khẩu không khớp.' : undefined),
  });

  // UC01: Xử lý đăng ký Player (POST /api/auth/register)
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    if (currentUser || registerLoading) return;
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
        setRegisterConfirmation('');
        setOtpMessage(otpSent(response.data.email));
        setRegistrationExpired(false);
        setOtpFields({});
        setSendError('');
        setOtpCode('');
        setOtpError('');
        const sentAt = Date.now();
        recordOtpSent(response.data.email, 'REGISTER', sentAt);
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
    if (otpLoading || otpSending || registrationExpired || (resettingPassword && !resetCodeSent)) return;
    const errors = {
      otp: fieldError(otpCode, 'mã xác minh', (value) => /^\d{6}$/.test(value)),
      password: resettingPassword ? fieldError(newPassword, 'mật khẩu mới', validPassword) : undefined,
      confirmation: resettingPassword
        ? fieldError(confirmPassword, 'xác nhận mật khẩu mới') ||
          (confirmPassword !== newPassword ? 'Xác nhận mật khẩu mới không khớp.' : undefined)
        : undefined,
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
      setConfirmPassword('');
      if (!resettingPassword) setPendingRegistrationEmail('');
      setLoginNotice(resettingPassword ? messages.reset : messages.verified);
      setActiveTab('login');
    } catch (error) {
      const response = error.response?.data;
      const message = response?.message || 'Không thể xác minh mã. Vui lòng thử lại.';
      const byField = Object.fromEntries(
        Object.entries({ email: 'email', otp: 'otp', newPassword: 'password' })
          .filter(([name]) => response?.errors?.[name])
          .map(([name, target]) => [target, response.errors[name]])
      );
      if (!Object.keys(byField).length && /MSG96|mã xác (minh|thực)/i.test(message)) byField.otp = message;
      setOtpFields(byField);
      setOtpError(Object.keys(byField).length ? '' : message);
      if (!resettingPassword && message.includes('Vui lòng đăng ký lại')) {
        setOtpError(message);
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
    setConfirmPassword('');
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
      setOtpMessage(resettingPassword ? messages.forgot : 'Đã gửi lại mã xác minh tới ' + email + '. Vui lòng dùng mã mới nhất.');
      setOtpCode('');
      const sentAt = Date.now();
      recordOtpSent(email, otpPurpose, sentAt, !resettingPassword);
      setClock(sentAt);
      setCooldowns((current) => ({ ...current, [otpKey]: sentAt + 60_000 }));
    } catch (error) {
      const message = otpSendError(error);
      const emailError = error.response?.data?.errors?.email;
      if (emailError) setOtpFields((current) => ({ ...current, email: emailError }));
      setSendError(emailError ? '' : message);
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

  const busy = loginLoading || registerLoading || otpLoading || otpSending;
  const cleanError = value => value ? uiMessage(value) : undefined;
  const loginForm = <form className={styles.formContainer} onSubmit={handleLoginSubmit} noValidate aria-busy={loginLoading}>
    <div className={styles.cardHeader}>
    <p className={styles.eyebrow}>SẴN SÀNG RA SÂN</p>
    <h1>Chào mừng trở lại.</h1>
    <p>Đăng nhập để tiếp tục lịch chơi của bạn.</p>
    </div>
    {loginNotice && <p role="status" className={styles.notice}>{uiMessage(loginNotice)}</p>}
    <FormField label="Tên đăng nhập hoặc email" required error={cleanError(loginFields.identity)}>
      <Input id="login-identity" autoComplete="username" value={loginIdentity} placeholder="Nhập tên đăng nhập hoặc email" onChange={event => { setLoginIdentity(event.target.value); setLoginFields(fields => ({ ...fields, identity: undefined })); setLoginError(''); }} />
    </FormField>
    <div>
    <PasswordField id="login-password" value={loginPassword} autoComplete="current-password" error={cleanError(loginFields.password)} onChange={event => { setLoginPassword(event.target.value); setLoginFields(fields => ({ ...fields, password: undefined })); setLoginError(''); }} />
      <Button className={styles.forgot} variant="ghost" disabled={busy} onClick={() => openOtpForm('RESET_PASSWORD')}>Quên mật khẩu?</Button>
    </div>
    {loginError && <p role="alert" className={styles.errorBanner}>{uiMessage(loginError)}</p>}
    <Button type="submit" loading={loginLoading} className={styles.submit}>Đăng nhập</Button>
    {!currentUser && <p className={styles.cardFooter}>Bạn chưa có tài khoản? <Button variant="ghost" disabled={busy} onClick={() => setActiveTab('register')}>Đăng ký ngay</Button>
    </p>}
  </form>;
  const registerFormView = <form className={styles.formContainer} onSubmit={handleRegisterSubmit} noValidate aria-busy={registerLoading}>
    <div className={styles.cardHeader}>
    <p className={styles.eyebrow}>BẮT ĐẦU LỊCH CHƠI MỚI</p>
    <h1>Tạo tài khoản người chơi</h1>
    <p>Xác thực email để hoàn tất. Chỉ mất vài bước.</p>
    </div>
    <div className={styles.twoColRow}>
      <FormField label="Tên đăng nhập" required error={cleanError(registerFields.username)} hint="6–32 ký tự, bắt đầu bằng chữ thường.">
    <Input id="register-username" autoComplete="username" value={registerForm.username} placeholder="nguyenminhanh" onChange={event => updateRegisterField('username', event.target.value)} />
    </FormField>
      <FormField label="Họ và tên" required error={cleanError(registerFields.full_name)}>
    <Input id="register-name" autoComplete="name" value={registerForm.full_name} placeholder="Nguyễn Minh Anh" onChange={event => updateRegisterField('full_name', event.target.value)} />
    </FormField>
    </div>
    <FormField label="Email" required error={cleanError(registerFields.email)}>
    <Input id="register-email" type="email" autoComplete="email" value={registerForm.email} placeholder="ban@example.com" onChange={event => updateRegisterField('email', event.target.value)} />
    </FormField>
    <FormField label="Số điện thoại" required error={cleanError(registerFields.phone_number)} hint="10 chữ số, bắt đầu bằng 0.">
    <Input id="register-phone" type="tel" autoComplete="tel" value={registerForm.phone_number} placeholder="0912345678" onChange={event => updateRegisterField('phone_number', event.target.value)} />
    </FormField>
    <PasswordField id="register-password" autoComplete="new-password" value={registerForm.password} error={cleanError(registerFields.password)} hint="8–32 ký tự, gồm chữ và số, không có khoảng trắng." strength onChange={event => updateRegisterField('password', event.target.value)} />
    <PasswordField id="register-confirm" label="Nhập lại mật khẩu" autoComplete="new-password" value={registerConfirmation} error={cleanError(registerFields.confirmation)} onChange={event => { setRegisterConfirmation(event.target.value); setRegisterFields(fields => ({ ...fields, confirmation: undefined })); }} />
    {registerError && <p role="alert" className={styles.errorBanner}>{uiMessage(registerError)}</p>}
    <p className={styles.helper}>Tài khoản chỉ được tạo sau khi bạn nhập đúng mã xác thực qua email.</p>
    <Button type="submit" loading={registerLoading} className={styles.submit}>Đăng ký và nhận mã</Button>
    <p className={styles.cardFooter}>Bạn đã có tài khoản? <Button variant="ghost" disabled={busy} onClick={() => setActiveTab('login')}>Đăng nhập</Button>
    </p>
  </form>;
  return <PublicLayout fullWidth hideHeader hideFooter>
    <div className={styles.splitLayout}>
    <aside className={styles.leftPanel} aria-label="Giới thiệu Courtly">
      <img className={styles.courtPhoto} src={courtPhoto} width="1600" height="900" alt="" fetchPriority="high" />
      <Link className={styles.brand} to="/">
    <span aria-hidden="true" className={styles.brandIcon}>C</span>Courtly<span className={styles.brandTag}>CẦU LÔNG · KẾT NỐI</span>
    </Link>
      <div className={styles.heroCopy}>
    <p className={styles.heroEyebrow}>MỖI TRẬN ĐẤU, MỘT KẾT NỐI.</p>
    <h2>Hẹn nhau<br />trên sân.</h2>
    <p>Từ một lịch hẹn đến những trận cầu đáng nhớ.<br />Bắt đầu cùng Courtly.</p>
        <ul className={styles.benefits}>
    <li>
    <span aria-hidden="true">01</span>
    <div>
    <strong>Tìm sân phù hợp</strong>
    <p>Nhiều địa điểm, dễ dàng lựa chọn.</p>
    </div>
    </li>
    <li>
    <span aria-hidden="true">02</span>
    <div>
    <strong>Chủ động lịch chơi</strong>
    <p>Đặt sân và theo dõi lịch trong một tài khoản.</p>
    </div>
    </li>
    <li>
    <span aria-hidden="true">03</span>
    <div>
    <strong>Kết nối đồng đội</strong>
    <p>Khám phá những kèo cầu lông đang mở.</p>
    </div>
    </li>
    </ul>
      </div>
    <footer className={styles.photoCredit}>Ảnh: <a href="https://commons.wikimedia.org/wiki/File:Indoor_badminton_court.jpg">Alanands3</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
    </footer>
    </aside>
    <div className={styles.rightPanel}>
    <div className={styles.topBar}>
    <Link to="/">← Về trang chủ</Link>
    <span>Courtly / Tài khoản</span>
    </div>
      <section ref={cardRef} className={styles.authCard} aria-label="Xác thực tài khoản">
        {activeTab !== 'otp' ? <>
    <Tabs label="Thao tác tài khoản" value={activeTab} onChange={setActiveTab} items={[
          { value: 'login', label: 'Đăng nhập', disabled: busy, content: activeTab === 'login' ? loginForm : null },
          ...(!currentUser ? [{ value: 'register', label: 'Đăng ký', disabled: busy, content: activeTab === 'register' ? registerFormView : null }] : []),
        ]} />{pendingRegistrationEmail && <Button variant="ghost" className={styles.resume} disabled={busy} onClick={() => openOtpForm('REGISTER')}>Tiếp tục xác thực email</Button>}</> :
        <form className={styles.formContainer} onSubmit={event => { if (resettingPassword && !resetCodeSent) { event.preventDefault(); handleSendOtp(); } else handleVerifyOtpSubmit(event); }} noValidate aria-busy={otpLoading || otpSending}>
          <Button variant="ghost" className={styles.back} disabled={busy} onClick={() => setActiveTab(resettingPassword ? 'login' : 'register')}>← Quay lại {resettingPassword ? 'đăng nhập' : 'đăng ký'}</Button>
          <div className={styles.cardHeader}>
    <p className={styles.eyebrow}>BẢO MẬT TÀI KHOẢN</p>
    <h1 tabIndex={-1}>{resettingPassword ? 'Đặt lại mật khẩu' : 'Xác thực email'}</h1>
    <p>{resettingPassword && !resetCodeSent ? 'Nhập email đã đăng ký để nhận mã đặt lại mật khẩu.' : 'Kiểm tra hộp thư đến và thư rác để lấy mã xác thực.'}</p>
    </div>
          <ol className={styles.steps} aria-label="Các bước xác thực">
    <li data-active={resettingPassword && !resetCodeSent}>1. {resettingPassword ? 'Email' : 'Thông tin'}</li>
    <li data-active={!resettingPassword || resetCodeSent}>2. {resettingPassword ? 'Xác thực & mật khẩu mới' : 'Xác thực email'}</li>
    </ol>
          {otpMessage && <p role="status" className={styles.notice}>{uiMessage(otpMessage)}</p>}
          <FormField label="Địa chỉ email" error={cleanError(otpFields.email)} required>
    <Input id="otp-email" type="email" autoComplete="email" value={otpEmail} readOnly={!resettingPassword || resetCodeSent} onChange={event => setOtpEmail(event.target.value)} />
    </FormField>
          {!registrationExpired && (!resettingPassword || resetCodeSent) && <>
            <OtpInput value={otpCode} onChange={setOtpCode} error={cleanError(otpFields.otp)} disabled={busy} />
            <p className={styles.timer} role="timer" aria-live="off">{otpSeconds > 0 ? <>Mã có hiệu lực trong <strong>{String(Math.floor(otpSeconds / 60)).padStart(2, '0')}:{String(otpSeconds % 60).padStart(2, '0')}</strong>
    </> : 'Mã có thể đã hết hạn. Máy chủ sẽ kiểm tra khi xác thực.'}</p>
            {resettingPassword && <>
    <PasswordField id="reset-password" label="Mật khẩu mới" autoComplete="new-password" value={newPassword} error={cleanError(otpFields.password)} hint="8–32 ký tự, gồm chữ và số, không có khoảng trắng." strength onChange={event => setNewPassword(event.target.value)} />
    <PasswordField id="reset-confirm" label="Xác nhận mật khẩu mới" autoComplete="new-password" value={confirmPassword} error={cleanError(otpFields.confirmation)} onChange={event => setConfirmPassword(event.target.value)} />
    </>}
            <Button type="submit" loading={otpLoading} disabled={otpSending} className={styles.submit}>{resettingPassword ? 'Đặt lại mật khẩu' : 'Xác thực mã'}</Button>
          </>}
          {otpError && <p role="alert" className={styles.errorBanner}>{uiMessage(otpError)}</p>}
          <div className={styles.otpActions}>{registrationExpired ? <>
    <p className={styles.helper}>Yêu cầu đăng ký đã hết hạn. Vui lòng nhập lại thông tin để nhận mã mới.</p>
    <Button variant="secondary" onClick={() => setActiveTab('register')}>Đăng ký lại</Button>
    </> : <>
            <Button variant={resettingPassword && !resetCodeSent ? 'primary' : 'ghost'} loading={otpSending} disabled={cooldown > 0 || otpLoading} onClick={handleSendOtp}>{cooldown > 0 ? `Gửi lại sau ${cooldown} giây` : resettingPassword && !resetCodeSent ? 'Gửi mã đặt lại mật khẩu' : 'Gửi lại mã'}</Button>
            {emailSendTimes.length > 0 && <p className={styles.helper}>Còn tối đa {observedRemaining} lượt gửi theo ghi nhận trong phiên này. Giới hạn máy chủ: 5 lượt/giờ, 10 lượt/ngày cho mỗi email.</p>}
          </>}</div>{sendError && <p role="alert" className={styles.errorBanner}>{uiMessage(sendError)}</p>}
        </form>}
      </section>
    <p className={styles.bottomNote}>Sẵn sàng cho trận cầu tiếp theo của bạn.</p>
    </div>
  </div>
    </PublicLayout>;
}
