import { useState } from 'react'
import { useVenueReviews } from '../../hooks/usePublicVenue'
import styles from './FacilityDetailPage.module.css'

export default function VenueInformation({ facility, retryVenue }) {
  const [page, setPage] = useState(0)
  const reviews = useVenueReviews(facility.facility_id, page)
  return <section className={styles.bottomGrid}>
    <div className={styles.bottomCard}>
      <h2 className={styles.sectionTitle}>Danh sách sân và giờ mở cửa</h2>
      {facility.courts_error ? <p role="alert">Không tải được danh sách sân. <button type="button" className="underline" onClick={retryVenue}>Thử lại</button></p>
        : facility.courts_list.length ? <ul>{facility.courts_list.map((court) => <li key={court.id}>{court.name}</li>)}</ul>
          : <p>Địa điểm chưa có sân đang hoạt động.</p>}
      {facility.opening_hours_list.length ? <dl>{facility.opening_hours_list.map((hour) =>
        <div key={hour.dayOfWeek} className="flex gap-3"><dt>{hour.dayName}</dt><dd>{hour.openTime} – {hour.closeTime}</dd></div>
      )}</dl> : <p>Chưa cập nhật giờ mở cửa.</p>}
    </div>
    <div className={styles.bottomCard}>
      <h2 className={styles.sectionTitle}>Bảng giá</h2>
      {facility.price_error && <p role="alert">Chưa tải đủ bảng giá. <button type="button" className="underline" onClick={retryVenue}>Thử lại</button></p>}
      {facility.price_table.length > 0 ? <div className="overflow-auto"><table className={styles.priceTable}>
        <thead><tr><th>Sân / Ngày</th><th>Khung giờ</th><th>Hiệu lực</th><th>Đơn giá</th></tr></thead>
        <tbody>{facility.price_table.map((row, index) => <tr key={row.id + ':' + index}>
          <td>{row.court_name} · {row.days_label}</td><td>{row.time_range}</td>
          <td>{row.valid_from || '—'} đến {row.valid_to || '—'}</td><td>{row.price_label}</td>
        </tr>)}</tbody>
      </table></div> : !facility.price_error && <p>Chưa có bảng giá.</p>}
    </div>
    <div className={styles.bottomCard}>
      <h2 className={styles.sectionTitle}>Đánh giá từ người chơi</h2>
      {!reviews.current && <p role="status">Đang tải đánh giá…</p>}
      {reviews.current?.error && <p role="alert">Không tải được đánh giá. <button type="button" className="underline" onClick={reviews.retry}>Thử lại</button></p>}
      {reviews.current?.data?.content.length === 0 && <p>Chưa có đánh giá nào.</p>}
      {reviews.current?.data?.content.map((review) => <article key={review.id} className={styles.reviewItem}>
        <strong>{review.playerName || 'Người chơi'} · {review.rating}/5</strong>
        {review.createdAt && <time dateTime={review.createdAt}> · {review.createdAt.slice(0, 10)}</time>}
        <p>{review.comment}</p>
        {review.ownerReply && <p className={styles.ownerReplyBox}>Phản hồi từ chủ sân: {review.ownerReply}</p>}
      </article>)}
      {reviews.current?.data?.totalPages > 1 && <nav aria-label="Trang đánh giá" className="mt-2 flex gap-3">
        <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Trang trước</button>
        <button type="button" disabled={page + 1 >= reviews.current.data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
      </nav>}
    </div>
  </section>
}
