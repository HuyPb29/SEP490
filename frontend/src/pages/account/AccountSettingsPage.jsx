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
      setError('New Password and Confirm New Password must match.');
      return;
    }
    if (
      newPassword.length < 8 || newPassword.length > 32 ||
      !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword) || /\s/.test(newPassword)
    ) {
      setError('Password must be 8-32 characters, include at least one letter and one number, and contain no spaces.');
      return;
    }

    setSaving(true);
    try {
      const response = await changePasswordApi({ currentPassword, newPassword });
      setNotice(response.message || 'MSG114: Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not change the password.');
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
          <h1 className={styles.heroHeading}>Account Settings</h1>
          <p className={styles.heroDescription}>Manage your sign-in credentials.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <section className={styles.authCard}>
          <h2 className={styles.cardTitle}>Change Password</h2>
          {userInfo && <p className={styles.stepDescription}>Signed in as {userInfo.username || userInfo.email}</p>}

          {!userInfo && (
            <div className={styles.infoBanner} role="status">
              Sign in to manage your account. <Link className={styles.greenLinkBold} to="/login">Sign in</Link>
            </div>
          )}

          {isStaff && (
            <div className={styles.infoBanner} role="note">
              Staff accounts cannot change passwords here. Please contact your Location Owner to issue a new password.
            </div>
          )}

          {userInfo && !isStaff && !canChangePassword && (
            <div className={styles.infoBanner} role="note">
              Password changes are available to Player and Owner accounts.
            </div>
          )}

          {userInfo && canChangePassword && (
            <form className={styles.formContainer} onSubmit={handleSubmit}>
              {notice && <div className={styles.infoBanner} role="status">{notice}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="current-password">Current Password</label>
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
                <label className={styles.label} htmlFor="new-password">New Password</label>
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
                <label className={styles.label} htmlFor="confirm-password">Confirm New Password</label>
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
                {saving ? 'Updating password...' : 'Change Password'}
              </button>
            </form>
          )}
          <p className={styles.cardFooterText}><Link className={styles.greenLinkBold} to="/">Back to locations</Link></p>
        </section>
      </main>
      </div>
    </div>
  );
}
