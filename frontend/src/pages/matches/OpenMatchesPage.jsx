import { subscribeLiveRefresh } from '../../utils/liveRefresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { Button, FormField, Input, Select, PageHeader, StatusBadge, LoadingState, EmptyState, ErrorState, Tabs, Modal, ConfirmDialog, Drawer } from '../../components/common';
import { shortDate, uiMessage } from '../../utils/formatters';
import { apiErrorMessage } from '../../api';
import {
  approveJoinRequest,
  cancelJoinRequest,
  cancelMatch,
  closeMatch,
  formatMinute,
  getJoinRequests,
  getMatch,
  getMyMatches,
  getOpenMatches,
  rejectJoinRequest,
  sendJoinRequest,
} from '../../api/matchApi';
import { searchFacilities } from '../../api/facilityApi';
import { getMySkillLevel } from '../../api/teamApi';
import { useAuth } from '../../hooks/useAuth';
import { isSkillLevel, matchSkillLabel, NO_SKILL_FILTER, NO_SKILL_LABEL, SKILL_LEVELS } from '../../utils/skillLevels';
import styles from './OpenMatchesPage.module.css';
import { useResource } from '../workspaceSupport';
import { keepMatchAfterRescheduleApi } from '../../api/bookingApi';

const TIME_SLOTS = {
  morning: { label: 'Sáng (06:00 – 12:00)', fromMinute: 360, toMinute: 720 },
  afternoon: { label: 'Chiều (12:00 – 17:00)', fromMinute: 720, toMinute: 1020 },
  evening: { label: 'Tối (17:00 – 23:00)', fromMinute: 1020, toMinute: 1380 },
  all: { label: 'Mọi khung giờ' },
};

function todayIso() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function formatMatchDate(date) { return shortDate(date); }

function capacityOf(match) {
  return match.currentPlayers + match.neededPlayers;
}

