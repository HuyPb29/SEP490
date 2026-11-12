import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../api';
import PublicLayout from '../../components/layout/PublicLayout';
import { LoadingState } from '../../components/common';
import styles from './TeamsPage.module.css';

export default function TeamsPage() {
  const [activeTab, setActiveTab] = useState('my-teams'); // 'my-teams' | 'explore'

  // State Tab: Đội của tôi
  const [myTeams, setMyTeams] = useState([]);
  const [loadingMyTeams, setLoadingMyTeams] = useState(false);
  const [myTeamsError, setMyTeamsError] = useState('');

  // State Tab: Khám phá đội
  const [exploreTeams, setExploreTeams] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [exploreError, setExploreError] = useState('');

  // Thông báo chung
  const [notice, setNotice] = useState({ text: '', type: 'success' });

  // Modal: Tạo đội mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal: Xem thành viên
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Modal: Quản lý yêu cầu gia nhập
  const [selectedTeamForRequests, setSelectedTeamForRequests] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  // Modal: Xin gia nhập đội
  const [teamToJoin, setTeamToJoin] = useState(null);
  const [phoneConsent, setPhoneConsent] = useState(true);
  const [joinConsentError, setJoinConsentError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // 1. Tải danh sách Đội của tôi
  const loadMyTeams = useCallback(async () => {
    setLoadingMyTeams(true);
    setMyTeamsError('');
    try {
      const res = await api.get('/me/teams');
      const list = res.data?.data ?? res.data ?? [];
      setMyTeams(Array.isArray(list) ? list : []);
    } catch (err) {
      setMyTeamsError(apiErrorMessage(err, 'Không thể tải danh sách đội của bạn.'));
    } finally {
      setLoadingMyTeams(false);
    }
  }, []);

  // 2. Tải danh sách Khám phá đội
  const loadExploreTeams = useCallback(async (keyword = '') => {
    setLoadingExplore(true);
    setExploreError('');
    try {
      const res = await api.get('/teams', {
        params: keyword.trim() ? { search: keyword.trim() } : undefined,
      });
      const list = res.data?.data ?? res.data ?? [];
      setExploreTeams(Array.isArray(list) ? list : []);
    } catch (err) {
      setExploreError(apiErrorMessage(err, 'Không thể tải danh sách đội công khai.'));
    } finally {
      setLoadingExplore(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeTab === 'my-teams') {
        loadMyTeams();
      } else {
        loadExploreTeams(searchKeyword);
      }
    });
  }, [activeTab, loadMyTeams, loadExploreTeams, searchKeyword]);

  // Xử lý tạo đội mới (UC27)
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setCreateError('');

    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError('Tên đội không được để trống.');
      return;
    }
    if (trimmed.length > 30) {
      setCreateError('Tên đội tối đa 30 ký tự.');
      return;
    }

    setIsCreating(true);
    try {
      await api.post('/teams', { name: trimmed });
      setNotice({ text: 'Tạo đội mới thành công!', type: 'success' });
      setShowCreateModal(false);
      setCreateName('');
      loadMyTeams();
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Không thể tạo đội.'));
    } finally {
      setIsCreating(false);
    }
  };

  // Mở modal xem thành viên
  const openMembersModal = async (team) => {
    setSelectedTeamForMembers(team);
    setMembers([]);
    setLoadingMembers(true);
    setMembersError('');
    try {
      const res = await api.get(`/teams/${team.id}/members`);
      const list = res.data?.data ?? res.data ?? [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      setMembersError(apiErrorMessage(err, 'Không thể tải danh sách thành viên.'));
    } finally {
      setLoadingMembers(false);
    }
  };

  // Đội trưởng xóa thành viên khỏi đội
  const handleKickMember = async (memberRecordId, memberName) => {
    if (!window.confirm(`Xác nhận xóa thành viên "${memberName}" khỏi đội?`)) return;
    setActionInProgress(true);
    try {
      await api.delete(`/team-members/${memberRecordId}`);
      setNotice({ text: `Đã xóa thành viên "${memberName}" khỏi đội.`, type: 'success' });
      // Tải lại thành viên
      if (selectedTeamForMembers) {
        const res = await api.get(`/teams/${selectedTeamForMembers.id}/members`);
        const list = res.data?.data ?? res.data ?? [];
        setMembers(Array.isArray(list) ? list : []);
      }
      loadMyTeams();
    } catch (err) {
      setMembersError(apiErrorMessage(err, 'Không thể xóa thành viên.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Rời đội (thành viên tự rời)
  const handleLeaveTeam = async (teamId, teamName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn rời khỏi đội "${teamName}"?`)) return;
    setActionInProgress(true);
    try {
      await api.post(`/teams/${teamId}/leave`);
      setNotice({ text: `Bạn đã rời khỏi đội "${teamName}".`, type: 'success' });
      loadMyTeams();
    } catch (err) {
      setNotice({ text: apiErrorMessage(err, 'Không thể rời đội.'), type: 'danger' });
    } finally {
      setActionInProgress(false);
    }
  };

  // Mở modal yêu cầu gia nhập (dành cho Đội trưởng)
  const openRequestsModal = async (team) => {
    setSelectedTeamForRequests(team);
    setJoinRequests([]);
    setLoadingRequests(true);
    setRequestsError('');
    try {
      const res = await api.get(`/teams/${team.id}/join-requests`, {
        params: { status: 'PENDING' },
      });
      const list = res.data?.data ?? res.data ?? [];
      setJoinRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      setRequestsError(apiErrorMessage(err, 'Không thể tải yêu cầu gia nhập.'));
    } finally {
      setLoadingRequests(false);
    }
  };

  // Đội trưởng duyệt yêu cầu
  const handleApproveRequest = async (requestId) => {
    setActionInProgress(true);
    try {
      await api.post(`/team-join-requests/${requestId}/approve`);
      setNotice({ text: 'Đã duyệt yêu cầu vào đội thành công.', type: 'success' });
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      loadMyTeams();
    } catch (err) {
      setRequestsError(apiErrorMessage(err, 'Không thể duyệt yêu cầu.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Đội trưởng từ chối yêu cầu
  const handleRejectRequest = async (requestId) => {
    setActionInProgress(true);
    try {
      await api.post(`/team-join-requests/${requestId}/reject`);
      setNotice({ text: 'Đã từ chối yêu cầu gia nhập.', type: 'success' });
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setRequestsError(apiErrorMessage(err, 'Không thể từ chối yêu cầu.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Gửi yêu cầu xin gia nhập đội (từ tab Khám phá)
  const handleSendJoinRequest = async () => {
    if (!phoneConsent) {
      setJoinConsentError('Vui lòng đồng ý chia sẻ số điện thoại với đội trưởng.');
      return;
    }
    if (!teamToJoin) return;

    setIsJoining(true);
    setJoinConsentError('');
    try {
      await api.post(`/teams/${teamToJoin.id}/join-requests`, { phoneConsent: true });
      setNotice({ text: `Đã gửi yêu cầu gia nhập đội "${teamToJoin.name}"!`, type: 'success' });
      setTeamToJoin(null);
      loadExploreTeams(searchKeyword);
    } catch (err) {
      setJoinConsentError(apiErrorMessage(err, 'Không thể gửi yêu cầu gia nhập đội.'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <PublicLayout
      title="Quản lý Đội Cầu Lông"
      subtitle="Tham gia hoặc thành lập đội cầu lông để cùng nhau tập luyện và giao lưu"
    >
      <div className={styles.container}>
        {/* Banner thông báo */}
        {notice.text && (
          <div
            className={`${styles.alertBox} ${
              notice.type === 'danger' ? styles.alertDanger : styles.alertSuccess
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice({ text: '', type: 'success' })}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab chuyển đổi */}
        <div className={styles.tabGroup} role="tablist" aria-label="Nhóm chức năng đội">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my-teams'}
            className={`${styles.tabBtn} ${activeTab === 'my-teams' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('my-teams')}
          >
            Đội của tôi ({myTeams.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'explore'}
            className={`${styles.tabBtn} ${activeTab === 'explore' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('explore')}
          >
            Khám phá đội
          </button>
        </div>

        {/* ================= TAB 1: ĐỘI CỦA TÔI ================= */}
        {activeTab === 'my-teams' && (
          <div>
            <div className={styles.actionBar}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                Các đội bạn đang tham gia
              </h2>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  setCreateError('');
                  setCreateName('');
                  setShowCreateModal(true);
                }}
              >
                + Tạo đội mới
              </button>
            </div>

            {loadingMyTeams ? (
              <LoadingState message="Đang tải danh sách đội của bạn…" />
            ) : myTeamsError ? (
              <div className={`${styles.alertBox} ${styles.alertDanger}`}>{myTeamsError}</div>
            ) : myTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 16, margin: '0 0 16px' }}>
                  Bạn hiện chưa tham gia đội cầu lông nào.
                </p>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => setShowCreateModal(true)}
                >
                  Tạo đội đầu tiên ngay
                </button>
              </div>
            ) : (
              <div className={styles.grid}>
                {myTeams.map((team) => (
                  <article key={team.id} className={styles.teamCard}>
                    <div>
                      <div className={styles.teamHeader}>
                        <h3 className={styles.teamName}>{team.name}</h3>
                        {team.captain ? (
                          <span className={`${styles.badge} ${styles.badgeCaptain}`}>Đội trưởng</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeMember}`}>Thành viên</span>
                        )}
                      </div>

                      <div className={styles.teamMeta}>
                        <div className={styles.metaRow}>
                          <span>👥</span>
                          <span><strong>{team.memberCount}</strong> thành viên</span>
                        </div>
                        <div className={styles.metaRow}>
                          <span>👑</span>
                          <span>Đội trưởng: <strong>{team.captainName || (team.captain ? 'Bạn' : '—')}</strong></span>
                        </div>
                        {team.createdAt && (
                          <div className={styles.metaRow}>
                            <span>📅</span>
                            <span>Ngày lập: {new Date(team.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => openMembersModal(team)}
                      >
                        Xem thành viên
                      </button>

                      {team.captain ? (
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => openRequestsModal(team)}
                        >
                          Duyệt đơn xin vào
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={actionInProgress}
                          onClick={() => handleLeaveTeam(team.id, team.name)}
                        >
                          Rời đội
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: KHÁM PHÁ ĐỘI ================= */}
        {activeTab === 'explore' && (
          <div>
            <div className={styles.actionBar}>
              <form
                className={styles.searchBar}
                onSubmit={(e) => {
                  e.preventDefault();
                  loadExploreTeams(searchKeyword);
                }}
              >
                <input
                  type="search"
                  placeholder="Tìm theo tên đội..."
                  className={styles.input}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
                <button type="submit" className={styles.primaryBtn}>
                  Tìm kiếm
                </button>
              </form>
            </div>

            {loadingExplore ? (
              <LoadingState message="Đang tìm kiếm đội…" />
            ) : exploreError ? (
              <div className={`${styles.alertBox} ${styles.alertDanger}`}>{exploreError}</div>
            ) : exploreTeams.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-muted)' }}>
                Không tìm thấy đội nào phù hợp với từ khóa tìm kiếm.
              </p>
            ) : (
              <div className={styles.grid}>
                {exploreTeams.map((team) => (
                  <article key={team.id} className={styles.teamCard}>
                    <div>
                      <div className={styles.teamHeader}>
                        <h3 className={styles.teamName}>{team.name}</h3>
                        {team.member && (
                          <span className={`${styles.badge} ${team.captain ? styles.badgeCaptain : styles.badgeMember}`}>
                            {team.captain ? 'Đội trưởng' : 'Đã tham gia'}
                          </span>
                        )}
                      </div>

                      <div className={styles.teamMeta}>
                        <div className={styles.metaRow}>
                          <span>👥</span>
                          <span><strong>{team.memberCount}</strong> thành viên</span>
                        </div>
                        <div className={styles.metaRow}>
                          <span>👑</span>
                          <span>Đội trưởng: <strong>{team.captainName || '—'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => openMembersModal(team)}
                      >
                        Xem thành viên
                      </button>

                      {team.member ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 650, alignSelf: 'center' }}>
                          ✓ Bạn là thành viên
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          style={{ height: 38, fontSize: 'var(--text-xs)' }}
                          onClick={() => {
                            setTeamToJoin(team);
                            setPhoneConsent(true);
                            setJoinConsentError('');
                          }}
                        >
                          Xin gia nhập
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= MODAL: TẠO ĐỘI MỚI ================= */}
        {showCreateModal && (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowCreateModal(false)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Tạo đội cầu lông mới</h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTeam} noValidate>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="teamNameInput">
                    Tên đội <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="teamNameInput"
                    type="text"
                    maxLength={30}
                    placeholder="VD: Cầu Giấy Smashers"
                    className={`${styles.input} ${createError ? styles.inputError : ''}`}
                    value={createName}
                    onChange={(e) => {
                      setCreateName(e.target.value);
                      if (createError) setCreateError('');
                    }}
                    disabled={isCreating}
                    autoFocus
                  />
                  {createError && (
                    <p className={styles.errorText} role="alert">{createError}</p>
                  )}
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Tối đa 30 ký tự. Bạn sẽ trở thành Đội trưởng của đội này.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Đang tạo…' : 'Xác nhận tạo đội'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: DANH SÁCH THÀNH VIÊN ================= */}
        {selectedTeamForMembers && (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setSelectedTeamForMembers(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Thành viên · {selectedTeamForMembers.name}
                </h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setSelectedTeamForMembers(null)}
                >
                  ✕
                </button>
              </div>

              {loadingMembers ? (
                <LoadingState message="Đang tải danh sách thành viên…" />
              ) : membersError ? (
                <div className={`${styles.alertBox} ${styles.alertDanger}`}>{membersError}</div>
              ) : members.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>Chưa có thông tin thành viên.</p>
              ) : (
                <ul className={styles.memberList}>
                  {members.map((m) => {
                    const initial = (m.fullName || 'U').charAt(0).toUpperCase();
                    return (
                      <li key={m.id} className={styles.memberItem}>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberAvatar}>{initial}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                              {m.fullName}
                              {m.captain && (
                                <span className={`${styles.badge} ${styles.badgeCaptain}`} style={{ marginLeft: 6 }}>
                                  Đội trưởng
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                              {m.skillLevel ? `Trình độ: ${m.skillLevel}` : 'Thành viên'}
                              {m.phone && ` · SĐT: ${m.phone}`}
                            </div>
                          </div>
                        </div>

                        {/* Đội trưởng có quyền kick thành viên khác */}
                        {selectedTeamForMembers.captain && !m.captain && (
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            disabled={actionInProgress}
                            onClick={() => handleKickMember(m.id, m.fullName)}
                          >
                            Xóa khỏi đội
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ================= MODAL: DUYỆT YÊU CẦU GIA NHẬP ================= */}
        {selectedTeamForRequests && (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setSelectedTeamForRequests(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Yêu cầu xin gia nhập ({joinRequests.length})
                </h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setSelectedTeamForRequests(null)}
                >
                  ✕
                </button>
              </div>

              {loadingRequests ? (
                <LoadingState message="Đang tải các yêu cầu…" />
              ) : requestsError ? (
                <div className={`${styles.alertBox} ${styles.alertDanger}`}>{requestsError}</div>
              ) : joinRequests.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
                  Không có yêu cầu gia nhập nào đang chờ duyệt.
                </p>
              ) : (
                <ul className={styles.requestList}>
                  {joinRequests.map((req) => (
                    <li key={req.id} className={styles.requestItem}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{req.fullName}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          SĐT: <strong>{req.phone || 'Đã ẩn'}</strong>
                          {req.skillLevel && ` · Trình độ: ${req.skillLevel}`}
                        </div>
                        {req.createdAt && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Gửi ngày: {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={actionInProgress}
                          onClick={() => handleRejectRequest(req.id)}
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          style={{ height: 34, fontSize: 'var(--text-xs)', padding: '0 12px' }}
                          disabled={actionInProgress}
                          onClick={() => handleApproveRequest(req.id)}
                        >
                          Duyệt
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ================= MODAL: XIN GIA NHẬP ĐỘI ================= */}
        {teamToJoin && (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setTeamToJoin(null)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Xin gia nhập {teamToJoin.name}</h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setTeamToJoin(null)}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Đơn xin gia nhập của bạn sẽ được gửi tới Đội trưởng <strong>{teamToJoin.captainName}</strong> để xem xét.
              </p>

              <label className={styles.consentBox}>
                <input
                  type="checkbox"
                  checked={phoneConsent}
                  onChange={(e) => {
                    setPhoneConsent(e.target.checked);
                    if (joinConsentError) setJoinConsentError('');
                  }}
                  disabled={isJoining}
                />
                <span>
                  Tôi đồng ý chia sẻ số điện thoại liên hệ của tôi với Đội trưởng để tiện trao đổi khi cần thiết.
                </span>
              </label>

              {joinConsentError && (
                <p className={styles.errorText} role="alert" style={{ marginBottom: 12 }}>
                  {joinConsentError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setTeamToJoin(null)}
                  disabled={isJoining}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSendJoinRequest}
                  disabled={isJoining}
                >
                  {isJoining ? 'Đang gửi…' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
