/**
 * OwnerPlaceholderPage.jsx — tidy placeholder for Owner Portal tabs not yet
 * implemented. Shows the tab name and a "Coming soon" message.
 */
import { useParams } from 'react-router-dom'
import styles from './OwnerPlaceholderPage.module.css'

/** Map URL segment → human-readable title */
const TITLES = {
  reports:     "Báo cáo",
  courts:      "Sân và bảng giá",
  hours:       "Giờ mở cửa",
  vouchers:    "Phiếu ưu đãi và chương trình ưu đãi",
  complaints:  "Khiếu nại",
  refunds:     "Hoàn tiền",
  maintenance: "Duyệt yêu cầu bảo trì",
  reviews:     "Đánh giá",
}

export default function OwnerPlaceholderPage({ tab }) {
  const { id } = useParams()
  const title = tab ? (TITLES[tab] ?? tab) : "Trang này"

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">🚧</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>
          Địa điểm <strong>#{id}</strong> · Chức năng đang được phát triển.
        </p>
        <p className={styles.note}>Chức năng sẽ sớm được cập nhật.</p>
      </div>
    </div>
  )
}
