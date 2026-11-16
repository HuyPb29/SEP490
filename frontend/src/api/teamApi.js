import api from './index'

/**
 * API đội (F7 – UC26, UC27).
 * D77: đội là nhóm chơi cố định; D78: danh sách đội, tối đa 20 thành viên (DR12), bị từ chối được xin lại;
 * D79: chỉ đội trưởng xem số điện thoại thành viên, xin vào đội phải đồng ý chia sẻ số điện thoại.
 */

export async function getMyTeams(signal) {
  const { data } = await api.get('/me/teams', { signal })
  return data.data ?? []
}

/** Mọi đội, tìm theo tên (D78). Trả kèm quan hệ của người xem: member, captain, myJoinStatus. */
export async function getTeams(search, signal) {
  const { data } = await api.get('/teams', { signal, params: { search: search || undefined } })
  return data.data ?? []
}

/** Tên đội không trùng (DR27), tối đa 30 ký tự. */
export async function createTeam(name) {
  const { data } = await api.post('/teams', { name })
  return data.data
}

export async function getTeamMembers(teamId, signal) {
  const { data } = await api.get(`/teams/${teamId}/members`, { signal })
  return data.data ?? []
}

export async function leaveTeam(teamId) {
  await api.post(`/teams/${teamId}/leave`)
}

export async function removeTeamMember(memberId) {
  await api.delete(`/team-members/${memberId}`)
}

/** Chỉ đội trưởng xem được; status ví dụ 'PENDING'. */
export async function getTeamJoinRequests(teamId, status, signal) {
  const { data } = await api.get(`/teams/${teamId}/join-requests`, { signal, params: { status } })
  return data.data ?? []
}

export async function sendTeamJoinRequest(teamId, phoneConsent) {
  const { data } = await api.post(`/teams/${teamId}/join-requests`, { phoneConsent })
  return data.data
}

export async function approveTeamJoinRequest(requestId) {
  const { data } = await api.post(`/team-join-requests/${requestId}/approve`)
  return data.data
}

export async function rejectTeamJoinRequest(requestId) {
  const { data } = await api.post(`/team-join-requests/${requestId}/reject`)
  return data.data
}

export async function cancelTeamJoinRequest(requestId) {
  const { data } = await api.post(`/team-join-requests/${requestId}/cancel`)
  return data.data
}
