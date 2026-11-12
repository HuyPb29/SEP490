import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { PublicHeader } from '../../components/layout/PublicLayout';
import { LoadingState } from '../../components/common';
import styles from './OpenMatchesPage.module.css';

function formatMatchDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parsedDate = new Date(`${dateStr}T00:00:00`);
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(parsedDate);
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    return `${weekday} ${day}/${month}`;
  } catch {
    return dateStr;
  }
}

function formatMatchTime(startMinute, endMinute) {
  const startH = String(Math.floor((startMinute || 0) / 60)).padStart(2, '0');
  const startM = String((startMinute || 0) % 60).padStart(2, '0');
  const endH = String(Math.floor((endMinute || 0) / 60)).padStart(2, '0');
  const endM = String((endMinute || 0) % 60).padStart(2, '0');
  return `${startH}:${startM} – ${endH}:${endM}`;
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function OpenMatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Bộ lọc tìm kiếm
  const [selectedDate, setSelectedDate] = useState(getTodayString);
  const [timeSlot, setTimeSlot] = useState('all');

  // Dữ liệu danh sách kèo mở
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState('');

  // Kèo do người dùng tổ chức (Hosted Match)
  const [hostedMatch, setHostedMatch] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isLoadingHosted, setIsLoadingHosted] = useState(false);

  // Dialog Xin tham gia kèo
  const [requestingMatchId, setRequestingMatchId] = useState(null);
  const [sharePhone, setSharePhone] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  // Dialog Mở kèo mới từ Booking của mình
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [currentPlayers, setCurrentPlayers] = useState(2);
  const [neededPlayers, setNeededPlayers] = useState(2);
  const [createError, setCreateError] = useState('');
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);

  // Thông báo phản hồi thao tác
  const [notice, setNotice] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // 1. Tải danh sách kèo mở (GET /api/matches)
  const loadMatches = useCallback(async (date = selectedDate, slot = timeSlot) => {
    setIsLoadingMatches(true);
    setMatchesError('');
    try {
      const params = {
        status: 'OPEN',
        size: 50,
      };

      if (date) params.playDate = date;

      if (slot === 'morning') {
        params.fromMinute = 360;  // 06:00
        params.toMinute = 720;    // 12:00
      } else if (slot === 'afternoon') {
        params.fromMinute = 720;  // 12:00
        params.toMinute = 1020;   // 17:00
      } else if (slot === 'evening') {
        params.fromMinute = 1020; // 17:00
        params.toMinute = 1380;   // 23:00
      }

      const res = await api.get('/matches', { params });
      // res.data.data là PageResponse<MatchResponse>
      const pageData = res.data?.data ?? res.data ?? {};
      const list = pageData.content ?? (Array.isArray(pageData) ? pageData : []);
      setMatches(Array.isArray(list) ? list : []);
    } catch (err) {
      setMatchesError(apiErrorMessage(err, 'Không thể tải danh sách kèo.'));
    } finally {
      setIsLoadingMatches(false);
    }
  }, [selectedDate, timeSlot]);

  // 2. Tải kèo do user tổ chức (GET /api/me/matches?role=HOSTED&status=OPEN)
  const loadHostedMatch = useCallback(async () => {
    if (!user) {
      setHostedMatch(null);
      setJoinRequests([]);
      return;
    }

    setIsLoadingHosted(true);
    try {
      const res = await api.get('/me/matches', {
        params: { role: 'HOSTED', status: 'OPEN', size: 1 },
      });
      const pageData = res.data?.data ?? res.data ?? {};
      const list = pageData.content ?? (Array.isArray(pageData) ? pageData : []);

      if (list.length > 0) {
        const current = list[0];
        setHostedMatch(current);

        // Tải danh sách yêu cầu xin gia nhập kèo này
        try {
          const reqRes = await api.get(`/matches/${current.id}/join-requests`, {
            params: { status: 'PENDING' },
          });
          const reqList = reqRes.data?.data ?? reqRes.data ?? [];
          setJoinRequests(Array.isArray(reqList) ? reqList : []);
        } catch {
          setJoinRequests([]);
        }
      } else {
        setHostedMatch(null);
        setJoinRequests([]);
      }
    } catch {
      setHostedMatch(null);
      setJoinRequests([]);
    } finally {
      setIsLoadingHosted(false);
    }
  }, [user]);

  // Khởi tạo và khi thay đổi bộ lọc
  useEffect(() => {
    Promise.resolve().then(() => {
      loadMatches();
      loadHostedMatch();
    });
  }, [loadMatches, loadHostedMatch]);

  const submitFilters = (event) => {
    event.preventDefault();
    loadMatches(selectedDate, timeSlot);
  };

  // Mở modal xin tham gia
  const openJoinDialog = (matchId) => {
    if (!user) {
      navigate('/login', { state: { returnTo: '/open-matches' } });
      return;
    }
    setRequestingMatchId(matchId);
    setSharePhone(false);
    setRequestError('');
  };

  // Gửi yêu cầu xin tham gia kèo (POST /api/matches/{id}/join-requests)
  const submitJoinRequest = async () => {
    if (!sharePhone) {
      setRequestError('Vui lòng đồng ý chia sẻ số điện thoại để tham gia kèo. (MSG24)');
      return;
    }

    setIsSubmittingJoin(true);
    setRequestError('');
    try {
      await api.post(`/matches/${requestingMatchId}/join-requests`, {
        phoneConsent: true,
      });
      setNotice('Đã gửi yêu cầu tham gia kèo thành công! Đang chờ chủ kèo duyệt.');
      setRequestingMatchId(null);
      loadMatches();
    } catch (err) {
      setRequestError(apiErrorMessage(err, 'Không thể gửi yêu cầu tham gia.'));
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  // Rút yêu cầu tham gia kèo (POST /api/match-join-requests/{id}/cancel)
  const withdrawRequest = async (joinRequestId) => {
    if (!joinRequestId) return;
    setActionInProgress(true);
    try {
      await api.post(`/match-join-requests/${joinRequestId}/cancel`);
      setNotice('Đã rút yêu cầu tham gia kèo.');
      loadMatches();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Không thể rút yêu cầu.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Chủ kèo duyệt yêu cầu (POST /api/match-join-requests/{id}/approve)
  const approveRequest = async (requestId) => {
    setActionInProgress(true);
    try {
      await api.post(`/match-join-requests/${requestId}/approve`);
      setNotice('Đã duyệt người chơi vào kèo thành công. (MSG75)');
      loadHostedMatch();
      loadMatches();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Không thể duyệt yêu cầu.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Chủ kèo từ chối yêu cầu (POST /api/match-join-requests/{id}/reject)
  const rejectRequest = async (requestId) => {
    setActionInProgress(true);
    try {
      await api.post(`/match-join-requests/${requestId}/reject`);
      setNotice('Đã từ chối yêu cầu tham gia.');
      loadHostedMatch();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Không thể từ chối yêu cầu.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Chủ kèo đóng kèo (POST /api/matches/{id}/close)
  const closeHostedMatch = async () => {
    if (!hostedMatch) return;
    if (!window.confirm('Xác nhận đóng kèo này? Mọi yêu cầu đang chờ sẽ được tự động hủy.')) return;
    setActionInProgress(true);
    try {
      await api.post(`/matches/${hostedMatch.id}/close`);
      setNotice('Kèo đã đóng. Mọi yêu cầu tham gia đang chờ đã được hủy. (MSG76)');
      loadHostedMatch();
      loadMatches();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Không thể đóng kèo.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Chủ kèo hủy kèo (POST /api/matches/{id}/cancel)
  const cancelHostedMatch = async () => {
    if (!hostedMatch) return;
    if (!window.confirm('Xác nhận hủy kèo này?')) return;
    setActionInProgress(true);
    try {
      await api.post(`/matches/${hostedMatch.id}/cancel`);
      setNotice('Đã hủy kèo giao lưu.');
      loadHostedMatch();
      loadMatches();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Không thể hủy kèo.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Tải danh sách Booking để mở kèo mới
  const openCreateMatchModal = async () => {
    if (!user) {
      navigate('/login', { state: { returnTo: '/open-matches' } });
      return;
    }
    setShowCreateModal(true);
    setCreateError('');
    setIsLoadingBookings(true);
    try {
      const res = await api.get('/me/bookings', { params: { size: 50 } });
      const pageData = res.data?.data ?? res.data ?? {};
      const list = pageData.content ?? (Array.isArray(pageData) ? pageData : []);
      // Lọc các booking có thể mở kèo: CONFIRMED hoặc IN_USE
      const valid = (Array.isArray(list) ? list : []).filter(
        (b) => b.status === 'CONFIRMED' || b.status === 'IN_USE'
      );
      setMyBookings(valid);
      if (valid.length > 0) setSelectedBookingId(String(valid[0].id));
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Không thể tải danh sách booking của bạn.'));
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Nộp form mở kèo mới (POST /api/matches)
  const handleCreateMatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingId) {
      setCreateError('Vui lòng chọn một lịch đặt sân để mở kèo.');
      return;
    }

    const cur = Number(currentPlayers);
    const need = Number(neededPlayers);
    if (!cur || cur < 1 || cur > 7) {
      setCreateError('Số người đã có phải từ 1 đến 7.');
      return;
    }
    if (!need || need < 1 || need > 7) {
      setCreateError('Số người cần tìm phải từ 1 đến 7.');
      return;
    }

    setIsCreatingMatch(true);
    setCreateError('');
    try {
      await api.post('/matches', {
        bookingId: Number(selectedBookingId),
        currentPlayers: cur,
        neededPlayers: need,
      });
      setNotice('Mở kèo giao lưu thành công! Bạn có thể quản lý người tham gia ở khung bên phải.');
      setShowCreateModal(false);
      loadHostedMatch();
      loadMatches();
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Không thể mở kèo. Vui lòng kiểm tra lại.'));
    } finally {
      setIsCreatingMatch(false);
    }
  };

  return (
    <div className={styles.page}>
      <PublicHeader />

      <main className={styles.main}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 17 }}>
          <div className={styles.pageHeading} style={{ margin: 0 }}>
            <p>GIAO LƯU</p>
            <h1>Kèo đang tìm người chơi</h1>
          </div>

          <button
            type="button"
            className={styles.filterButton}
            style={{ height: 42, background: 'var(--color-primary)' }}
            onClick={openCreateMatchModal}
          >
            + Mở kèo từ lịch đặt sân
          </button>
        </div>

        {/* Thanh lọc kèo */}
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
              <option value="all">Mọi khung giờ</option>
              <option value="morning">Sáng (06:00 – 12:00)</option>
              <option value="afternoon">Chiều (12:00 – 17:00)</option>
              <option value="evening">Tối (17:00 – 23:00)</option>
            </select>
          </label>
          <button type="submit" className={styles.filterButton} disabled={isLoadingMatches}>
            {isLoadingMatches ? 'Đang lọc…' : 'Lọc kèo'}
          </button>
        </form>

        {notice && (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        )}

        <div className={styles.contentGrid}>
          {/* CỘT TRÁI: DANH SÁCH KÈO MỞ */}
          <section className={styles.matchGrid} aria-label="Danh sách kèo mở">
            {isLoadingMatches ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <LoadingState message="Đang tải danh sách kèo…" />
              </div>
            ) : matchesError ? (
              <div style={{ gridColumn: '1 / -1', padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
                {matchesError}
              </div>
            ) : matches.length === 0 ? (
              <div className={styles.emptyState}>
                Không có kèo phù hợp với ngày và khung giờ đã chọn. Hãy thử chọn ngày khác hoặc tự mở kèo mới!
              </div>
            ) : (
              matches.map((match) => {
                const totalCapacity = (match.currentPlayers || 0) + (match.neededPlayers || 0);
                const isRequested = match.myJoinStatus === 'PENDING';
                const isApproved = match.myJoinStatus === 'APPROVED';
                const missingPlayers = match.neededPlayers || 0;
                const matchTimeStr = formatMatchTime(match.startMinute, match.endMinute);

                return (
                  <article className={styles.matchCard} key={match.id}>
                    <div className={styles.matchTop}>
                      <h2>{match.locationName} · {match.courtName || 'Sân cầu lông'}</h2>
                      <span className={styles.skillBadge}>
                        {match.hostSkillLevel || 'Giao lưu'}
                      </span>
                    </div>

                    <p className={styles.matchTime}>
                      {formatMatchDate(match.playDate)} · {matchTimeStr}
                    </p>

                    <div className={styles.hostRow}>
                      <span>Chủ kèo: <strong>{match.hostName || 'Người chơi'}</strong></span>
                      <strong>{match.currentPlayers}/{totalCapacity} người</strong>
                    </div>

                    <div
                      className={styles.progressTrack}
                      role="progressbar"
                      aria-label={`${match.currentPlayers} trên ${totalCapacity} người`}
                      aria-valuemin={0}
                      aria-valuemax={totalCapacity}
                      aria-valuenow={match.currentPlayers}
                    >
                      <span
                        style={{
                          width: `${totalCapacity > 0 ? (match.currentPlayers / totalCapacity) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <p className={styles.needPlayers}>
                      {missingPlayers > 0 ? `Cần thêm ${missingPlayers} người` : 'Kèo đã đủ người'}
                    </p>

                    {match.host ? (
                      <div className={styles.requestStatusRow}>
                        <strong style={{ color: 'var(--color-primary)' }}>👑 Kèo của bạn</strong>
                      </div>
                    ) : isApproved ? (
                      <div className={styles.requestStatusRow}>
                        <strong style={{ color: 'var(--color-primary)' }}>✓ Đã được duyệt vào kèo</strong>
                        {match.hostPhone && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>SĐT chủ kèo: {match.hostPhone}</span>
                        )}
                      </div>
                    ) : isRequested ? (
                      <div className={styles.requestStatusRow}>
                        <strong>Đang chờ chủ kèo duyệt</strong>
                        <button
                          type="button"
                          className={styles.withdrawButton}
                          disabled={actionInProgress}
                          onClick={() => withdrawRequest(match.myJoinRequestId)}
                        >
                          Rút yêu cầu
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.joinButton}
                        disabled={missingPlayers === 0 || actionInProgress}
                        onClick={() => openJoinDialog(match.id)}
                      >
                        {missingPlayers === 0 ? 'Đã đủ người' : 'Xin tham gia'}
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </section>

          {/* CỘT PHẢI: KÈO TÔI TỔ CHỨC */}
          <aside className={styles.hostedCard} aria-label="Kèo tôi tổ chức">
            <h2 className={styles.hostedTitle}>Kèo tôi tổ chức</h2>

            {isLoadingHosted ? (
              <LoadingState message="Đang kiểm tra kèo…" />
            ) : hostedMatch ? (
              <>
                <div className={styles.hostedSummary}>
                  <strong>{hostedMatch.locationName} · {hostedMatch.courtName}</strong>
                  <span>
                    {formatMatchDate(hostedMatch.playDate)} · {formatMatchTime(hostedMatch.startMinute, hostedMatch.endMinute)} ·{' '}
                    {hostedMatch.currentPlayers}/{(hostedMatch.currentPlayers || 0) + (hostedMatch.neededPlayers || 0)} người
                  </span>
                  {hostedMatch.status !== 'OPEN' && (
                    <span className={styles.hostedStatus}>
                      {hostedMatch.status === 'CLOSED' ? 'Đã đóng' : 'Đã hủy'}
                    </span>
                  )}
                </div>

                <h3 className={styles.requestsTitle}>
                  Yêu cầu tham gia ({joinRequests.length})
                </h3>

                {joinRequests.length > 0 ? (
                  <ul className={styles.requestList}>
                    {joinRequests.map((request) => {
                      const initial = (request.fullName || 'U').slice(0, 2).toUpperCase();
                      return (
                        <li className={styles.requestItem} key={request.id}>
                          <div className={styles.requestPerson}>
                            <span className={styles.requestAvatar}>{initial}</span>
                            <div>
                              <strong>{request.fullName}</strong>
                              <span>
                                SĐT: {request.phone || 'Đã chia sẻ'}
                                {request.skillLevel && ` · Trình độ: ${request.skillLevel}`}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actionInProgress || hostedMatch.status !== 'OPEN'}
                              onClick={() => rejectRequest(request.id)}
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={actionInProgress || hostedMatch.status !== 'OPEN'}
                              onClick={() => approveRequest(request.id)}
                            >
                              Duyệt
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.noRequests}>Không có yêu cầu tham gia nào đang chờ.</p>
                )}

                <div className={styles.hostedActions}>
                  <button
                    type="button"
                    className={styles.closeMatchButton}
                    disabled={actionInProgress || hostedMatch.status !== 'OPEN'}
                    onClick={closeHostedMatch}
                  >
                    Đóng kèo
                  </button>
                  <button
                    type="button"
                    className={styles.cancelMatchButton}
                    disabled={actionInProgress || hostedMatch.status !== 'OPEN'}
                    onClick={cancelHostedMatch}
                  >
                    Hủy kèo
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
                  Bạn hiện chưa mở kèo giao lưu nào. Nếu bạn đã đặt sân, hãy mở kèo để mời thêm bạn bè và người chơi cùng!
                </p>
                <button
                  type="button"
                  className={styles.joinButton}
                  style={{ width: '100%', padding: '10px 0' }}
                  onClick={openCreateMatchModal}
                >
                  + Mở kèo ngay
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* MODAL: XIN THAM GIA KÈO */}
      {requestingMatchId && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setRequestingMatchId(null)}
        >
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
            <p style={{ fontSize: 13, color: '#475569', margin: '8px 0 16px' }}>
              Chủ kèo sẽ nhận được yêu cầu và số điện thoại của bạn để liên hệ sắp xếp trận đấu.
            </p>

            <label className={styles.consentLabel}>
              <input
                type="checkbox"
                checked={sharePhone}
                onChange={(event) => {
                  setSharePhone(event.target.checked);
                  setRequestError('');
                }}
                disabled={isSubmittingJoin}
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
                disabled={isSubmittingJoin}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.modalSubmit}
                onClick={submitJoinRequest}
                disabled={isSubmittingJoin}
              >
                {isSubmittingJoin ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* MODAL: MỞ KÈO TỪ BOOKING (UC28 / UC29) */}
      {showCreateModal && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setShowCreateModal(false)}
        >
          <section
            className={styles.joinModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-match-modal-title"
            style={{ maxWidth: 480 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Đóng"
              onClick={() => setShowCreateModal(false)}
            >
              ×
            </button>
            <h2 id="create-match-modal-title">Mở kèo giao lưu mới</h2>

            {isLoadingBookings ? (
              <LoadingState message="Đang tải lịch đặt sân của bạn…" />
            ) : myBookings.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                  Bạn chưa có lịch đặt sân hợp lệ nào (đã xác nhận) để mở kèo. Hãy đặt sân trước khi tạo kèo giao lưu!
                </p>
                <button
                  type="button"
                  className={styles.modalSubmit}
                  onClick={() => navigate('/')}
                >
                  Tìm và đặt sân ngay
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateMatchSubmit} style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <label htmlFor="selectBookingInput" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    Chọn lịch đặt sân <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    id="selectBookingInput"
                    style={{
                      height: 42,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #d5dee5',
                      fontSize: 13,
                    }}
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    disabled={isCreatingMatch}
                  >
                    {myBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.bookingCode || b.id} · {b.locationName || 'Cơ sở'} · {formatMatchDate(b.playDate)} (
                        {formatMatchTime(b.startMinute, b.endMinute)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="currentPlayersInput" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Số người đã có <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="currentPlayersInput"
                      type="number"
                      min={1}
                      max={7}
                      style={{
                        height: 42,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid #d5dee5',
                        fontSize: 13,
                      }}
                      value={currentPlayers}
                      onChange={(e) => setCurrentPlayers(e.target.value)}
                      disabled={isCreatingMatch}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="neededPlayersInput" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Số người cần tìm <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="neededPlayersInput"
                      type="number"
                      min={1}
                      max={7}
                      style={{
                        height: 42,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid #d5dee5',
                        fontSize: 13,
                      }}
                      value={neededPlayers}
                      onChange={(e) => setNeededPlayers(e.target.value)}
                      disabled={isCreatingMatch}
                    />
                  </div>
                </div>

                {createError && (
                  <p className={styles.requestError} role="alert" style={{ marginBottom: 12 }}>
                    {createError}
                  </p>
                )}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalCancel}
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreatingMatch}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className={styles.modalSubmit}
                    disabled={isCreatingMatch}
                  >
                    {isCreatingMatch ? 'Đang tạo kèo…' : 'Xác nhận mở kèo'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
