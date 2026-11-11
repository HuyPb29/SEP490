import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { logoutApi } from '../api/authApi'
import { getSavedUser, roleHome } from '../api/session'

import { errorMessage } from './workspaceSupport'

export function Section({ title, resource, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {resource?.loading && <p role="status">Đang tải…</p>}
      {resource?.error && <p role="alert">{resource.error} <button onClick={resource.reload}>Thử lại</button></p>}
      {children}
    </section>
  )
}

export function Field({ label, options, ...props }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {options ? <select {...props}>{options.map(([value, name]) =>
        <option key={value} value={value}>{name}</option>)}</select> : <input {...props} />}
    </label>
  )
}

export function ActionForm({ action, label = 'Lưu', after, confirmation, children }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (busy || (confirmation && !window.confirm(confirmation))) return
    const form = event.currentTarget
    setBusy(true)
    setMessage(null)
    try {
      const result = await action(Object.fromEntries(new FormData(form)))
      form.reset()
      setMessage({ text: result?.data?.message || 'Đã lưu.' })
      after?.(result)
    } catch (error) {
      setMessage({ error: true, text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        {children}
        <button className="action" type="submit">{busy ? 'Đang xử lý…' : label}</button>
      </fieldset>
      {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  )
}

export default function WorkspaceLayout({ role, title, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getSavedUser()
  const [logoutError, setLogoutError] = useState('')
  if (!user) return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />
  if (role && user.role_code !== role) return <Navigate to={roleHome[user.role_code] ?? '/'} replace />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 [&_input]:rounded [&_input]:border [&_input]:border-slate-300 [&_input]:p-2 [&_select]:rounded [&_select]:border [&_select]:border-slate-300 [&_select]:p-2 [&_.action]:rounded [&_.action]:bg-emerald-800 [&_.action]:px-3 [&_.action]:py-2 [&_.action]:text-white [&_button:disabled]:opacity-60">
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <nav aria-label="Tài khoản" className="flex flex-wrap items-center gap-4 text-sm underline">
          <Link to={roleHome[user.role_code] ?? '/'}>Trang chính</Link>
          {['player', 'owner'].includes(user.role_code) && <Link to="/account">Tài khoản</Link>}
          {user.role_code === 'player' && <><Link to="/my-bookings">Đặt sân của tôi</Link><Link to="/my-rewards">Ưu đãi của tôi</Link><Link to="/my-complaints">Khiếu nại</Link></>}
          <Link to="/notifications">Thông báo</Link>
          <button type="button" onClick={async () => {
            try {
              await logoutApi()
              navigate('/login', { replace: true })
            } catch (error) {
              setLogoutError(errorMessage(error))
            }
          }}>Đăng xuất</button>
        </nav>
        {logoutError && <p role="alert">{logoutError}</p>}
        <h1 className="text-3xl font-bold">{title}</h1>
        {children}
      </main>
    </div>
  )
}
