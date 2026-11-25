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

  const slotStyle = category === 'slot' && resolved.slot ? {
    background: `var(--slot-${resolved.slot}-bg)`,
    borderColor: `var(--slot-${resolved.slot}-border)`,
    color: `var(--slot-${resolved.slot}-text)`,
  } : undefined;
  return <span className={classes} style={slotStyle}><span className={styles.badgeDot} aria-hidden="true" />{children || resolved.label}</span>;
}

export default StatusBadge;
