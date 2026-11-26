import api, { getAllPages } from './index';

export async function loadManagementInbox(role, locationId, signal) {
  const config = { signal, locationId };
  const requests = [
    getAllPages('/staff/payments', config),
    api.get('/staff/reschedule-payments', { ...config, params: { status: 'AWAITING_CONFIRMATION' } }).then(result => result.data.data),
    getAllPages(`/${role}/complaints`, config),
    ...(role === 'owner' ? [api.get('/owner/refunds', config).then(result => result.data.data)] : []),
  ];
  const results = await Promise.allSettled(requests);
  const counts = {};
  if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
    const payments = [...results[0].value, ...results[1].value].filter(item => item.status === 'AWAITING_CONFIRMATION');
    counts.payments = payments.length;
    counts.urgentPayments = payments.filter(item => item.overdue || item.transferredToOwner).length;
  }
  if (results[2].status === 'fulfilled') counts.complaints = results[2].value.filter(item => ['SUBMITTED', 'PENDING_OWNER'].includes(item.status)).length;
  if (results[3]?.status === 'fulfilled') counts.refund = results[3].value.filter(item => item.status === 'PENDING_REFUND').length;
  return counts;
}
