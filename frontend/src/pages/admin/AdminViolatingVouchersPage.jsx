import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AdminFacilitiesPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const INITIAL_VOUCHERS = [
  {
    id: 'voucher-free-booking',
    code: 'FREECOURT100',
    title: 'Free Court Booking',
    facility: 'Smash Arena',
    owner: 'Nguyen Van Hung',
    ownerUsername: 'nguyen.van.hung',
    discount: '100% off',
    condition: 'Minimum order: VND 0',
    violationReason: 'Complaint report: voucher can discount an order to VND 0 (BR15).',
    reportedCount: 8,
    status: 'Published - Flagged',
  },
  {
    id: 'voucher-mystery-deal',
    code: 'MYSTERY50',
    title: 'Mystery Half-Price Deal',
    facility: 'Green Shuttle Club',
    owner: 'Pham Minh',
    ownerUsername: 'pham.minh',
    discount: '50% off',
    condition: 'Minimum order: VND 5,000,000',
    violationReason: 'Reported condition is misleading and does not match the advertised offer.',
    reportedCount: 3,
    status: 'Published - Flagged',
  },
  {
    id: 'voucher-old-promo',
    code: 'COURTLY20',
    title: 'Courtly Weekend Discount',
    facility: 'Dich Vong Badminton Court',
    owner: 'Do Lan',
    ownerUsername: 'do.lan',
    discount: '20% off',
    condition: 'Minimum order: VND 100,000',
    violationReason: 'Deactivated after review of a reported promotion.',
    reportedCount: 2,
    status: 'Deactivated',
  },
]

const STATUS_FILTERS = ['All', 'Flagged / Reported', 'Deactivated']

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminViolatingVouchersPage() {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS)
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredVouchers = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return vouchers.filter((voucher) => {
      const matchesStatus = selectedStatus === 'All'
        || (selectedStatus === 'Deactivated' && voucher.status === 'Deactivated')
        || (selectedStatus === 'Flagged / Reported' && voucher.status === 'Published - Flagged')
      const searchableText = `${voucher.code} ${voucher.title} ${voucher.facility}`.toLocaleLowerCase()
      const matchesSearch = !keyword || searchableText.includes(keyword)
      return matchesStatus && matchesSearch
    })
  }, [vouchers, selectedStatus, searchKeyword])

  const handleDeactivate = (voucherId) => {
    try {
      const voucher = vouchers.find((item) => item.id === voucherId)
      if (!voucher) throw new Error('The selected voucher could not be found.')
      if (voucher.status === 'Deactivated') return
      const confirmed = window.confirm(`Deactivate voucher ${voucher.code}? It will stop being displayed to players and cannot be applied to new orders. It will remain in the database for existing orders.`)
      if (!confirmed) return
      setVouchers((currentVouchers) => currentVouchers.map((item) => (
        item.id === voucherId ? { ...item, status: 'Deactivated' } : item
      )))
      setStatusMessage(`${voucher.code} has been deactivated. Existing orders are unchanged.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleViewOwner = (username) => {
    try {
      if (!username) throw new Error('The owner username is unavailable.')
      navigate(`/admin/accounts?search=${encodeURIComponent(username)}`)
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleStatusChange = (event) => {
    try {
      setSelectedStatus(event.target.value)
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
        <h1 className={styles.pageTitle}>Manage Violating Vouchers</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="vouchers-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="vouchers-heading">Vouchers ({filteredVouchers.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Filter by status</span>
                <select className={styles.filterSelect} value={selectedStatus} onChange={handleStatusChange}>
                  {STATUS_FILTERS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Search by voucher code or facility</span>
                <input
                  type="search"
                  placeholder="Search by voucher code or facility"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(145px, 1.15fr) minmax(155px, 1.2fr) minmax(185px, 1.5fr) minmax(200px, 1.6fr) minmax(82px, .6fr) minmax(130px, 1fr) minmax(156px, 1.2fr)', minWidth: '1050px' }}>
              <span role="columnheader">Voucher Code &amp; Title</span>
              <span role="columnheader">Facility &amp; Owner</span>
              <span role="columnheader">Discount &amp; Condition</span>
              <span role="columnheader">Violation Reason</span>
              <span role="columnheader">Reported Count</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actions</span>
            </div>
            {filteredVouchers.map((voucher) => (
              <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={voucher.id} style={{ gridTemplateColumns: 'minmax(145px, 1.15fr) minmax(155px, 1.2fr) minmax(185px, 1.5fr) minmax(200px, 1.6fr) minmax(82px, .6fr) minmax(130px, 1fr) minmax(156px, 1.2fr)', minWidth: '1050px' }}>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.code}</strong>
                  <span className={styles.cellSecondary}>{voucher.title}</span>
                </div>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.facility}</strong>
                  <span className={styles.cellSecondary}>Owner: {voucher.owner}</span>
                </div>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.discount}</strong>
                  <span className={styles.cellSecondary}>{voucher.condition}</span>
                </div>
                <span className={styles.wrapCell} role="cell">{voucher.violationReason}</span>
                <strong className={styles.numberCell} role="cell">{voucher.reportedCount.toLocaleString('en-US')}</strong>
                <span role="cell">
                  <span className={`${styles.statusBadge} ${voucher.status === 'Deactivated' ? styles.statusLocked : styles.statusReported}`}>
                    {voucher.status}
                  </span>
                </span>
                <div className={styles.adminRowActions} role="cell">
                  <button className={styles.extendButton} type="button" onClick={() => handleViewOwner(voucher.ownerUsername)}>View Owner</button>
                  {voucher.status === 'Deactivated' ? (
                    <span className={styles.cellSecondary}>Deactivated</span>
                  ) : (
                    <button className={styles.lockButton} type="button" onClick={() => handleDeactivate(voucher.id)}>Deactivate</button>
                  )}
                </div>
              </div>
            ))}
            {filteredVouchers.length === 0 && <p className={styles.emptyState}>No vouchers match your filters.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}