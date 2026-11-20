import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './AdminLocationsPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const roleStyles = { 'Người chơi': 'rolePlayer', 'Nhân viên': 'roleStaff', 'Chủ sân': 'roleOwner', 'Quản trị viên': 'roleAdmin' }

const INITIAL_ACCOUNTS = [
  {
    id: 'user-alex-nguyen',
    username: 'alex.nguyen',
    name: 'Alex Nguyen',
    email: 'alex.nguyen@example.com',
    phone: '0911222333',
    role: "Người chơi",
    facility: '',
    status: "Đang hoạt động",
    createdAt: '2025-11-18',
  },
  {
    id: 'user-court-deals',
    username: 'court.deals',
    name: 'Court Deals',
    email: 'court.deals@example.com',
    phone: '0922333444',
    role: "Người chơi",
    facility: '',
    status: "Đang hoạt động",
    createdAt: '2026-02-14',
  },
  {
    id: 'user-minh-anh',
    username: 'minh.anh',
    name: 'Tran Minh Anh',
    email: 'minh.anh@example.com',
    phone: '0901234567',
    role: "Người chơi",
    facility: '',
    status: "Đang hoạt động",
    createdAt: '2025-08-12',
  },
  {
    id: 'user-quoc-bao',
    username: 'quoc.bao',
    name: 'Nguyen Quoc Bao',
    email: 'quoc.bao@example.com',
    phone: '0912345678',
    role: "Người chơi",
    facility: '',
    status: "Đã khóa",
    createdAt: '2025-09-04',
  },
  {
    id: 'user-thanh-tran',
    username: 'thanh.tran',
    name: 'Tran Thanh',
    email: 'thanh.tran@example.com',
    phone: '0987654321',
    role: "Nhân viên",
    facility: 'Smash Arena',
    status: "Đang hoạt động",
    createdAt: '2025-10-19',
  },
  {
    id: 'user-lan-pham',
    username: 'lan.pham',
    name: 'Pham Thi Lan',
    email: 'lan.pham@example.com',
    phone: '0934567890',
    role: "Nhân viên",
    facility: 'Green Shuttle Club',
    status: "Chưa xác thực",
    createdAt: '2026-01-03',
  },
  {
    id: 'user-nguyen-hung',
    username: 'nguyen.van.hung',
    name: 'Nguyen Van Hung',
    email: 'hung.nguyen@example.com',
    phone: '0905556677',
    role: "Chủ sân",
    facility: '',
    status: "Đang hoạt động",
    createdAt: '2025-07-26',
  },
  {
    id: 'user-pham-minh',
    username: 'pham.minh',
    name: 'Pham Minh',
    email: 'minh.pham@example.com',
    phone: '0977778899',
    role: "Chủ sân",
    facility: '',
    status: "Đã khóa",
    createdAt: '2025-06-11',
  },
  {
    id: 'user-admin',
    username: 'admin',
    name: 'Courtly Administrator',
    email: 'admin@courtly.example',
    phone: '0900000000',
    role: "Quản trị viên",
    facility: '',
    status: "Đang hoạt động",
    createdAt: '2024-12-01',
  },
]

