import { describe, expect, it } from 'vitest'
import { checkoutPointLimit, checkoutRewardErrorField, pointInputError } from './checkoutPoints'

// Màn tóm tắt đặt sân (UC14, UC15): dùng điểm tối đa 50% số tiền còn lại sau voucher (D161, BR41), 1 điểm = 500 đồng.
describe('checkoutPointLimit', () => {
  it('tối đa 50% số tiền sau voucher, đổi ra điểm và làm tròn xuống', () => {
    expect(checkoutPointLimit(100000, 1000, 500)).toBe(100)
    expect(checkoutPointLimit(99900, 1000, 500)).toBe(99)
  })

  it('không vượt số dư điểm', () => {
    expect(checkoutPointLimit(100000, 30, 500)).toBe(30)
  })

  it('không âm khi số tiền bằng 0', () => {
    expect(checkoutPointLimit(0, 100, 500)).toBe(0)
    expect(checkoutPointLimit(-1000, 100, 500)).toBe(0)
  })
})

describe('pointInputError', () => {
  it('không dùng điểm thì không lỗi', () => {
    expect(pointInputError(0, 100, 50, 500)).toBe('')
  })

  it('số lẻ, giảm dưới 1.000 đồng hoặc vượt số dư báo MSG37', () => {
    const msg37 = 'Mỗi lần dùng điểm phải giảm ít nhất 1.000 đồng và không vượt số dư. (MSG37)'
    expect(pointInputError(2.5, 100, 50, 500)).toBe(msg37)
    expect(pointInputError(1, 100, 50, 500)).toBe(msg37)
    expect(pointInputError(101, 100, 200, 500)).toBe(msg37)
  })

  it('vượt trần của khoản thanh toán báo MSG38 kèm số tối đa', () => {
    expect(pointInputError(60, 100, 50, 500)).toBe('Bạn được dùng tối đa 50 điểm cho khoản thanh toán này. (MSG38)')
  })

  it('đúng giới hạn thì hợp lệ', () => {
    expect(pointInputError(2, 100, 50, 500)).toBe('')
    expect(pointInputError(50, 100, 50, 500)).toBe('')
  })
})

describe('checkoutRewardErrorField', () => {
  it('lỗi voucher hiện ở ô voucher', () => {
    expect(checkoutRewardErrorField('Mã giảm giá không dùng được (MSG34)')).toBe('voucher')
    expect(checkoutRewardErrorField('Đơn đã có voucher (MSG35)')).toBe('voucher')
    expect(checkoutRewardErrorField('Mã giảm giá đã hết lượt (MSG108)')).toBe('voucher')
  })

  it('lỗi điểm hiện ở ô điểm', () => {
    expect(checkoutRewardErrorField('Điểm không hợp lệ (MSG37)')).toBe('points')
    expect(checkoutRewardErrorField('Vượt trần (MSG38)')).toBe('points')
    expect(checkoutRewardErrorField('Không đủ điểm (MSG40)')).toBe('points')
    expect(checkoutRewardErrorField('Số điểm vừa thay đổi (MSG108)')).toBe('points')
  })

  it('lỗi khác hoặc không có lỗi thì không gắn vào ô nào', () => {
    expect(checkoutRewardErrorField('Slot vừa có người giữ hoặc đặt. (MSG28)')).toBeNull()
    expect(checkoutRewardErrorField('')).toBeNull()
    expect(checkoutRewardErrorField(undefined)).toBeNull()
  })
})
