import { matchPath } from 'react-router-dom'

const routesByRole = {
  player: ['/account', '/change-password', '/my-reschedules', '/teams', '/complaints', '/my-vouchers', '/my-bookings', '/my-bookings/:bookingId/reschedules', '/my-complaints', '/my-rewards',
    '/booking/summary', '/booking/payment', '/facilities/:id/package-booking', '/booking/multi'],
  staff: ['/staff/dashboard', '/staff/schedule', '/staff/confirm-payments', '/staff/complaints', '/maintenance'],
  owner: ['/account', '/change-password', '/owner/courts', '/owner/reconciliations', '/owner/workspace', '/owner/reports', '/owner/courts-pricing',
    '/owner/opening-hours', '/owner/facility-settings', '/staff/confirm-payments', '/maintenance'],
  admin: ['/admin/workspace', '/admin/accounts', '/admin/facilities', '/admin/reviews', '/admin/vouchers'],
}

export function canResumePath(value, role) {
  if (typeof value !== 'string' || !/^\/(?![/\\])/.test(value)) return false
  const pathname = value.split(/[?#]/, 1)[0]
  // Staff và Owner đăng nhập từ trang công khai (trang chủ, trang địa điểm, kèo) thì vào thẳng trang làm việc của mình,
  // không quay lại trang của người chơi.
  const publicPages = role === 'staff' || role === 'owner' ? [] : ['/', '/facilities/:id', '/open-matches', '/locations', '/matches']
  return ['/notifications', ...publicPages, ...(routesByRole[role] || [])]
    .some((pattern) => matchPath(pattern, pathname))
}
