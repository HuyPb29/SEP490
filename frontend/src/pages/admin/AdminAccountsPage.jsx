import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './AdminFacilitiesPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const INITIAL_ACCOUNTS = [
  {
    id: 'user-alex-nguyen',
    username: 'alex.nguyen',
    name: 'Alex Nguyen',
    email: 'alex.nguyen@example.com',
    phone: '0911222333',
    role: 'Player',
    facility: '',
    status: 'Active',
    createdAt: '2025-11-18',
  },
  {
    id: 'user-court-deals',
    username: 'court.deals',
    name: 'Court Deals',
    email: 'court.deals@example.com',
    phone: '0922333444',
    role: 'Player',
    facility: '',
    status: 'Active',
    createdAt: '2026-02-14',
  },
  {
    id: 'user-minh-anh',
    username: 'minh.anh',
    name: 'Tran Minh Anh',
    email: 'minh.anh@example.com',
    phone: '0901234567',
    role: 'Player',
    facility: '',
    status: 'Active',
    createdAt: '2025-08-12',
  },
  {
    id: 'user-quoc-bao',
    username: 'quoc.bao',
    name: 'Nguyen Quoc Bao',
    email: 'quoc.bao@example.com',
    phone: '0912345678',
    role: 'Player',
    facility: '',
    status: 'Locked',
    createdAt: '2025-09-04',
  },
  {
    id: 'user-thanh-tran',
    username: 'thanh.tran',
    name: 'Tran Thanh',
    email: 'thanh.tran@example.com',
    phone: '0987654321',
    role: 'Staff',
    facility: 'Smash Arena',
    status: 'Active',
    createdAt: '2025-10-19',
  },
  {
    id: 'user-lan-pham',
    username: 'lan.pham',
    name: 'Pham Thi Lan',
    email: 'lan.pham@example.com',
    phone: '0934567890',
    role: 'Staff',
    facility: 'Green Shuttle Club',
    status: 'Unverified',
    createdAt: '2026-01-03',
  },
  {
    id: 'user-nguyen-hung',
    username: 'nguyen.van.hung',
    name: 'Nguyen Van Hung',
    email: 'hung.nguyen@example.com',
    phone: '0905556677',
    role: 'Owner',
    facility: '',
    status: 'Active',
    createdAt: '2025-07-26',
  },
  {
    id: 'user-pham-minh',
    username: 'pham.minh',
    name: 'Pham Minh',
    email: 'minh.pham@example.com',
    phone: '0977778899',
    role: 'Owner',
    facility: '',
    status: 'Locked',
    createdAt: '2025-06-11',
  },
  {
    id: 'user-admin',
    username: 'admin',
    name: 'Courtly Administrator',
    email: 'admin@courtly.example',
    phone: '0900000000',
    role: 'Admin',
    facility: '',
    status: 'Active',
    createdAt: '2024-12-01',
  },
]

const ROLES = ['All Roles', 'Player', 'Staff', 'Owner', 'Admin']

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
  const [selectedRole, setSelectedRole] = useState('All Roles')
  const [searchKeyword, setSearchKeyword] = useState(() => searchParams.get('search') ?? '')
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredAccounts = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    return accounts.filter((account) => {
      const matchesRole = selectedRole === 'All Roles' || account.role === selectedRole
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
      if (!account) throw new Error('The selected account could not be found.')
      if (account.role === 'Admin') throw new Error('Admin accounts cannot be locked.')

      if (account.status === 'Locked') {
        setAccounts((currentAccounts) => currentAccounts.map((item) => (
          item.id === accountId ? { ...item, status: 'Active' } : item
        )))
        setStatusMessage(`${account.name} has been unlocked successfully. (MSG14)`)
        setActionError('')
        return
      }

      const confirmationMessage = account.role === 'Owner'
        ? `Lock Owner account ${account.name}? All facilities and staff accounts belonging to this Owner will also be locked. The Owner will have 30 days to sign in and download report data (UC36).`
        : `Lock ${account.role} account ${account.name}? They will be blocked from signing in with "Account is locked. Please contact administrator." Historical data will be preserved (DR31).`
      if (!window.confirm(confirmationMessage)) return

      setAccounts((currentAccounts) => currentAccounts.map((item) => (
        item.id === accountId ? { ...item, status: 'Locked' } : item
      )))
      setStatusMessage(`${account.name}'s account has been locked.`)
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
        <h1 className={styles.pageTitle}>Manage User Accounts</h1>

        {(statusMessage || actionError) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={clearNotice}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="accounts-heading">
          <div className={styles.adminToolbar}>
            <h2 className={styles.sectionTitle} id="accounts-heading">Accounts ({filteredAccounts.length})</h2>
            <div className={styles.toolbarControls}>
              <label className={styles.filterField}>
                <span className={styles.visuallyHidden}>Filter by role</span>
                <select className={styles.filterSelect} value={selectedRole} onChange={handleRoleChange}>
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Search by username, name, email, or phone</span>
                <input
                  type="search"
                  placeholder="Search by username, name, email, or phone"
                  value={searchKeyword}
                  onChange={handleSearchChange}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row" style={{ gridTemplateColumns: 'minmax(160px, 1.25fr) minmax(185px, 1.35fr) minmax(80px, .7fr) minmax(130px, 1fr) minmax(95px, .75fr) minmax(90px, .75fr) minmax(84px, .65fr)', minWidth: '920px' }}>
              <span role="columnheader">User</span>
              <span role="columnheader">Contact</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Affiliated Facility</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Created At</span>
              <span role="columnheader">Actions</span>
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
                <span role="cell"><span className={`${styles.roleBadge} ${styles[`role${account.role}`]}`}>{account.role}</span></span>
                <span className={styles.cellSecondary} role="cell">{account.role === 'Staff' ? account.facility : '—'}</span>
                <span role="cell">
                  <span className={`${styles.statusBadge} ${account.status === 'Active' ? styles.statusActive : account.status === 'Locked' ? styles.statusLocked : styles.statusUnverified}`}>
                    {account.status}
                  </span>
                </span>
                <span className={styles.numberCell} role="cell">{formatDate(account.createdAt)}</span>
                <div className={styles.accountActions} role="cell">
                  {account.role !== 'Admin' && (
                    <button
                      className={account.status === 'Locked' ? styles.reopenButton : styles.lockButton}
                      type="button"
                      onClick={() => handleAccountLock(account.id)}
                    >
                      {account.status === 'Locked' ? 'Unlock' : 'Lock'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredAccounts.length === 0 && <p className={styles.emptyState}>No accounts match your filters.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}