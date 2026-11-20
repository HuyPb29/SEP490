import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './AdminLocationsPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const INITIAL_VOUCHERS = [
  {
    id: 'voucher-free-booking',
    code: 'FREECOURT100',
    title: "Ưu đãi đặt sân miễn phí",
    facility: 'Smash Arena',
    owner: 'Nguyen Van Hung',
    ownerUsername: 'nguyen.van.hung',
    discount: "Giảm 100%",
    condition: "Đơn tối thiểu: 0 đồng",
    violationReason: "Báo cáo khiếu nại: phiếu ưu đãi có thể làm giá trị đơn giảm còn 0 đồng.",
    reportedCount: 8,
    status: "Đã phát hành — Bị báo cáo",
  },
  {
    id: 'voucher-mystery-deal',
    code: 'MYSTERY50',
    title: "Ưu đãi giảm một nửa giá",
    facility: 'Green Shuttle Club',
    owner: 'Pham Minh',
    ownerUsername: 'pham.minh',
    discount: "Giảm 50%",
    condition: "Đơn tối thiểu: 5.000.000 đồng",
    violationReason: "Bị báo cáo vì điều kiện gây hiểu nhầm và không đúng với ưu đãi đã quảng cáo.",
    reportedCount: 3,
    status: "Đã phát hành — Bị báo cáo",
  },
  {
    id: 'voucher-old-promo',
    code: 'COURTLY20',
    title: "Ưu đãi cuối tuần Courtly",
    facility: 'Dich Vong Badminton Court',
    owner: 'Do Lan',
    ownerUsername: 'do.lan',
    discount: "Giảm 20%",
    condition: "Đơn tối thiểu: 100.000 đồng",
    violationReason: "Đã vô hiệu hóa sau khi kiểm tra chương trình ưu đãi bị báo cáo.",
    reportedCount: 2,
    status: "Đã vô hiệu hóa",
  },
]

const STATUS_FILTERS = ["Tất cả", "Bị đánh dấu / Bị báo cáo", "Đã vô hiệu hóa"]

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminViolatingVouchersPage() {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS)
  const [selectedStatus, setSelectedStatus] = useState("Tất cả")
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredVouchers = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return vouchers.filter((voucher) => {
      const matchesStatus = selectedStatus === "Tất cả"
        || (selectedStatus === "Đã vô hiệu hóa" && voucher.status === "Đã vô hiệu hóa")
        || (selectedStatus === "Bị đánh dấu / Bị báo cáo" && voucher.status === "Đã phát hành — Bị báo cáo")
      const searchableText = `${voucher.code} ${voucher.title} ${voucher.facility}`.toLocaleLowerCase()
      const matchesSearch = !keyword || searchableText.includes(keyword)
      return matchesStatus && matchesSearch
    })
  }, [vouchers, selectedStatus, searchKeyword])

  const handleDeactivate = (voucherId) => {
    try {
      const voucher = vouchers.find((item) => item.id === voucherId)
      if (!voucher) throw new Error("Không tìm thấy phiếu ưu đãi đã chọn.")
      if (voucher.status === "Đã vô hiệu hóa") return
      const confirmed = window.confirm(`Vô hiệu hóa phiếu ưu đãi ${voucher.code}? Phiếu sẽ ngừng hiển thị với người chơi và không áp dụng cho đơn mới. Dữ liệu của các đơn đã sử dụng phiếu vẫn được giữ lại.`)
      if (!confirmed) return
      setVouchers((currentVouchers) => currentVouchers.map((item) => (
        item.id === voucherId ? { ...item, status: "Đã vô hiệu hóa" } : item
      )))
      setStatusMessage(`${voucher.code} đã được vô hiệu hóa. Các đơn hiện có được giữ nguyên.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleViewOwner = (username) => {
    try {
      if (!username) throw new Error("Không có tên đăng nhập của chủ sân.")
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
        <h1 className={styles.pageTitle}>Quản lý phiếu ưu đãi vi phạm</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Đóng thông báo" onClick={clearNotice}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="vouchers-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="vouchers-heading">Phiếu ưu đãi ({filteredVouchers.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Lọc theo trạng thái</span>
                <select className={styles.filterSelect} value={selectedStatus} onChange={handleStatusChange}>
                  {STATUS_FILTERS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Tìm theo mã phiếu ưu đãi hoặc địa điểm</span>
                <input
                  type="search"
                  placeholder="Tìm theo mã phiếu ưu đãi hoặc địa điểm"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(145px, 1.15fr) minmax(155px, 1.2fr) minmax(185px, 1.5fr) minmax(200px, 1.6fr) minmax(82px, .6fr) minmax(130px, 1fr) minmax(156px, 1.2fr)', minWidth: '1050px' }}>
              <span role="columnheader">Mã và tên phiếu ưu đãi</span>
              <span role="columnheader">Địa điểm và chủ sân</span>
              <span role="columnheader">Mức giảm và điều kiện</span>
              <span role="columnheader">Lý do vi phạm</span>
              <span role="columnheader">Số lượt báo cáo</span>
              <span role="columnheader">Trạng thái</span>
              <span role="columnheader">Thao tác</span>
            </div>
            {filteredVouchers.map((voucher) => (
              <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={voucher.id} style={{ gridTemplateColumns: 'minmax(145px, 1.15fr) minmax(155px, 1.2fr) minmax(185px, 1.5fr) minmax(200px, 1.6fr) minmax(82px, .6fr) minmax(130px, 1fr) minmax(156px, 1.2fr)', minWidth: '1050px' }}>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.code}</strong>
                  <span className={styles.cellSecondary}>{voucher.title}</span>
                </div>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.facility}</strong>
                  <span className={styles.cellSecondary}>Chủ sân: {voucher.owner}</span>
                </div>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{voucher.discount}</strong>
                  <span className={styles.cellSecondary}>{voucher.condition}</span>
                </div>
                <span className={styles.wrapCell} role="cell">{voucher.violationReason}</span>
                <strong className={styles.numberCell} role="cell">{voucher.reportedCount.toLocaleString('en-US')}</strong>
                <span role="cell">
                  <span className={`${styles.statusBadge} ${voucher.status === "Đã vô hiệu hóa" ? styles.statusLocked : styles.statusReported}`}>
                    {voucher.status}
                  </span>
                </span>
                <div className={styles.adminRowActions} role="cell">
                  <button className={styles.extendButton} type="button" onClick={() => handleViewOwner(voucher.ownerUsername)}>Xem chủ sân</button>
                  {voucher.status === "Đã vô hiệu hóa" ? (
                    <span className={styles.cellSecondary}>Đã vô hiệu hóa</span>
                  ) : (
                    <button className={styles.lockButton} type="button" onClick={() => handleDeactivate(voucher.id)}>Vô hiệu hóa</button>
                  )}
                </div>
              </div>
            ))}
            {filteredVouchers.length === 0 && <p className={styles.emptyState}>Không có phiếu ưu đãi phù hợp với bộ lọc.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}