import { useMemo, useState } from 'react'
import styles from './AdminLocationsPage.module.css'
import AdminPortalSidebar from './AdminPortalSidebar'

const INITIAL_PENDING_REQUESTS = [
  {
    id: 'request-mydinh',
    name: 'My Dinh Badminton Court',
    type: 'New Owner',
    address: '15 Le Duc Tho, Nam Tu Liem',
    courts: 6,
    ownerName: 'Tran Van Binh',
    contact: '0912 000 111',
    submitted: '23/10 14:20',
  },
  {
    id: 'request-smash-2',
    name: 'Smash Arena 2',
    type: 'Add Location',
    address: '40 Quang Trung, Ha Dong',
    courts: 5,
    ownerName: 'Nguyen Van Hung',
    contact: '',
    submitted: '23/10 09:05',
  },
  {
    id: 'request-long-bien',
    name: 'Long Bien Club',
    type: 'New Owner',
    address: '7 Nguyen Van Cu, Long Bien',
    courts: 4,
    ownerName: 'Le Thu Ha',
    contact: '0988 222 333',
    submitted: '22/10 17:40',
  },
]

const INITIAL_FACILITIES = [
  {
    id: 'facility-smash-arena',
    name: 'Smash Arena',
    owner: 'Nguyen Van Hung',
    status: 'Active',
    serviceStartDate: '2026-01-01',
    serviceEndDate: '2026-12-31',
    servicePeriodKind: 'range',
    courts: 8,
    bookings: 3412,
  },
  {
    id: 'facility-green-shuttle',
    name: 'Green Shuttle Club',
    owner: 'Pham Minh',
    status: 'Active',
    serviceStartDate: '2026-01-01',
    serviceEndDate: '2026-10-27',
    servicePeriodKind: 'expires',
    courts: 6,
    bookings: 1980,
  },
  {
    id: 'facility-dich-vong',
    name: 'Dich Vong Badminton Court',
    owner: 'Do Lan',
    status: 'Active',
    serviceStartDate: '2026-03-15',
    serviceEndDate: '2027-03-14',
    servicePeriodKind: 'range',
    courts: 4,
    bookings: 870,
  },
  {
    id: 'facility-thanh-xuan',
    name: 'Badminton Thanh Xuan',
    owner: 'Vu Tung',
    status: 'Locked',
    serviceStartDate: '2025-10-01',
    serviceEndDate: '2026-09-30',
    servicePeriodKind: 'expired',
    courts: 5,
    bookings: 1204,
  },
]

const TOTAL_FACILITY_COUNT = 24
const EXTENSION_OPTIONS = [
  { months: 12, label: '12 months (1 year)' },
  { months: 24, label: '24 months (2 years)' },
  { months: 36, label: '36 months (3 years)' },
]

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

function addMonths(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number)
  const targetYear = year + Math.floor((month - 1 + months) / 12)
  const targetMonth = (month - 1 + months) % 12
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDayOfMonth)
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10)
}

function isExpired(dateString) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(`${dateString}T00:00:00`)
  return endDate < today
}

function getErrorMessage(err) {
  return err.response?.data?.message || err.message
}

