import { Button as UiButton, Input as UiInput, Select as UiSelect } from '../../components/ui';
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AdminLocationsPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const INITIAL_REVIEWS = [
  {
    id: 'review-spam-one',
    player: 'Alex Nguyen',
    playerUsername: 'alex.nguyen',
    facility: 'Smash Arena',
    rating: 1,
    content: "“Nơi này rất tệ, quảng cáo rác liên tục! Hãy đặt qua liên kết của tôi.”",
    flagReason: "Nội dung tục tĩu và quảng cáo rác lặp lại; có 6 người dùng báo cáo.",
    reported: true,
    isHidden: false,
    violationType: 'spam',
  },
  {
    id: 'review-civil-low-rating',
    player: 'Mai Pham',
    playerUsername: 'mai.pham',
    facility: 'Green Shuttle Club',
    rating: 1,
    content: "“Sàn trơn khi tôi đến chơi, phòng thay đồ cũng cần được cải thiện.”",
    flagReason: "Bị báo cáo vì số sao thấp; nội dung góp ý lịch sự và cụ thể.",
    reported: true,
    isHidden: false,
    violationType: 'low-rating-only',
  },
  {
    id: 'review-defamation',
    player: 'Jordan Lee',
    playerUsername: 'jordan.lee',
    facility: 'Dich Vong Badminton Court',
    rating: 2,
    content: "“Nhân viên đã lấy túi của tôi. Đừng tin ai ở nơi này.”",
    flagReason: "Bị báo cáo vì cáo buộc cá nhân chưa có căn cứ; cần kiểm tra nội dung.",
    reported: true,
    isHidden: false,
    violationType: 'defamation',
  },
  {
    id: 'review-hidden-spam',
    player: 'Court Deals',
    playerUsername: 'court.deals',
    facility: 'Badminton Thanh Xuan',
    rating: 5,
    content: "“Dùng mã ưu đãi FREECOURT tại example.invalid để nhận thưởng.”",
    flagReason: "Đã ẩn vì chứa liên kết quảng cáo không mong muốn và nội dung rác.",
    reported: true,
    isHidden: true,
    violationType: 'spam',
  },
]

