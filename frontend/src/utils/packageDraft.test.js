import { describe, expect, it, vi } from 'vitest'
import { clearPackageDraft, readPackageDraft, savePackageDraft } from './packageDraft'
import { today } from './formatters'

// UC15: lịch gói Player chọn được mang sang trang tóm tắt, chỉ giữ trong ngày và đúng địa điểm.
describe('packageDraft', () => {
  const draft = { facilityId: 3, request: { packageType: 'CUSTOM', courtId: 5 } }

  it('lưu rồi đọc lại được, có ghi ngày lưu', () => {
    savePackageDraft(draft)

    expect(readPackageDraft(3)).toEqual({ ...draft, savedOn: today() })
    expect(readPackageDraft()).toEqual({ ...draft, savedOn: today() })
    expect(readPackageDraft('3')).not.toBeNull()
  })

  it('không trả lịch của địa điểm khác', () => {
    savePackageDraft(draft)

    expect(readPackageDraft(4)).toBeNull()
  })

  it('lịch lưu từ hôm trước thì bỏ', () => {
    sessionStorage.setItem('pending_package_selection', JSON.stringify({ ...draft, savedOn: '2000-01-01' }))

    expect(readPackageDraft(3)).toBeNull()
  })

  it('thiếu request hoặc dữ liệu hỏng thì coi như không có', () => {
    sessionStorage.setItem('pending_package_selection', JSON.stringify({ facilityId: 3, savedOn: today() }))
    expect(readPackageDraft(3)).toBeNull()

    sessionStorage.setItem('pending_package_selection', '{hỏng')
    expect(readPackageDraft(3)).toBeNull()
    expect(readPackageDraft(3)).toBeNull()
  })

  it('xóa thì không đọc được nữa', () => {
    savePackageDraft(draft)
    clearPackageDraft()

    expect(readPackageDraft(3)).toBeNull()
  })

  it('trình duyệt chặn sessionStorage thì không văng lỗi', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })

    expect(() => savePackageDraft(draft)).not.toThrow()
    expect(() => clearPackageDraft()).not.toThrow()
  })
})
