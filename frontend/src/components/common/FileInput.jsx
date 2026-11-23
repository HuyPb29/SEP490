import { useImperativeHandle, useRef, useState } from 'react'
import styles from './FileInput.module.css'

/** Nhãn chọn ảnh tiếng Việt, giữ nguyên FileList gửi cho bộ xử lý hiện có. */
export function FileInput({ onChange, disabled, selectedFileName, inputRef, ...props }) {
  const input = useRef(null)
  useImperativeHandle(inputRef, () => input.current)
  const [filename, setFilename] = useState('')
  const displayName = selectedFileName ?? filename
  return <span className={styles.picker}>
    <input {...props} ref={input} type="file" disabled={disabled} className={styles.nativeInput} onChange={(event) => {
      setFilename(Array.from(event.target.files || []).map((file) => file.name).join(', '))
      onChange?.(event)
    }} />
    <button type="button" disabled={disabled} onClick={() => input.current?.click()}>Chọn ảnh</button>
    <span className={styles.filename} title={displayName}>{displayName || 'Chưa chọn ảnh'}</span>
  </span>
}
