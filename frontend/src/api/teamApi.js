import http, { unwrap } from './http';

// ---- Đội (UC27, UC28)
export const listTeams = (search) => http.get('/teams', { params: { search: search || undefined } }).then(unwrap);
export const listMyTeams = () => http.get('/me/teams').then(unwrap);
export const createTeam = (name) => http.post('/teams', { name }).then(unwrap);
export const listTeamMembers = (teamId) => http.get(`/teams/${teamId}/members`).then(unwrap);
export const leaveTeam = (teamId) => http.post(`/teams/${teamId}/leave`).then(unwrap);
export const removeTeamMember = (memberId) => http.delete(`/team-members/${memberId}`).then(unwrap);

export const requestJoinTeam = (teamId, phoneConsent) =>
  http.post(`/teams/${teamId}/join-requests`, { phoneConsent }).then(unwrap);
export const listTeamJoinRequests = (teamId) => http.get(`/teams/${teamId}/join-requests`).then(unwrap);
export const decideTeamJoinRequest = (id, action) => http.post(`/team-join-requests/${id}/${action}`).then(unwrap);

// ---- Kèo (UC29, UC30)
export const listMatches = (params) => http.get('/matches', { params }).then(unwrap);
export const createMatch = (body) => http.post('/matches', body).then(unwrap);
export const updateMatch = (id, body) => http.patch(`/matches/${id}`, body).then(unwrap);
export const closeMatch = (id) => http.post(`/matches/${id}/close`).then(unwrap);
export const cancelMatch = (id) => http.post(`/matches/${id}/cancel`).then(unwrap);

export const requestJoinMatch = (matchId, phoneConsent) =>
  http.post(`/matches/${matchId}/join-requests`, { phoneConsent }).then(unwrap);
export const listMatchJoinRequests = (matchId) => http.get(`/matches/${matchId}/join-requests`).then(unwrap);
export const decideMatchJoinRequest = (id, action) => http.post(`/match-join-requests/${id}/${action}`).then(unwrap);
