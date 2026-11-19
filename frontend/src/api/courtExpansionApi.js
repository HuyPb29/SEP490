import api from './index'

const config = (locationId) => ({ locationId, headers: { 'X-Location-Id': String(locationId) } })
export async function expansionQuote(locationId, courtCount) {
  const { data } = await api.get(`/owner/locations/${locationId}/court-expansions/quote`, {
    ...config(locationId), params: { courtCount },
  })
  return data.data
}
export async function ownerExpansions(locationId) {
  const { data } = await api.get(`/owner/locations/${locationId}/court-expansions`, config(locationId))
  return data.data
}
export async function submitExpansion(locationId, quote, proof) {
  const form = new FormData()
  form.append('data', new Blob([JSON.stringify({ courtCount: quote.courtCount,
    quotedStart: quote.startDate, contractEnd: quote.endDate, quotedAmount: quote.amount })], { type: 'application/json' }))
  form.append('proof', proof)
  const { data } = await api.post(`/owner/locations/${locationId}/court-expansions`, form, config(locationId))
  return data.data
}
export async function adminExpansions() {
  const { data } = await api.get('/admin/court-expansions')
  return data.data
}
export async function decideExpansion(id, approve, payload) {
  const { data } = await api.post(`/admin/court-expansions/${id}/${approve ? 'approve' : 'reject'}`, payload)
  return data.data
}
export async function expansionProof(id, admin, locationId) {
  const { data } = await api.get(`/${admin ? 'admin' : 'owner'}/court-expansions/${id}/proof`, {
    ...(admin ? {} : config(locationId)), responseType: 'blob',
  })
  return data
}
