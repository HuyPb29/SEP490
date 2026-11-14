import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { apiErrorMessage } from '../../api'
import {
  approveTeamJoinRequest,
  cancelTeamJoinRequest,
  createTeam,
  getMyTeams,
  getTeamJoinRequests,
  getTeamMembers,
  getTeams,
  leaveTeam,
  rejectTeamJoinRequest,
  removeTeamMember,
  sendTeamJoinRequest,
} from '../../api/teamApi'
import WorkspaceLayout, { ConfirmDialog, EmptyState, Feedback, Field, Modal, Section, StatusPill } from '../WorkspaceLayout'
import { useResource } from '../workspaceSupport'

/**
 * Trang đội của Player (UC26, UC27).
 * Ba phần: yêu cầu tham gia (đội mình làm chủ) → đội của tôi (+ tạo đội, xem thành viên) → các đội khác (xin vào).
 * Mọi thao tác gọi API rồi tải lại từ server, không tự sửa số liệu ở state.
 */

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function rowStyle(selected) {
  return selected ? { borderColor: 'var(--cw-accent, #059669)', borderWidth: 2, display: 'block' } : undefined
}

const rowHead = { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px 14px' }

/** Thao tác một nút gọi API, hiện lỗi của backend ngay cạnh nút. */
function useAction(afterSuccess) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = useCallback(async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      afterSuccess?.()
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [afterSuccess])
  return { busy, error, run, clearError: () => setError('') }
}

// ---------------------------------------------------------------- Yêu cầu tham gia (đội trưởng duyệt)

function IncomingRequests({ revision, refreshAll }) {
  const load = useCallback(async (signal) => {
    const teams = (await getMyTeams(signal)).filter((team) => team.captain)
    const groups = await Promise.all(teams.map(async (team) => {
      const requests = await getTeamJoinRequests(team.id, 'PENDING', signal)
      return requests.map((request) => ({ ...request, teamName: team.name, teamId: team.id }))
    }))
    return groups.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }, [])
  const requests = useResource(load, revision)
  const action = useAction(refreshAll)

  return <Section title="Yêu cầu tham gia" resource={requests}>
    <p className="cw-muted">Người chơi xin vào đội bạn làm đội trưởng. Duyệt thì họ thành thành viên; đội tối đa 20 người.</p>
    {action.error && <Feedback tone="error">{action.error}</Feedback>}
    {requests.data?.length > 0 && <ul className="cw-records">
      {requests.data.map((request) => <li key={request.id} className="cw-record">
        <div>
          <div className="cw-record-title">{request.fullName} · xin vào đội {request.teamName}</div>
          <small>
            {request.skillLevel ? 'Trình độ: ' + request.skillLevel + ' · ' : ''}
            {request.phone ? 'SĐT: ' + request.phone + ' · ' : ''}
            Gửi lúc {formatTime(request.createdAt)}
          </small>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="cw-secondary" disabled={action.busy}
            onClick={() => action.run(() => rejectTeamJoinRequest(request.id))}>Từ chối</button>
          <button type="button" className="action" disabled={action.busy}
            onClick={() => action.run(() => approveTeamJoinRequest(request.id))}>Xác nhận</button>
        </div>
      </li>)}
    </ul>}
    {requests.data?.length === 0 && <EmptyState>Không có yêu cầu tham gia đang chờ.</EmptyState>}
  </Section>
}

// ---------------------------------------------------------------- Đội của tôi

