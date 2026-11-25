import api from './index'

export async function findVoucherRecipients(locationId, params, signal) {
  const { data } = await api.get('/owner/vouchers/recipients', { locationId, params, signal })
  return data.data
}

export async function listVoucherRecipients(locationId, voucherId, page, signal) {
  const { data } = await api.get(`/owner/vouchers/${voucherId}/grants`, { locationId, params: { page, size: 20 }, signal })
  return data.data
}

export function grantVoucherRecipients(locationId, voucherId, playerIds) {
  return api.post(`/owner/vouchers/${voucherId}/grants`, { playerIds }, { locationId })
}
