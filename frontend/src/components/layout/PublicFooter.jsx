import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './PublicFooter.module.css';

const EXPLORE_LINKS = [
  ['/', 'Tìm địa điểm'],
  ['/open-matches', 'Kèo mở'],
  ['/register-service', 'Đăng ký sân'],
];

const PLAYER_LINKS = [
  ['/my-bookings', 'Booking của tôi'],
  ['/teams', 'Đội của tôi'],
  ['/my-rewards', 'Voucher & Điểm'],
  ['/my-complaints', 'Khiếu nại'],
  ['/account', 'Tài khoản'],
];

const GUEST_LINKS = [
  ['/login', 'Đăng nhập'],
  ['/login?mode=register', 'Đăng ký tài khoản'],
];

function FooterColumn({ title, links }) {
  return (
    <nav className={styles.column} aria-label={title}>
      <h2 className={styles.columnTitle}>{title}</h2>
      <ul className={styles.linkList}>
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className={styles.link}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function PublicFooter() {
  const { user } = useAuth();
  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const isPlayer = roleCode === 'player';
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link to="/" className={styles.brandLink}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            <span>Courtly</span>
          </Link>
          <p className={styles.tagline}>
            Đặt sân, ghép kèo và quản lý lịch chơi cầu lông trong cùng một tài khoản.
          </p>
        </div>

        <FooterColumn title="Khám phá" links={EXPLORE_LINKS} />
        {!user && <FooterColumn title="Tài khoản" links={GUEST_LINKS} />}
        {isPlayer && <FooterColumn title="Cá nhân" links={PLAYER_LINKS} />}
      </div>

      <div className={styles.bottomBar}>
        <p>© {year} Courtly. Đồ án tốt nghiệp SEP490.</p>
      </div>
    </footer>
  );
}
