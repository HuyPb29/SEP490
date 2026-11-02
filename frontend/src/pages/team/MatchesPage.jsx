import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, Empty, Field, Notice, PageShell, Pager, formatDateTime, formatMinute, inputClass,
} from '../../components/common/ui';
import { errorMessage } from '../../api/http';
import * as teamApi from '../../api/teamApi';

const STATUS = {
  OPEN: ['Đang tìm người', 'green'],
  CLOSED: ['Đã đóng', 'slate'],
  CANCELLED: ['Đã hủy', 'red'],
  EXPIRED: ['Hết hạn', 'amber'],
};

/** UC29 Đăng kèo, UC30 Tham gia kèo. */
export default function MatchesPage() {
  const [page, setPage] = useState(null);
  const [pageNo, setPageNo] = useState(0);
  const [status, setStatus] = useState('OPEN');
  const [form, setForm] = useState({ bookingId: '', currentPlayers: 1, neededPlayers: 1 });
  const [openMatch, setOpenMatch] = useState(null);
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

  const load = useCallback(
    () => run(async () => setPage(await teamApi.listMatches({ status: status || undefined, page: pageNo, size: 10 }))),
    [run, status, pageNo],
  );
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const ok = await run(() => teamApi.createMatch({
      bookingId: Number(form.bookingId),
      currentPlayers: Number(form.currentPlayers),
      neededPlayers: Number(form.neededPlayers),
    }), 'Đã đăng kèo');
    if (ok) {
      setForm({ bookingId: '', currentPlayers: 1, neededPlayers: 1 });
      load();
    }
  };

  const join = async (match) => {
    if (!window.confirm('Bạn đồng ý chia sẻ số điện thoại với chủ kèo để được xét duyệt?')) return;
    if (await run(() => teamApi.requestJoinMatch(match.id, true), 'Đã gửi yêu cầu tham gia')) load();
  };

  const manage = (match) =>
    run(async () => {
      setOpenMatch(match);
      setRequests((await teamApi.listMatchJoinRequests(match.id)) || []);
    });

  const decide = async (req, action) => {
    if (await run(() => teamApi.decideMatchJoinRequest(req.id, action),
      action === 'approve' ? 'Đã duyệt người chơi' : 'Đã từ chối yêu cầu')) {
      await load();
      await manage(openMatch);
    }
  };

  const closeOrCancel = async (match, action) => {
    const label = action === 'close' ? 'đóng' : 'hủy';
    if (!window.confirm(`Bạn muốn ${label} kèo này?`)) return;
    const call = action === 'close' ? teamApi.closeMatch : teamApi.cancelMatch;
    if (await run(() => call(match.id), `Đã ${label} kèo`)) {
      setOpenMatch(null);
      load();
    }
  };

  return (
    <PageShell title="Kèo đang mở" subtitle="Đăng kèo từ booking của bạn hoặc xin tham gia kèo của người khác">
      <Notice error={error} success={success} />
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Đăng kèo" className="md:col-span-1 self-start">
          <Field label="Mã booking (ID)">
            <input className={inputClass} type="number" min="1" value={form.bookingId}
              onChange={(e) => setForm({ ...form, bookingId: e.target.value })} />
          </Field>
          <Field label="Số người đã có (1–7)">
            <input className={inputClass} type="number" min="1" max="7" value={form.currentPlayers}
              onChange={(e) => setForm({ ...form, currentPlayers: e.target.value })} />
          </Field>
          <Field label="Số người cần tìm (1–7)">
            <input className={inputClass} type="number" min="1" max="7" value={form.neededPlayers}
              onChange={(e) => setForm({ ...form, neededPlayers: e.target.value })} />
          </Field>
          <Button disabled={!form.bookingId} onClick={create}>Đăng kèo</Button>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-slate-600">Trạng thái</span>
              <select className={`${inputClass} w-auto`} value={status}
                onChange={(e) => { setStatus(e.target.value); setPageNo(0); }}>
                <option value="">Tất cả</option>
                {Object.entries(STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            {!page || page.content.length === 0 ? <Empty>Chưa có kèo nào</Empty> : (
              <ul className="divide-y divide-slate-100">
                {page.content.map((m) => (
                  <li key={m.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{m.locationName} · {m.courtName}</p>
                        <p className="text-sm text-slate-600">
                          {m.playDate} · {formatMinute(m.startMinute)}–{formatMinute(m.endMinute)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Chủ kèo {m.hostName}{m.teamName ? ` · Đội ${m.teamName}` : ''} ·
                          Hiện có {m.currentPlayers}, cần thêm {m.neededPlayers}
                        </p>
                      </div>
                      <Badge tone={(STATUS[m.status] || [])[1]}>{(STATUS[m.status] || [m.status])[0]}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {m.host ? (
                        <Button variant="secondary" onClick={() => manage(m)}>Quản lý</Button>
                      ) : m.myJoinStatus ? (
                        <Badge tone="amber">Yêu cầu: {m.myJoinStatus}</Badge>
                      ) : m.status === 'OPEN' ? (
                        <Button onClick={() => join(m)}>Xin tham gia</Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={page} onChange={setPageNo} />
          </Card>

          {openMatch && (
            <Card title={`Quản lý kèo #${openMatch.id}`}>
              {requests.length === 0 ? <Empty>Chưa có yêu cầu tham gia</Empty> : (
                <ul className="divide-y divide-slate-100 mb-3">
                  {requests.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.fullName} <Badge tone="amber">{r.status}</Badge></p>
                        <p className="text-xs text-slate-500">{r.phone} · {formatDateTime(r.createdAt)}</p>
                      </div>
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
              {openMatch.status === 'OPEN' && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => closeOrCancel(openMatch, 'close')}>Đóng kèo</Button>
                  <Button variant="danger" onClick={() => closeOrCancel(openMatch, 'cancel')}>Hủy kèo</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
