import { Button as UiButton } from '../ui';
import { Link } from 'react-router-dom';
import styles from './CommonUI.module.css';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  breadcrumbs = [],
  actions,
  className = '',
}) {
  return (
    <header className={[styles.pageHeader, className].filter(Boolean).join(' ')}>
      {breadcrumbs.length > 0 && <nav aria-label="Đường dẫn trang"><ol className={styles.breadcrumbs}>
        {breadcrumbs.map((item, index) => <li key={item.to || index}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{item.label}</span>}
        </li>)}
      </ol></nav>}
      {backTo && (
        <div className={styles.breadcrumbRow}>
          {backTo.to ? (
            <Link to={backTo.to} className={styles.backLink}>
              ← {backTo.label || 'Quay lại'}
            </Link>
          ) : (
            <UiButton variant="custom" type="button" onClick={backTo.onClick} className={styles.backLink}>
              ← {backTo.label || 'Quay lại'}
            </UiButton>
          )}
        </div>
      )}
      <div className={styles.headerMain}>
        <div className={styles.headerTitles}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          {title && <h1 className={styles.pageTitle}>{title}</h1>}
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.headerActions}>{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
