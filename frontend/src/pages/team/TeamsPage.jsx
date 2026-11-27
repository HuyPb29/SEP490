import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { apiErrorMessage } from '../../api'
import {
  approveTeamJoinRequest, cancelTeamJoinRequest, createTeam, getMySkillLevel,
  getMyTeams, getTeamJoinRequests, getTeamMembers, getTeams, leaveTeam,
  rejectTeamJoinRequest, removeTeamMember, sendTeamJoinRequest, updateTeamSkillLevel,
} from '../../api/teamApi'
import { isSkillLevel, skillOptions } from '../../utils/skillLevels'
import { dateTime, shortDate } from '../../utils/formatters'
import WorkspaceLayout from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/common/Button'
import { Avatar } from '../../components/common/Avatar'
import { FormField, Input, Select } from '../../components/common/FormField'
import { Modal, ConfirmDialog } from '../../components/common/Modal'
import { EmptyState, ErrorState, LoadingState, Toast } from '../../components/common/States'
import { StatusBadge } from '../../components/common/StatusBadge'
import { Tabs } from '../../components/common/Tabs'
import { useResource } from '../workspaceSupport'
import styles from './TeamsPage.module.css'

function skillText(team) {
  return team.skillLevel ? 'Trình độ ' + team.skillLevel : 'Chưa chọn trình độ'
}

/** Khóa thao tác UI đồng bộ; dữ liệu sau thao tác luôn tải lại từ server. */
function useAction(afterSuccess) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const run = useCallback(async (fn, successMessage = 'Đã hoàn thành thao tác.') => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      setNotice(successMessage)
      afterSuccess?.(successMessage)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [afterSuccess])
  return { busy, error, notice, run, clearError: () => setError('') }
}

function TeamCard({ team, selected = false, children }) {
  return <article className={styles.teamCard} data-selected={selected || undefined} aria-label={team.name}>
    <div className={styles.cardHeading}><Avatar name={team.name} /><div><h3>{team.name}</h3><p>Đội trưởng {team.captainName}</p></div></div>
    <div className={styles.chips}><span className={styles.skillChip}>{skillText(team)}</span>
      {team.captain && <span className={styles.roleChip}>Đội trưởng</span>}</div>
    <div className={styles.capacity}><span>Thành viên</span><strong>{team.memberCount}<span> / {team.maxMembers ?? 20}</span></strong></div>
    <div className={styles.cardActions}>{children}</div>
  </article>
}

