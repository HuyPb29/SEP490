import { Link } from 'react-router-dom';
import styles from './CommonUI.module.css';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  actions,
  className = '',
}) {
  return (
    <header className={[styles.pageHeader, className].filter(Boolean).join(' ')}>
      {backTo && (
        <div className={styles.breadcrumbRow}>
          {backTo.to ? (
            <Link to={backTo.to} className={styles.backLink}>
              ← {backTo.label || 'Quay lại'}
            </Link>
          ) : (
            <button type="button" onClick={backTo.onClick} className={styles.backLink}>
              ← {backTo.label || 'Quay lại'}
            </button>
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
