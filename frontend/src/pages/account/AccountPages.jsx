import { useCallback, useId, useState } from 'react';
import { Link, Navigate, NavLink, useNavigate } from 'react-router-dom';
import api, { getAllPages } from '../../api';
import { fieldError, messages, normalizeName, validName, validPassword, validUsername } from '../../api/f1Rules';
import { clearSession, getSavedUser, getToken, saveSession } from '../../api/session';
import { Button, FormField, Input, Select, StatusBadge, Table } from '../../components/common';
import { Inbox } from '../NotificationsPage';
import WorkspaceLayout, { EmptyState, Feedback, Field, Modal, Section } from '../WorkspaceLayout';
import { useResource } from '../workspaceSupport';
import AccountForm from './AccountForm';
import styles from './AccountPages.module.css';

const loadProfile = (signal) => api.get('/users/me', { signal }).then((response) => response.data.data);
const loadStaff = (signal) => api.get('/owner/staff-members', { signal }).then((response) => response.data.data);

const roles = { PLAYER: 'Người chơi', STAFF: 'Nhân viên', OWNER: 'Chủ sân', ADMIN: 'Quản trị viên' };
const accountStatuses = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', DISABLED: 'Đã vô hiệu hóa' };

function AccountDetails({ account }) {
  const facts = [
    ['Họ và tên', account.fullName],
    ['Tên đăng nhập', account.username],
    ['Email', account.email],
    ['Số điện thoại', account.phone],
    ['Vai trò', roles[account.role] ?? account.role],
    [
      'Trạng thái',
      <StatusBadge key="status" tone={account.status === 'ACTIVE' ? 'success' : 'danger'}>
        {accountStatuses[account.status] ?? account.status}
      </StatusBadge>,
    ],
  ];
  if (account.role === 'PLAYER') facts.splice(4, 0, ['Trình độ chơi', account.skillLevel]);
  if (account.locationId) facts.push(['Địa điểm', '#' + account.locationId]);
  return (
    <dl className="cw-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const SKILL_LEVELS = ['Mới chơi', 'Trung bình', 'Khá', 'Nâng cao'];

/** Hộp thoại sửa hồ sơ: họ tên cho mọi vai trò, thêm trình độ chơi cho Player. Lưu xong trả hồ sơ mới. */
function EditProfileDialog({ account, onClose, onSaved }) {
  const titleId = useId();
  const nameId = useId();
  const skillId = useId();
  const isPlayer = account.role === 'PLAYER';
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const skillOptions = ['', ...SKILL_LEVELS];

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const nameError = fieldError(values.fullName, 'họ và tên', validName);
    setErrors({ fullName: nameError });
    if (nameError) return;

    const payload = { fullName: normalizeName(values.fullName) };
    // Chỉ gửi khi đã chọn: backend chỉ nhận 4 mức (DR33), để trống thì giữ nguyên trình độ đang có.
    if (isPlayer && values.skillLevel) payload.skillLevel = values.skillLevel;
    setBusy(true);
    try {
      const response = await api.patch('/users/me', payload);
      const updated = response.data.data;
      // Cập nhật phiên đăng nhập để tên trên thanh điều hướng đổi theo ngay.
      if (updated && getToken()) saveSession({ token: getToken(), user: updated });
      onSaved(updated);
    } catch (error) {
      const response = error.response?.data;
      setErrors(response?.errors?.fullName
        ? { fullName: response.errors.fullName }
        : { form: response?.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.' });
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
      <form noValidate onSubmit={handleSubmit} className="cw-modal-content">
        <h2 id={titleId}>Sửa thông tin</h2>
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
            <FormField htmlFor={skillId} label="Trình độ chơi">
              <Select id={skillId} name="skillLevel" defaultValue={SKILL_LEVELS.includes(account.skillLevel) ? account.skillLevel : ''}>
                {skillOptions.map((option) => (
                  <option key={option} value={option}>{option || 'Chưa chọn'}</option>
                ))}
              </Select>
            </FormField>
          )}
          <p className={styles.dialogHint}>
            Tên đăng nhập, email và số điện thoại không đổi được tại đây.
          </p>
        </fieldset>
        {errors.form && <Feedback tone="error">{errors.form}</Feedback>}
        <div className="cw-modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Huỷ</Button>
          <Button type="submit" loading={busy} loadingText="Đang lưu…">Lưu</Button>
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
  const initial = (account?.fullName || account?.username || 'U').trim().slice(0, 1).toLocaleUpperCase('vi-VN');

  return (
    <Section title="Hồ sơ của tôi" resource={profile}>
      {account && (
        <>
          <div className={styles.profileHead}>
            <span className={styles.avatar} aria-hidden="true">{initial}</span>
            <div className={styles.profileName}>
              <strong>{account.fullName || account.username}</strong>
              <span>@{account.username} · {roles[account.role] ?? account.role}</span>
            </div>
            <Button variant="primary" onClick={() => { setSaved(false); setEditing(true); }}>
              Sửa thông tin
            </Button>
          </div>
          {saved && <Feedback tone="success">{messages.saved}</Feedback>}
          <AccountDetails account={account} />
        </>
      )}
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
    </Section>
  );
}

function ChangePasswordView() {
  const navigate = useNavigate();
  return (
        <Section title="Đổi mật khẩu">
          <p className="cw-muted">Sau khi đổi mật khẩu, bạn sẽ cần đăng nhập lại.</p>
          <AccountForm
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
        </Section>
  );
}

function NotificationsView() {
  return <Inbox title="Thông báo của tôi" />;
}

const ACCOUNT_SECTIONS = {
  profile: { to: '/account', label: 'Hồ sơ của tôi', view: ProfileView },
  password: { to: '/account/password', label: 'Đổi mật khẩu', view: ChangePasswordView },
  notifications: { to: '/account/notifications', label: 'Thông báo của tôi', view: NotificationsView },
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
              {item.label}
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

function AdminAccount({ id, reload }) {
  const loadDetail = useCallback(
    (signal) => api.get('/admin/accounts/' + id, { signal }).then((response) => response.data.data),
    [id]
  );
  const loadAudit = useCallback(
    (signal) => getAllPages('/admin/account-audits', { signal, params: { targetAccountId: id } }),
    [id]
  );
  const detail = useResource(loadDetail, id);
  const audit = useResource(loadAudit, id);
  const account = detail.data;
  const canChange = ['ACTIVE', 'LOCKED'].includes(account?.status) && account.role !== 'ADMIN';
  const unlocking = account?.status === 'LOCKED';
  const signIns = audit.data?.filter((entry) => entry.action === 'LOGIN');
  const changes = audit.data?.filter((entry) => entry.action !== 'LOGIN');
  return (
    <>
      <Section title="Chi tiết tài khoản" resource={detail}>
        {account && (
          <>
            <AccountDetails account={account} />
            <p>Ngày tạo tài khoản {formatAccountDate(account.createdAt)}</p>
          </>
        )}
        {canChange && (
          <AccountForm
            label={unlocking ? 'Mở khóa' : 'Khóa tài khoản'}
            confirmation={
              unlocking ? undefined : 'Khóa tài khoản ' + account.fullName + '? Người dùng sẽ không đăng nhập được nữa.'
            }
            fields={[{ name: 'reason', label: 'Lý do', maxLength: 500 }]}
            submit={(form) =>
              api.patch('/admin/accounts/' + id + '/status', { ...form, status: unlocking ? 'ACTIVE' : 'LOCKED' })
            }
            success={() =>
              unlocking
                ? 'Đã cập nhật tài khoản ' + account.fullName + '.'
                : 'Đã khóa tài khoản ' + account.fullName + '.'
            }
            after={() => {
              detail.reload();
              audit.reload();
              reload();
            }}
          />
        )}
      </Section>
      <Section title="Lịch sử đăng nhập" resource={audit}>
        {signIns?.length === 0 && <p>Chưa có lượt đăng nhập.</p>}
        <ul>
          {signIns?.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.createdAt}>{formatAccountDate(entry.createdAt)}</time>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Nhật ký tài khoản" resource={audit}>
        {changes?.length === 0 && <p>Chưa có thay đổi tài khoản.</p>}
        <ul>
          {changes?.map((entry) => (
            <li key={entry.id}>
              {formatAccountDate(entry.createdAt)} · {entry.action} · {entry.reason || '—'}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Accounts() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
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

  return (
    <>
      <Section title="Danh sách tài khoản" resource={accounts}>
        <div className="cw-columns">
          <Field
            label="Tìm theo tên đăng nhập, họ tên hoặc số điện thoại"
            type="search"
            onChange={(event) => setSearch(event.target.value.trim())}
          />
          <Field
            label="Vai trò"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={[['', 'Tất cả vai trò'], ...Object.entries(roles)]}
          />
          <Field
            label="Trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[['', 'Tất cả trạng thái'], ...Object.entries(accountStatuses)]}
          />
        </div>
        {accounts.data?.length === 0 && <p>Không có tài khoản phù hợp.</p>}
        {accounts.data?.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th scope="col">Tên đăng nhập</th>
                <th scope="col">Họ và tên</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Địa điểm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Đăng nhập gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((account) => (
                <tr key={account.id}>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      style={{ color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', background: 'none', border: 0, padding: 0 }}
                      onClick={() => setSelected(account.id)}
                    >
                      {account.username}
                    </button>
                  </td>
                  <td>{account.fullName}</td>
                  <td>{roles[account.role]}</td>
                  <td>{account.locationId ? '#' + account.locationId : '—'}</td>
                  <td>
                    <StatusBadge tone={account.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {accountStatuses[account.status] ?? account.status}
                    </StatusBadge>
                  </td>
                  <td>{formatAccountDate(account.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
      {selected && <AdminAccount key={selected} id={selected} reload={accounts.reload} />}
    </>
  );
}

export function AdminWorkspace() {
  return (
    <WorkspaceLayout title="Quản trị hệ thống" role="admin">
      <Link to="/admin/facilities" className="underline">
        Quản lý địa điểm
      </Link>
      <Accounts />
    </WorkspaceLayout>
  );
}
