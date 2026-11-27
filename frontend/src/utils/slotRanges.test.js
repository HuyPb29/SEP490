import { describe, expect, it } from 'vitest'
import { groupRanges, pickRange, pickRangeTo } from './slotRanges'

// UC14, UC16: gộp ô 30 phút thành dải (BR01, BR64) và cách bấm ô để chọn một dải liền nhau (D183).
describe('groupRanges', () => {
  it('gộp các ô liền nhau cùng sân, cùng ngày thành một dải và cộng tiền', () => {
    const ranges = groupRanges([
      { courtId: 1, courtName: 'Sân 1', time: '10:30', price: 60000 },
      { courtId: 2, courtName: 'Sân 2', time: '10:00', price: 70000 },
      { courtId: 1, courtName: 'Sân 1', time: '10:00', price: 60000 },
      { courtId: 1, courtName: 'Sân 1', time: '11:30', price: '80000' },
    ])

    expect(ranges.map(({ courtId, startTime, endTime, amount }) => ({ courtId, startTime, endTime, amount }))).toEqual([
      { courtId: 1, startTime: '10:00', endTime: '11:00', amount: 120000 },
      { courtId: 1, startTime: '11:30', endTime: '12:00', amount: 80000 },
      { courtId: 2, startTime: '10:00', endTime: '10:30', amount: 70000 },
    ])
    expect(ranges[0].items).toHaveLength(2)
    expect(ranges[0].courtName).toBe('Sân 1')
  })

  it('không gộp hai ô cùng giờ nhưng khác ngày', () => {
    const ranges = groupRanges([
      { date: '2026-12-02', courtId: 1, time: '10:30', price: 1 },
      { date: '2026-12-01', courtId: 1, time: '10:00', price: 1 },
    ])

    expect(ranges.map((range) => range.date)).toEqual(['2026-12-01', '2026-12-02'])
  })

  it('ô chưa có giá tính 0 đồng', () => {
    expect(groupRanges([{ courtId: 1, time: '10:00' }])[0].amount).toBe(0)
  })

  it('không chọn ô nào thì không có dải', () => {
    expect(groupRanges([])).toEqual([])
  })
})

describe('pickRange', () => {
  const range = { courtId: 1, startMinute: 600, endMinute: 660 }

  it('chưa chọn gì thì lấy đúng ô vừa bấm', () => {
    expect(pickRange(null, 1, '10:00')).toEqual({ courtId: 1, startMinute: 600, endMinute: 630 })
  })

  it('bấm ô ngay sau hoặc ngay trước dải thì kéo dài', () => {
    expect(pickRange(range, 1, '11:00')).toEqual({ courtId: 1, startMinute: 600, endMinute: 690 })
    expect(pickRange(range, 1, '09:30')).toEqual({ courtId: 1, startMinute: 570, endMinute: 660 })
  })

  it('bấm ô đầu hoặc ô cuối thì bớt ô đó', () => {
    expect(pickRange(range, 1, '10:00')).toEqual({ courtId: 1, startMinute: 630, endMinute: 660 })
    expect(pickRange(range, 1, '10:30')).toEqual({ courtId: 1, startMinute: 600, endMinute: 630 })
  })

  it('dải chỉ có một ô thì bấm lại ô đó là bỏ chọn', () => {
    expect(pickRange({ courtId: 1, startMinute: 600, endMinute: 630 }, 1, '10:00')).toBeNull()
  })

  it('bấm ô khác sân hoặc không liền kề thì chọn lại từ ô đó', () => {
    expect(pickRange(range, 2, '10:00')).toEqual({ courtId: 2, startMinute: 600, endMinute: 630 })
    expect(pickRange(range, 1, '12:00')).toEqual({ courtId: 1, startMinute: 720, endMinute: 750 })
  })

  it('bấm ô ở giữa dải dài thì chọn lại từ ô đó', () => {
    expect(pickRange({ courtId: 1, startMinute: 600, endMinute: 690 }, 1, '10:30'))
      .toEqual({ courtId: 1, startMinute: 630, endMinute: 660 })
  })
})

describe('pickRangeTo (đặt tại quầy, D183)', () => {
  const allFree = () => true

  it('bấm ô bắt đầu rồi ô kết thúc cùng sân thì lấy cả dải khi mọi ô giữa còn trống', () => {
    const start = pickRangeTo(null, 1, '10:00', allFree)
    expect(pickRangeTo(start, 1, '12:00', allFree)).toEqual({ courtId: 1, startMinute: 600, endMinute: 750 })
  })

  it('bấm ô sớm hơn dải đang chọn cũng lấy cả đoạn', () => {
    const range = { courtId: 1, startMinute: 720, endMinute: 750 }
    expect(pickRangeTo(range, 1, '10:00', allFree)).toEqual({ courtId: 1, startMinute: 600, endMinute: 750 })
  })

  it('có ô ở giữa đã bị đặt thì không nối, chọn lại từ ô vừa bấm', () => {
    const range = { courtId: 1, startMinute: 600, endMinute: 630 }
    const free = (minute) => minute !== 660

    expect(pickRangeTo(range, 1, '11:30', free)).toEqual({ courtId: 1, startMinute: 690, endMinute: 720 })
  })

  it('chỉ hỏi các ô nằm ngoài dải đang chọn', () => {
    const asked = []
    pickRangeTo({ courtId: 1, startMinute: 600, endMinute: 660 }, 1, '11:30', (minute) => { asked.push(minute); return true })

    expect(asked).toEqual([660, 690])
  })

  it('ô liền kề, ô đầu, ô cuối và ô khác sân vẫn theo cách của pickRange', () => {
    const range = { courtId: 1, startMinute: 600, endMinute: 660 }
    expect(pickRangeTo(range, 1, '11:00', allFree)).toEqual({ courtId: 1, startMinute: 600, endMinute: 690 })
    expect(pickRangeTo(range, 1, '10:30', allFree)).toEqual({ courtId: 1, startMinute: 600, endMinute: 630 })
    expect(pickRangeTo(range, 2, '12:00', allFree)).toEqual({ courtId: 2, startMinute: 720, endMinute: 750 })
  })
})
