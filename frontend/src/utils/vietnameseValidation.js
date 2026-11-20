/** Thông báo kiểm tra biểu mẫu không phụ thuộc ngôn ngữ của trình duyệt. */
export function installVietnameseValidation() {
  const invalid = (event) => {
    const field = event.target
    if (!field?.validity || typeof field.setCustomValidity !== 'function' || field.validity.customError) return
    const validity = field.validity
    let message = 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
    if (validity.valueMissing) message = field.type === 'checkbox' ? 'Vui lòng tích xác nhận để tiếp tục.'
      : field.tagName === 'SELECT' || field.type === 'file' || field.type === 'radio' ? 'Vui lòng chọn thông tin bắt buộc.'
        : 'Vui lòng điền thông tin bắt buộc.'
    else if (validity.typeMismatch) message = field.type === 'email' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : 'Vui lòng nhập địa chỉ liên kết hợp lệ.'
    else if (validity.patternMismatch) message = 'Thông tin không đúng định dạng yêu cầu.'
    else if (validity.tooShort) message = `Vui lòng nhập ít nhất ${field.minLength} ký tự.`
    else if (validity.tooLong) message = `Chỉ được nhập tối đa ${field.maxLength} ký tự.`
    else if (validity.rangeUnderflow) message = `Giá trị phải từ ${field.min} trở lên.`
    else if (validity.rangeOverflow) message = `Giá trị không được vượt quá ${field.max}.`
    else if (validity.stepMismatch) message = 'Vui lòng chọn giá trị theo bước cho phép.'
    else if (validity.badInput) message = 'Vui lòng nhập giá trị hợp lệ.'
    field.setCustomValidity(message)
  }
  const clear = (event) => event.target?.setCustomValidity?.('')
  document.addEventListener('invalid', invalid, true)
  document.addEventListener('input', clear, true)
  document.addEventListener('change', clear, true)
  return () => {
    document.removeEventListener('invalid', invalid, true)
    document.removeEventListener('input', clear, true)
    document.removeEventListener('change', clear, true)
  }
}
