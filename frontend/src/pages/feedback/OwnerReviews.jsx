import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../api';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  Toast,
} from '../../components/common';
import { shortDate } from '../../utils/formatters';
import styles from './OwnerReviews.module.css';

const REPLY_LIMIT = 1000;

function Stars({ rating }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className={styles.stars} aria-label={`${value} trên 5 sao`}>
      <span aria-hidden="true">{'★'.repeat(value)}<span className={styles.starsEmpty}>{'★'.repeat(5 - value)}</span></span>
      <span className={styles.ratingText}>{value}/5</span>
    </span>
  );
}

export function OwnerReviews() {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingFilter, setRatingFilter] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Quản lý reply theo từng review
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyError, setReplyError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [pendingHide, setPendingHide] = useState(null);

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
      setError(apiErrorMessage(err, 'Không thể tải danh sách đánh giá của địa điểm.'));
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
    if (text.length > REPLY_LIMIT) {
      setReplyError(`Nội dung phản hồi tối đa ${REPLY_LIMIT} ký tự.`);
      return;
    }

    setActionInProgress(true);
    setReplyError('');
    try {
      await api.post(`/owner/reviews/${reviewId}/replies`, { reply: text });
      setToast({ tone: 'success', text: 'Đã gửi phản hồi đánh giá.' });
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
  const changeHidden = async (review) => {
    setActionInProgress(true);
    try {
      await api.patch(`/owner/reviews/${review.id}`, { hidden: !review.hidden });
      setToast({ tone: 'success', text: `Đã ${review.hidden ? 'hiển thị lại' : 'ẩn'} đánh giá.` });
      loadReviews();
    } catch (err) {
      setToast({ tone: 'danger', text: apiErrorMessage(err, 'Không thể thay đổi trạng thái hiển thị của đánh giá.') });
    } finally {
      setActionInProgress(false);
      setPendingHide(null);
    }
  };

  // BR22: chỉ ẩn đánh giá vi phạm quy định nội dung, không ẩn vì bị chấm điểm thấp.
  const handleToggleHidden = (review) => {
    if (review.hidden) changeHidden(review);
    else setPendingHide(review);
  };

  const filtered = ratingFilter !== '' || hiddenFilter !== '';

  return (
    <div className={styles.container}>
      {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}

      <div className={styles.filterRow}>
        <FormField label="Số sao" className={styles.filterField}>
          <Select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setPage(0);
            }}
            options={[['', 'Tất cả số sao'], ['5', '5 sao'], ['4', '4 sao'], ['3', '3 sao'], ['2', '2 sao'], ['1', '1 sao']]}
          />
        </FormField>
        <FormField label="Hiển thị" className={styles.filterField}>
          <Select
            value={hiddenFilter}
            onChange={(e) => {
              setHiddenFilter(e.target.value);
              setPage(0);
            }}
            options={[['', 'Tất cả'], ['false', 'Đang hiển thị'], ['true', 'Đã ẩn']]}
          />
        </FormField>
        {filtered && (
          <Button variant="ghost" className={styles.clearFilter}
            onClick={() => { setRatingFilter(''); setHiddenFilter(''); setPage(0); }}>
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {isLoading && <LoadingState message="Đang tải danh sách đánh giá…" />}
      {!isLoading && error && <ErrorState message={error} onRetry={loadReviews} />}
      {!isLoading && !error && reviews.length === 0 && (
        <EmptyState
          title="Chưa có đánh giá"
          description={filtered
            ? 'Không có đánh giá phù hợp với bộ lọc. Thử bỏ bớt điều kiện lọc.'
            : 'Khách đánh giá sau khi booking hoàn thành; đánh giá sẽ hiện ở đây.'}
        />
      )}
      {!isLoading && !error && reviews.length > 0 && (
        <ul className={styles.reviewList}>
          {reviews.map((item) => {
            const draft = replyTextMap[item.id] || '';
            const replyId = `reply-input-${item.id}`;
            return (
              <li key={item.id} className={`${styles.reviewCard} ${item.hidden ? styles.reviewHidden : ''}`}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.reviewerName}>{item.playerName || 'Người chơi ẩn danh'}</h3>
                    <p className={styles.reviewMeta}>
                      Mã đặt sân #{item.bookingId} · {item.createdAt ? shortDate(item.createdAt) : '—'}
                    </p>
                  </div>
                  <div className={styles.badges}>
                    <Stars rating={item.rating} />
                    {item.hidden && <StatusBadge tone="neutral">Đã ẩn</StatusBadge>}
                    {!item.ownerReply && <StatusBadge tone="warning">Chưa phản hồi</StatusBadge>}
                  </div>
                </div>

                <p className={styles.comment}>{item.comment || 'Khách không để lại nhận xét.'}</p>

                {item.ownerReply && (
                  <div className={styles.replyBox}>
                    <p className={styles.replyTitle}>Phản hồi của bạn</p>
                    <p className={styles.replyText}>{item.ownerReply}</p>
                  </div>
                )}

                {!item.ownerReply && activeReplyId === item.id && (
                  <div className={styles.replyForm}>
                    <FormField label="Phản hồi khách hàng" htmlFor={replyId} required error={replyError || undefined}
                      hint={`${draft.length}/${REPLY_LIMIT} ký tự. Phản hồi hiển thị công khai và không sửa được sau khi gửi.`}>
                      <Textarea
                        id={replyId}
                        rows={3}
                        maxLength={REPLY_LIMIT}
                        placeholder="Cảm ơn khách hoặc giải thích, hỗ trợ khách hàng…"
                        value={draft}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReplyTextMap((prev) => ({ ...prev, [item.id]: val }));
                          if (replyError) setReplyError('');
                        }}
                        disabled={actionInProgress}
                      />
                    </FormField>
                    <div className={styles.formActions}>
                      <Button variant="secondary" disabled={actionInProgress}
                        onClick={() => { setActiveReplyId(null); setReplyError(''); }}>
                        Hủy
                      </Button>
                      <Button loading={actionInProgress} loadingText="Đang gửi…" onClick={() => handleSendReply(item.id)}>
                        Gửi phản hồi
                      </Button>
                    </div>
                  </div>
                )}

                <div className={styles.actionRow}>
                  {!item.ownerReply && activeReplyId !== item.id && (
                    <Button size="sm" onClick={() => { setActiveReplyId(item.id); setReplyError(''); }}>
                      Phản hồi
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className={item.hidden ? undefined : styles.dangerText}
                    disabled={actionInProgress} onClick={() => handleToggleHidden(item)}>
                    {item.hidden ? 'Hiện lại đánh giá' : 'Ẩn đánh giá'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page + 1}
          totalPages={totalPages}
          onPageChange={(next) => setPage(next - 1)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingHide)}
        title="Ẩn đánh giá này?"
        tone="danger"
        confirmText="Ẩn đánh giá"
        busy={actionInProgress}
        onConfirm={() => changeHidden(pendingHide)}
        onCancel={() => setPendingHide(null)}
      >
        <p>Đánh giá sẽ không còn hiện trên trang công khai của địa điểm. Bạn có thể hiện lại sau.</p>
        <p className={styles.dialogWarning}>
          Chỉ ẩn đánh giá vi phạm quy định nội dung (xúc phạm, quảng cáo, lộ thông tin cá nhân…), không ẩn vì bị chấm điểm thấp.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default OwnerReviews;