function IncomingRequests({ revision, refreshAll }) {
  const section = useRef(null)
  const load = useCallback(async (signal) => {
    const teams = (await getMyTeams(signal)).filter((team) => team.captain)
    const groups = await Promise.all(teams.map(async (team) => {
      const requests = await getTeamJoinRequests(team.id, 'PENDING', signal)
      return requests.map((request) => ({ ...request, teamName: team.name, teamId: team.id }))
    }))
    return groups.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }, [])
  const requests = useResource(load, revision)
  const [confirm, setConfirm] = useState(null)
  const action = useAction(() => {
    setConfirm(null)
    refreshAll()
  })
  useEffect(() => {
    if (action.notice) section.current?.focus({ preventScroll: true })
  }, [action.notice])
  return <section ref={section} tabIndex={-1} className={styles.section} aria-label="Yêu cầu gửi đến đội của bạn">
    <div className={styles.sectionHeading}><div><h2>Yêu cầu gửi đến</h2><p>Duyệt người chơi muốn tham gia đội bạn làm chủ. Mỗi đội tối đa 20 thành viên.</p></div></div>
    {action.notice && <Toast>{action.notice}</Toast>}
    {action.error && !confirm && <Toast tone="danger">{action.error}</Toast>}
    {requests.loading ? <LoadingState message="Đang tải yêu cầu tham gia…" /> : requests.error ? <ErrorState message={requests.error} onRetry={requests.reload} /> :
      requests.data?.length ? <ul className={styles.rows}>{requests.data.map(request => <li key={request.id} className={styles.requestRow}>
        <div className={styles.person}><Avatar name={request.fullName} /><div><h3>{request.fullName}</h3><p>Xin vào đội <strong>{request.teamName}</strong></p>
          <small>{request.skillLevel ? 'Trình độ ' + request.skillLevel + ' · ' : ''}<time dateTime={request.createdAt}>{dateTime(request.createdAt)}</time></small></div></div>
        <div className={styles.rowActions}><StatusBadge status="PENDING" category="join_request" />
          <Button variant="secondary" disabled={action.busy} onClick={() => { action.clearError(); setConfirm(request) }}>Từ chối</Button>
          <Button loading={action.busy} onClick={() => action.run(() => approveTeamJoinRequest(request.id), 'Đã duyệt ' + request.fullName + ' vào đội ' + request.teamName + '.')}>Duyệt yêu cầu</Button></div>
      </li>)}</ul> : <EmptyState title="Không có yêu cầu đang chờ" description="Khi có người xin tham gia đội bạn làm chủ, yêu cầu sẽ xuất hiện tại đây."
        action={<Button variant="secondary" onClick={requests.reload}>Làm mới yêu cầu</Button>} />}
    {confirm && <ConfirmDialog title={'Từ chối ' + confirm.fullName + '?'} tone="danger" busy={action.busy} confirmText="Từ chối yêu cầu"
      onCancel={() => setConfirm(null)} onConfirm={() => action.run(() => rejectTeamJoinRequest(confirm.id), 'Đã từ chối yêu cầu của ' + confirm.fullName + '.')}>
      <p>Người chơi sẽ không được thêm vào đội {confirm.teamName}. Yêu cầu này sẽ kết thúc; họ có thể gửi yêu cầu mới sau đó.</p>
      {action.error && <Toast tone="danger">{action.error}</Toast>}
    </ConfirmDialog>}
  </section>
}