const ROLES = ["Tất cả vai trò", "Người chơi", "Nhân viên", "Chủ sân", "Quản trị viên"]

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminAccountsPage() {
  const [searchParams] = useSearchParams()
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS)
  const [selectedRole, setSelectedRole] = useState("Tất cả vai trò")
  const [searchKeyword, setSearchKeyword] = useState(() => searchParams.get('search') ?? '')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredAccounts = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return accounts.filter((account) => {
      const matchesRole = selectedRole === "Tất cả vai trò" || account.role === selectedRole
      const searchableText = [account.username, account.name, account.email, account.phone]
        .join(' ')
        .toLocaleLowerCase()
      const matchesSearch = !keyword || searchableText.includes(keyword)
      return matchesRole && matchesSearch
    })
  }, [accounts, searchKeyword, selectedRole])

  const handleAccountLock = (accountId) => {
    try {
      const account = accounts.find((item) => item.id === accountId)
      if (!account) throw new Error("Không tìm thấy tài khoản đã chọn.")
      if (account.role === "Quản trị viên") throw new Error("Không được khóa tài khoản quản trị viên.")

      if (account.status === "Đã khóa") {
        setAccounts((currentAccounts) => currentAccounts.map((item) => (
          item.id === accountId ? { ...item, status: "Đang hoạt động" } : item
        )))
        setStatusMessage(`${account.name} đã được mở khóa thành công.`)
        setActionError('')
        return
      }

      const confirmationMessage = account.role === "Chủ sân"
        ? `Khóa tài khoản chủ sân ${account.name}? Tất cả địa điểm và tài khoản nhân viên thuộc chủ sân này cũng sẽ bị khóa. Chủ sân có 30 ngày để đăng nhập và tải dữ liệu báo cáo.`
        : `Khóa tài khoản ${account.role} ${account.name}? Tài khoản sẽ không thể đăng nhập và nhận thông báo đã bị khóa, cần liên hệ quản trị viên. Dữ liệu lịch sử được giữ lại.`
      if (!window.confirm(confirmationMessage)) return

      setAccounts((currentAccounts) => currentAccounts.map((item) => (
        item.id === accountId ? { ...item, status: "Đã khóa" } : item
      )))
      setStatusMessage(`${account.name}: đã khóa tài khoản.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleRoleChange = (event) => {
    try {
      setSelectedRole(event.target.value)
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
        <h1 className={styles.pageTitle}>Quản lý tài khoản người dùng</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Đóng thông báo" onClick={clearNotice}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="accounts-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="accounts-heading">Tài khoản ({filteredAccounts.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Lọc theo vai trò</span>
                <select className={styles.filterSelect} value={selectedRole} onChange={handleRoleChange}>
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Tìm theo tên đăng nhập, họ tên, email hoặc số điện thoại</span>
                <input
                  type="search"
                  placeholder="Tìm theo tên đăng nhập, họ tên, email hoặc số điện thoại"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(160px, 1.25fr) minmax(185px, 1.35fr) minmax(80px, .7fr) minmax(130px, 1fr) minmax(95px, .75fr) minmax(90px, .75fr) minmax(84px, .65fr)', minWidth: '920px' }}>
              <span role="columnheader">Người dùng</span>
              <span role="columnheader">Liên hệ</span>
              <span role="columnheader">Vai trò</span>
              <span role="columnheader">Địa điểm trực thuộc</span>
              <span role="columnheader">Trạng thái</span>
              <span role="columnheader">Ngày tạo</span>
              <span role="columnheader">Thao tác</span>
            </div>
            {filteredAccounts.map((account) => (
              <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={account.id} style={{ gridTemplateColumns: 'minmax(160px, 1.25fr) minmax(185px, 1.35fr) minmax(80px, .7fr) minmax(130px, 1fr) minmax(95px, .75fr) minmax(90px, .75fr) minmax(84px, .65fr)', minWidth: '920px' }}>
                <div className={styles.cellStack} role="cell">
                  <strong className={styles.cellPrimary}>{account.name}</strong>
                  <span className={styles.cellSecondary}>@{account.username}</span>
                </div>
                <div className={styles.cellStack} role="cell">
                  <span>{account.email}</span>
                  <span className={styles.cellSecondary}>{account.phone}</span>
                </div>
                <span role="cell"><span className={`${styles.roleBadge} ${styles[roleStyles[account.role]]}`}>{account.role}</span></span>
                <span className={styles.cellSecondary} role="cell">{account.role === "Nhân viên" ? account.facility : '—'}</span>
                <span role="cell">
                  <span className={`${styles.statusBadge} ${account.status === "Đang hoạt động" ? styles.statusActive : account.status === "Đã khóa" ? styles.statusLocked : styles.statusUnverified}`}>
                    {account.status}
                  </span>
                </span>
                <span className={styles.numberCell} role="cell">{formatDate(account.createdAt)}</span>
                <div className={styles.accountActions} role="cell">
                  {account.role !== "Quản trị viên" && (
                    <button
                      className={account.status === "Đã khóa" ? styles.reopenButton : styles.lockButton}
                      type="button"
                      onClick={() => handleAccountLock(account.id)}
                    >
                      {account.status === "Đã khóa" ? "Mở khóa" : "Khóa"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredAccounts.length === 0 && <p className={styles.emptyState}>Không có tài khoản phù hợp với bộ lọc.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}
