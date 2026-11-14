/**
 * OwnerPlaceholderPage.jsx — tidy placeholder for Owner Portal tabs not yet
 * implemented. Shows the tab name and a "Coming soon" message.
 */
import { useParams } from 'react-router-dom'
import styles from './OwnerPlaceholderPage.module.css'

/** Map URL segment → human-readable title */
const TITLES = {
  reports:     'Reports',
  courts:      'Courts & Pricing',
  hours:       'Opening Hours',
  vouchers:    'Vouchers & Offers',
  complaints:  'Complaints',
  refunds:     'Refunds',
  maintenance: 'Maintenance Approval',
  reviews:     'Reviews',
}

export default function OwnerPlaceholderPage({ tab }) {
  const { id } = useParams()
  const title = tab ? (TITLES[tab] ?? tab) : 'This page'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">🚧</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>
          Location <strong>#{id}</strong> · This section is under development.
        </p>
        <p className={styles.note}>Coming soon in the next sprint.</p>
      </div>
    </div>
  )
}