export default function AdminLocationsPage() {
  const [pendingRequests, setPendingRequests] = useState(INITIAL_PENDING_REQUESTS)
  const [facilities, setFacilities] = useState(INITIAL_FACILITIES)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [modal, setModal] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filteredFacilities = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase()
    if (!keyword) return facilities
    return facilities.filter((facility) => facility.name.toLocaleLowerCase().includes(keyword))
  }, [facilities, searchKeyword])

  const handleApprove = (requestId) => {
    try {
      const request = pendingRequests.find((item) => item.id === requestId)
      if (!request) throw new Error('The registration request could not be found.')

      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startDateString = [
        startDate.getFullYear(),
        String(startDate.getMonth() + 1).padStart(2, '0'),
        String(startDate.getDate()).padStart(2, '0'),
      ].join('-')
      const endDateString = addMonths(startDateString, 12)
      setFacilities((currentFacilities) => [...currentFacilities, {
        id: `facility-${request.id}`,
        name: request.name,
        owner: request.ownerName,
        status: 'Active',
        serviceStartDate: startDateString,
        serviceEndDate: endDateString,
        servicePeriodKind: 'range',
        courts: request.courts,
        bookings: 0,
      }])
      setPendingRequests((currentRequests) => currentRequests.filter((item) => item.id !== requestId))
      setStatusMessage(request.type === 'New Owner'
        ? `Owner account created for ${request.ownerName}. Activation email sent.`
        : `Location added to ${request.ownerName}'s existing owner account.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleReject = (requestId) => {
    try {
      const request = pendingRequests.find((item) => item.id === requestId)
      if (!request) throw new Error('The registration request could not be found.')
      setModal({ type: 'reject', requestId, reason: '' })
      setActionError('')
      setStatusMessage('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleConfirmRejection = (event) => {
    event.preventDefault()
    try {
      if (!modal || modal.type !== 'reject') throw new Error('Choose a registration request to reject.')
      const request = pendingRequests.find((item) => item.id === modal.requestId)
      if (!request) throw new Error('The registration request could not be found.')
      if (!modal.reason.trim()) throw new Error('A rejection reason is required.')
      setPendingRequests((currentRequests) => currentRequests.filter((item) => item.id !== modal.requestId))
      setStatusMessage(`Rejection email sent to ${request.ownerName}.`)
      setModal(null)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleLock = (facilityId) => {
    try {
      const facility = facilities.find((item) => item.id === facilityId)
      if (!facility) throw new Error('The selected location could not be found.')
      const confirmed = window.confirm(`Lock location ${facility.name}? The location will no longer be displayed and will not accept new bookings. The system does not process unplayed bookings of the location.`)
      if (!confirmed) return
      setFacilities((currentFacilities) => currentFacilities.map((item) => (
        item.id === facilityId ? { ...item, status: 'Locked' } : item
      )))
      setStatusMessage(`${facility.name} has been locked.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleExtend = (facilityId, reopening = false) => {
    try {
      const facility = facilities.find((item) => item.id === facilityId)
      if (!facility) throw new Error('The selected location could not be found.')
      setModal({ facilityId, months: 12, reopening })
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const handleReopen = (facilityId) => {
    try {
      const facility = facilities.find((item) => item.id === facilityId)
      if (!facility) throw new Error('The selected location could not be found.')
      if (isExpired(facility.serviceEndDate)) {
        handleExtend(facilityId, true)
        return
      }
      setFacilities((currentFacilities) => currentFacilities.map((item) => (
        item.id === facilityId ? { ...item, status: 'Active' } : item
      )))
      setStatusMessage(`${facility.name} has been reopened.`)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const handleConfirmExtension = (event) => {
    event.preventDefault()
    try {
      if (!modal) throw new Error('Choose a location to extend.')
      const facility = facilities.find((item) => item.id === modal.facilityId)
      if (!facility) throw new Error('The selected location could not be found.')
      const option = EXTENSION_OPTIONS.find((item) => item.months === Number(modal.months))
      if (!option) throw new Error('Choose a valid extension period.')
      const serviceEndDate = addMonths(facility.serviceEndDate, option.months)
      setFacilities((currentFacilities) => currentFacilities.map((item) => (
        item.id === facility.id
          ? {
            ...item,
            serviceEndDate,
            servicePeriodKind: 'range',
            status: modal.reopening ? 'Active' : item.status,
          }
          : item
      )))
      setStatusMessage(modal.reopening
        ? `${facility.name} has been extended and reopened.`
        : `${facility.name} service extended by ${option.label}.`)
      setModal(null)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
      setStatusMessage('')
    }
  }

  const closeModal = () => {
    try {
      setModal(null)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const updateExtensionPeriod = (event) => {
    try {
      const months = Number(event.target.value)
      setModal((currentModal) => currentModal ? { ...currentModal, months } : currentModal)
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const updateRejectionReason = (event) => {
    try {
      const reason = event.target.value
      setModal((currentModal) => currentModal ? { ...currentModal, reason } : currentModal)
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  const clearStatus = () => {
    try {
      setStatusMessage('')
      setActionError('')
    } catch (err) {
      setActionError(getErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <AdminPortalSidebar pendingRequestCount={pendingRequests.length} />

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Manage Service Locations</h1>

        {(statusMessage || (actionError && !modal)) && (
          <div className={actionError ? styles.errorNotice : styles.statusNotice} role={actionError ? 'alert' : 'status'}>
            <span>{actionError || statusMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={clearStatus}>×</button>
          </div>
        )}

        <section className={`${styles.panel} ${styles.requestsPanel}`} aria-labelledby="requests-title">
          <h2 className={styles.sectionTitle} id="requests-title">
            Pending Registration Requests ({pendingRequests.length})
          </h2>
          <div className={styles.requestList}>
            {pendingRequests.map((request) => (
              <article className={styles.requestRow} key={request.id}>
                <div className={styles.requestInfo}>
                  <div className={styles.requestHeading}>
                    <h3>{request.name}</h3>
                    <span className={styles.requestType}>{request.type}</span>
                  </div>
                  <p className={styles.requestAddress}>{request.address} · {request.courts} courts</p>
                  <p className={styles.requestMeta}>
                    {request.ownerName}{request.type === 'Add Location' ? ' (Existing Owner)' : ''}
                    {request.contact ? ` · ${request.contact}` : ''} · submitted {request.submitted}
                  </p>
                </div>
                <div className={styles.requestActions}>
                  <button className={styles.rejectButton} type="button" onClick={() => handleReject(request.id)}>Reject</button>
                  <button className={styles.approveButton} type="button" onClick={() => handleApprove(request.id)}>Approve</button>
                </div>
              </article>
            ))}
            {pendingRequests.length === 0 && (
              <p className={styles.emptyState}>There are no pending registration requests.</p>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.facilitiesPanel}`} aria-labelledby="facilities-title">
          <div className={styles.facilitiesHeader}>
            <h2 className={styles.sectionTitle} id="facilities-title">
              Locations ({TOTAL_FACILITY_COUNT + facilities.length - INITIAL_FACILITIES.length})
            </h2>
            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>Search by location name</span>
              <input
                type="search"
                placeholder="Search by location name"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.tableScroller}>
            <div className={`${styles.facilityTable} ${styles.tableHeader}`} role="row">
              <span role="columnheader">Location</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Service Period</span>
              <span role="columnheader">Courts</span>
              <span role="columnheader">Bookings</span>
              <span role="columnheader">Actions</span>
            </div>
            {filteredFacilities.map((facility) => (
              <div className={`${styles.facilityTable} ${styles.facilityRow}`} role="row" key={facility.id}>
                <div className={styles.facilityName} role="cell">
                  <strong>{facility.name}</strong>
                  <span>Owner: {facility.owner}</span>
                </div>
                <div className={styles.statusCell} role="cell">
                  <span className={`${styles.statusBadge} ${facility.status === 'Active' ? styles.statusActive : styles.statusLocked}`}>
                    {facility.status}
                  </span>
                </div>
                <div
                  className={`${styles.servicePeriod} ${facility.servicePeriodKind === 'expires' ? styles.periodExpiring : ''} ${facility.servicePeriodKind === 'expired' ? styles.periodExpired : ''}`}
                  role="cell"
                >
                  {facility.servicePeriodKind === 'range'
                    ? <>{formatDate(facility.serviceStartDate)} – {formatDate(facility.serviceEndDate)}</>
                    : <>{facility.servicePeriodKind === 'expired' ? 'Expired' : 'Expires'} {formatDate(facility.serviceEndDate)}</>}
                </div>
                <span className={styles.numberCell} role="cell">{facility.courts}</span>
                <span className={styles.numberCell} role="cell">{facility.bookings.toLocaleString('en-US')}</span>
                <div className={styles.facilityActions} role="cell">
                  <button className={styles.extendButton} type="button" onClick={() => handleExtend(facility.id)}>Extend</button>
                  {facility.status === 'Active' ? (
                    <button className={styles.lockButton} type="button" onClick={() => handleLock(facility.id)}>Lock</button>
                  ) : (
                    <button className={styles.reopenButton} type="button" onClick={() => handleReopen(facility.id)}>Reopen</button>
                  )}
                </div>
              </div>
            ))}
            {filteredFacilities.length === 0 && (
              <p className={styles.emptyState}>No locations match your search.</p>
            )}
          </div>
        </section>

        {modal && (
          <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="extend-modal-title">
              <h2 id="extend-modal-title">
                {modal.type === 'reject'
                  ? 'Reject Registration Request'
                  : modal.reopening ? 'Extend and Reopen Location' : 'Extend Service Period'}
              </h2>
              <p>
                {modal.type === 'reject'
                  ? 'Provide a reason to include in the rejection email.'
                  : 'Select the service period to add to this location.'}
              </p>
              <form onSubmit={modal.type === 'reject' ? handleConfirmRejection : handleConfirmExtension}>
                {actionError && <p className={styles.modalError} role="alert">{actionError}</p>}
                {modal.type === 'reject' ? (
                  <label className={styles.modalField}>
                    <span>Rejection reason</span>
                    <textarea
                      autoFocus
                      rows="4"
                      value={modal.reason}
                      onChange={updateRejectionReason}
                    />
                  </label>
                ) : (
                  <label className={styles.modalField}>
                    <span>Extension period</span>
                    <select value={modal.months} onChange={updateExtensionPeriod}>
                      {EXTENSION_OPTIONS.map((option) => (
                        <option key={option.months} value={option.months}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.cancelButton} type="button" onClick={closeModal}>Cancel</button>
                  <button className={styles.approveButton} type="submit">
                    {modal.type === 'reject'
                      ? 'Send Rejection'
                      : modal.reopening ? 'Extend & Reopen' : 'Confirm Extension'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}