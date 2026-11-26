import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  apiErrorMessage,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notificationApi';
import { useAuth } from '../../hooks/useAuth';
import { notificationMessage } from '../../utils/formatters';
import styles from './NotificationBell.module.css';
import { notificationDestination } from '../../utils/notificationNavigation';
import { Button, EmptyState, ErrorState, LoadingState } from '../common';
import { STATUS_CATALOG } from '../common/statusCatalog';
import { subscribeLiveRefresh } from '../../utils/liveRefresh';

/** Nhãn + màu cho từng loại thông báo do job tự động sinh ra. */
const TYPE_META = Object.fromEntries(Object.entries(STATUS_CATALOG.notification).map(([type, meta]) =>
  [type, { ...meta, tone: { warning: 'warn', success: 'ok' }[meta.tone] || meta.tone }]));

const PREVIEW_SIZE = 8;

function relativeTime(value) {
  if (!value) return '';
  const then = new Date(String(value)).getTime();
  if (Number.isNaN(then)) return '';
  const diffMinutes = Math.round((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return 'vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const date = new Date(then);
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { isAuthenticated, role, setSelectedVenue } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [feedback, setFeedback] = useState('');
  const pendingMarkAll = useRef(false);
  const triggerRef = useRef(null);
  const panelId = useId();
  const wrapperRef = useRef(null);

  const loadUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setUnread(await getUnreadCount());
    } catch {
      // Bell không được làm hỏng trang: lỗi mạng thì giữ nguyên số cũ.
    }
  }, [isAuthenticated]);

  const loadPreview = useCallback(async (quiet = false) => {
    if (!isAuthenticated) return;
    if (quiet !== true) setLoading(true);
    try {
      const page = await getNotifications({ page: 0, size: PREVIEW_SIZE });
      setItems(page.content ?? []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      if (quiet !== true) setLoading(false);
    }
  }, [isAuthenticated]);

  // Cập nhật mỗi 5 giây và ngay khi quay lại cửa sổ hoặc hoàn tất thao tác.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    const poll = () => getUnreadCount()
        .then((count) => {
          if (active) setUnread(count);
        })
        .catch(() => {});
    const stop = subscribeLiveRefresh(poll, 5000, true);
    return () => {
      active = false;
      stop();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeLiveRefresh(() => loadPreview(true));
  }, [open, loadPreview]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadPreview();
      loadUnread();
    }
  };

  const handleItemClick = (item) => {
    if (!item.read) {
      markNotificationRead(item.id).then(() => {
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
        setUnread((current) => Math.max(0, current - 1));
      }).catch((err) => {
        setError(apiErrorMessage(err));
      });
    }
    const locationId = item.locationId || (item.refType === 'LOCATION' ? item.refId : null);
    if (locationId && ['owner', 'staff'].includes(role)) {
      setSelectedVenue(locationId);
    }
    setOpen(false);
    navigate(notificationDestination(item, role));
  };

  const handleMarkAll = async () => {
    if (pendingMarkAll.current) return;
    pendingMarkAll.current = true;
    setMarkingAll(true);
    setFeedback('');
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((entry) => ({ ...entry, read: true })));
      setUnread(0);
      setError('');
      setFeedback('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      pendingMarkAll.current = false;
      setMarkingAll(false);
    }
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={triggerRef}
        className={styles.bellButton}
        type="button"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a6 6 0 0 0-6 6v3.6l-1.6 2.7A1 1 0 0 0 5.3 16h13.4a1 1 0 0 0 .9-1.7L18 11.6V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2H9.2a3 3 0 0 0 2.8 2Z"
          />
        </svg>
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Thông báo">
          <div className={styles.panelHeader}>
            <strong>Thông báo</strong>
            <Button variant="ghost" size="sm" className={styles.markAll} onClick={handleMarkAll} disabled={unread === 0 || loading} loading={markingAll}>
              Đánh dấu đã đọc hết
            </Button>
          </div>

          {error && <ErrorState message={error} onRetry={loadPreview} />}
          {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
          {loading && <LoadingState message="Đang tải thông báo…" />}
          {!loading && !error && items.length === 0 && (
            <EmptyState title="Chưa có thông báo mới" description="Thông tin về lịch đặt và hoạt động sẽ xuất hiện tại đây." action={<Button variant="secondary" size="sm" onClick={loadPreview}>Làm mới</Button>} />
          )}

          <ul className={styles.list} hidden={loading}>
            {items.map((item) => {
              const meta = TYPE_META[item.type] ?? { label: 'Thông báo', tone: 'info' };
              return (
                <li key={item.id}>
                  <button
                    className={`${styles.item} ${item.read ? '' : styles.itemUnread}`}
                    type="button"
                    onClick={() => handleItemClick(item)}
                  >
                    <span className={`${styles.dot} ${styles[`tone${meta.tone}`] ?? ''}`} aria-hidden="true" />
                    <span className={styles.itemBody}>
                      {meta.tag && <span className={styles.itemTag}>{meta.tag}</span>}
                      <span className={styles.itemTitle}>{notificationMessage(item.title)}</span>
                      <span className={styles.itemContent}>{notificationMessage(item.content)}</span>
                      <span className={styles.itemMeta}>
                        {item.read ? 'Đã đọc' : 'Chưa đọc'} · {meta.label} · {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Link className={styles.viewAll} to="/notifications" onClick={() => setOpen(false)}>
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
