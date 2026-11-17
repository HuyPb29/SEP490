import { today } from './formatters';

// UC15: lịch gói Player đã chọn ở trang chọn lịch, chuyển sang trang tóm tắt gói.
// Chỉ giữ trong ngày để không khôi phục lịch có buổi đã qua.
const PACKAGE_DRAFT_KEY = 'pending_package_selection';

export function savePackageDraft(draft) {
  try {
    sessionStorage.setItem(PACKAGE_DRAFT_KEY, JSON.stringify({ ...draft, savedOn: today() }));
  } catch {
    // sessionStorage bị chặn thì trang tóm tắt sẽ đưa Player về chọn lại lịch
  }
}

export function readPackageDraft(facilityId) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(PACKAGE_DRAFT_KEY));
    if (!draft?.request || draft.savedOn !== today()) return null;
    if (facilityId && Number(draft.facilityId) !== Number(facilityId)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearPackageDraft() {
  try {
    sessionStorage.removeItem(PACKAGE_DRAFT_KEY);
  } catch {
    // bỏ qua
  }
}
