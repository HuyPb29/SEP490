import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  apiErrorMessage,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notificationApi';
import { useAuth } from '../../hooks/useAuth';
import styles from './NotificationBell.module.css';

/** Nhãn + màu cho từng loại thông báo do job tự động sinh ra. */
const TYPE_META = {
  BOOKING_HOLD_EXPIRED: { label: 'Hết hạn giữ chỗ', tone: 'warn' },
  BOOKING_STARTED: { label: 'Bắt đầu giờ chơi', tone: 'info' },
  BOOKING_COMPLETED: { label: 'Hoàn thành buổi chơi', tone: 'ok' },
  BOOKING_AFFECTED: { label: 'Lịch đặt bị ảnh hưởng', tone: 'warn' },
  SERVICE_TERM_EXPIRED: { label: 'Hết hạn dịch vụ', tone: 'danger' },
  VOUCHER_EXPIRED: { label: 'Voucher hết hạn', tone: 'warn' },
};

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
  const { isAuthenticated, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapperRef = useRef(null);

  const loadUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setUnread(await getUnreadCount());
    } catch {
      // Bell không được làm hỏng trang: lỗi mạng thì giữ nguyên số cũ.
    }
  }, [isAuthenticated]);

  const loadPreview = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const page = await getNotifications({ page: 0, size: PREVIEW_SIZE });
      setItems(page.content ?? []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Đếm lại mỗi phút để bắt kịp job tự động (job chạy 60 giây/lần).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    const poll = () => {
      getUnreadCount()
        .then((count) => {
          if (active) setUnread(count);
        })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
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

  const handleItemClick = async (item) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id);
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
        setUnread((current) => Math.max(0, current - 1));
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    }
    const upperRole = String(role || '').toUpperCase();
    if (item.refType === 'LOCATION') {
      setOpen(false);
      navigate(upperRole === 'ADMIN' ? '/admin/facilities' : '/owner/courts');
    } else if (item.refType === 'VOUCHER' && upperRole === 'OWNER') {
      setOpen(false);
      navigate('/owner/promotions');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((entry) => ({ ...entry, read: true })));
      setUnread(0);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={styles.bellButton}
        type="button"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
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
        <div className={styles.panel} role="dialog" aria-label="Thông báo">
          <div className={styles.panelHeader}>
            <strong>Thông báo</strong>
            <button className={styles.markAll} type="button" onClick={handleMarkAll} disabled={unread === 0}>
              Đánh dấu đã đọc hết
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {loading && <p className={styles.empty}>Đang tải thông báo…</p>}
          {!loading && items.length === 0 && (
            <p className={styles.empty}>Chưa có thông báo mới.</p>
          )}

          <ul className={styles.list}>
            {items.map((item) => {
              const meta = TYPE_META[item.type] ?? { label: item.type, tone: 'info' };
              return (
                <li key={item.id}>
                  <button
                    className={`${styles.item} ${item.read ? '' : styles.itemUnread}`}
                    type="button"
                    onClick={() => handleItemClick(item)}
                  >
                    <span className={`${styles.dot} ${styles[`tone${meta.tone}`] ?? ''}`} aria-hidden="true" />
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemContent}>{item.content}</span>
                      <span className={styles.itemMeta}>
                        {meta.label} · {relativeTime(item.createdAt)}
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
