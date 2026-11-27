import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/facilityApi', () => ({
  getPublicVenue: vi.fn(),
  getVenueReviews: vi.fn(),
  getVenueSchedule: vi.fn(),
  searchFacilities: vi.fn(),
}))

import { getPublicVenue, getVenueSchedule, searchFacilities } from '../api/facilityApi'
import { useFacilitySearch } from './useFacilitySearch'
import { usePackagePreview } from './usePackagePreview'
import { usePublicVenue } from './usePublicVenue'
import { useResource } from './useResource'
import { useVenueSchedule, useVenueSession } from './useVenueSchedule'

// Các hook tải dữ liệu của màn F3: tìm địa điểm (UC11), thông tin địa điểm (UC12), lịch sân (UC13),
// xem trước gói (UC15). Kiểm tra trạng thái đang tải, lỗi, hủy request cũ khi đổi tham số.
beforeEach(() => {
  vi.mocked(getPublicVenue).mockReset()
  vi.mocked(getVenueSchedule).mockReset()
  vi.mocked(searchFacilities).mockReset()
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

describe('useFacilitySearch (UC11)', () => {
  it('đang tải rồi có danh sách', async () => {
    vi.mocked(searchFacilities).mockResolvedValue({ data: { items: [{ facility_id: 1 }] } })
    const { result } = renderHook(() => useFacilitySearch())
    expect(result.current.loading).toBe(true)

    await act(() => result.current.fetchFacilities('linh'))

    expect(searchFacilities).toHaveBeenCalledWith({ keyword: 'linh', signal: expect.any(AbortSignal) })
    expect(result.current).toMatchObject({ loading: false, loadError: false, facilities: [{ facility_id: 1 }] })
  })

  it('dữ liệu sai dạng hoặc lỗi mạng thì báo lỗi tải', async () => {
    vi.mocked(searchFacilities).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useFacilitySearch())

    await act(() => result.current.fetchFacilities(''))

    expect(result.current).toMatchObject({ loading: false, loadError: true, facilities: [] })
  })

  it('gõ từ khóa mới thì hủy lần tìm cũ, kết quả cũ không ghi đè', async () => {
    const first = deferred()
    vi.mocked(searchFacilities).mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ data: { items: [{ facility_id: 2 }] } })
    const { result } = renderHook(() => useFacilitySearch())

    let firstCall
    act(() => { firstCall = result.current.fetchFacilities('l') })
    await act(() => result.current.fetchFacilities('linh'))
    await act(async () => { first.resolve({ data: { items: [{ facility_id: 1 }] } }); await firstCall })

    expect(vi.mocked(searchFacilities).mock.calls[0][0].signal.aborted).toBe(true)
    expect(result.current.facilities).toEqual([{ facility_id: 2 }])
  })
})

describe('usePublicVenue (UC12)', () => {
  it('trả dữ liệu theo đúng lần tải', async () => {
    vi.mocked(getPublicVenue).mockResolvedValue({ facility_name: 'Sân Linh Đàm' })
    const { result } = renderHook(() => usePublicVenue(1, 0))
    expect(result.current).toBeNull()

    await waitFor(() => expect(result.current?.data).toEqual({ facility_name: 'Sân Linh Đàm' }))
  })

  it('lỗi thì lấy câu của backend, tải lại khi tăng revision', async () => {
    const error = new Error('404')
    error.response = { data: { message: 'Không tìm thấy địa điểm' } }
    vi.mocked(getPublicVenue).mockRejectedValueOnce(error).mockResolvedValueOnce({ facility_name: 'Sân A' })
    const { result, rerender } = renderHook(({ revision }) => usePublicVenue(1, revision), { initialProps: { revision: 0 } })

    await waitFor(() => expect(result.current?.error).toBe('Không tìm thấy địa điểm'))
    rerender({ revision: 1 })
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current?.data).toEqual({ facility_name: 'Sân A' }))
    expect(getPublicVenue).toHaveBeenCalledTimes(2)
  })
})

