import { useMemo, useState } from 'react';
import { PublicHeader } from '../../components/layout/PublicLayout';
import styles from './OpenMatchesPage.module.css';

const INITIAL_MATCHES = [
  {
    id: 'smash-arena-2',
    facility: 'Smash Arena',
    court: 'Sân 2',
    level: 'Trung bình',
    date: '2026-10-25',
    time: '19:00 – 21:00',
    host: 'Quang Huy',
    players: 6,
    capacity: 8,
  },
  {
    id: 'green-shuttle-1',
    facility: 'Green Shuttle Club',
    court: 'Sân 1',
    level: 'Nâng cao',
    date: '2026-10-25',
    time: '18:00 – 20:00',
    host: 'Thu Trang',
    players: 4,
    capacity: 8,
  },
  {
    id: 'hanoi-hub-7',
    facility: 'Hanoi Badminton Hub',
    court: 'Sân 7',
    level: 'Mới chơi',
    date: '2026-10-25',
    time: '20:00 – 22:00',
    host: 'Duc Long',
    players: 4,
    capacity: 8,
  },
  {
    id: 'dich-vong-3',
    facility: 'Dich Vong',
    court: 'Sân 3',
    level: 'Nâng cao',
    date: '2026-10-25',
    time: '21:00 – 22:30',
    host: 'Bao Ngoc',
    players: 7,
    capacity: 8,
  },
];

const INITIAL_JOIN_REQUESTS = [
  { id: 'tran-lam', initials: 'TL', name: 'Tran Lam', skill: 'Nâng cao' },
  { id: 'pham-ha', initials: 'PH', name: 'Pham Ha', skill: 'Trung bình' },
];

