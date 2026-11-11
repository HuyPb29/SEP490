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
    content: '“This place is crap, spam, spam, spam! Book through my link instead.”',
    flagReason: 'Profanity and repeated promotional spam; reported by 6 users.',
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
    content: '“The floor was slippery during my visit, and the changing rooms need attention.”',
    flagReason: 'Reported for its low star rating; the feedback is civil and specific.',
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
    content: '“The staff stole my bag. Do not trust anyone at this place.”',
    flagReason: 'Reported as an unsupported personal accusation; needs content review.',
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
    content: '“Use promo code FREECOURT at example.invalid for a prize.”',
    flagReason: 'Hidden for unsolicited promotional links and spam.',
    reported: true,
    isHidden: true,
    violationType: 'spam',
  },
]

const REVIEW_FILTERS = ['All Reviews', 'Reported / Visible', 'Hidden']
const HIDE_CONFIRMATION = 'Hide this review? Only hide reviews that violate content guidelines.'

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminViolatingReviewsPage() {
  const navigate = useNavigate()
  const [reviews, setReviews] = useState(INITIAL_REVIEWS)
  const [selectedFilter, setSelectedFilter] = useState('All Reviews')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredReviews = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return reviews.filter((review) => {
      const matchesStatus = selectedFilter === 'All Reviews'
        || (selectedFilter === 'Reported / Visible' && review.reported && !review.isHidden)
        || (selectedFilter === 'Hidden' && review.isHidden)
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
      if (!review) throw new Error('The selected review could not be found.')

      if (review.isHidden) {
        setReviews((currentReviews) => currentReviews.map((item) => (
          item.id === reviewId ? { ...item, isHidden: false } : item
        )))
        setStatusMessage('Review is visible again.')
        setActionError('')
        return
      }

      if (review.violationType === 'low-rating-only') {
        throw new Error('Do not hide a review solely because of its low star rating (BR22).')
      }
      if (!window.confirm(HIDE_CONFIRMATION)) return
      setReviews((currentReviews) => currentReviews.map((item) => (
        item.id === reviewId ? { ...item, isHidden: true } : item
      )))
      setStatusMessage('Review hidden from players. The review remains stored (DR13).')
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleBanSpammer = (username) => {
    try {
      if (!username) throw new Error('The player username is unavailable.')
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
        <h1 className={styles.pageTitle}>Manage Violating Reviews</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button>
          </div>
        )}

        <aside className={styles.complianceBanner}>
          Compliance Rule (BR22): Only hide reviews that violate content guidelines (profanity, defamation, spam). Never hide a review solely due to a low star rating (1–2 stars).
        </aside>

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="reviews-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="reviews-heading">Reviews ({filteredReviews.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Filter reviews</span>
                <select className={styles.filterSelect} value={selectedFilter} onChange={handleFilterChange}>
                  {REVIEW_FILTERS.map((filter) => <option key={filter} value={filter}>{filter}</option>)}
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Search by player, facility, or review content</span>
                <input
                  type="search"
                  placeholder="Search by player, location, or review content"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(120px, .9fr) minmax(160px, 1.15fr) minmax(55px, .4fr) minmax(330px, 2.4fr) minmax(90px, .65fr) minmax(180px, 1.3fr)', minWidth: '980px' }}>
              <span role="columnheader">Player</span>
              <span role="columnheader">Location</span>
              <span role="columnheader">Rating</span>
              <span role="columnheader">Review Content &amp; Flag Reason</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actions</span>
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
                    {review.isHidden ? 'Hidden' : 'Visible'}
                  </span>
                </span>
                <div className={styles.adminRowActions} role="cell">
                  <button
                    className={review.isHidden ? styles.reopenButton : styles.lockButton}
                    type="button"
                    disabled={review.violationType === 'low-rating-only' && !review.isHidden}
                    title={review.violationType === 'low-rating-only' && !review.isHidden ? 'Low rating alone is not a content violation.' : undefined}
                    onClick={() => handleReviewVisibility(review.id)}
                  >
                    {review.isHidden ? 'Unhide' : 'Hide Review'}
                  </button>
                  {review.violationType === 'spam' && (
                    <button className={styles.extendButton} type="button" onClick={() => handleBanSpammer(review.playerUsername)}>
                      Ban Spammer
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredReviews.length === 0 && <p className={styles.emptyState}>No reviews match your filters.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}