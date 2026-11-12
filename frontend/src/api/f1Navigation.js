import { matchPath } from 'react-router-dom'

const routesByRole = {
  player: ['/account', '/my-bookings', '/my-bookings/:bookingId/reschedules', '/my-complaints', '/my-rewards',
    '/booking/summary', '/booking/payment', '/facilities/:id/package-booking', '/booking/multi'],
  staff: ['/staff/dashboard', '/staff/confirm-payments', '/staff/complaints', '/maintenance'],
  owner: ['/account', '/owner/workspace', '/owner/reports', '/owner/courts-pricing',
    '/owner/opening-hours', '/owner/facility-settings', '/staff/confirm-payments', '/maintenance'],
  admin: ['/admin/workspace', '/admin/facilities'],
}

export function canResumePath(value, role) {
  if (typeof value !== 'string' || !/^\/(?![/\\])/.test(value)) return false
  const pathname = value.split(/[?#]/, 1)[0]
  return ['/notifications', '/', '/facilities/:id', '/open-matches', ...(routesByRole[role] || [])]
    .some((pattern) => matchPath(pattern, pathname))
}
