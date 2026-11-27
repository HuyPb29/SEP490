import { Button as UiButton, Input as UiInput, Select as UiSelect, ScrollArea, ActionMenu } from '../../components/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import api, { apiErrorMessage, getAllPages } from '../../api';
import { fieldError, messages, normalizeName, validName, validPassword, validUsername } from '../../api/f1Rules';
import { clearSession, getSavedUser, getToken, saveSession } from '../../api/session';
import { Avatar, Button, FormField, Input, Select, StatusBadge, LoadingState, ErrorState, Toast, EmptyState as SharedEmptyState } from '../../components/common';
import { SKILL_LEVELS } from '../../utils/skillLevels';
import { Inbox } from '../NotificationsPage';
import WorkspaceLayout, { EmptyState, Modal, Section } from '../WorkspaceLayout';
import { useResource } from '../workspaceSupport';
import AccountForm from './AccountForm';
import styles from './AccountPages.module.css';
import adminStyles from './AdminAccounts.module.css';
import AdminLayout from '../../components/layout/AdminLayout';
import { Drawer } from '../../components/common/Drawer';
import { Modal as CommonModal } from '../../components/common/Modal';

const loadProfile = (signal) => api.get('/users/me', { signal }).then((response) => response.data.data);
const loadStaff = (signal) => api.get('/owner/staff-members', { signal }).then((response) => response.data.data);

const roles = { PLAYER: 'Người chơi', STAFF: 'Nhân viên', OWNER: 'Chủ sân', ADMIN: 'Quản trị viên' };
const accountStatuses = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', DISABLED: 'Đã vô hiệu hóa' };

