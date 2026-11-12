import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AccountForm from './AccountForm'
import { messages, normalizeName, validName, validPassword } from '../../api/f1Rules'
import api, { getAllPages } from '../../api'
import { clearSession, getSavedUser } from '../../api/session'
import WorkspaceLayout, { ActionForm, Field, Section } from '../WorkspaceLayout'
import { useResource } from '../workspaceSupport'

const loadProfile = (signal) => api.get('/users/me', { signal }).then((response) => response.data.data)
const loadStaff = (signal) => api.get('/owner/staff-members', { signal }).then((response) => response.data.data)
const loadAccounts = (signal) => getAllPages('/admin/accounts', { signal })

function AccountDetails({ account }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
    <dt>Tên đăng nhập</dt><dd>{account.username}</dd>
    <dt>Họ và tên</dt><dd>{account.fullName}</dd>
    <dt>Email</dt><dd>{account.email || '—'}</dd>
    <dt>Số điện thoại</dt><dd>{account.phone || '—'}</dd>
    <dt>Vai trò</dt><dd>{account.role}</dd>
    <dt>Trạng thái</dt><dd>{account.status}</dd>
    {account.locationId && <><dt>Địa điểm</dt><dd>#{account.locationId}</dd></>}
  </dl>
}

function Profile() {
  const profile = useResource(loadProfile)
  const navigate = useNavigate()
  return <>
    <Section title="Hồ sơ" resource={profile}>
      {profile.data && <AccountDetails account={profile.data} />}
      {profile.data?.role === 'PLAYER' && <>
        <AccountForm label="Lưu họ tên" fields={[
          { name: 'fullName', label: 'Họ và tên', initial: profile.data.fullName, required: true, validate: validName, normalize: normalizeName },
        ]} submit={(form) => api.patch('/users/me', form)} success={() => messages.saved} after={profile.reload} />
        <AccountForm label="Lưu trình độ" fields={[
          { name: 'skillLevel', label: 'Trình độ chơi', initial: profile.data.skillLevel || '',
            options: [...new Set(['', 'Mới chơi', 'Trung bình', 'Khá', 'Nâng cao', profile.data.skillLevel || ''])] },
        ]} submit={(form) => api.patch('/users/me', form)} success={() => messages.saved} after={profile.reload} />
      </>}
    </Section>
    <Section title="Đổi mật khẩu">
      <AccountForm label="Đổi mật khẩu" fields={[
        { name: 'currentPassword', label: 'Mật khẩu hiện tại', type: 'password', autoComplete: 'current-password', required: true },
        { name: 'newPassword', label: 'Mật khẩu mới', type: 'password', autoComplete: 'new-password', required: true, validate: validPassword },
        { name: 'confirmation', label: 'Xác nhận mật khẩu mới', type: 'password', autoComplete: 'new-password', required: true },
      ]} submit={(form) => api.post('/users/me/password', form)} after={() => {
        clearSession()
        navigate('/login', { replace: true, state: { passwordChanged: true } })
      }} />
    </Section>
  </>
}

export function AccountPage() {
  const user = getSavedUser()
  if (user && !['player', 'owner'].includes(user.role_code)) return <Navigate to="/notifications" replace />
  return <WorkspaceLayout title="Tài khoản của tôi"><Profile /></WorkspaceLayout>
}

export function StaffAccounts() {
  const staff = useResource(loadStaff)
  return <Section title="Nhân viên tại địa điểm" resource={staff}>
    <ActionForm label="Tạo tài khoản" action={(form) => api.post('/owner/staff-members', form)} after={staff.reload}>
      <Field label="Tên đăng nhập" name="username" required pattern="[a-z][a-z0-9._]{3,19}" />
      <Field label="Họ và tên" name="fullName" required minLength={2} maxLength={50} />
      <Field label="Số điện thoại" name="phone" type="tel" required pattern="0[0-9]{9}" />
      <Field label="Mật khẩu ban đầu" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={32} />
    </ActionForm>
    {staff.data?.length === 0 && <p>Chưa có nhân viên.</p>}
    {staff.data?.map((item) => <details key={item.id} className="space-y-3 border-t py-3">
      <summary>{item.fullName} · {item.username} · {item.status}</summary>
      <AccountDetails account={item} />
      {item.status === 'ACTIVE' && <ActionForm label="Vô hiệu hóa" confirmation="Vô hiệu hóa tài khoản này?" action={(form) =>
        api.patch('/owner/staff-members/' + item.id + '/status', { ...form, status: 'DISABLED' })
      } after={staff.reload}>
        <Field label="Lý do" name="reason" maxLength={500} />
      </ActionForm>}
      {item.status === 'ACTIVE' && <ActionForm label="Cấp lại mật khẩu" action={(form) => api.post('/owner/staff-members/' + item.id + '/password', form)}>
        <Field label="Mật khẩu mới" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={32} />
      </ActionForm>}
    </details>)}
  </Section>
}

function AdminAccount({ id, reload }) {
  const loadDetail = useCallback((signal) => api.get('/admin/accounts/' + id, { signal }).then((response) => response.data.data), [id])
  const loadAudit = useCallback((signal) => getAllPages('/admin/account-audits', { signal, params: { targetAccountId: id } }), [id])
  const detail = useResource(loadDetail, id)
  const audit = useResource(loadAudit, id)
  const account = detail.data
  const canChange = ['ACTIVE', 'LOCKED'].includes(account?.status) && account?.role !== 'ADMIN'
  return <>
    <Section title="Chi tiết tài khoản" resource={detail}>
      {account && <AccountDetails account={account} />}
      {canChange && <ActionForm label={account.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'} confirmation="Xác nhận đổi trạng thái tài khoản?" action={(form) =>
        api.patch('/admin/accounts/' + id + '/status', { ...form, status: account.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED' })
      } after={() => { detail.reload(); audit.reload(); reload() }}>
        <Field label="Lý do" name="reason" maxLength={500} />
      </ActionForm>}
    </Section>
    <Section title="Nhật ký tài khoản" resource={audit}>
      {audit.data?.length === 0 && <p>Chưa có nhật ký.</p>}
      <ul>{audit.data?.map((entry) => <li key={entry.id}>{entry.createdAt} · {entry.action} · {entry.reason || '—'}</li>)}</ul>
    </Section>
  </>
}

function Accounts() {
  const accounts = useResource(loadAccounts)
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = accounts.data?.filter((account) => [account.username, account.fullName, account.role, account.email, account.status]
    .some((value) => value?.toLowerCase().includes(normalizedSearch)))
  return <>
    <Section title="Danh sách tài khoản" resource={accounts}>
      <Field label="Tìm theo tên, email, vai trò hoặc trạng thái" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      {filtered?.length === 0 && <p>Không có tài khoản phù hợp.</p>}
      <Field label="Tài khoản" value={selected} onChange={(event) => setSelected(event.target.value)}
        options={[[ '', 'Chọn tài khoản' ], ...(filtered ?? []).map((account) =>
          [account.id, account.fullName + ' · ' + account.username + ' · ' + account.status])]} />
    </Section>
    {selected && <AdminAccount key={selected} id={selected} reload={accounts.reload} />}
  </>
}

export function AdminWorkspace({ children }) {
  return <WorkspaceLayout title="Quản trị hệ thống" role="admin">
    <Link to="/admin/facilities" className="underline">Quản lý địa điểm</Link>
    <Accounts />
    {children}
  </WorkspaceLayout>
}
