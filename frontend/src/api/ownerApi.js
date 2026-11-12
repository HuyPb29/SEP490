import api from './index'

export async function loadOwnerLocations(signal) {
  const { data } = await api.get('/owner/locations', { signal })
  return data.data
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
