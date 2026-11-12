import api from './index'

const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const amount = new Intl.NumberFormat('vi-VN')
const body = (response) => response.data.data

export async function searchFacilities({ keyword = '', signal } = {}) {
  const params = keyword.trim() ? { q: keyword.trim() } : {}
  const response = await api.get('/locations', { params, signal })
  return { success: true, data: { items: body(response).map((venue) => ({
    ...venue, facility_id: venue.id, facility_name: venue.name,
  })) } }
}

export async function getVenueReviews(id, page, signal) {
  const response = await api.get('/locations/' + id + '/reviews', { params: { page, size: 20 }, signal })
  const result = body(response)
  return { ...result, content: result.content.filter((review) => !review.hidden) }
}

export async function getPublicVenue(id, signal) {
  const path = '/locations/' + id
  const [detailResponse, courtsResponse, ratingResponse] = await Promise.allSettled([
    api.get(path, { signal }),
    api.get(path + '/courts', { signal }),
    api.get(path + '/review-summary', { signal }),
  ])
  if (detailResponse.status === 'rejected') throw detailResponse.reason
  const detail = body(detailResponse.value)
  const courts = courtsResponse.status === 'fulfilled' ? body(courtsResponse.value) : []
  const rating = ratingResponse.status === 'fulfilled' ? body(ratingResponse.value) : null
  const courtDetails = await Promise.allSettled(courts.map(({ id: courtId }) =>
    api.get('/courts/' + courtId, { signal }).then(body)
  ))
  const priceTable = courtDetails.flatMap((result) => result.status === 'fulfilled'
    ? (result.value.priceRules || []).map((rule) => ({
      id: result.value.id + ':' + rule.id,
      court_name: result.value.name,
      days_label: rule.applyDays?.length ? [...rule.applyDays].sort((a, b) => a - b).map((day) => weekdays[day - 1]).join(', ') : 'Hằng ngày',
      time_range: rule.startTime + ' – ' + rule.endTime,
      price_label: amount.format(rule.pricePerSlot) + ' đ / 30 phút',
      valid_from: rule.validFrom,
      valid_to: rule.validTo,
    }))
    : [])
  const hours = (detail.openingHours || []).map((entry) => ({
    ...entry, dayName: weekdays[entry.dayOfWeek - 1],
  }))
  return {
    ...detail,
    facility_id: detail.id,
    facility_name: detail.name,
    contact_phone: detail.contactPhone,
    open_hours: hours.map((entry) => entry.dayName + ': ' + entry.openTime + '–' + entry.closeTime).join(' · ') || 'Chưa cập nhật',
    opening_hours_list: hours,
    courts_list: courts,
    courts_count: courts.length,
    courts_error: courtsResponse.status === 'rejected',
    price_error: courtsResponse.status === 'rejected' || courtDetails.some((result) => result.status === 'rejected'),
    rating: rating?.averageRating ?? null,
    review_count: rating?.reviewCount ?? 0,
    price_table: priceTable,
  }
}

// bookingId (tùy chọn): booking đang đổi lịch; buổi trong gói được xem tới hết thời hạn gói (BR31)
export async function getVenueSchedule(id, date, signal, bookingId) {
  const response = await api.get('/locations/' + id + '/schedules', { params: { date, bookingId }, signal })
  const schedule = body(response)
  const courts = schedule.courts.map((court) => ({
    court_id: court.courtId,
    court_name: court.name,
    slots: (court.slots || []).map((slot) => ({
      time: slot.time,
      status: slot.status.toLowerCase(),
      price: slot.price,
      bookingInfo: slot.bookerName || slot.bookerPhone || slot.note ? {
        name: slot.bookerName,
        phone: slot.bookerPhone,
        note: slot.note,
      } : null,
    })),
  }))
  return { play_date: schedule.date, max_date: schedule.maxDate, time_headers: courts[0]?.slots.map((slot) => slot.time) || [], courts }
}

export async function getFacilityDetailAndSchedule(id, date, signal) {
  const [venue, schedule] = await Promise.allSettled([getPublicVenue(id, signal), getVenueSchedule(id, date, signal)])
  if (venue.status === 'rejected') return { success: false, error: venue.reason.response?.data?.message || 'Không tải được địa điểm.' }
  const data = schedule.status === 'fulfilled' ? schedule.value : {
    scheduleError: schedule.reason.response?.data?.message || 'Không tải được lịch sân.',
    play_date: date, courts: [], time_headers: [],
  }
  return { success: true, data: { ...data, facility: { ...venue.value, max_date: data.max_date } } }
}