function AccountDetails({ account, className = '' }) {
  const facts = [
    ['Họ và tên', account.fullName],
    ['Tên đăng nhập', account.username],
    ['Email', account.email],
    ['Số điện thoại', account.phone],
    ['Vai trò', roles[account.role] ?? account.role],
    [
      'Trạng thái',
      <StatusBadge key="status" status={account.status} category="account" />,
    ],
  ];
  if (account.role === 'PLAYER') facts.splice(4, 0, ['Trình độ chơi', account.skillLevel]);
  if (account.locationId) facts.push(['Địa điểm', '#' + account.locationId]);
  return (
    <dl className={className || 'cw-facts'}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Hộp thoại sửa hồ sơ: họ tên cho mọi vai trò, thêm trình độ chơi cho Player. Lưu xong trả hồ sơ mới. */
function EditProfileDialog({ account, onClose, onSaved }) {
  const titleId = useId();
  const nameId = useId();
  const skillId = useId();
  const isPlayer = account.role === 'PLAYER';
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const lock = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (lock.current) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const nameError = fieldError(values.fullName, 'họ và tên', validName);
    setErrors({ fullName: nameError });
    if (nameError) return;

    const payload = { fullName: normalizeName(values.fullName) };
    // Chỉ gửi khi đã chọn: backend chỉ nhận 4 mức (DR33), để trống thì giữ nguyên trình độ đang có.
    if (isPlayer && values.skillLevel) payload.skillLevel = values.skillLevel;
    lock.current = true;
    setBusy(true);
    try {
      const response = await api.patch('/users/me', payload);
      const updated = response.data.data;
      // Cập nhật phiên đăng nhập để tên trên thanh điều hướng đổi theo ngay.
      if (updated && getToken()) saveSession({ token: getToken(), user: updated });
      onSaved(updated);
    } catch (error) {
      const response = error.response?.data;
      const byField = Object.fromEntries(
        ['fullName', 'skillLevel']
          .filter((name) => response?.errors?.[name])
          .map((name) => [name, response.errors[name]])
      );
      setErrors(Object.keys(byField).length ? byField
        : { form: response?.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.' });
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
      <form noValidate onSubmit={handleSubmit} className={styles.editForm}>
        <div><h2 id={titleId}>Sửa thông tin</h2><p className={styles.description}>Cập nhật thông tin hiển thị trên hồ sơ của bạn.</p></div>
        <fieldset disabled={busy} className={styles.dialogFields}>
          <FormField htmlFor={nameId} label="Họ và tên" required error={errors.fullName}>
            <Input
              id={nameId}
              name="fullName"
              defaultValue={account.fullName}
              autoComplete="name"
              maxLength={50}
              invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? `${nameId}-error` : undefined}
              autoFocus
            />
          </FormField>
          {isPlayer && (
            <FormField htmlFor={skillId} label="Trình độ chơi" error={errors.skillLevel}>
              <Select id={skillId} name="skillLevel" defaultValue={SKILL_LEVELS.includes(account.skillLevel) ? account.skillLevel : ''}
                invalid={Boolean(errors.skillLevel)} aria-describedby={errors.skillLevel ? `${skillId}-error` : undefined}>
                <option value="" disabled>Chọn trình độ</option>
                {SKILL_LEVELS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Tên đăng nhập" hint="Chỉ đọc"><Input value={account.username || ''} readOnly /></FormField>
          <FormField label="Email" hint="Chỉ đọc"><Input value={account.email || ''} readOnly /></FormField>
          <FormField label="Số điện thoại" hint="Chỉ đọc"><Input value={account.phone || ''} readOnly /></FormField>
          <p className={styles.dialogHint}>
            Tên đăng nhập, email và số điện thoại không đổi được tại đây.
          </p>
        </fieldset>
        {errors.form && <Toast tone="danger">{errors.form}</Toast>}
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Quay lại</Button>
          <Button type="submit" loading={busy}>Lưu thay đổi</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileView() {
  const profile = useResource(loadProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const account = profile.data;
  const editButton = useRef(null);
  useEffect(() => {
    if (saved && !profile.loading && !profile.error) editButton.current?.focus({ preventScroll: true });
  }, [saved, profile.loading, profile.error]);

  return (
    <section className={styles.panel} aria-label="Hồ sơ của tôi">
      <div className={styles.sectionHeading}><h2>Hồ sơ của tôi</h2><p>Thông tin cá nhân và trình độ chơi của bạn.</p></div>
      {saved && <Toast>{messages.saved}</Toast>}
      {profile.loading ? <LoadingState message="Đang tải hồ sơ…" /> : profile.error ? <ErrorState message={profile.error} onRetry={profile.reload} /> : account ? (
        <>
          <div className={styles.profileHead}>
            <Avatar name={account.fullName || account.username} className={styles.profileAvatar} />
            <div className={styles.profileName}>
              <strong>{account.fullName || account.username}</strong>
              <span>@{account.username} · {roles[account.role] ?? account.role}</span>
            </div>
            <Button ref={editButton} variant="primary" onClick={() => { setSaved(false); setEditing(true); }}>
              Sửa thông tin
            </Button>
          </div>
          <AccountDetails account={account} className={styles.profileFacts} />
          <p className={styles.readonlyNote}>Tên đăng nhập, email và số điện thoại chỉ đọc. Bạn có thể sửa họ tên{account.role === 'PLAYER' ? ' và trình độ chơi' : ''}.</p>
        </>
      ) : <SharedEmptyState title="Chưa tải được thông tin hồ sơ" description="Tải lại để lấy thông tin tài khoản của bạn." action={<Button variant="secondary" onClick={profile.reload}>Tải lại hồ sơ</Button>} />}
      {editing && account && (
        <EditProfileDialog
          account={account}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
            profile.reload();
          }}
        />
      )}
    </section>
  );
}

function ChangePasswordView() {
  const navigate = useNavigate();
  return (
        <section className={styles.panel} aria-label="Đổi mật khẩu">
          <div className={styles.sectionHeading}><h2>Đổi mật khẩu</h2><p>Giữ tài khoản an toàn bằng mật khẩu riêng, khó đoán.</p></div>
          <p className={styles.securityNote}>Sau khi đổi mật khẩu, bạn sẽ cần đăng nhập lại.</p>
          <AccountForm
            className={styles.passwordForm}
            label="Đổi mật khẩu"
            fields={[
              {
                name: 'currentPassword',
                label: 'Mật khẩu hiện tại',
                type: 'password',
                autoComplete: 'current-password',
                required: true,
              },
              {
                name: 'newPassword',
                label: 'Mật khẩu mới',
                type: 'password',
                autoComplete: 'new-password',
                required: true,
                validate: validPassword,
                hint: '8–32 ký tự, gồm ít nhất một chữ cái và một chữ số, không chứa khoảng trắng.',
              },
              {
                name: 'confirmation',
                label: 'Xác nhận mật khẩu mới',
                type: 'password',
                autoComplete: 'new-password',
                required: true,
              },
            ]}
            submit={(form) => api.post('/users/me/password', form)}
            after={() => {
              clearSession();
              navigate('/login', { replace: true, state: { passwordChanged: true } });
            }}
          />
        </section>
  );
}

function NotificationsView() {
  return <Inbox title="Thông báo của tôi" />;
}

const ACCOUNT_SECTIONS = {
  profile: { to: '/account', label: 'Hồ sơ', description: 'Thông tin cá nhân', view: ProfileView },
  password: { to: '/account/password', label: 'Mật khẩu', description: 'Bảo mật tài khoản', view: ChangePasswordView },
  notifications: { to: '/account/notifications', label: 'Thông báo', description: 'Hoạt động mới nhất', view: NotificationsView },
};

/** Trang tài khoản của Player/Owner: thanh điều hướng bên trái giữa hồ sơ, đổi mật khẩu và thông báo. */
export function AccountPage({ section = 'profile' }) {
  const user = getSavedUser();
  if (user && !['player', 'owner'].includes(user.role_code)) return <Navigate to="/notifications" replace />;
  const current = ACCOUNT_SECTIONS[section] ?? ACCOUNT_SECTIONS.profile;
  const View = current.view;
  return (
    <WorkspaceLayout title="Tài khoản của tôi" description="Quản lý hồ sơ, mật khẩu và thông báo của bạn.">
      <div className={styles.accountShell}>
        <nav className={styles.accountNav} aria-label="Tài khoản">
          {Object.values(ACCOUNT_SECTIONS).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `${styles.accountNavLink} ${isActive ? styles.accountNavLinkActive : ''}`}
            >
              <span>{item.label}<small>{item.description}</small></span><span className={styles.navArrow} aria-hidden="true">›</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.accountContent}>
          <View />
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function StaffAccounts() {
  const staff = useResource(loadStaff);
  return (
    <Section title="Nhân viên tại địa điểm" resource={staff}>
      <details>
        <summary>Thêm nhân viên</summary>
        <AccountForm
          label="Tạo tài khoản"
          fields={[
            {
              name: 'username',
              label: 'Tên đăng nhập',
              required: true,
              validate: validUsername,
              normalize: (value) => value.trim(),
            },
            { name: 'fullName', label: 'Họ và tên', required: true, validate: validName, normalize: normalizeName },
            {
              name: 'password',
              label: 'Mật khẩu ban đầu',
              type: 'password',
              autoComplete: 'new-password',
              required: true,
              validate: validPassword,
            },
          ]}
          submit={(form) => api.post('/owner/staff-members', form)}
          success={(result) => 'Đã tạo tài khoản nhân viên ' + result.data.data.fullName + '.'}
          after={staff.reload}
        />
      </details>
      {staff.data?.length === 0 && <EmptyState>Địa điểm này chưa có nhân viên.</EmptyState>}
      {staff.data?.map((item) => (
        <details key={item.id} className="space-y-3 border-t py-3">
          <summary>
            {item.fullName} · {item.username} · {accountStatuses[item.status] ?? item.status}
          </summary>
          <AccountDetails account={item} />
          {item.status === 'ACTIVE' && (
            <AccountForm
              label="Vô hiệu hóa"
              confirmation={'Vô hiệu hóa tài khoản ' + item.fullName + '? Người dùng sẽ không đăng nhập được nữa.'}
              fields={[{ name: 'reason', label: 'Lý do', maxLength: 500 }]}
              submit={(form) => api.patch('/owner/staff-members/' + item.id + '/status', { ...form, status: 'DISABLED' })}
              after={staff.reload}
            />
          )}
          {item.status !== 'DISABLED' && (
            <AccountForm
              label="Cấp lại mật khẩu"
              fields={[
                {
                  name: 'newPassword',
                  label: 'Mật khẩu mới',
                  type: 'password',
                  autoComplete: 'new-password',
                  required: true,
                  validate: validPassword,
                },
              ]}
              submit={(form) => api.post('/owner/staff-members/' + item.id + '/password', form)}
              success={() => 'Đã cấp lại mật khẩu nhân viên.'}
            />
          )}
        </details>
      ))}
    </Section>
  );
}

function formatAccountDate(value) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—';
}

const ROLE_TONE = { PLAYER: 'rolePlayer', OWNER: 'roleOwner', STAFF: 'roleStaff', ADMIN: 'roleAdmin' };
const STATUS_TONE = { ACTIVE: 'badgeSuccess', LOCKED: 'badgeDanger', DISABLED: 'badgeNeutral' };

/** UC04 #3, #4: Admin khóa (bắt buộc lý do) hoặc mở lại tài khoản; tài khoản Admin không khóa được. */
function AccountStatusDialog({ account, onClose, onDone }) {
  const unlocking = account.status === 'LOCKED';
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!unlocking && !reason.trim()) {
      setError('Vui lòng nhập lý do khóa tài khoản.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/accounts/' + account.id + '/status', {
        status: unlocking ? 'ACTIVE' : 'LOCKED',
        reason: reason.trim() || undefined,
      });
      onDone(unlocking ? 'Đã mở lại tài khoản ' + account.username + '.' : 'Đã khóa tài khoản ' + account.username + '.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Không cập nhật được trạng thái tài khoản.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <CommonModal title={(unlocking ? 'Mở lại tài khoản ' : 'Khóa tài khoản ') + account.username + '?'} busy={busy}
      onClose={onClose} className={adminStyles.modal}>
      <form className={adminStyles.form} onSubmit={submit} noValidate>
        <p className={adminStyles.muted}>{account.fullName} · {roles[account.role] ?? account.role}</p>
        <p className={unlocking ? adminStyles.info : adminStyles.warning}>
          {unlocking
            ? 'Người dùng đăng nhập lại được ngay sau khi mở.'
            : 'Người dùng sẽ bị đăng xuất và không đăng nhập được. Dữ liệu (booking, điểm, đánh giá) được giữ nguyên; Admin mở lại được bất cứ lúc nào.'}
        </p>
        <label className={adminStyles.field}>
          <span>{unlocking ? 'Ghi chú (không bắt buộc)' : 'Lý do khóa *'}</span>
          <textarea rows={3} maxLength={500} value={reason} disabled={busy} autoFocus
            onChange={(event) => { setReason(event.target.value); setError(''); }} />
          <small>Lý do được lưu vào lịch sử tài khoản.</small>
        </label>
        {error && <p className={adminStyles.error} role="alert">{error}</p>}
        <div className={adminStyles.actions}>
          <UiButton variant="custom" type="button" className={adminStyles.secondary} disabled={busy} onClick={onClose}>Hủy</UiButton>
          <UiButton variant="custom" type="submit" className={unlocking ? adminStyles.primary : adminStyles.danger} disabled={busy}>
            {busy ? 'Đang lưu…' : unlocking ? 'Mở lại tài khoản' : 'Khóa tài khoản'}
          </UiButton>
        </div>
      </form>
    </CommonModal>
  );
}

function AdminAccount({ id, onClose, onChangeStatus }) {
  const loadDetail = useCallback(
    (signal) => api.get('/admin/accounts/' + id, { signal }).then((response) => response.data.data),
    [id]
  );
  const detail = useResource(loadDetail, id);
  const account = detail.data;
  const canChange = ['ACTIVE', 'LOCKED'].includes(account?.status) && account.role !== 'ADMIN';
  return (
    <Drawer title={account ? account.username : 'Chi tiết tài khoản'} onClose={onClose}
      footer={canChange && (
        <div className={adminStyles.actions}>
          <UiButton variant="custom" type="button" className={account.status === 'LOCKED' ? adminStyles.primary : adminStyles.danger}
            onClick={() => onChangeStatus(account, detail.reload)}>
            {account.status === 'LOCKED' ? 'Mở lại tài khoản' : 'Khóa tài khoản…'}
          </UiButton>
        </div>
      )}>
      {detail.loading && <p className={adminStyles.muted} role="status">Đang tải chi tiết…</p>}
      {detail.error && <p className={adminStyles.error} role="alert">{detail.error}</p>}
      {account && (
        <>
          <div className={adminStyles.headRow}>
            <span className={`${adminStyles.role} ${adminStyles[ROLE_TONE[account.role]] ?? ''}`}>{roles[account.role] ?? account.role}</span>
            <span className={`${adminStyles.badge} ${adminStyles[STATUS_TONE[account.status]] ?? ''}`}>
              {accountStatuses[account.status] ?? account.status}
            </span>
          </div>
          <AccountDetails account={account} />
          <dl className={adminStyles.kv}>
            <dt>Ngày tạo</dt><dd>{formatAccountDate(account.createdAt)}</dd>
            <dt>Đăng nhập gần nhất</dt><dd>{formatAccountDate(account.lastLoginAt)}</dd>
            {account.locationId && <><dt>Địa điểm (Staff)</dt><dd>#{account.locationId}</dd></>}
          </dl>
          {account.role === 'ADMIN' && <p className={adminStyles.muted}>Không khóa được tài khoản quản trị viên.</p>}
          <p className={adminStyles.muted}>Admin không cấp lại mật khẩu; người dùng tự đặt lại qua email (BR59). Mật khẩu Staff do chủ sân cấp lại.</p>
        </>
      )}
    </Drawer>
  );
}

function Accounts() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);
  const [message, setMessage] = useState('');
  const load = useCallback(
    (signal) =>
      getAllPages('/admin/accounts', {
        signal,
        params: {
          role: role || undefined,
          status: status || undefined,
          search: search || undefined,
        },
      }),
    [role, status, search]
  );
  const accounts = useResource(load, load);
  const list = accounts.data ?? [];

  return (
    <>
      {message && <p className={adminStyles.success} role="status">{message}</p>}
      <section data-account-board className={`${adminStyles.board} ${adminStyles.accountsBoard}`} aria-label="Danh sách tài khoản">
        <div className={`${adminStyles.toolbar} ${adminStyles.accountToolbar}`}>
          <UiInput className={adminStyles.search} type="search" aria-label="Tìm tài khoản"
            placeholder="Tên đăng nhập, họ tên, email, SĐT…"
            onChange={(event) => setSearch(event.target.value.trim())} />
          <UiSelect className={adminStyles.select} aria-label="Lọc theo vai trò" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Vai trò: Tất cả</option>
            {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </UiSelect>
          <UiSelect className={adminStyles.select} aria-label="Lọc theo trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Trạng thái: Tất cả</option>
            {Object.entries(accountStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </UiSelect>
        </div>
        {accounts.loading && !accounts.data && <p className={adminStyles.empty} role="status">Đang tải tài khoản…</p>}
        {accounts.error && <p className={adminStyles.empty} role="alert">{accounts.error}</p>}
        {accounts.data && list.length === 0 && <p className={adminStyles.empty}>Không có tài khoản phù hợp.</p>}
        {list.length > 0 && (
          <ScrollArea label="Bảng danh sách tài khoản" className={adminStyles.accountsScroll}>
            <table className={`${adminStyles.table} ${adminStyles.accountTable}`}>
              <thead>
                <tr>
                  <th scope="col">Tên đăng nhập</th>
                  <th scope="col">Họ và tên</th>
                  <th scope="col">Email · SĐT</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Địa điểm (Staff)</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Đăng nhập gần nhất</th>
                  <th scope="col">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {list.map((account) => {
                  const canChange = ['ACTIVE', 'LOCKED'].includes(account.status) && account.role !== 'ADMIN';
                  return (
                    <tr key={account.id} className={String(account.id) === String(selected) ? adminStyles.rowOn : ''}>
                      <td data-label="Tên đăng nhập"><b>{account.username}</b></td>
                      <td data-label="Họ và tên">{account.fullName}</td>
                      <td data-label="Email · SĐT"><small>{account.email || 'không có email'}{account.phone ? <><br />{account.phone}</> : null}</small></td>
                      <td data-label="Vai trò"><span className={`${adminStyles.role} ${adminStyles[ROLE_TONE[account.role]] ?? ''}`}>{roles[account.role] ?? account.role}</span></td>
                      <td data-label="Địa điểm (Staff)">{account.locationId ? '#' + account.locationId : '—'}</td>
                      <td data-label="Trạng thái">
                        <span className={`${adminStyles.badge} ${adminStyles[STATUS_TONE[account.status]] ?? ''}`}>
                          {accountStatuses[account.status] ?? account.status}
                        </span>
                      </td>
                      <td data-label="Đăng nhập gần nhất"><small>{formatAccountDate(account.lastLoginAt)}</small></td>
                      <td data-label="Hành động" className={adminStyles.actionsCell}>
                        <ActionMenu label={`Hành động cho ${account.username}`} items={[
                          { id: 'view', label: 'Xem', onAction: () => setSelected(account.id) },
                          ...(canChange ? [{ id: 'status', label: account.status === 'LOCKED' ? 'Mở lại' : 'Khóa', danger: account.status !== 'LOCKED',
                            onAction: () => { setMessage(''); setStatusTarget({ account }); } }] : []),
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
        {list.length > 0 && <p className={adminStyles.footNote}>{list.length} tài khoản</p>}
      </section>
      {selected && <AdminAccount key={selected} id={selected} onClose={() => setSelected(null)}
        onChangeStatus={(account, reloadDetail) => { setMessage(''); setStatusTarget({ account, reloadDetail }); }} />}
      {statusTarget && <AccountStatusDialog account={statusTarget.account} onClose={() => setStatusTarget(null)}
        onDone={(text) => { statusTarget.reloadDetail?.(); accounts.reload(); setStatusTarget(null); setMessage(text); }} />}
    </>
  );
}

export function AdminWorkspace() {
  return (
    <AdminLayout fitViewport title="Quản lý tài khoản"
      subtitle="Khóa hoặc mở lại tài khoản. Admin không cấp lại mật khẩu; người dùng tự đặt lại qua email.">
      <Accounts />
    </AdminLayout>
  );
}
