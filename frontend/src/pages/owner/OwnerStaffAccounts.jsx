import { useState } from 'react'
import api from '../../api'
import { fieldError, normalizeName, validName, validPassword, validUsername } from '../../api/f1Rules'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  StatusBadge,
  Table,
  Toast,
} from '../../components/common'
import { errorMessage } from '../../utils/formatters'
import { useResource } from '../workspaceSupport'
import styles from './OwnerWorkspace.module.css'

const loadStaff = (signal) => api.get('/owner/staff-members', { signal }).then((response) => response.data.data)

const STAFF_STATUS = {
  ACTIVE: { label: 'Hoạt động', tone: 'success' },
  LOCKED: { label: 'Đã khóa', tone: 'danger' },
  DISABLED: { label: 'Đã vô hiệu hóa', tone: 'neutral' },
}

/** Lỗi theo trường từ backend, không có thì trả lỗi chung của form. */
function responseErrors(error, names) {
  const response = error.response?.data
  const byField = Object.fromEntries(names.filter((name) => response?.errors?.[name]).map((name) => [name, response.errors[name]]))
  return Object.keys(byField).length ? byField : { form: errorMessage(error) }
}

function CopyValue({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={styles.copyValue}>
      <code>{value}</code>
      <Button variant="secondary" size="sm" onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}>
        {copied ? 'Đã sao chép' : 'Sao chép'}
      </Button>
    </span>
  )
}

function CreateStaffDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', fullName: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const update = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }))
  }

  async function submit(event) {
    event.preventDefault()
    const validation = {
      username: fieldError(form.username, 'tên đăng nhập', validUsername),
      fullName: fieldError(form.fullName, 'họ và tên', validName),
      password: fieldError(form.password, 'mật khẩu ban đầu', validPassword),
    }
    setErrors(validation)
    if (Object.values(validation).some(Boolean)) return
    setBusy(true)
    try {
      const response = await api.post('/owner/staff-members', {
        username: form.username.trim(),
        fullName: normalizeName(form.fullName),
        password: form.password,
      })
      onCreated(response.data.data, form.password)
    } catch (error) {
      setErrors(responseErrors(error, ['username', 'fullName', 'password']))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Thêm nhân viên" onClose={onClose} busy={busy}>
      <form noValidate className={styles.modalForm} onSubmit={submit}>
        <FormField label="Tên đăng nhập" required error={errors.username}
          hint="6–32 ký tự, bắt đầu bằng chữ thường; chỉ gồm a–z, số, dấu chấm, gạch dưới.">
          <Input value={form.username} autoComplete="off" onChange={update('username')} />
        </FormField>
        <FormField label="Họ và tên" required error={errors.fullName}>
          <Input value={form.fullName} autoComplete="off" onChange={update('fullName')} />
        </FormField>
        <FormField label="Mật khẩu ban đầu" required error={errors.password}
          hint="8–32 ký tự, có cả chữ và số. Nhân viên không tự đổi được mật khẩu.">
          <Input type="text" value={form.password} autoComplete="new-password" onChange={update('password')} />
        </FormField>
        {errors.form && <p className={styles.formError} role="alert">{errors.form}</p>}
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" loading={busy}>Tạo tài khoản</Button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordDialog({ member, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const error = fieldError(password, 'mật khẩu mới', validPassword)
    setErrors({ newPassword: error })
    if (error) return
    setBusy(true)
    try {
      await api.post('/owner/staff-members/' + member.id + '/password', { newPassword: password })
      onDone(member, password)
    } catch (err) {
      setErrors(responseErrors(err, ['newPassword']))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Cấp lại mật khẩu cho ${member.fullName}`} onClose={onClose} busy={busy}>
      <form noValidate className={styles.modalForm} onSubmit={submit}>
        <p className={styles.muted}>Mật khẩu cũ hết hiệu lực ngay. Báo mật khẩu mới cho nhân viên sau khi lưu.</p>
        <FormField label="Mật khẩu mới" required error={errors.newPassword} hint="8–32 ký tự, có cả chữ và số.">
          <Input type="text" value={password} autoComplete="new-password"
            onChange={(event) => { setPassword(event.target.value); setErrors({}) }} />
        </FormField>
        {errors.form && <p className={styles.formError} role="alert">{errors.form}</p>}
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" loading={busy}>Cấp lại mật khẩu</Button>
        </div>
      </form>
    </Modal>
  )
}

function DisableDialog({ member, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await api.patch('/owner/staff-members/' + member.id + '/status', { reason: reason.trim(), status: 'DISABLED' })
      onDone(member)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog title={`Vô hiệu hóa ${member.fullName}?`} tone="danger" confirmText="Vô hiệu hóa"
      busy={busy} onConfirm={confirm} onCancel={onClose}>
      <div className={styles.modalForm}>
        <p>Nhân viên sẽ không đăng nhập được nữa. Thao tác này không hoàn tác tại đây.</p>
        <FormField label="Lý do" hint="Không bắt buộc, tối đa 500 ký tự.">
          <Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        {error && <p className={styles.formError} role="alert">{error}</p>}
      </div>
    </ConfirmDialog>
  )
}

export default function OwnerStaffAccounts() {
  const staff = useResource(loadStaff)
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const [issued, setIssued] = useState(null)

  const close = () => setDialog(null)
  const rows = staff.data ?? []

  return (
    <section className={styles.panel} aria-labelledby="staff-heading">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="staff-heading" className={styles.panelTitle}>Nhân viên tại địa điểm</h2>
          <p className={styles.muted}>Nhân viên đăng nhập bằng tên đăng nhập và mật khẩu do bạn cấp.</p>
        </div>
        <Button onClick={() => { setIssued(null); setDialog({ type: 'create' }) }}>Thêm nhân viên</Button>
      </header>

      {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}
      {issued && (
        <div className={styles.issued} role="status">
          <p>
            <strong>Mật khẩu của {issued.name}</strong> chỉ hiện một lần. Sao chép và gửi cho nhân viên trước khi rời trang.
          </p>
          <CopyValue value={issued.password} />
          <Button variant="ghost" size="sm" onClick={() => setIssued(null)}>Đã lưu, ẩn mật khẩu</Button>
        </div>
      )}

      {staff.loading && <LoadingState message="Đang tải nhân viên…" />}
      {staff.error && <ErrorState message={staff.error} onRetry={staff.reload} />}
      {!staff.loading && !staff.error && rows.length === 0 && (
        <EmptyState title="Chưa có nhân viên" description="Tạo tài khoản để nhân viên xác nhận thanh toán và vận hành sân."
          action={<Button variant="secondary" onClick={() => setDialog({ type: 'create' })}>Thêm nhân viên</Button>} />
      )}
      {!staff.loading && !staff.error && rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th scope="col">Họ và tên</th>
              <th scope="col">Tên đăng nhập</th>
              <th scope="col">Trạng thái</th>
              <th scope="col"><span className={styles.srOnly}>Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const status = STAFF_STATUS[member.status] ?? { label: member.status, tone: 'neutral' }
              return (
                <tr key={member.id}>
                  <td><strong>{member.fullName}</strong></td>
                  <td><code>{member.username}</code></td>
                  <td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                  <td className={styles.rowAction}>
                    <div className={styles.rowButtons}>
                      {member.status !== 'DISABLED' && (
                        <Button variant="ghost" size="sm" onClick={() => setDialog({ type: 'password', member })}>
                          Cấp lại mật khẩu
                        </Button>
                      )}
                      {member.status === 'ACTIVE' && (
                        <Button variant="ghost" size="sm" className={styles.dangerText}
                          onClick={() => setDialog({ type: 'disable', member })}>
                          Vô hiệu hóa
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}

      {dialog?.type === 'create' && (
        <CreateStaffDialog onClose={close} onCreated={(created, password) => {
          close()
          setIssued({ name: created?.fullName ?? 'nhân viên', password })
          setToast({ tone: 'success', text: `Đã tạo tài khoản nhân viên ${created?.fullName ?? ''}.` })
          staff.reload()
        }} />
      )}
      {dialog?.type === 'password' && (
        <ResetPasswordDialog member={dialog.member} onClose={close} onDone={(member, password) => {
          close()
          setIssued({ name: member.fullName, password })
          setToast({ tone: 'success', text: 'Đã cấp lại mật khẩu nhân viên.' })
        }} />
      )}
      {dialog?.type === 'disable' && (
        <DisableDialog member={dialog.member} onClose={close} onDone={(member) => {
          close()
          setToast({ tone: 'success', text: `Đã vô hiệu hóa tài khoản ${member.fullName}.` })
          staff.reload()
        }} />
      )}
    </section>
  )
}