describe('useVenueSchedule (UC13)', () => {
  const today = '2026-11-30'

  it('lần đầu luôn xem hôm nay vì chưa biết ngày xa nhất', async () => {
    vi.mocked(getVenueSchedule).mockResolvedValue({ max_date: '2026-12-30', courts: [] })
    const { result } = renderHook(() => useVenueSchedule(1, '2026-12-05', today, 'jwt', 0))

    expect(result.current.date).toBe(today)
    await waitFor(() => expect(result.current.maxDate).toBe('2026-12-30'))
    expect(getVenueSchedule).toHaveBeenCalledWith(1, today, expect.any(AbortSignal))
  })

  it('biết ngày xa nhất rồi thì xem ngày được chọn nếu nằm trong giới hạn', async () => {
    vi.mocked(getVenueSchedule).mockImplementation(async (id, date) => ({ max_date: '2026-12-30', play_date: date }))
    const { result, rerender } = renderHook(({ date }) => useVenueSchedule(1, date, today, 'jwt', 0),
      { initialProps: { date: '2026-12-05' } })

    await waitFor(() => expect(result.current.current?.data.play_date).toBe('2026-12-05'))
    rerender({ date: '2027-02-01' })
    expect(result.current.date).toBe(today)
    rerender({ date: '2026-11-01' })
    expect(result.current.date).toBe(today)
  })

  it('lỗi tải lịch thì giữ ngày xa nhất đã biết', async () => {
    const error = new Error('500')
    error.response = { data: { message: 'Không tải được lịch sân.' } }
    vi.mocked(getVenueSchedule).mockResolvedValueOnce({ max_date: '2026-12-30' }).mockRejectedValueOnce(error)
    const { result, rerender } = renderHook(({ revision }) => useVenueSchedule(1, today, today, 'jwt', revision),
      { initialProps: { revision: 0 } })

    await waitFor(() => expect(result.current.maxDate).toBe('2026-12-30'))
    rerender({ revision: 1 })
    await waitFor(() => expect(result.current.current?.error).toBe('Không tải được lịch sân.'))
    expect(result.current.maxDate).toBe('2026-12-30')
  })

  it('đổi người xem (đăng nhập/đăng xuất) thì tải lại từ hôm nay', async () => {
    vi.mocked(getVenueSchedule).mockResolvedValue({ max_date: '2026-12-30' })
    const { result, rerender } = renderHook(({ token }) => useVenueSchedule(1, '2026-12-05', today, token, 0),
      { initialProps: { token: null } })

    await waitFor(() => expect(result.current.maxDate).toBe('2026-12-30'))
    rerender({ token: 'jwt' })
    expect(result.current).toMatchObject({ date: today, maxDate: null, current: null })
  })
})

describe('useVenueSession (UC13: ai đang xem lịch)', () => {
  it('chưa đăng nhập thì không có người xem, đăng nhập xong thì cập nhật ngay', () => {
    const { result } = renderHook(() => useVenueSession())
    expect(result.current).toEqual({ token: null, user: null })

    act(() => {
      localStorage.setItem('bms_access_token', 'jwt')
      localStorage.setItem('bms_user_info', JSON.stringify({ user_id: 7, role_code: 'staff' }))
      window.dispatchEvent(new Event('bms-auth-change'))
    })

    expect(result.current).toEqual({ token: 'jwt', user: { user_id: 7, role_code: 'staff' } })
  })
})

describe('usePackagePreview (UC15)', () => {
  it('chờ 250 ms rồi mới xem trước, chỉ gọi cho lần chọn cuối', async () => {
    vi.useFakeTimers()
    const load = vi.fn(async (request) => ({ data: { sessions: request.sessions.length } }))
    const first = { sessions: [1] }
    const second = { sessions: [1, 2] }
    const { result, rerender } = renderHook(({ request }) => usePackagePreview(request, load, 0),
      { initialProps: { request: first } })

    await act(() => vi.advanceTimersByTimeAsync(100))
    rerender({ request: second })
    await act(() => vi.advanceTimersByTimeAsync(250))

    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith(second)
    expect(result.current).toMatchObject({ request: second, data: { sessions: 2 } })
  })

  it('lỗi thì trả câu của backend', async () => {
    vi.useFakeTimers()
    const error = new Error('400')
    error.response = { data: { message: 'Gói phải có buổi trong ít nhất 2 ngày. (MSG92)' } }
    const request = { sessions: [] }
    const { result } = renderHook(() => usePackagePreview(request, async () => { throw error }, 0))

    await act(() => vi.advanceTimersByTimeAsync(250))

    expect(result.current.error).toBe('Gói phải có buổi trong ít nhất 2 ngày. (MSG92)')
  })

  it('chưa có lịch thì không gọi', async () => {
    vi.useFakeTimers()
    const load = vi.fn()
    const { result } = renderHook(() => usePackagePreview(null, load, 0))

    await act(() => vi.advanceTimersByTimeAsync(500))

    expect(load).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })
})

describe('useResource', () => {
  it('đang tải, có dữ liệu, tải lại', async () => {
    const load = vi.fn().mockResolvedValueOnce(['a']).mockResolvedValueOnce(['b'])
    const { result } = renderHook(() => useResource(load, 'k'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.data).toEqual(['a']))
    act(() => result.current.reload())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual(['b']))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('lỗi thì hiện câu đã bỏ mã kỹ thuật', async () => {
    const error = new Error('x')
    error.response = { data: { message: 'Bạn không có quyền xem giao dịch này. (MSG05)' } }
    const { result } = renderHook(() => useResource(async () => { throw error }, 'k'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Bạn không có quyền xem giao dịch này.')
  })
})