function TeamDetails({ team, refreshAll }) {
  const container = useRef(null)
  useEffect(() => { container.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  const load = useCallback((signal) => getTeamMembers(team.id, signal), [team.id])
  const members = useResource(load, team.id)
  const [confirm, setConfirm] = useState(null) // { kind: 'remove', member } | { kind: 'leave' }
  const action = useAction(() => { setConfirm(null); members.reload(); refreshAll() })

  function runConfirmed() {
    if (!confirm) return
    if (confirm.kind === 'leave') action.run(() => leaveTeam(team.id))
    else action.run(() => removeTeamMember(confirm.member.id))
  }

  return <div ref={container} style={{ marginTop: 12 }}>
    <Section title={'Thành viên đội ' + team.name} resource={members}>
      <p className="cw-muted">
        Đội trưởng: {team.captainName} · {team.memberCount}/{team.maxMembers ?? 20} thành viên
        {team.captain ? ' · Bạn là đội trưởng, chỉ bạn thấy số điện thoại của thành viên.' : ''}
      </p>
      {action.error && <Feedback tone="error">{action.error}</Feedback>}
      {members.data?.length > 0 && <ul className="cw-records">
        {members.data.map((member) => <li key={member.id} className="cw-record">
          <div>
            <div className="cw-record-title">{member.fullName}</div>
            <small>
              {member.skillLevel ? 'Trình độ: ' + member.skillLevel + ' · ' : ''}
              {member.phone ? 'SĐT: ' + member.phone + ' · ' : ''}
              Vào đội {formatTime(member.joinedAt)}
            </small>
          </div>
          {member.captain
            ? <StatusPill tone="positive">Đội trưởng</StatusPill>
            : team.captain && <button type="button" className="cw-danger" disabled={action.busy}
              onClick={() => setConfirm({ kind: 'remove', member })}>Xóa khỏi đội</button>}
        </li>)}
      </ul>}
      {!team.captain && <div className="cw-modal-actions" style={{ justifyContent: 'start' }}>
        <button type="button" className="cw-danger" disabled={action.busy} onClick={() => setConfirm({ kind: 'leave' })}>
          Rời đội
        </button>
      </div>}
    </Section>
    {confirm && <ConfirmDialog tone="danger" onCancel={() => setConfirm(null)} onConfirm={runConfirmed}
      title={confirm.kind === 'leave' ? 'Rời đội ' + team.name : 'Xóa ' + confirm.member.fullName + ' khỏi đội'}>
      {confirm.kind === 'leave'
        ? 'Bạn sẽ không còn là thành viên của đội này. Muốn quay lại phải gửi yêu cầu và được đội trưởng duyệt.'
        : 'Thành viên này sẽ bị xóa khỏi đội. Muốn quay lại họ phải gửi yêu cầu mới.'}
    </ConfirmDialog>}
  </div>
}

function CreateTeamModal({ onClose, onCreated }) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Tên đội không được để trống.'); return }
    setBusy(true)
    setError('')
    try {
      const team = await createTeam(trimmed)
      onCreated(team)
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Không tạo được đội.'))
    } finally {
      setBusy(false)
    }
  }

  return <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
    <form className="cw-modal-content" onSubmit={submit}>
      <h2 id={titleId}>Tạo đội mới</h2>
      <p className="cw-muted">Bạn sẽ là đội trưởng. Tên đội không trùng với đội đã có, tối đa 30 ký tự.</p>
      <Field label="Tên đội" value={name} maxLength={30} required autoFocus error={error || undefined}
        onChange={(event) => { setName(event.target.value); setError('') }} />
      <div className="cw-modal-actions">
        <button type="button" className="cw-secondary" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="submit" className="action" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo đội'}</button>
      </div>
    </form>
  </Modal>
}

function MyTeams({ revision, refreshAll }) {
  const load = useCallback((signal) => getMyTeams(signal), [])
  const teams = useResource(load, revision)
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')

  const createButton = <button type="button" className="action" onClick={() => setCreating(true)}>+ Tạo đội</button>

  return <>
    <Section title="Đội của tôi" resource={teams} actions={createButton}>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      {teams.data?.length > 0 && <ul className="cw-records">
        {teams.data.map((team) => {
          const selected = team.id === selectedId
          return <li key={team.id} className="cw-record" style={rowStyle(selected)}>
            <div style={rowHead}>
              <div>
                <div className="cw-record-title">{team.name}</div>
                <small>{team.memberCount}/{team.maxMembers ?? 20} thành viên · {team.captain ? 'Bạn là đội trưởng' : 'Đội trưởng ' + team.captainName}</small>
              </div>
              {team.captain && <StatusPill tone="positive">Đội trưởng</StatusPill>}
              <button type="button" className="cw-secondary" onClick={() => setSelectedId(selected ? null : team.id)}>
                {selected ? 'Đóng chi tiết' : 'Xem chi tiết'}
              </button>
            </div>
            {selected && <TeamDetails key={team.id} team={team} refreshAll={refreshAll} />}
          </li>
        })}
      </ul>}
      {teams.data?.length === 0 && <EmptyState>Bạn chưa ở trong đội nào. Tạo đội mới hoặc xin vào một đội ở mục bên dưới.</EmptyState>}
    </Section>
    {creating && <CreateTeamModal onClose={() => setCreating(false)}
      onCreated={(team) => { setCreating(false); setNotice('Đã tạo đội "' + team.name + '".'); refreshAll() }} />}
  </>
}

