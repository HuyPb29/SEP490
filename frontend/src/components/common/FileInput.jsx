import { useRef, useState } from 'react'
import styles from './FileInput.module.css'

/** Nhãn chọn ảnh tiếng Việt, giữ nguyên FileList gửi cho bộ xử lý hiện có. */
export function FileInput({ onChange, disabled, ...props }) {
  const input = useRef(null)
  const [filename, setFilename] = useState('')
  return <span className={styles.picker}>
    <input {...props} ref={input} type="file" disabled={disabled} className="sr-only" onChange={(event) => {
      setFilename(Array.from(event.target.files || []).map((file) => file.name).join(', '))
      onChange?.(event)
    }} />
    <button type="button" disabled={disabled} onClick={() => input.current?.click()}>Chọn ảnh</button>
    <span className={styles.filename} title={filename}>{filename || 'Chưa chọn ảnh'}</span>
  </span>
}