function TeamDetails({ team, refreshAll }) {
  const container = useRef(null)
  useEffect(() => { container.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  const load = useCallback((signal) => getTeamMembers(team.id, signal), [team.id])
  const members = useResource(load, team.id)
  const [confirm, setConfirm] = useState(null)
  const action = useAction((message) => { setConfirm(null); members.reload(); refreshAll(message) })
  function runConfirmed() {
    if (!confirm) return
    if (confirm.kind === 'leave') action.run(() => leaveTeam(team.id), 'Đã rời đội ' + team.name + '.')
    else action.run(() => removeTeamMember(confirm.member.id), 'Đã xóa ' + confirm.member.fullName + ' khỏi đội.')
  }
  return <section ref={container} className={styles.details} aria-label={'Thành viên đội ' + team.name}>
    <header className={styles.detailsHeader}><div className={styles.cardHeading}><Avatar name={team.name} /><div><h2>{team.name}</h2><p>Đội trưởng {team.captainName}</p></div></div>
      <div className={styles.chips}><span className={styles.skillChip}>{skillText(team)}</span><span className={styles.roleChip}>{team.memberCount}/{team.maxMembers ?? 20} thành viên</span></div></header>
    {team.captain && <TeamSkillForm team={team} onSaved={refreshAll} />}
    <div className={styles.sectionHeading}><div><h3>Thành viên</h3><p>{team.captain ? 'Số điện thoại trong danh sách này chỉ dành cho đội trưởng.' : 'Cùng đội, cùng tiến bộ qua mỗi buổi chơi.'}</p></div></div>
    {action.error && !confirm && <Toast tone="danger">{action.error}</Toast>}
    {members.loading ? <LoadingState message="Đang tải thành viên…" /> : members.error ? <ErrorState message={members.error} onRetry={members.reload} /> :
      members.data?.length ? <ul className={styles.rows}>{members.data.map(member => <li key={member.id} className={styles.memberRow}>
        <div className={styles.person}><Avatar name={member.fullName} /><div><h4>{member.fullName}</h4>
          <p>{member.skillLevel ? 'Trình độ ' + member.skillLevel : 'Chưa chọn trình độ'} · Vào đội <time dateTime={member.joinedAt}>{shortDate(member.joinedAt)}</time></p>
          {team.captain && member.phone && <a className={styles.phone} href={'tel:' + member.phone}>{member.phone}</a>}</div></div>
        {member.captain ? <span className={styles.roleChip}>Đội trưởng</span> : team.captain && <Button variant="danger" disabled={action.busy}
          onClick={() => { action.clearError(); setConfirm({ kind: 'remove', member }) }}>Xóa khỏi đội</Button>}
      </li>)}</ul> : <EmptyState title="Chưa có thành viên để hiển thị" description="Thử tải lại danh sách để cập nhật thành viên của đội."
        action={<Button variant="secondary" onClick={members.reload}>Tải lại thành viên</Button>} />}
    {!team.captain && <div className={styles.leaveRow}><p>Bạn có thể rời đội khi không còn tham gia cùng nhóm.</p><Button variant="danger" disabled={action.busy}
      onClick={() => { action.clearError(); setConfirm({ kind: 'leave' }) }}>Rời đội</Button></div>}
    {confirm && <ConfirmDialog tone="danger" busy={action.busy} onCancel={() => setConfirm(null)} onConfirm={runConfirmed}
      confirmText={confirm.kind === 'leave' ? 'Xác nhận rời đội' : 'Xóa khỏi đội'}
      title={confirm.kind === 'leave' ? 'Rời đội ' + team.name + '?' : 'Xóa ' + confirm.member.fullName + ' khỏi đội?'}>
      <p>{confirm.kind === 'leave' ? 'Bạn sẽ không còn là thành viên của đội này. Muốn quay lại phải gửi yêu cầu và được đội trưởng duyệt.' : 'Thành viên này sẽ bị xóa khỏi đội. Muốn quay lại họ phải gửi yêu cầu mới.'}</p>
      {action.error && <Toast tone="danger">{action.error}</Toast>}
    </ConfirmDialog>}
  </section>
}

function TeamSkillForm({ team, onSaved }) {
  const [skill, setSkill] = useState(team.skillLevel || '')
  const [notice, setNotice] = useState('')
  const action = useAction(() => { setNotice('Đã cập nhật trình độ của đội.'); onSaved('Đã cập nhật trình độ của đội.') })
  const changed = skill && skill !== team.skillLevel
  return <form className={styles.skillForm} onSubmit={(event) => {
    event.preventDefault()
    setNotice('')
    if (changed) action.run(() => updateTeamSkillLevel(team.id, skill))
  }}>
    <div className={styles.skillControls}><FormField label="Trình độ của đội"><Select options={skillOptions(team.skillLevel ? '' : 'Chọn trình độ')}
      value={skill} disabled={action.busy} onChange={(event) => { setSkill(event.target.value); action.clearError(); setNotice('') }} /></FormField>
      <Button type="submit" variant="secondary" loading={action.busy} disabled={!changed}>Lưu trình độ</Button></div>
    {action.error && <Toast tone="danger">{action.error}</Toast>}
    {notice && <Toast>{notice}</Toast>}
  </form>
}

function CreateTeamModal({ onClose, onCreated }) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [skill, setSkill] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const trimmed = name.trim().replace(/\s+/g, ' ')
    const found = {}
    if (!trimmed) found.name = 'Tên đội không được để trống.'
    else if (trimmed.length < 3 || trimmed.length > 30) found.name = 'Tên đội phải từ 3 đến 30 ký tự.'
    if (!isSkillLevel(skill)) found.skill = 'Vui lòng chọn trình độ của đội.'
    setErrors(found)
    if (Object.keys(found).length) return
    lock.current = true
    setBusy(true)
    try {
      const team = await createTeam(trimmed, skill)
      onCreated(team)
    } catch (cause) {
      setErrors({ name: apiErrorMessage(cause, 'Không tạo được đội.') })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
    <form className={styles.modalContent} onSubmit={submit} noValidate>
      <div><p className={styles.eyebrow}>Bắt đầu cùng đồng đội</p><h2 id={titleId}>Tạo đội mới</h2><p className={styles.description}>Bạn sẽ là đội trưởng. Mỗi đội tối đa 20 thành viên.</p></div>
      <FormField label="Tên đội" required error={errors.name} hint="Từ 3–30 ký tự, không trùng với đội đã có."><Input value={name} maxLength={30} required autoFocus disabled={busy}
        onChange={(event) => { setName(event.target.value); setErrors({}) }} /></FormField>
      <FormField label="Trình độ của đội" required error={errors.skill} hint="Giúp người chơi tìm được nhóm phù hợp."><Select options={skillOptions('Chọn trình độ')} value={skill} required disabled={busy}
        onChange={(event) => { setSkill(event.target.value); setErrors({}) }} /></FormField>
      <div className={styles.modalActions}><Button variant="secondary" onClick={onClose} disabled={busy}>Quay lại</Button><Button type="submit" loading={busy}>Tạo đội</Button></div>
    </form>
  </Modal>
}

function MyTeams({ revision, refreshAll, onCreate, onExplore, onNotice }) {
  const section = useRef(null)
  const load = useCallback((signal) => getMyTeams(signal), [])
  const teams = useResource(load, revision)
  const [selectedId, setSelectedId] = useState(null)
  const detailsId = useId()
  const selected = teams.data?.find(team => team.id === selectedId)
  useEffect(() => {
    if (selectedId == null || selected || teams.loading) return undefined
    const frame = requestAnimationFrame(() => section.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [selectedId, selected, teams.loading])
  return <section ref={section} tabIndex={-1} className={styles.section} aria-label="Đội của tôi">
    <div className={styles.sectionHeading}><div><h2>Đội của tôi</h2><p>Những nhóm bạn đang chơi cùng. Mở đội để xem và quản lý thành viên.</p></div></div>
    {teams.loading ? <LoadingState message="Đang tải đội của bạn…" /> : teams.error ? <ErrorState message={teams.error} onRetry={teams.reload} /> :
      teams.data?.length ? <div className={styles.grid}>{teams.data.map(team => <TeamCard key={team.id} team={team} selected={team.id === selectedId}>
        <Button variant="secondary" aria-expanded={team.id === selectedId} aria-controls={detailsId} onClick={() => setSelectedId(team.id === selectedId ? null : team.id)}>
          {team.id === selectedId ? 'Đóng chi tiết' : 'Xem chi tiết'}</Button></TeamCard>)}</div> :
        <EmptyState title="Bạn chưa ở trong đội nào" description="Tạo nhóm riêng hoặc tìm một đội phù hợp để cùng ra sân."
          action={<div className={styles.emptyActions}><Button onClick={onCreate}>Tạo đội mới</Button><Button variant="secondary" onClick={onExplore}>Khám phá đội</Button></div>} />}
    <div id={detailsId}>{selected && !teams.error && <TeamDetails key={selected.id} team={selected} refreshAll={(message) => {
      onNotice(message)
      refreshAll()
    }} />}</div>
  </section>
}

function JoinTeamModal({ team, onClose, onSent }) {
  const titleId = useId()
  const consentId = useId()
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const loadSkill = useCallback((signal) => getMySkillLevel(signal), [])
  const profile = useResource(loadSkill)
  const needsSkill = profile.data !== undefined && !isSkillLevel(profile.data)
  const [skill, setSkill] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    if (needsSkill && !isSkillLevel(skill)) { setError('Hồ sơ của bạn chưa có trình độ chơi, vui lòng chọn trình độ.'); return }
    if (!consent) { setError('Vui lòng đồng ý chia sẻ số điện thoại với đội trưởng để gửi yêu cầu.'); return }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await sendTeamJoinRequest(team.id, true, needsSkill ? skill : undefined)
      onSent()
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Không gửi được yêu cầu.'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Modal labelledBy={titleId} onDismiss={onClose} busy={busy}>
    <form className={styles.modalContent} onSubmit={submit} noValidate>
      <div><p className={styles.eyebrow}>Tìm đồng đội, cùng tiến bộ</p><h2 id={titleId}>Xin vào đội {team.name}</h2><p className={styles.description}>Đội trưởng {team.captainName} sẽ xét duyệt yêu cầu của bạn.</p></div>
      <div className={styles.chips}><span className={styles.skillChip}>{skillText(team)}</span><span className={styles.roleChip}>{team.memberCount}/{team.maxMembers ?? 20} thành viên</span></div>
      {profile.loading ? <LoadingState message="Đang tải trình độ hồ sơ…" /> : profile.error ? <ErrorState message={profile.error} onRetry={profile.reload} /> : needsSkill &&
        <FormField label="Trình độ chơi của bạn" required hint="Trình độ bạn chọn sẽ được lưu vào hồ sơ."><Select options={skillOptions('Chọn trình độ')} value={skill} required disabled={busy}
          onChange={(event) => { setSkill(event.target.value); setError('') }} /></FormField>}
      <div className={styles.consentBox}><label htmlFor={consentId}><input id={consentId} type="checkbox" checked={consent} disabled={busy} aria-describedby={error ? consentId + '-error' : consentId + '-hint'}
        onChange={(event) => { setConsent(event.target.checked); setError('') }} /><span>Tôi đồng ý chia sẻ số điện thoại với đội trưởng</span></label>
        <p id={consentId + '-hint'}>Thông tin liên hệ giúp đội trưởng kết nối với bạn khi bạn được duyệt vào đội.</p></div>
      {error && <div id={consentId + '-error'}><Toast tone="danger">{error}</Toast></div>}
      <div className={styles.modalActions}><Button variant="secondary" onClick={onClose} disabled={busy}>Quay lại</Button>
        <Button type="submit" loading={busy} disabled={profile.loading || !!profile.error || !consent || (needsSkill && !isSkillLevel(skill))}>Gửi yêu cầu</Button></div>
    </form>
  </Modal>
}

function OtherTeams({ revision, refreshAll, onCreate, requestsOnly = false }) {
  const section = useRef(null)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [skill, setSkill] = useState('')
  const load = useCallback(async (signal) => (await getTeams(applied, skill, signal)).filter((team) => !team.member), [applied, skill])
  const teams = useResource(load, revision + ':' + applied + ':' + skill)
  const [joining, setJoining] = useState(null)
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null)
  const action = useAction(() => {
    setConfirm(null)
    refreshAll()
  })
  useEffect(() => {
    if (action.notice) section.current?.focus({ preventScroll: true })
  }, [action.notice])
  const visible = requestsOnly ? teams.data?.filter(team => team.myJoinStatus === 'PENDING') : teams.data
  const filtered = applied || skill
  function resetFilters() { setSearch(''); setApplied(''); setSkill('') }
  return <section ref={section} tabIndex={-1} className={styles.section} aria-label={requestsOnly ? 'Yêu cầu đã gửi' : 'Khám phá đội'}>
    <div className={styles.sectionHeading}><div><h2>{requestsOnly ? 'Yêu cầu đã gửi' : 'Tìm đội phù hợp với bạn'}</h2><p>{requestsOnly ? 'Những đội đang chờ đội trưởng duyệt yêu cầu của bạn.' : 'Kết nối với người chơi cùng trình độ và sẵn sàng cho buổi chơi tiếp theo.'}</p></div>
      {!teams.loading && !teams.error && <span className={styles.resultCount}>{visible?.length ?? 0} {requestsOnly ? 'yêu cầu' : 'đội'}</span>}</div>
    {!requestsOnly && <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setApplied(search.trim()) }}>
      <FormField label="Tìm đội theo tên"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên đội…" /></FormField>
      <FormField label="Trình độ"><Select options={skillOptions('Mọi trình độ')} value={skill} onChange={(event) => setSkill(event.target.value)} /></FormField>
      <Button type="submit" variant="secondary">Tìm đội</Button>{filtered && <Button variant="ghost" onClick={resetFilters}>Xóa bộ lọc</Button>}
    </form>}
    {notice && <Toast>{notice}</Toast>}{action.notice && <Toast>{action.notice}</Toast>}
    {action.error && !confirm && <Toast tone="danger">{action.error}</Toast>}
    {teams.loading ? <LoadingState message={requestsOnly ? 'Đang tải yêu cầu đã gửi…' : 'Đang tìm đội…'} /> : teams.error ? <ErrorState message={teams.error} onRetry={teams.reload} /> :
      visible?.length ? <div className={styles.grid}>{visible.map(team => {
        const full = team.memberCount >= (team.maxMembers ?? 20)
        const pending = team.myJoinStatus === 'PENDING'
        return <TeamCard key={team.id} team={team}>
          {pending ? <><StatusBadge status="PENDING" category="join_request" />
            <Button variant="secondary" disabled={action.busy} onClick={() => { action.clearError(); setConfirm(team) }}>Rút yêu cầu</Button></> :
            <Button disabled={full} onClick={() => { setNotice(''); setJoining(team) }}>{full ? 'Đội đã đủ người' : 'Xin tham gia'}</Button>}
        </TeamCard>
      })}</div> : <EmptyState title={requestsOnly ? 'Bạn chưa có yêu cầu đang chờ' : filtered ? 'Không tìm thấy đội phù hợp' : 'Chưa có đội để khám phá'}
        description={requestsOnly ? 'Bạn có thể tìm đội ở tab Khám phá. Khi gửi yêu cầu, trạng thái sẽ xuất hiện tại đây.' : filtered ? 'Thử tìm tên khác hoặc bỏ bớt bộ lọc trình độ.' : 'Tạo đội đầu tiên của bạn và cùng kết nối với những người chơi khác.'}
        action={requestsOnly ? <Button variant="secondary" onClick={teams.reload}>Làm mới yêu cầu</Button> : filtered ? <Button variant="secondary" onClick={resetFilters}>Xóa bộ lọc</Button> : <Button onClick={onCreate}>Tạo đội mới</Button>} />}
    {confirm && <ConfirmDialog title={'Rút yêu cầu vào đội ' + confirm.name + '?'} tone="danger" busy={action.busy} confirmText="Rút yêu cầu"
      onCancel={() => setConfirm(null)} onConfirm={() => action.run(() => cancelTeamJoinRequest(confirm.myJoinRequestId), 'Đã rút yêu cầu vào đội ' + confirm.name + '.')}>
      <p>Đội trưởng sẽ không còn xét duyệt yêu cầu này. Nếu đổi ý, bạn cần gửi yêu cầu mới và chờ duyệt lại.</p>{action.error && <Toast tone="danger">{action.error}</Toast>}
    </ConfirmDialog>}
    {joining && <JoinTeamModal team={joining} onClose={() => setJoining(null)} onSent={() => {
      setNotice('Đã gửi yêu cầu vào đội "' + joining.name + '". Chờ đội trưởng duyệt.'); setJoining(null); refreshAll()
    }} />}
  </section>
}

export default function TeamsPage() {
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState('explore')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const refreshAll = useCallback(() => setRevision((value) => value + 1), [])
  return <WorkspaceLayout role="player" title="Đội" subtitle="Tìm đồng đội phù hợp, cùng ra sân và nâng trình độ."
    actions={<Button onClick={() => setCreating(true)}>+ Tạo đội</Button>}>
    <div className={styles.page}>
      {notice && <Toast onClose={() => setNotice('')}>{notice}</Toast>}
      <Tabs className={styles.tabs} label="Quản lý đội" value={tab} onChange={setTab} items={[
        { value: 'explore', label: 'Khám phá', content: <OtherTeams revision={revision} refreshAll={refreshAll} onCreate={() => setCreating(true)} /> },
        { value: 'mine', label: 'Đội của tôi', content: <MyTeams revision={revision} refreshAll={refreshAll} onCreate={() => setCreating(true)} onExplore={() => setTab('explore')} onNotice={setNotice} /> },
        { value: 'requests', label: 'Yêu cầu', content: <div className={styles.requests}><OtherTeams requestsOnly revision={revision} refreshAll={refreshAll} /><IncomingRequests revision={revision} refreshAll={refreshAll} /></div> },
      ]} />
    </div>
    {creating && <CreateTeamModal onClose={() => setCreating(false)} onCreated={(team) => {
      setCreating(false); setNotice('Đã tạo đội "' + team.name + '".'); setTab('mine'); refreshAll()
    }} />}
  </WorkspaceLayout>
}
