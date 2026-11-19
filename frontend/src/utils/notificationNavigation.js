const idValue = (value) => /^[1-9]\d*$/.test(String(value ?? '')) ? String(value) : null;

/** Routes refer to the object identified by refType, not merely the notification type. */
export function notificationDestination(item, userRole) {
  const role = String(userRole || '').toLowerCase();
  const refType = String(item.refType || '').toUpperCase();
  const type = String(item.type || '').toUpperCase();
  const refId = idValue(item.refId);
  const bookingId = idValue(item.bookingId) || (refType === 'BOOKING' ? refId : null);
  const packageId = idValue(item.packageId) || (refType === 'PACKAGE' ? refId : null);
  const locationId = idValue(item.locationId) || (refType === 'LOCATION' ? refId : null);
  const inbox = ['player', 'owner'].includes(role) ? '/account/notifications' : '/notifications';
  const fallback = `${inbox}#notification-${item.id}`;

  if (type === 'RESCHEDULE_PROOF_SUBMITTED' && ['owner', 'staff'].includes(role)) {
    return '/staff/confirm-payments?type=reschedule';
  }
  if (refType === 'SERVICE_REGISTRATION') {
    return role === 'admin' ? `/admin/facilities?registrationId=${refId || ''}` : '/register-service';
  }
  if (type === 'LATE_PAYMENT_VOUCHER' || type === 'BATCH_OFFER_VOUCHER') {
    return role === 'player' ? '/my-rewards' : fallback;
  }
  if (refType === 'COMPLAINT' && refId) {
    if (role === 'owner') return `/owner/workspace?tab=complaints&complaintId=${refId}`;
    if (role === 'staff') return `/staff/complaints?complaintId=${refId}`;
    if (role === 'player') return `/my-complaints?complaintId=${refId}`;
  }
  if (refType === 'REVIEW') {
    if (role === 'owner') return `/owner/workspace?tab=reviews&reviewId=${refId || ''}`;
    if (role === 'player' && bookingId) return `/my-bookings?bookingId=${bookingId}`;
    if (locationId) return `/facilities/${locationId}`;
  }
  if (refType === 'MATCH' && refId) return `/open-matches?matchId=${refId}`;
  if (refType === 'TEAM') return '/teams';
  if (refType === 'VOUCHER') return role === 'owner' ? '/owner/workspace?tab=rewards' : '/my-rewards';
  if (refType === 'SERVICE_TERM') return role === 'admin' ? '/admin/facilities' : '/owner/workspace';
  if (refType === 'LOCATION') {
    if (role === 'admin') return '/admin/facilities';
    if (role === 'owner') return '/owner/facility-settings';
    if (role === 'staff') return '/staff/dashboard';
    return locationId ? `/facilities/${locationId}` : '/my-bookings';
  }
  if (refType === 'MAINTENANCE' || refType === 'COURT') {
    return ['owner', 'staff'].includes(role) ? '/maintenance' : fallback;
  }
  if (refType === 'PAYMENT' && ['owner', 'staff'].includes(role)) {
    const params = new URLSearchParams();
    if (item.rescheduleRequestId) params.set('type', 'reschedule');
    if (refId) params.set('paymentId', refId);
    return '/staff/confirm-payments?' + params;
  }
  if (['BOOKING', 'PACKAGE', 'PAYMENT'].includes(refType)) {
    if (role === 'player') {
      if (packageId) return `/my-bookings?packageId=${packageId}`;
      if (bookingId) return `/my-bookings?bookingId=${bookingId}`;
      return '/my-bookings';
    }
    if (role === 'owner' && type === 'REFUND_REQUEST') return '/owner/workspace?tab=refund';
    if (role === 'owner' && type === 'WALK_IN_AFFECTED') return '/owner/workspace?tab=complaints';
    if (['owner', 'staff'].includes(role)) return '/staff/dashboard';
  }
  return fallback;
}
