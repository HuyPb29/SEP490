import api from './index'

export function createComplaintWithEvidence(data, evidence) {
  const body = new FormData()
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  body.append('evidence', evidence)
  return api.post('/complaints/with-evidence', body)
}

export async function getComplaintEvidence(id, signal) {
  const { data } = await api.get('/complaints/' + id + '/evidence', { signal })
  return data.data
}

export async function getComplaintEvidenceImage(id, signal) {
  const { data } = await api.get('/complaints/' + id + '/evidence/image', { signal, responseType: 'blob' })
  return data
}
