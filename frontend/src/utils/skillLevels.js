/** DR33 (D165): trình độ chơi có 4 mức cố định, dùng cho hồ sơ Player, đội và kèo. */
export const SKILL_LEVELS = ['Mới chơi', 'Trung bình', 'Khá', 'Nâng cao']

export const isSkillLevel = (value) => SKILL_LEVELS.includes(value)

/** Kèo không đặt trình độ: nhãn hiển thị và giá trị lọc gửi backend (m.skill_level IS NULL). */
export const NO_SKILL_LABEL = 'Không yêu cầu'
export const NO_SKILL_FILTER = 'NONE'

/** Nhãn trình độ của kèo; kèo không đặt trình độ hiện "Không yêu cầu". */
export const matchSkillLabel = (match) => (isSkillLevel(match?.skillLevel) ? match.skillLevel : NO_SKILL_LABEL)

/** Danh sách [value, label] cho Field có options; placeholder là dòng đầu (giá trị rỗng). */
export function skillOptions(placeholder) {
  const levels = SKILL_LEVELS.map((level) => [level, level])
  return placeholder ? [['', placeholder], ...levels] : levels
}