export default function OpenMatchesPage() {
  const [notificationParams] = useSearchParams();
  const requestedMatch = notificationParams.get('matchId');
  const { isAuthenticated, role } = useAuth();
  const isPlayer = isAuthenticated && role === 'player';
  const [tab, setTab] = useState('open');
  const [detailId, setDetailId] = useState(null);
  const [dismissedNotification, setDismissedNotification] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
  const [noticeTone, setNoticeTone] = useState('success');
  const [loadingHosted, setLoadingHosted] = useState(isPlayer);
  const [requestMatches, setRequestMatches] = useState([]);

  // Bỏ trống = mọi ngày từ hôm nay trở đi (backend chỉ trả kèo OPEN chưa qua ngày chơi).
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('');
  // Lọc theo trình độ của kèo: '' = mọi trình độ, NO_SKILL_FILTER = kèo Không yêu cầu.
  const [selectedSkill, setSelectedSkill] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(() => ({ date: '', timeSlot: 'all', locationId: '', skillLevel: '' }));
  // FR104: lọc kèo theo địa điểm; danh sách địa điểm đang hoạt động lấy từ UC11.
  const [locations, setLocations] = useState([]);

  const [matches, setMatches] = useState([]);
  const [matchesError, setMatchesError] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Kèo tôi làm chủ đang mở, kèm yêu cầu đang chờ và người đã được duyệt (FR103: chủ kèo xem SĐT người đã duyệt).
  const [hostedMatches, setHostedMatches] = useState([]);
  const [hostedError, setHostedError] = useState('');
  // Kèo tôi đã được duyệt vào, còn hiệu lực (FR103: người đã duyệt xem SĐT chủ kèo).
  const [joinedMatches, setJoinedMatches] = useState([]);

  const [requestingMatchId, setRequestingMatchId] = useState(null);
  const [sharePhone, setSharePhone] = useState(false);
  // FR99: hồ sơ chưa có trình độ thì chọn khi gửi yêu cầu; null = chưa tải xong.
  const [mySkill, setMySkill] = useState(null);
  const [chosenSkill, setChosenSkill] = useState('');
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const loadMatches = useCallback(async (quiet = false) => {
    if (quiet !== true) setLoadingMatches(true);
    try {
      const slot = TIME_SLOTS[appliedFilters.timeSlot] ?? TIME_SLOTS.all;
      const page = await getOpenMatches({
        locationId: appliedFilters.locationId || undefined,
        playDate: appliedFilters.date || undefined,
        fromMinute: slot.fromMinute,
        toMinute: slot.toMinute,
        skillLevel: appliedFilters.skillLevel || undefined,
      });
      setMatches(page.content ?? []);
      setMatchesError('');
    } catch (cause) {
      setMatchesError(apiErrorMessage(cause, 'Không tải được danh sách kèo.'));
    } finally {
      setLoadingMatches(false);
    }
  }, [appliedFilters]);

  const loadHosted = useCallback(async (quiet = false) => {
    if (!isPlayer) return;
    if (quiet !== true) setLoadingHosted(true);
    try {
      const [page, joined] = await Promise.all([
        getMyMatches({ role: 'HOSTED', status: 'OPEN' }),
        getMyMatches({ role: 'JOINED' }),
      ]);
      const hosted = await Promise.all(
        (page.content ?? []).map(async (match) => {
          try {
            const [requests, approved] = await Promise.all([
              getJoinRequests(match.id, 'PENDING'),
              getJoinRequests(match.id, 'APPROVED'),
            ]);
            return { match, requests, approved };
          } catch {
            return { match, requests: [], approved: [], requestsError: 'Không tải được yêu cầu của kèo này.' };
          }
        })
      );
      setHostedMatches(hosted);
      setRequestMatches(joined.content ?? []);
      setJoinedMatches((joined.content ?? []).filter((match) =>
        match.myJoinStatus === 'APPROVED' && (match.status === 'OPEN' || match.status === 'CLOSED')));
      setHostedError('');
    } catch (cause) {
      setHostedError(apiErrorMessage(cause, 'Không tải được kèo của bạn.'));
    } finally { setLoadingHosted(false); }
  }, [isPlayer]);

  useEffect(() => {
    const timer = setTimeout(loadMatches, 0);
    const stop = subscribeLiveRefresh(() => loadMatches(true));
    return () => { clearTimeout(timer); stop(); };
  }, [loadMatches]);

  useEffect(() => {
    if (!isPlayer) return undefined;
    const timer = setTimeout(loadHosted, 0);
    const stop = subscribeLiveRefresh(() => loadHosted(true));
    return () => { clearTimeout(timer); stop(); };
  }, [isPlayer, loadHosted]);

  useEffect(() => {
    const controller = new AbortController();
    searchFacilities({ signal: controller.signal })
      .then((result) => setLocations(result?.data?.items ?? []))
      .catch(() => setLocations([]));
    return () => controller.abort();
  }, []);

  const reloadAll = useCallback(() => Promise.all([loadMatches(), loadHosted()]), [loadMatches, loadHosted]);

  const submitFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ date: selectedDate, timeSlot, locationId: selectedLocation, skillLevel: selectedSkill });
  };

  const openJoinDialog = (matchId) => {
    setRequestingMatchId(matchId);
    setSharePhone(false);
    setRequestError('');
    setChosenSkill('');
    setMySkill(null);
    getMySkillLevel().then(setMySkill).catch(() => setMySkill(''));
  };

  const needsSkill = mySkill !== null && !isSkillLevel(mySkill);

  const submitJoinRequest = async () => {
    if (submitting || actionLock.current) return;
    if (needsSkill && !isSkillLevel(chosenSkill)) {
      setRequestError('Hồ sơ của bạn chưa có trình độ chơi, vui lòng chọn trình độ.');
      return;
    }
    if (!sharePhone) {
      setRequestError('Vui lòng đồng ý chia sẻ số điện thoại để tham gia kèo. (MSG24)');
      return;
    }
    actionLock.current = true;
    setNoticeTone('success');
    setSubmitting(true);
    try {
      await sendJoinRequest(requestingMatchId, true, needsSkill ? chosenSkill : undefined);
      setRequestingMatchId(null);
      setRequestError('');
      setNotice('Đã gửi yêu cầu tham gia. Chủ kèo sẽ xét duyệt.');
      await reloadAll();
    } catch (cause) {
      setRequestError(apiErrorMessage(cause, 'Không gửi được yêu cầu tham gia.'));
    } finally {
      actionLock.current = false;
      setSubmitting(false);
    }
  };

  const withdrawRequest = async (match) => {
    try {
      await cancelJoinRequest(match.myJoinRequestId);
      setNotice('Đã rút yêu cầu tham gia.');
      await reloadAll();
    } catch (cause) {
      setNoticeTone('danger');
      setNotice(apiErrorMessage(cause, 'Không rút được yêu cầu.'));
    }
  };

  const decideRequest = async (requestId, approve) => {
    try {
      await (approve ? approveJoinRequest(requestId) : rejectJoinRequest(requestId));
      setNotice(approve ? 'Đã duyệt người chơi vào kèo. (MSG75)' : 'Đã từ chối yêu cầu tham gia.');
    } catch (cause) {
      setNoticeTone('danger');
      setNotice(apiErrorMessage(cause, 'Không xử lý được yêu cầu.'));
    }
    await reloadAll();
  };

  const finishHostedMatch = async (matchId, close) => {
    try {
      await (close ? closeMatch(matchId) : cancelMatch(matchId));
      setNotice(close
        ? 'Kèo đã đóng. Mọi yêu cầu tham gia đang chờ đã được hủy. (MSG76)'
        : 'Kèo đã hủy. Mọi yêu cầu tham gia đang chờ đã được hủy. (MSG76)');
    } catch (cause) {
      setNoticeTone('danger');
      setNotice(apiErrorMessage(cause, 'Không cập nhật được kèo.'));
    }
    await reloadAll();
  };

  const [detailRevision, setDetailRevision] = useState(0);
  async function runAction(action) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionBusy(true);
    setNotice('');
    setNoticeTone('success');
    try { await action(); setDetailRevision(value => value + 1); }
    catch (error) { setNoticeTone('danger'); setNotice(apiErrorMessage(error)); }
    finally { actionLock.current = false; setActionBusy(false); setConfirmation(null); }
  }
  const confirm = (title, message, action) => setConfirmation({ title, message, action });
  const resetFilters = () => {
    setSelectedDate(''); setTimeSlot('all'); setSelectedLocation(''); setSelectedSkill('');
    setAppliedFilters({ date: '', timeSlot: 'all', locationId: '', skillLevel: '' });
  };
  const joinArea = (match, privateDetail = false) => {
    if (match.host) return <p className={styles.helper}>Bạn là chủ kèo này.</p>;
    if (match.myJoinStatus === 'PENDING') return <div className={styles.actions}><StatusBadge status="PENDING" category="join_request" /><Button variant="secondary" disabled={actionBusy} onClick={() => confirm('Rút yêu cầu tham gia?', 'Yêu cầu đang chờ sẽ được hủy. Chủ kèo sẽ không xét duyệt yêu cầu này nữa.', () => withdrawRequest(match))}>Rút yêu cầu</Button></div>;
    if (match.myJoinStatus === 'APPROVED') return <div className={styles.contact}><StatusBadge status="APPROVED" category="join_request" />{privateDetail && isPlayer && match.hostPhone && <p>Số điện thoại chủ kèo: <a href={'tel:' + match.hostPhone}>{match.hostPhone}</a></p>}</div>;
    if (match.myJoinStatus === 'REJECTED') return <div><StatusBadge status="REJECTED" category="join_request" /><p className={styles.helper}>Bạn đã bị từ chối ở kèo này và không thể gửi lại yêu cầu.</p></div>;
    if (!isAuthenticated) return <Link to="/login" state={{ returnTo: '/open-matches' }} className={styles.linkButton}>Tham gia</Link>;
    if (!isPlayer) return <Button disabled>Chỉ dành cho người chơi</Button>;
    return <Button disabled={match.neededPlayers === 0 || match.status !== 'OPEN' || actionBusy} onClick={() => openJoinDialog(match.id)}>Tham gia</Button>;
  };
  const card = match => <article className={styles.matchCard} key={match.id} aria-label={`${match.locationName} · ${match.courtName}`}>
    <div className={styles.dateStrip}><span>{formatMatchDate(match.playDate)}</span><strong>{formatMinute(match.startMinute)}</strong><span>đến {formatMinute(match.endMinute)}</span></div>
    <div className={styles.cardBody}>
      <div className={styles.cardTop}><h2>{match.locationName}</h2><StatusBadge status={match.status} category="match" /></div>
      <p className={styles.court}>{match.courtName} · Đội {match.teamName}</p>
      <div className={styles.skills}><span className={styles.chip}>Kèo: {matchSkillLabel(match)}</span>{isSkillLevel(match.teamSkillLevel) && <span className={styles.teamSkill}>Đội: {match.teamSkillLevel}</span>}</div>
      <p className={styles.helper}>Chủ kèo: <strong>{match.hostName}</strong></p>
      <div className={styles.capacity}><span><strong>{match.currentPlayers}/{capacityOf(match)}</strong> người</span><span>Cần thêm {match.neededPlayers}</span></div>
      <progress className={styles.progress} max={Math.max(1, capacityOf(match))} value={match.currentPlayers} aria-label={`Số người: ${match.currentPlayers}/${capacityOf(match)}`} />
      <div className={styles.cardFooter}><Button variant="secondary" onClick={() => setDetailId(match.id)}>Xem chi tiết</Button>{joinArea(match)}</div>
    </div>
  </article>;
  const hostedDetails = match => {
    const hosted = hostedMatches.find(item => item.match.id === match.id);
    if (!isPlayer || !match.host) return null;
    return <section className={styles.hostSection} aria-label="Quản lý kèo">
      <h3>Yêu cầu tham gia</h3>
      {loadingHosted ? <LoadingState message="Đang tải yêu cầu…" /> : hostedError ? <ErrorState message={hostedError} onRetry={loadHosted} /> : hosted?.requestsError ? <ErrorState message={hosted.requestsError} onRetry={loadHosted} /> : <>
        {!hosted?.requests.length ? <EmptyState title="Chưa có yêu cầu đang chờ" description="Người chơi gửi yêu cầu sẽ xuất hiện tại đây. Bạn có thể làm mới để kiểm tra." action={<Button variant="secondary" onClick={loadHosted}>Làm mới</Button>} /> :
          <ul className={styles.people}>{hosted.requests.map(request => <li key={request.id}><div><strong>{request.fullName}</strong><p className={styles.helper}>{request.skillLevel || 'Chưa có trình độ'}</p><StatusBadge status="PENDING" category="join_request" /></div><div className={styles.actions}>
            <Button variant="secondary" disabled={actionBusy} onClick={() => confirm('Từ chối yêu cầu?', `${request.fullName} sẽ không được tham gia và không thể gửi lại yêu cầu vào kèo này.`, () => decideRequest(request.id, false))}>Từ chối</Button>
            <Button loading={actionBusy} onClick={() => runAction(() => decideRequest(request.id, true))}>Duyệt</Button>
          </div></li>)}</ul>}
        <h3>Người đã được duyệt ({hosted?.approved.length || 0})</h3>
        {!hosted?.approved.length ? <p className={styles.helper}>Chưa có người chơi được duyệt vào kèo.</p> : <ul className={styles.people}>{hosted.approved.map(request => <li key={request.id}><div><strong>{request.fullName}</strong><p className={styles.helper}>{request.skillLevel}</p>{request.phone && <a href={'tel:' + request.phone}>{request.phone}</a>}</div><StatusBadge status="APPROVED" category="join_request" /></li>)}</ul>}
      </>}
      {match.status === 'OPEN' && !match.reschedulePending && <div className={styles.actions}><Button variant="secondary" disabled={actionBusy} onClick={() => confirm('Đóng kèo?', 'Kèo ngừng tuyển người. Mọi yêu cầu đang chờ sẽ bị hủy; những người đã được duyệt vẫn ở trong kèo.', () => finishHostedMatch(match.id, true))}>Đóng kèo</Button><Button variant="danger" disabled={actionBusy} onClick={() => confirm('Hủy kèo?', 'Kèo sẽ bị hủy và không nhận người chơi. Mọi yêu cầu tham gia đang chờ sẽ bị hủy. Thao tác này không hủy lịch đặt sân.', () => finishHostedMatch(match.id, false))}>Hủy kèo</Button></div>}
    </section>;
  };
  const openPanel = <>
    <form className={styles.filters} onSubmit={submitFilters}>
      <FormField label="Địa điểm"><Select id="match-location" value={selectedLocation} onChange={event => setSelectedLocation(event.target.value)}><option value="">Mọi địa điểm</option>{locations.map(location => <option key={location.facility_id} value={location.facility_id}>{location.facility_name}</option>)}</Select></FormField>
      <FormField label="Ngày chơi"><Input id="match-date" type="date" min={todayIso()} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></FormField>
      <FormField label="Khung giờ"><Select id="match-time" value={timeSlot} onChange={event => setTimeSlot(event.target.value)}>{Object.entries(TIME_SLOTS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</Select></FormField>
      <FormField label="Trình độ"><Select id="match-skill" value={selectedSkill} onChange={event => setSelectedSkill(event.target.value)}><option value="">Mọi trình độ</option>{SKILL_LEVELS.map(level => <option key={level}>{level}</option>)}<option value={NO_SKILL_FILTER}>{NO_SKILL_LABEL}</option></Select></FormField>
      <Button type="submit" loading={loadingMatches}>Lọc kèo</Button><Button variant="ghost" onClick={resetFilters}>Xóa bộ lọc</Button>
    </form>
    <div className={styles.listHeading}><h2>Cùng ra sân, tìm đồng đội</h2><span>{!loadingMatches && !matchesError && `${matches.length} kèo đang mở`}</span></div>
    {loadingMatches ? <LoadingState message="Đang tải danh sách kèo…" /> : matchesError ? <ErrorState message={matchesError} onRetry={loadMatches} /> : !matches.length ? <EmptyState title="Chưa có kèo phù hợp" description="Thử bỏ bớt bộ lọc hoặc chọn ngày, khung giờ khác để tìm đồng đội." action={<Button variant="secondary" onClick={resetFilters}>Xóa bộ lọc và tìm lại</Button>} /> : <div className={styles.matchGrid}>{matches.map(card)}</div>}
  </>;
  const allRequests = [...new Map([...requestMatches, ...joinedMatches].map(match => [match.id, match])).values()].filter(match => match.myJoinStatus);
  const personalPanel = type => !isPlayer ? <EmptyState title="Đăng nhập để theo dõi kèo" description="Dùng tài khoản người chơi để xem yêu cầu và quản lý các kèo của bạn." action={<Link className={styles.linkButton} to="/login" state={{ returnTo: '/open-matches' }}>Đăng nhập</Link>} /> : loadingHosted ? <LoadingState message="Đang tải kèo của bạn…" /> : hostedError ? <ErrorState message={hostedError} onRetry={loadHosted} /> :
    (type === 'hosted' ? hostedMatches : allRequests).length ? <div className={styles.matchGrid}>{(type === 'hosted' ? hostedMatches.map(item => item.match) : allRequests).map(card)}</div> : <EmptyState title={type === 'hosted' ? 'Bạn chưa có kèo đang mở' : 'Bạn chưa có yêu cầu tham gia'} description={type === 'hosted' ? 'Mở kèo từ chi tiết lịch đặt sân đã xác nhận cho đội của bạn.' : 'Khám phá kèo đang mở và gửi yêu cầu để tìm đồng đội.'} action={type === 'hosted' ? <Link className={styles.linkButton} to="/my-bookings">Đến lịch đặt sân để mở kèo</Link> : <Button onClick={() => setTab('open')}>Khám phá kèo đang mở</Button>} />;
  const activeDetail = detailId || (/^[1-9]\d*$/.test(requestedMatch || '') && requestedMatch !== dismissedNotification ? requestedMatch : null);
  const dismissDetail = () => { setDetailId(null); setDismissedNotification(requestedMatch); };

  return <PublicLayout>
    <PageHeader eyebrow="Giao lưu cầu lông" title="Tìm kèo, kết nối đồng đội" subtitle="Chọn lịch phù hợp, gửi yêu cầu và cùng nhau ra sân."
      breadcrumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Kèo' }]}
      actions={isPlayer && <Link className={styles.linkButton} to="/my-bookings">Mở kèo từ lịch đặt sân</Link>} />
    {notice && !activeDetail && <div role={noticeTone === 'danger' ? 'alert' : 'status'} className={`${styles.notice} ${noticeTone === 'danger' ? styles.noticeError : ''}`}><span>{uiMessage(notice)}</span><Button variant="ghost" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</Button></div>}
    <Tabs className={styles.tabs} label="Danh mục kèo" value={tab} onChange={setTab} items={[
      { value: 'open', label: 'Kèo đang mở', content: openPanel },
      { value: 'requests', label: 'Yêu cầu của tôi', content: personalPanel('requests') },
      { value: 'hosted', label: 'Kèo của tôi', content: personalPanel('hosted') },
    ]} />
    {activeDetail && <NotificationMatch key={activeDetail} id={activeDetail} revision={detailRevision} onClose={dismissDetail} busy={actionBusy} isPlayer={isPlayer} notice={notice} noticeTone={noticeTone}
      actions={match => <>{joinArea(match, true)}{hostedDetails(match)}{isPlayer && match.host && match.reschedulePending && <div className={styles.reschedule}><h3>Lịch sân đã thay đổi</h3><p>Kiểm tra ngày giờ mới trước khi quyết định giữ hoặc hủy kèo.</p><div className={styles.actions}><Button disabled={actionBusy} onClick={() => runAction(async () => { await keepMatchAfterRescheduleApi(match.id); setNotice('Đã giữ kèo ở giờ mới.'); await reloadAll(); })}>Giữ kèo ở giờ mới</Button><Button variant="danger" disabled={actionBusy} onClick={() => confirm('Hủy kèo sau đổi lịch?', 'Kèo sẽ bị hủy và các yêu cầu đang chờ sẽ không được xét duyệt. Lịch đặt sân được giữ nguyên.', () => finishHostedMatch(match.id, false))}>Hủy kèo</Button></div></div>}</>} />}
    {requestingMatchId && <Modal title="Xin tham gia kèo" busy={submitting} onClose={() => { setRequestingMatchId(null); setRequestError(''); }}>
      <div className={styles.joinBody}><p>Trình độ kèo: <strong>{matchSkillLabel(matches.find(match => match.id === requestingMatchId))}</strong>. Chủ kèo sẽ xét duyệt yêu cầu của bạn.</p>
        {mySkill === null && <LoadingState message="Đang tải thông tin người chơi…" />}
        {needsSkill && <FormField label="Trình độ chơi của bạn" required hint="Trình độ được chọn sẽ lưu vào hồ sơ của bạn."><Select aria-describedby={requestError ? 'join-error' : undefined} aria-invalid={Boolean(requestError && !chosenSkill)} id="join-skill" value={chosenSkill} onChange={event => { setChosenSkill(event.target.value); setRequestError(''); }}><option value="">Chọn trình độ</option>{SKILL_LEVELS.map(level => <option key={level}>{level}</option>)}</Select></FormField>}
        <label className={styles.consent}><input id="share-phone" aria-invalid={Boolean(requestError && !sharePhone)} type="checkbox" checked={sharePhone} disabled={submitting} aria-describedby={requestError ? 'join-error' : 'join-privacy'} onChange={event => { setSharePhone(event.target.checked); setRequestError(''); }} /><span>Tôi đồng ý chia sẻ số điện thoại với chủ kèo</span></label>
        <p id="join-privacy" className={styles.helper}>Số điện thoại không hiển thị trên danh sách kèo chung.</p>
        {requestError && <p id="join-error" role="alert" className={styles.error}>{uiMessage(requestError)}</p>}
        <div className={styles.actions}><Button variant="secondary" disabled={submitting} onClick={() => setRequestingMatchId(null)}>Quay lại</Button><Button loading={submitting} disabled={mySkill === null} onClick={submitJoinRequest}>Gửi yêu cầu</Button></div>
      </div>
    </Modal>}
    {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} tone="danger" confirmText="Xác nhận" busy={actionBusy} onClose={() => setConfirmation(null)} onConfirm={() => runAction(confirmation.action)} />}
  </PublicLayout>;
}

