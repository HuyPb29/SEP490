import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './PublicFooter.module.css';

const YEAR = new Date().getFullYear();

const PRODUCT_LINKS = [
  ['/', 'Tìm sân'],
  ['/open-matches', 'Kèo mở'],
  ['/register-service', 'Đăng ký sân'],
];

const PLAYER_LINKS = [
  ['/my-bookings', 'Booking của tôi'],
  ['/teams', 'Đội của tôi'],
  ['/my-rewards', 'Voucher & Điểm'],
  ['/my-complaints', 'Khiếu nại'],
  ['/account', 'Hồ sơ của tôi'],
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
  const { user, roleHome } = useAuth();
  const roleCode = String(user?.role_code || user?.role || '').toLowerCase();
  const isPlayer = roleCode === 'player';
  const homeUrl = isPlayer ? '/locations' : roleHome[roleCode] ?? '/';
  const productLinks = isPlayer ? [['/locations', 'Tìm sân'], ['/open-matches', 'Kèo mở']]
    : roleCode === 'owner' ? [['/register-service', 'Đăng ký sân']]
      : !user ? PRODUCT_LINKS : [];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link to={homeUrl} className={styles.brandLink}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            <span>Courtly</span>
          </Link>
          <p className={styles.tagline}>
            Nền tảng đặt sân cầu lông nhanh chóng, minh bạch và tiện lợi dành cho mọi người chơi.
          </p>
        </div>

        {productLinks.length > 0 && <FooterColumn title="Sản phẩm" links={productLinks} />}
        {!user && <FooterColumn title="Tài khoản" links={GUEST_LINKS} />}
        {isPlayer && <FooterColumn title="Cá nhân" links={PLAYER_LINKS} />}
      </div>

      <div className={styles.bottomBar}>
        <p>© {YEAR} Courtly. Đặt sân nhanh – Chơi vui hơn.</p>
      </div>
    </footer>
  );
}