// ---------------------------------------------------------------- Các đội khác

function JoinTeamModal({ team, onClose, onSent }) {
  const titleId = useId()
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!consent) { setError('Vui lòng đồng ý chia sẻ số điện thoại với đội trưởng để gửi yêu cầu.'); return }
    setBusy(true)
    setError('')
    try {
      await sendTeamJoinRequest(team.id, true)
      onSent()
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Không gửi được yêu cầu.'))
    } finally {
      setBusy(false)
    }
  }

  return <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
    <div className="cw-modal-content">
      <h2 id={titleId}>Xin vào đội {team.name}</h2>
      <p className="cw-muted">Đội trưởng {team.captainName} sẽ xét duyệt. Mỗi đội chỉ nhận một yêu cầu đang chờ của bạn.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError('') }} />
        <span>Tôi đồng ý chia sẻ số điện thoại với đội trưởng</span>
      </label>
      {error && <Feedback tone="error">{error}</Feedback>}
      <div className="cw-modal-actions">
        <button type="button" className="cw-secondary" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="button" className="action" onClick={submit} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
      </div>
    </div>
  </Modal>
}

function OtherTeams({ revision, refreshAll }) {
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const load = useCallback(async (signal) => (await getTeams(applied, signal)).filter((team) => !team.member), [applied])
  const teams = useResource(load, revision + ':' + applied)
  const [joining, setJoining] = useState(null)
  const [notice, setNotice] = useState('')
  const action = useAction(refreshAll)

  return <>
    <Section title="Các đội khác" resource={teams}>
      <form className="cw-form" onSubmit={(event) => { event.preventDefault(); setApplied(search.trim()) }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Field label="Tìm đội theo tên" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên đội" />
          </div>
          <button type="submit" className="cw-secondary" style={{ minHeight: 44 }}>Tìm</button>
        </div>
      </form>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      {action.error && <Feedback tone="error">{action.error}</Feedback>}
      {teams.data?.length > 0 && <ul className="cw-records">
        {teams.data.map((team) => {
          const full = team.memberCount >= (team.maxMembers ?? 20)
          return <li key={team.id} className="cw-record">
            <div>
              <div className="cw-record-title">{team.name}</div>
              <small>Đội trưởng {team.captainName} · {team.memberCount}/{team.maxMembers ?? 20} thành viên</small>
            </div>
            {team.myJoinStatus === 'PENDING' ? <>
              <StatusPill tone="pending">Đang chờ duyệt</StatusPill>
              <button type="button" className="cw-secondary" disabled={action.busy}
                onClick={() => action.run(() => cancelTeamJoinRequest(team.myJoinRequestId))}>Rút yêu cầu</button>
            </> : full ? <StatusPill tone="negative">Đội đã đủ người</StatusPill>
              : <button type="button" className="action" onClick={() => { setNotice(''); setJoining(team) }}>Xin tham gia</button>}
          </li>
        })}
      </ul>}
      {teams.data?.length === 0 && <EmptyState>{applied ? 'Không có đội nào khớp tên "' + applied + '".' : 'Chưa có đội nào khác.'}</EmptyState>}
    </Section>
    {joining && <JoinTeamModal team={joining} onClose={() => setJoining(null)}
      onSent={() => { setNotice('Đã gửi yêu cầu vào đội "' + joining.name + '". Chờ đội trưởng duyệt.'); setJoining(null); refreshAll() }} />}
  </>
}

// ---------------------------------------------------------------- Trang

export default function TeamsPage() {
  const [revision, setRevision] = useState(0)
  const refreshAll = useCallback(() => setRevision((value) => value + 1), [])
  return <WorkspaceLayout role="player" title="Đội">
    <IncomingRequests revision={revision} refreshAll={refreshAll} />
    <MyTeams revision={revision} refreshAll={refreshAll} />
    <OtherTeams revision={revision} refreshAll={refreshAll} />
  </WorkspaceLayout>
}
