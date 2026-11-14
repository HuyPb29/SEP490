import styles from './CommonUI.module.css';
import { resolveStatusMeta } from './statusCatalog';

const TONE_CLASSES = {
  success: styles.badgeSuccess,
  positive: styles.badgePositive,
  warning: styles.badgeWarning,
  info: styles.badgeInfo,
  danger: styles.badgeDanger,
  neutral: styles.badgeNeutral,
};

export function StatusBadge({ status, category = 'booking', tone, children, className = '' }) {
  const resolved = status ? resolveStatusMeta(status, category) : { label: children, tone: tone || 'neutral' };
  const finalTone = tone || resolved.tone || 'neutral';
  const toneClass = TONE_CLASSES[finalTone] || styles.badgeNeutral;
  const classes = [styles.badge, toneClass, className].filter(Boolean).join(' ');

  return <span className={classes}>{children || resolved.label}</span>;
}

export default StatusBadge;
