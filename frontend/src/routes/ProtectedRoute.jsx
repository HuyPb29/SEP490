import React from 'react'
import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import LoadingSpinner from '../components/common/LoadingSpinner'

const roleLabels = { PLAYER: 'Người chơi', OWNER: 'Chủ sân', STAFF: 'Nhân viên', ADMIN: 'Quản trị viên', ANY: 'Mọi vai trò' }

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, role, isLoading, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // 1. Never redirect while loading to prevent F5 logout bug
  if (isLoading) {
    return <LoadingSpinner message="Đang kiểm tra phiên đăng nhập và quyền truy cập…" />
  }

  // 2. If not authenticated, redirect to login with return path
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // 3. Check role authorization
  const normalizedUserRole = (role || '').toUpperCase()
  const normalizedAllowedRoles = allowedRoles.map((r) => r.toUpperCase())

  const hasRequiredRole =
    normalizedAllowedRoles.length === 0 ||
    normalizedAllowedRoles.includes(normalizedUserRole) ||
    normalizedAllowedRoles.includes('ANY')

  if (!hasRequiredRole) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '36px 32px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ fontSize: '48px', lineHeight: 1 }} aria-hidden="true">
            🚫
          </span>
          <h1
            style={{
              margin: '16px 0 8px',
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            Không có quyền truy cập
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            Tài khoản của bạn (<strong>{user?.username || user?.email || "Người dùng hiện tại"}</strong>) có vai trò{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              {roleLabels[normalizedUserRole] || 'Người chơi'}
            </span>{' '}
            không có quyền truy cập khu vực này.
          </p>

          <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#475569' }}>
            Vai trò được phép: <strong>{normalizedAllowedRoles.map((value) => roleLabels[value] || value).join(' hoặc ')}</strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Về trang chủ
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Đổi tài khoản
              </button>
            </div>

            {/* Dev/Testing Quick Role Switcher */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: '11px',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                Đổi nhanh vai trò (chế độ kiểm thử)
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {allowedRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const demoUser = {
                        id: 999,
                        username: `demo_${r.toLowerCase()}`,
                        full_name: `Minh họa ${r.charAt(0) + r.slice(1).toLowerCase()}`,
                        email: `demo_${r.toLowerCase()}@courtly.com`,
                        role: r,
                        role_code: r,
                      }
                      login('demo-token-bypass', demoUser)
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#ecfdf5',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#15803d',
                      cursor: 'pointer',
                    }}
                  >
                    Chuyển sang vai trò {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return children ? children : <Outlet />
}
