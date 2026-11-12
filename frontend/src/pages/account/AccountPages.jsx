import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { getAllPages } from '../../api';
import { messages, normalizeName, validName, validPassword, validPhone, validUsername } from '../../api/f1Rules';
import { clearSession, getSavedUser } from '../../api/session';
import { StatusBadge, Table } from '../../components/common';
import WorkspaceLayout, { EmptyState, Field, Section } from '../WorkspaceLayout';
import { useResource } from '../workspaceSupport';
import AccountForm from './AccountForm';

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

function Profile() {
  const profile = useResource(loadProfile);
  const navigate = useNavigate();
  return (
    <>
      <Section title="Hồ sơ cá nhân" resource={profile}>
        {profile.data && <AccountDetails account={profile.data} />}
        {profile.data?.role === 'PLAYER' && (
          <>
            <AccountForm
              label="Lưu họ tên"
              fields={[
                {
                  name: 'fullName',
                  label: 'Họ và tên',
                  initial: profile.data.fullName,
                  required: true,
                  validate: validName,
                  normalize: normalizeName,
                },
              ]}
              submit={(form) => api.patch('/users/me', form)}
              success={() => messages.saved}
              after={profile.reload}
            />
            <AccountForm
              label="Lưu trình độ"
              fields={[
                {
                  name: 'skillLevel',
                  label: 'Trình độ chơi',
                  initial: profile.data.skillLevel || '',
                  options: [
                    ...new Set([
                      '',
                      'Mới chơi',
                      'Trung bình',
                      'Khá',
                      'Nâng cao',
                      profile.data.skillLevel || '',
                    ]),
                  ],
                },
              ]}
              submit={(form) => api.patch('/users/me', form)}
              success={() => messages.saved}
              after={profile.reload}
            />
          </>
        )}
      </Section>
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
    </>
  );
}

export function AccountPage() {
  const user = getSavedUser();
  if (user && !['player', 'owner'].includes(user.role_code)) return <Navigate to="/notifications" replace />;
  return (
    <WorkspaceLayout title="Tài khoản của tôi" description="Xem hồ sơ và cập nhật mật khẩu đăng nhập.">
      <Profile />
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
              name: 'phone',
              label: 'Số điện thoại',
              type: 'tel',
              required: true,
              validate: validPhone,
              normalize: (value) => value.trim(),
            },
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

function AdminSections({ vouchers }) {
  const [tab, setTab] = useState('accounts');
  return (
    <>
      <div className="cw-tabs" role="group" aria-label="Khu vực quản trị">
        <button type="button" aria-pressed={tab === 'accounts'} onClick={() => setTab('accounts')}>
          Tài khoản và nhật ký
        </button>
        <button type="button" aria-pressed={tab === 'vouchers'} onClick={() => setTab('vouchers')}>
          Kiểm duyệt voucher
        </button>
      </div>
      {tab === 'accounts' ? <Accounts /> : vouchers}
    </>
  );
}

export function AdminWorkspace({ children }) {
  return (
    <WorkspaceLayout title="Quản trị hệ thống" role="admin">
      <Link to="/admin/facilities" className="underline">
        Quản lý địa điểm
      </Link>
      <AdminSections vouchers={children} />
    </WorkspaceLayout>
  );
}
