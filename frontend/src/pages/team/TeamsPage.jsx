import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Empty, Field, Notice, PageShell, formatDateTime, inputClass } from '../../components/common/ui';
import { errorMessage } from '../../api/http';
import * as teamApi from '../../api/teamApi';

/** UC27 Quản lý đội, UC28 Tham gia đội. */
export default function TeamsPage() {
  const [myTeams, setMyTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const run = useCallback(async (action, message) => {
    setError('');
    setSuccess('');
    try {
      await action();
      if (message) setSuccess(message);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }, []);

  const loadMine = useCallback(() => run(async () => setMyTeams((await teamApi.listMyTeams()) || [])), [run]);
  const loadSearch = useCallback(
    () => run(async () => setTeams((await teamApi.listTeams(search)) || [])),
    [run, search],
  );

  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { loadSearch(); }, [loadSearch]);

  const openTeam = (team) =>
    run(async () => {
      setSelected(team);
      setMembers((await teamApi.listTeamMembers(team.id)) || []);
      setRequests(team.captain ? (await teamApi.listTeamJoinRequests(team.id)) || [] : []);
    });

  const refreshSelected = async () => {
    await loadMine();
    await loadSearch();
    if (selected) await openTeam(selected);
  };

  const create = async () => {
    if (await run(() => teamApi.createTeam(name.trim()), 'Đã tạo đội')) {
      setName('');
      loadMine();
      loadSearch();
    }
  };

  const join = async (team) => {
    if (!window.confirm('Bạn đồng ý chia sẻ số điện thoại với đội trưởng để được xét duyệt?')) return;
    await run(() => teamApi.requestJoinTeam(team.id, true), 'Đã gửi yêu cầu tham gia, chờ đội trưởng duyệt');
  };

  const decide = async (req, action) => {
    const ok = await run(() => teamApi.decideTeamJoinRequest(req.id, action),
      action === 'approve' ? 'Đã duyệt thành viên' : 'Đã từ chối yêu cầu');
    if (ok) refreshSelected();
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Xóa ${member.fullName} khỏi đội?`)) return;
    if (await run(() => teamApi.removeTeamMember(member.id), 'Đã xóa thành viên')) refreshSelected();
  };

  const leave = async (team) => {
    if (!window.confirm(`Rời đội ${team.name}?`)) return;
    if (await run(() => teamApi.leaveTeam(team.id), 'Đã rời đội')) {
      setSelected(null);
      loadMine();
      loadSearch();
    }
  };

  return (
    <PageShell title="Đội của tôi" subtitle="Tạo đội, duyệt thành viên và tìm đội để tham gia">
      <Notice error={error} success={success} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card title="Tạo đội mới">
            <Field label="Tên đội (tối đa 30 ký tự)">
              <input className={inputClass} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button disabled={!name.trim()} onClick={create}>Tạo đội</Button>
          </Card>

          <Card title="Đội đang tham gia">
            {myTeams.length === 0 ? <Empty>Bạn chưa tham gia đội nào</Empty> : (
              <ul className="divide-y divide-slate-100">
                {myTeams.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name} {t.captain && <Badge tone="green">Đội trưởng</Badge>}</p>
                      <p className="text-xs text-slate-500">{t.memberCount} thành viên</p>
                    </div>
                    <Button variant="secondary" onClick={() => openTeam(t)}>Chi tiết</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tìm đội">
            <input className={`${inputClass} mb-3`} placeholder="Tên đội" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            {teams.length === 0 ? <Empty>Không tìm thấy đội</Empty> : (
              <ul className="divide-y divide-slate-100">
                {teams.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-slate-500">Đội trưởng {t.captainName} · {t.memberCount} thành viên</p>
                    </div>
                    {t.member ? <Badge tone="green">Đã tham gia</Badge>
                      : <Button onClick={() => join(t)}>Xin tham gia</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={selected ? `Đội ${selected.name}` : 'Chi tiết đội'} className="self-start">
          {!selected ? <Empty>Chọn một đội để xem thành viên</Empty> : (
            <>
              <h3 className="text-sm font-semibold mb-2">Thành viên</h3>
              <ul className="divide-y divide-slate-100 mb-4">
                {members.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{m.fullName} {m.captain && <Badge tone="green">Đội trưởng</Badge>}</p>
                      <p className="text-xs text-slate-500">
                        {m.skillLevel || 'Chưa cập nhật trình độ'}{m.phone ? ` · ${m.phone}` : ''}
                      </p>
                    </div>
                    {selected.captain && !m.captain &&
                      <Button variant="danger" onClick={() => removeMember(m)}>Xóa</Button>}
                  </li>
                ))}
              </ul>

              {selected.captain && (
                <>
                  <h3 className="text-sm font-semibold mb-2">Yêu cầu tham gia</h3>
                  {requests.length === 0 ? <Empty>Không có yêu cầu</Empty> : (
                    <ul className="divide-y divide-slate-100 mb-4">
                      {requests.map((r) => (
                        <li key={r.id} className="py-2">
                          <p className="font-medium">{r.fullName} <Badge tone="amber">{r.status}</Badge></p>
                          <p className="text-xs text-slate-500 mb-2">{r.phone} · {formatDateTime(r.createdAt)}</p>
                          {r.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button onClick={() => decide(r, 'approve')}>Duyệt</Button>
                              <Button variant="secondary" onClick={() => decide(r, 'reject')}>Từ chối</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {selected.member && !selected.captain &&
                <Button variant="danger" onClick={() => leave(selected)}>Rời đội</Button>}
            </>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
