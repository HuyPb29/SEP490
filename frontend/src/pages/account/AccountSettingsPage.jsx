import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { changePasswordApi } from '../../api/authApi';
import styles from '../auth/AuthPage.module.css';

function loadUserInfo() {
  try {
    return JSON.parse(localStorage.getItem('bms_user_info') || 'null');
  } catch {
    return null;
  }
}

export default function AccountSettingsPage() {
  const [userInfo] = useState(loadUserInfo);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const role = String(userInfo?.role_code || userInfo?.role || '').toLowerCase();
  const isStaff = role === 'staff';
  const canChangePassword = role === 'player' || role === 'owner';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu phải trùng nhau.");
      return;
    }
    if (
      newPassword.length < 8 || newPassword.length > 32 ||
      !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword) || /\s/.test(newPassword)
    ) {
      setError("Mật khẩu phải có 8–32 ký tự, gồm ít nhất một chữ cái và một chữ số, không chứa khoảng trắng.");
      return;
    }

    setSaving(true);
    try {
      const response = await changePasswordApi({ currentPassword, newPassword });
      setNotice(response.message || "Đổi mật khẩu thành công.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Không thể đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      <Header />
      <div className={styles.splitLayout} style={{ flex: 1 }}>
        <aside className={styles.leftPanel}>
        <div className={styles.brandHeader}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>Courtly</span>
        </div>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroHeading}>Cài đặt tài khoản</h1>
          <p className={styles.heroDescription}>Quản lý thông tin đăng nhập của bạn.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <section className={styles.authCard}>
          <h2 className={styles.cardTitle}>Đổi mật khẩu</h2>
          {userInfo && <p className={styles.stepDescription}>Đang đăng nhập bằng tài khoản {userInfo.username || userInfo.email}</p>}

          {!userInfo && (
            <div className={styles.infoBanner} role="status">
              Đăng nhập để quản lý tài khoản. <Link className={styles.greenLinkBold} to="/login">Đăng nhập</Link>
            </div>
          )}

          {isStaff && (
            <div className={styles.infoBanner} role="note">
              Tài khoản nhân viên không thể đổi mật khẩu tại đây. Vui lòng liên hệ chủ sân để được cấp mật khẩu mới.
            </div>
          )}

          {userInfo && !isStaff && !canChangePassword && (
            <div className={styles.infoBanner} role="note">
              Chức năng đổi mật khẩu dành cho người chơi và chủ sân.
            </div>
          )}

          {userInfo && canChangePassword && (
            <form className={styles.formContainer} onSubmit={handleSubmit}>
              {notice && <div className={styles.infoBanner} role="status">{notice}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="current-password">Mật khẩu hiện tại</label>
                <input
                  id="current-password"
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => { setCurrentPassword(event.target.value); setError(''); setNotice(''); }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="new-password">Mật khẩu mới</label>
                <input
                  id="new-password"
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => { setNewPassword(event.target.value); setError(''); setNotice(''); }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
                <input
                  id="confirm-password"
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => { setConfirmPassword(event.target.value); setError(''); setNotice(''); }}
                  required
                />
              </div>
              {error && <p className={styles.errorText} role="alert">{error}</p>}
              <button className={styles.primaryBtn} type="submit" disabled={saving}>
                {saving ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
              </button>
            </form>
          )}
          <p className={styles.cardFooterText}><Link className={styles.greenLinkBold} to="/">Quay lại tìm địa điểm</Link></p>
        </section>
      </main>
      </div>
    </div>
  );
}
