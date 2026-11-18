/** DR33 (D165): trình độ chơi có 4 mức cố định, dùng cho hồ sơ Player, đội và kèo. */
export const SKILL_LEVELS = ['Mới chơi', 'Trung bình', 'Khá', 'Nâng cao']

export const isSkillLevel = (value) => SKILL_LEVELS.includes(value)

/** Danh sách [value, label] cho Field có options; placeholder là dòng đầu (giá trị rỗng). */
export function skillOptions(placeholder) {
  const levels = SKILL_LEVELS.map((level) => [level, level])
  return placeholder ? [['', placeholder], ...levels] : levels
}
