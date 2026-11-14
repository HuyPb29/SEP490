import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../api';
import { LoadingState, Pagination } from '../../components/common';
import styles from './OwnerReviews.module.css';

export function OwnerReviews() {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingFilter, setRatingFilter] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Quản lý reply theo từng review
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyError, setReplyError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {
        page,
        size: 10,
      };
      if (ratingFilter !== '') params.rating = Number(ratingFilter);
      if (hiddenFilter !== '') params.hidden = hiddenFilter === 'true';

      const res = await api.get('/owner/reviews', { params });
      // res.data.data là PageResponse<ReviewResponse> { content: [...], totalPages, ... }
      const pageData = res.data?.data ?? res.data ?? {};
      const list = pageData.content ?? (Array.isArray(pageData) ? pageData : []);
      setReviews(Array.isArray(list) ? list : []);
      setTotalPages(pageData.totalPages || 1);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không thể tải danh sách đánh giá của cơ sở.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, ratingFilter, hiddenFilter]);

  useEffect(() => {
    Promise.resolve().then(() => loadReviews());
  }, [loadReviews]);

  // Gửi phản hồi của Owner (UC32)
  const handleSendReply = async (reviewId) => {
    const text = (replyTextMap[reviewId] || '').trim();
    if (!text) {
      setReplyError('Nội dung phản hồi không được để trống.');
      return;
    }
    if (text.length > 1000) {
      setReplyError('Nội dung phản hồi tối đa 1000 ký tự.');
      return;
    }

    setActionInProgress(true);
    setReplyError('');
    try {
      await api.post(`/owner/reviews/${reviewId}/replies`, { reply: text });
      setNotice('Đã gửi phản hồi đánh giá thành công.');
      setActiveReplyId(null);
      setReplyTextMap((prev) => ({ ...prev, [reviewId]: '' }));
      loadReviews();
    } catch (err) {
      setReplyError(apiErrorMessage(err, 'Không thể gửi phản hồi.'));
    } finally {
      setActionInProgress(false);
    }
  };

  // Ẩn / Hiện lại đánh giá (UC32)
  const handleToggleHidden = async (review) => {
    setActionInProgress(true);
    try {
      await api.patch(`/owner/reviews/${review.id}`, { hidden: !review.hidden });
      setNotice(`Đã ${review.hidden ? 'hiển thị lại' : 'ẩn'} đánh giá.`);
      loadReviews();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không thể thay đổi trạng thái hiển thị của đánh giá.'));
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className={styles.container}>
      {notice && (
        <div className={styles.alertSuccess}>
          <span>✓ {notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && <div className={styles.alertDanger}>{error}</div>}

      {/* Thanh bộ lọc */}
      <div className={styles.filterRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="ratingFilterSelect" style={{ fontSize: 'var(--text-sm)', fontWeight: 650 }}>
            Số sao:
          </label>
          <select
            id="ratingFilterSelect"
            className={styles.filterSelect}
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả số sao</option>
            <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
            <option value="4">⭐⭐⭐⭐ (4 sao)</option>
            <option value="3">⭐⭐⭐ (3 sao)</option>
            <option value="2">⭐⭐ (2 sao)</option>
            <option value="1">⭐ (1 sao)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="hiddenFilterSelect" style={{ fontSize: 'var(--text-sm)', fontWeight: 650 }}>
            Hiển thị:
          </label>
          <select
            id="hiddenFilterSelect"
            className={styles.filterSelect}
            value={hiddenFilter}
            onChange={(e) => {
              setHiddenFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả</option>
            <option value="false">Đang hiển thị</option>
            <option value="true">Đã ẩn</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Đang tải danh sách đánh giá…" />
      ) : reviews.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          Chưa có đánh giá nào phù hợp với bộ lọc hiện tại.
        </p>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((item) => (
            <article key={item.id} className={styles.reviewCard}>
              <div className={styles.cardTop}>
                <div>
                  <h4 className={styles.reviewerName}>{item.playerName || 'Người chơi ẩn danh'}</h4>
                  <div className={styles.reviewMeta}>
                    Booking #{item.bookingId} ·{' '}
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={styles.stars}>
                    {'★'.repeat(item.rating || 5)}{'☆'.repeat(Math.max(0, 5 - (item.rating || 5)))}
                    <span style={{ color: 'var(--color-text)', marginLeft: 4 }}>({item.rating}/5)</span>
                  </div>
                  {item.hidden && <span className={styles.badgeHidden}>Đã ẩn</span>}
                </div>
              </div>

              <p className={styles.comment}>{item.comment || 'Khách hàng không để lại nhận xét chi tiết.'}</p>

              {/* Phản hồi của Chủ sân nếu có */}
              {item.ownerReply && (
                <div className={styles.replyBox}>
                  <p className={styles.replyTitle}>Phản hồi từ bạn (Chủ sân):</p>
                  <p className={styles.replyText}>{item.ownerReply}</p>
                </div>
              )}

              {/* Form gửi phản hồi nếu chưa có */}
              {!item.ownerReply && activeReplyId === item.id && (
                <div className={styles.replyForm}>
                  <label htmlFor={`reply-input-${item.id}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 650, color: 'var(--color-text-secondary)' }}>
                    Soạn câu trả lời cho đánh giá này:
                  </label>
                  <textarea
                    id={`reply-input-${item.id}`}
                    rows={3}
                    maxLength={1000}
                    placeholder="Nhập phản hồi cảm ơn hoặc hỗ trợ khách hàng..."
                    className={styles.replyTextarea}
                    value={replyTextMap[item.id] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReplyTextMap((prev) => ({ ...prev, [item.id]: val }));
                      if (replyError) setReplyError('');
                    }}
                    disabled={actionInProgress}
                  />
                  {replyError && <p className={styles.errorText} role="alert">{replyError}</p>}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        setActiveReplyId(null);
                        setReplyError('');
                      }}
                      disabled={actionInProgress}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => handleSendReply(item.id)}
                      disabled={actionInProgress}
                    >
                      {actionInProgress ? 'Đang gửi…' : 'Gửi phản hồi'}
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.actionRow}>
                {!item.ownerReply && activeReplyId !== item.id && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => {
                      setActiveReplyId(item.id);
                      setReplyError('');
                    }}
                  >
                    💬 Phản hồi khách hàng
                  </button>
                )}

                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={actionInProgress}
                  onClick={() => handleToggleHidden(item)}
                >
                  {item.hidden ? '👁 Hiện lại đánh giá' : '🚫 Ẩn đánh giá'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page + 1}
          totalPages={totalPages}
          onPageChange={(next) => setPage(next - 1)}
        />
      )}
    </div>
  );
}

export default OwnerReviews;