const REVIEW_FILTERS = ["Tất cả đánh giá", "Bị báo cáo / Đang hiển thị", "Đã ẩn"]
const HIDE_CONFIRMATION = "Ẩn đánh giá này? Chỉ ẩn đánh giá vi phạm quy định nội dung."

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminViolatingReviewsPage() {
  const navigate = useNavigate()
  const [reviews, setReviews] = useState(INITIAL_REVIEWS)
  const [selectedFilter, setSelectedFilter] = useState("Tất cả đánh giá")
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredReviews = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return reviews.filter((review) => {
      const matchesStatus = selectedFilter === "Tất cả đánh giá"
        || (selectedFilter === "Bị báo cáo / Đang hiển thị" && review.reported && !review.isHidden)
        || (selectedFilter === "Đã ẩn" && review.isHidden)
      const searchableText = [review.player, review.playerUsername, review.facility, review.content, review.flagReason]
        .join(' ')
        .toLocaleLowerCase()
      const matchesSearch = !keyword || searchableText.includes(keyword)
      return matchesStatus && matchesSearch
    })
  }, [reviews, selectedFilter, searchKeyword])

  const handleReviewVisibility = (reviewId) => {
    try {
      const review = reviews.find((item) => item.id === reviewId)
      if (!review) throw new Error("Không tìm thấy đánh giá đã chọn.")

      if (review.isHidden) {
        setReviews((currentReviews) => currentReviews.map((item) => (
          item.id === reviewId ? { ...item, isHidden: false } : item
        )))
        setStatusMessage("Đã hiển thị lại đánh giá.")
        setActionError('')
        return
      }

      if (review.violationType === 'low-rating-only') {
        throw new Error("Không được ẩn đánh giá chỉ vì có số sao thấp.")
      }
      if (!window.confirm(HIDE_CONFIRMATION)) return
      setReviews((currentReviews) => currentReviews.map((item) => (
        item.id === reviewId ? { ...item, isHidden: true } : item
      )))
      setStatusMessage("Đã ẩn đánh giá khỏi người chơi. Nội dung đánh giá vẫn được lưu lại.")
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleBanSpammer = (username) => {
    try {
      if (!username) throw new Error("Không có tên đăng nhập của người chơi.")
      navigate(`/admin/accounts?search=${encodeURIComponent(username)}`)
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleFilterChange = (event) => {
    try {
      setSelectedFilter(event.target.value)
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleSearchChange = (event) => {
    try {
      setSearchKeyword(event.target.value)
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const clearNotice = () => {
    try {
      setStatusMessage('')
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <AdminPortalSidebar />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Quản lý đánh giá vi phạm</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <UiButton variant="secondary" type="button" aria-label="Đóng thông báo" onClick={clearNotice}>×</UiButton>
          </div>
        )}

        <aside className={styles.complianceBanner}>
          Chỉ ẩn đánh giá vi phạm nội dung như tục tĩu, phỉ báng hoặc quảng cáo rác. Không ẩn đánh giá chỉ vì có số sao thấp (1–2 sao).
        </aside>

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="reviews-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="reviews-heading">Đánh giá ({filteredReviews.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Lọc đánh giá</span>
                <UiSelect className={styles.filterSelect} value={selectedFilter} onChange={handleFilterChange}>
                  {REVIEW_FILTERS.map((filter) => <option key={filter} value={filter}>{filter}</option>)}
                </UiSelect>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Tìm theo người chơi, địa điểm hoặc nội dung đánh giá</span>
                <UiInput
                  type="search"
                  placeholder="Tìm theo người chơi, địa điểm hoặc nội dung đánh giá"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(120px, .9fr) minmax(160px, 1.15fr) minmax(55px, .4fr) minmax(330px, 2.4fr) minmax(90px, .65fr) minmax(180px, 1.3fr)', minWidth: '980px' }}>
              <span role="columnheader">Người chơi</span>
              <span role="columnheader">Địa điểm</span>
              <span role="columnheader">Số sao</span>
              <span role="columnheader">Nội dung đánh giá và lý do báo cáo</span>
              <span role="columnheader">Trạng thái</span>
              <span role="columnheader">Thao tác</span>
            </div>
            {filteredReviews.map((review) => (
              <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={review.id} style={{ gridTemplateColumns: 'minmax(120px, .9fr) minmax(160px, 1.15fr) minmax(55px, .4fr) minmax(330px, 2.4fr) minmax(90px, .65fr) minmax(180px, 1.3fr)', minWidth: '980px' }}>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{review.player}</strong>
                  <span className={styles.cellSecondary}>@{review.playerUsername}</span>
                </div>
                <span className={styles.cellPrimary} role="cell">{review.facility}</span>
                <strong className={styles.ratingCell} role="cell">{review.rating}★</strong>
                <div className={styles.reviewContent} role="cell">
                  <span>{review.content}</span>
                  <small>{review.flagReason}</small>
                </div>
                <span role="cell">
                  <span className={`${styles.statusBadge} ${review.isHidden ? styles.statusLocked : styles.statusActive}`}>
                    {review.isHidden ? "Đã ẩn" : "Đang hiển thị"}
                  </span>
                </span>
                <div className={styles.adminRowActions} role="cell">
                  <UiButton variant="custom"
                    className={review.isHidden ? styles.reopenButton : styles.lockButton}
                    type="button"
                    disabled={review.violationType === 'low-rating-only' && !review.isHidden}
                    title={review.violationType === 'low-rating-only' && !review.isHidden ? "Số sao thấp không phải lý do vi phạm nội dung." : undefined}
                    onClick={() => handleReviewVisibility(review.id)}
                  >
                    {review.isHidden ? "Hiển thị lại" : "Ẩn đánh giá"}
                  </UiButton>
                  {review.violationType === 'spam' && (
                    <UiButton variant="custom" className={styles.extendButton} type="button" onClick={() => handleBanSpammer(review.playerUsername)}>
                      Khóa tài khoản phát tán nội dung rác
                    </UiButton>
                  )}
                </div>
              </div>
            ))}
            {filteredReviews.length === 0 && <p className={styles.emptyState}>Không có đánh giá phù hợp với bộ lọc.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}