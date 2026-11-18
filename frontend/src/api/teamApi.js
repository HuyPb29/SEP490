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

/**
 * Mọi đội, tìm theo tên và lọc theo trình độ của đội (FR94).
 * Trả kèm quan hệ của người xem: member, captain, myJoinStatus.
 */
export async function getTeams(search, skillLevel, signal) {
  const { data } = await api.get('/teams', {
    signal,
    params: { search: search || undefined, skillLevel: skillLevel || undefined },
  })
  return data.data ?? []
}

/** Tên đội 3–30 ký tự, không trùng (DR27); trình độ của đội bắt buộc (FR91, DR33). */
export async function createTeam(name, skillLevel) {
  const { data } = await api.post('/teams', { name, skillLevel })
  return data.data
}

/** Chủ đội đổi trình độ của đội (FR91). */
export async function updateTeamSkillLevel(teamId, skillLevel) {
  const { data } = await api.patch(`/teams/${teamId}`, { skillLevel })
  return data.data
}

/** Trình độ trong hồ sơ của người đang đăng nhập (FR06); rỗng thì phải chọn khi xin vào đội/kèo (FR92, FR99). */
export async function getMySkillLevel(signal) {
  const { data } = await api.get('/users/me', { signal })
  return data.data?.skillLevel || ''
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

/** skillLevel chỉ cần khi hồ sơ chưa có trình độ; backend lưu vào hồ sơ (FR92). */
export async function sendTeamJoinRequest(teamId, phoneConsent, skillLevel) {
  const { data } = await api.post(`/teams/${teamId}/join-requests`, {
    phoneConsent,
    skillLevel: skillLevel || undefined,
  })
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
