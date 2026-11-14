import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { apiErrorMessage } from '../../api';
import {
  approveJoinRequest,
  cancelJoinRequest,
  cancelMatch,
  closeMatch,
  formatMinute,
  getJoinRequests,
  getMyMatches,
  getOpenMatches,
  rejectJoinRequest,
  sendJoinRequest,
} from '../../api/matchApi';
import { useAuth } from '../../hooks/useAuth';
import styles from './OpenMatchesPage.module.css';

const TIME_SLOTS = {
  morning: { label: 'Sáng (06:00 – 12:00)', fromMinute: 360, toMinute: 720 },
  afternoon: { label: 'Chiều (12:00 – 17:00)', fromMinute: 720, toMinute: 1020 },
  evening: { label: 'Tối (17:00 – 23:00)', fromMinute: 1020, toMinute: 1380 },
  all: { label: 'Mọi khung giờ' },
};

function todayIso() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function formatMatchDate(date) {
  const parsedDate = new Date(`${date}T00:00:00`);
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(parsedDate);
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${day}/${month}`;
}

function capacityOf(match) {
  return match.currentPlayers + match.neededPlayers;
}

export default function OpenMatchesPage() {
  const { isAuthenticated, role } = useAuth();
  const isPlayer = isAuthenticated && role === 'player';

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [timeSlot, setTimeSlot] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState(() => ({ date: todayIso(), timeSlot: 'all' }));

  const [matches, setMatches] = useState([]);
  const [matchesError, setMatchesError] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Kèo tôi làm chủ đang mở, kèm yêu cầu tham gia đang chờ của từng kèo.
  const [hostedMatches, setHostedMatches] = useState([]);
  const [hostedError, setHostedError] = useState('');

  const [requestingMatchId, setRequestingMatchId] = useState(null);
  const [sharePhone, setSharePhone] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const slot = TIME_SLOTS[appliedFilters.timeSlot] ?? TIME_SLOTS.all;
      const page = await getOpenMatches({
        playDate: appliedFilters.date || undefined,
        fromMinute: slot.fromMinute,
        toMinute: slot.toMinute,
      });
      setMatches(page.content ?? []);
      setMatchesError('');
    } catch (cause) {
      setMatchesError(apiErrorMessage(cause, 'Không tải được danh sách kèo.'));
    } finally {
      setLoadingMatches(false);
    }
  }, [appliedFilters]);

  const loadHosted = useCallback(async () => {
    if (!isPlayer) return;
    try {
      const page = await getMyMatches({ role: 'HOSTED', status: 'OPEN' });
      const hosted = await Promise.all(
        (page.content ?? []).map(async (match) => {
          try {
            const requests = await getJoinRequests(match.id, 'PENDING');
            return { match, requests };
          } catch {
            return { match, requests: [] };
          }
        })
      );
      setHostedMatches(hosted);
      setHostedError('');
    } catch (cause) {
      setHostedError(apiErrorMessage(cause, 'Không tải được kèo của bạn.'));
    }
  }, [isPlayer]);

  useEffect(() => {
    const timer = setTimeout(loadMatches, 0);
    return () => clearTimeout(timer);
  }, [loadMatches]);

  useEffect(() => {
    if (!isPlayer) return undefined;
    const timer = setTimeout(loadHosted, 0);
    return () => clearTimeout(timer);
  }, [isPlayer, loadHosted]);

  const reloadAll = useCallback(() => Promise.all([loadMatches(), loadHosted()]), [loadMatches, loadHosted]);

  const submitFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ date: selectedDate, timeSlot });
  };

  const openJoinDialog = (matchId) => {
    setRequestingMatchId(matchId);
    setSharePhone(false);
    setRequestError('');
  };

  const submitJoinRequest = async () => {
    if (!sharePhone) {
      setRequestError('Vui lòng đồng ý chia sẻ số điện thoại để tham gia kèo. (MSG24)');
      return;
    }
    setSubmitting(true);
    try {
      await sendJoinRequest(requestingMatchId, true);
      setRequestingMatchId(null);
      setRequestError('');
      setNotice('Đã gửi yêu cầu tham gia. Chủ kèo sẽ xét duyệt.');
      await reloadAll();
    } catch (cause) {
      setRequestError(apiErrorMessage(cause, 'Không gửi được yêu cầu tham gia.'));
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawRequest = async (match) => {
    try {
      await cancelJoinRequest(match.myJoinRequestId);
      setNotice('Đã rút yêu cầu tham gia.');
      await reloadAll();
    } catch (cause) {
      setNotice(apiErrorMessage(cause, 'Không rút được yêu cầu.'));
    }
  };

  const decideRequest = async (requestId, approve) => {
    try {
      await (approve ? approveJoinRequest(requestId) : rejectJoinRequest(requestId));
      setNotice(approve ? 'Đã duyệt người chơi vào kèo. (MSG75)' : 'Đã từ chối yêu cầu tham gia.');
    } catch (cause) {
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
      setNotice(apiErrorMessage(cause, 'Không cập nhật được kèo.'));
    }
    await reloadAll();
  };

  const joinArea = (match) => {
    if (match.host) {
      return <div className={styles.requestStatusRow}><strong>Kèo của bạn</strong></div>;
    }
    if (match.myJoinStatus === 'PENDING') {
      return (
        <div className={styles.requestStatusRow}>
          <strong>Đang chờ chủ kèo duyệt</strong>
          <button type="button" className={styles.withdrawButton} onClick={() => withdrawRequest(match)}>
            Rút yêu cầu
          </button>
        </div>
      );
    }
    if (match.myJoinStatus === 'APPROVED') {
      return <div className={styles.requestStatusRow}><strong>Bạn đã được duyệt vào kèo</strong></div>;
    }
    if (match.myJoinStatus === 'REJECTED') {
      // D61: bị từ chối thì không xin lại kèo đó.
      return <div className={styles.requestStatusRow}><strong>Chủ kèo đã từ chối yêu cầu của bạn</strong></div>;
    }
    if (!isAuthenticated) {
      return <Link to="/login" state={{ returnTo: '/open-matches' }} className={styles.joinButton}>Đăng nhập để xin tham gia</Link>;
    }
    if (!isPlayer) {
      return (
        <button type="button" className={styles.joinButton} disabled>
          Đăng nhập bằng tài khoản người chơi để xin tham gia
        </button>
      );
    }
    return (
      <button
        type="button"
        className={styles.joinButton}
        disabled={match.neededPlayers === 0}
        onClick={() => openJoinDialog(match.id)}
      >
        Xin tham gia
      </button>
    );
  };

  return (
    <div className={styles.page}>
      <PublicHeader />

      <main className={styles.main}>
        <div className={styles.headingRow}>
          <div className={styles.pageHeading}>
            <p>GIAO LƯU</p>
            <h1>Kèo đang tìm người chơi</h1>
          </div>
          {isPlayer && <Link to="/my-bookings" className={styles.headingAction}>Đến lịch đặt sân để mở kèo</Link>}
        </div>

        <form className={styles.filterBar} onSubmit={submitFilters}>
          <label className={styles.filterField}>
            <span>Ngày chơi</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <label className={styles.filterField}>
            <span>Khung giờ</span>
            <select value={timeSlot} onChange={(event) => setTimeSlot(event.target.value)}>
              {Object.entries(TIME_SLOTS).map(([value, slot]) => (
                <option key={value} value={value}>{slot.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={styles.filterButton}>Lọc kèo</button>
        </form>

        <div className={styles.contentGrid}>
          <section className={styles.matchGrid} aria-label="Danh sách kèo mở">
            {loadingMatches && <div className={styles.emptyState} role="status">Đang tải danh sách kèo…</div>}
            {matchesError && (
              <div className={styles.emptyState} role="alert">
                {matchesError}{' '}
                <button type="button" onClick={loadMatches}>Thử lại</button>
              </div>
            )}
            {!loadingMatches && !matchesError && matches.map((match) => (
              <article className={styles.matchCard} key={match.id}>
                <div className={styles.matchTop}>
                  <h2>{match.locationName} · {match.courtName}</h2>
                  {match.hostSkillLevel && <span className={styles.skillBadge}>{match.hostSkillLevel}</span>}
                </div>
                <p className={styles.matchTime}>
                  {formatMatchDate(match.playDate)} · {formatMinute(match.startMinute)} – {formatMinute(match.endMinute)}
                </p>
                <div className={styles.hostRow}>
                  <span>Chủ kèo: <strong>{match.hostName}</strong></span>
                  <strong>{match.currentPlayers}/{capacityOf(match)} người</strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label={`${match.currentPlayers} trên ${capacityOf(match)} người`}
                  aria-valuemin={0}
                  aria-valuemax={capacityOf(match)}
                  aria-valuenow={match.currentPlayers}
                >
                  <span style={{ width: `${(match.currentPlayers / capacityOf(match)) * 100}%` }} />
                </div>
                <p className={styles.needPlayers}>Cần thêm {match.neededPlayers} người</p>
                {joinArea(match)}
              </article>
            ))}
            {!loadingMatches && !matchesError && matches.length === 0 && (
              <div className={styles.emptyState}>Không có kèo phù hợp với ngày và khung giờ đã chọn.</div>
            )}
          </section>

          {isPlayer && (
            <aside className={styles.hostedCard} aria-label="Kèo tôi tổ chức">
              <h2 className={styles.hostedTitle}>Kèo tôi tổ chức</h2>
              {hostedError && <p role="alert">{hostedError}</p>}
              {!hostedError && hostedMatches.length === 0 && (
                <p className={styles.noRequests}>
                  Bạn chưa có kèo đang mở. Mở kèo từ chi tiết booking đã xác nhận đặt dưới tên đội của bạn.
                </p>
              )}
              {hostedMatches.map(({ match, requests }) => (
                <div key={match.id}>
                  <div className={styles.hostedSummary}>
                    <strong>{match.locationName} · {match.courtName}</strong>
                    <span>
                      {formatMatchDate(match.playDate)} · {formatMinute(match.startMinute)} – {formatMinute(match.endMinute)}
                      {' · '}{match.currentPlayers}/{capacityOf(match)} người
                    </span>
                  </div>

                  <h3 className={styles.requestsTitle}>Yêu cầu tham gia ({requests.length})</h3>
                  {requests.length > 0 ? (
                    <ul className={styles.requestList}>
                      {requests.map((request) => (
                        <li className={styles.requestItem} key={request.id}>
                          <div className={styles.requestPerson}>
                            <span className={styles.requestAvatar}>
                              {(request.fullName || '?').trim().charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <strong>{request.fullName}</strong>
                              {request.skillLevel && <span>Trình độ: {request.skillLevel}</span>}
                              {request.phone && <span>SĐT: {request.phone}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            onClick={() => decideRequest(request.id, false)}
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            className={styles.approveButton}
                            onClick={() => decideRequest(request.id, true)}
                          >
                            Duyệt
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.noRequests}>Không có yêu cầu tham gia đang chờ.</p>
                  )}

                  <div className={styles.hostedActions}>
                    <button
                      type="button"
                      className={styles.closeMatchButton}
                      onClick={() => finishHostedMatch(match.id, true)}
                    >
                      Đóng kèo
                    </button>
                    <button
                      type="button"
                      className={styles.cancelMatchButton}
                      onClick={() => finishHostedMatch(match.id, false)}
                    >
                      Hủy kèo
                    </button>
                  </div>
                </div>
              ))}
            </aside>
          )}
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </main>

      {requestingMatchId && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setRequestingMatchId(null)}>
          <section
            className={styles.joinModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Đóng"
              onClick={() => {
                setRequestingMatchId(null);
                setRequestError('');
              }}
            >
              ×
            </button>
            <h2 id="join-modal-title">Xin tham gia kèo</h2>
            <label className={styles.consentLabel}>
              <input
                type="checkbox"
                checked={sharePhone}
                onChange={(event) => {
                  setSharePhone(event.target.checked);
                  setRequestError('');
                }}
              />
              <span>Tôi đồng ý chia sẻ số điện thoại với chủ kèo</span>
            </label>
            {requestError && <p className={styles.requestError} role="alert">{requestError}</p>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => {
                  setRequestingMatchId(null);
                  setRequestError('');
                }}
              >
                Hủy
              </button>
              <button type="button" className={styles.modalSubmit} disabled={submitting} onClick={submitJoinRequest}>
                {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