function formatMatchDate(date) {
  const parsedDate = new Date(`${date}T00:00:00`);
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(parsedDate);
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${day}/${month}`;
}

function getMissingPlayers(match) {
  return Math.max(match.capacity - match.players, 0);
}

export default function OpenMatchesPage() {
  const [selectedDate, setSelectedDate] = useState('2026-10-25');
  const [timeSlot, setTimeSlot] = useState('evening');
  const [appliedFilters, setAppliedFilters] = useState({
    date: '2026-10-25',
    timeSlot: 'evening',
  });
  const matches = INITIAL_MATCHES;
  const [requestedMatchIds, setRequestedMatchIds] = useState(['green-shuttle-1']);
  const [requestingMatchId, setRequestingMatchId] = useState(null);
  const [sharePhone, setSharePhone] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [joinRequests, setJoinRequests] = useState(INITIAL_JOIN_REQUESTS);
  const [hostedPlayers, setHostedPlayers] = useState(5);
  const [hostedStatus, setHostedStatus] = useState('Open');
  const [notice, setNotice] = useState('');

  const filteredMatches = useMemo(
    () =>
      matches.filter((match) => {
        if (match.date !== appliedFilters.date) return false;
        if (appliedFilters.timeSlot === 'evening') return true;
        const hour = Number(match.time.slice(0, 2));
        if (appliedFilters.timeSlot === 'morning') return hour < 12;
        if (appliedFilters.timeSlot === 'afternoon') return hour >= 12 && hour < 17;
        return true;
      }),
    [matches, appliedFilters]
  );

  const submitFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ date: selectedDate, timeSlot });
  };

  const openJoinDialog = (matchId) => {
    setRequestingMatchId(matchId);
    setSharePhone(false);
    setRequestError('');
  };

  const submitJoinRequest = () => {
    if (!sharePhone) {
      setRequestError('Vui lòng đồng ý chia sẻ số điện thoại để tham gia kèo. (MSG24)');
      return;
    }

    setRequestedMatchIds((current) =>
      current.includes(requestingMatchId) ? current : [...current, requestingMatchId]
    );
    setRequestingMatchId(null);
    setRequestError('');
  };

  const withdrawRequest = (matchId) => {
    setRequestedMatchIds((current) => current.filter((id) => id !== matchId));
  };

  const finishHostedMatch = (status) => {
    setHostedStatus(status);
    setJoinRequests([]);
    setNotice(`Kèo ${status === 'Closed' ? 'đã đóng' : 'đã hủy'}. Mọi yêu cầu tham gia đang chờ đã được hủy. (MSG76)`);
  };

  const approveRequest = (requestId) => {
    if (hostedStatus !== 'Open') return;

    const nextPlayers = Math.min(hostedPlayers + 1, 8);
    setHostedPlayers(nextPlayers);
    setJoinRequests((current) => current.filter((request) => request.id !== requestId));

    if (nextPlayers >= 8) {
      setHostedStatus('Closed');
      setJoinRequests([]);
      setNotice('Kèo đã đóng vì đủ 8/8 người. Mọi yêu cầu tham gia đang chờ đã được hủy. (MSG76)');
      return;
    }

    setNotice(`Đã duyệt yêu cầu. Kèo hiện có ${nextPlayers}/8 người. (MSG75)`);
  };

  const rejectRequest = (requestId) => {
    setJoinRequests((current) => current.filter((request) => request.id !== requestId));
  };

  return (
    <div className={styles.page}>
      <PublicHeader />

      <main className={styles.main}>
        <div className={styles.pageHeading}>
          <p>GIAO LƯU</p>
          <h1>Kèo đang tìm người chơi</h1>
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
              <option value="morning">Sáng (06:00 – 12:00)</option>
              <option value="afternoon">Chiều (12:00 – 17:00)</option>
              <option value="evening">Tối (17:00 – 23:00)</option>
              <option value="all">Mọi khung giờ</option>
            </select>
          </label>
          <button type="submit" className={styles.filterButton}>Lọc kèo</button>
        </form>

        <div className={styles.contentGrid}>
          <section className={styles.matchGrid} aria-label="Danh sách kèo mở">
            {filteredMatches.map((match) => {
              const isRequested = requestedMatchIds.includes(match.id);
              const missingPlayers = getMissingPlayers(match);

              return (
                <article className={styles.matchCard} key={match.id}>
                  <div className={styles.matchTop}>
                    <h2>{match.facility} · {match.court}</h2>
                    <span className={styles.skillBadge}>{match.level}</span>
                  </div>
                  <p className={styles.matchTime}>{formatMatchDate(match.date)} · {match.time}</p>
                  <div className={styles.hostRow}>
                    <span>Chủ kèo: <strong>{match.host}</strong></span>
                    <strong>{match.players}/{match.capacity} người</strong>
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`${match.players} trên ${match.capacity} người`}
                    aria-valuemin={0}
                    aria-valuemax={match.capacity}
                    aria-valuenow={match.players}
                  >
                    <span style={{ width: `${(match.players / match.capacity) * 100}%` }} />
                  </div>
                  <p className={styles.needPlayers}>
                    Cần thêm {missingPlayers} người
                  </p>

                  {isRequested ? (
                    <div className={styles.requestStatusRow}>
                      <strong>Đang chờ chủ kèo duyệt</strong>
                      <button
                        type="button"
                        className={styles.withdrawButton}
                        onClick={() => withdrawRequest(match.id)}
                      >
                        Rút yêu cầu
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.joinButton}
                      disabled={missingPlayers === 0}
                      onClick={() => openJoinDialog(match.id)}
                    >
                      Xin tham gia
                    </button>
                  )}
                </article>
              );
            })}
            {filteredMatches.length === 0 && (
              <div className={styles.emptyState}>Không có kèo phù hợp với ngày và khung giờ đã chọn.</div>
            )}
          </section>

          <aside className={styles.hostedCard} aria-label="Kèo tôi tổ chức">
            <h2 className={styles.hostedTitle}>Kèo tôi tổ chức</h2>
            <div className={styles.hostedSummary}>
              <strong>Smash Arena · Sân 5</strong>
              <span>30/10 · 20:00 – 22:00 · {hostedPlayers}/8 người</span>
              {hostedStatus !== 'Open' && <span className={styles.hostedStatus}>{hostedStatus === 'Closed' ? 'Đã đóng' : 'Đã hủy'}</span>}
            </div>

            <h3 className={styles.requestsTitle}>Yêu cầu tham gia ({joinRequests.length})</h3>
            {joinRequests.length > 0 ? (
              <ul className={styles.requestList}>
                {joinRequests.map((request) => (
                  <li className={styles.requestItem} key={request.id}>
                    <div className={styles.requestPerson}>
                      <span className={styles.requestAvatar}>{request.initials}</span>
                      <div>
                        <strong>{request.name}</strong>
                        <span>Trình độ: {request.skill}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.rejectButton}
                      disabled={hostedStatus !== 'Open'}
                      onClick={() => rejectRequest(request.id)}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      className={styles.approveButton}
                      disabled={hostedStatus !== 'Open'}
                      onClick={() => approveRequest(request.id)}
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
                disabled={hostedStatus !== 'Open'}
                onClick={() => finishHostedMatch('Closed')}
              >
                Đóng kèo
              </button>
              <button
                type="button"
                className={styles.cancelMatchButton}
                disabled={hostedStatus !== 'Open'}
                onClick={() => finishHostedMatch('Cancelled')}
              >
                Hủy kèo
              </button>
            </div>
          </aside>
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
              <button type="button" className={styles.modalSubmit} onClick={submitJoinRequest}>
                Gửi yêu cầu
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