function NotificationMatch({ id, revision, onClose, busy, isPlayer, actions, notice, noticeTone }) {
  const load = useCallback(signal => getMatch(id, signal), [id]);
  const resource = useResource(load, `${id}:${revision}`);
  const match = resource.data;
  return <Drawer title="Chi tiết kèo" onClose={onClose} busy={busy}>
    {notice && <p role={noticeTone === 'danger' ? 'alert' : 'status'} className={`${styles.notice} ${noticeTone === 'danger' ? styles.noticeError : ''}`}>{uiMessage(notice)}</p>}
    {resource.loading ? <LoadingState message="Đang tải chi tiết kèo…" /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : !match ? <EmptyState title="Chưa có thông tin kèo" description="Đóng chi tiết và chọn một kèo khác hoặc thử tải lại." action={<Button onClick={resource.reload}>Thử lại</Button>} /> : <>
      <StatusBadge status={match.status} category="match" /><h3 className={styles.detailTitle}>{match.locationName} · {match.courtName}</h3>
      <div className={styles.detailDate}>{formatMatchDate(match.playDate)} · {formatMinute(match.startMinute)} – {formatMinute(match.endMinute)}</div>
      <dl className={styles.details}><dt>Đội</dt><dd>{match.teamName}</dd><dt>Chủ kèo</dt><dd>{match.hostName}</dd><dt>Trình độ kèo</dt><dd>{matchSkillLabel(match)}</dd><dt>Trình độ đội</dt><dd>{isSkillLevel(match.teamSkillLevel) ? match.teamSkillLevel : 'Chưa có thông tin'}</dd><dt>Số người</dt><dd>{match.currentPlayers}/{capacityOf(match)} · Cần thêm {match.neededPlayers}</dd></dl>
      {isPlayer && match.host && match.hostPhone && <p className={styles.contact}>Số điện thoại chủ kèo: {match.hostPhone}</p>}
      {actions(match)}
    </>}
  </Drawer>;
}
