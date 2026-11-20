import api, { getAllPages } from './index'

const vouchersPath = '/owner/vouchers'

export function loadOwnerVouchers(locationId, signal) {
  return getAllPages(vouchersPath, { locationId, signal })
}

export function createOwnerVoucher(locationId, voucher) {
  return api.post(vouchersPath, voucher, { locationId })
}

export function updateOwnerVoucher(locationId, current, voucher) {
  return api.patch(`${vouchersPath}/${current.id}`, { version: current.version, voucher }, { locationId })
}

export function publishOwnerVoucher(locationId, voucherId) {
  return api.post(`${vouchersPath}/${voucherId}/publish`, undefined, { locationId })
}

export async function loadOwnerLocations(signal) {
  const { data } = await api.get('/owner/locations', { signal })
  return data.data
}

export async function loadOwnerRefunds(signal) {
  const { data } = await api.get('/owner/refunds', { signal })
  return data.data
}

export async function loadOwnerRefund(id, signal) {
  const { data } = await api.get('/owner/refunds/' + id, { signal })
  return data.data
}

export function recordOwnerRefund(id, form) {
  return api.post('/owner/refunds/' + id + '/record', { ...form, amount: Number(form.amount) })
}

export async function downloadVenueData(params) {
  const { data } = await api.get('/owner/exports', { params, responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = 'du-lieu-dia-diem.xlsx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
