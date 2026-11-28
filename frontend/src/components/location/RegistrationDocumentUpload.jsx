import { useEffect, useState } from 'react'
import { Button, FormField } from '../common'
import { FileInput } from '../common/FileInput'

export default function RegistrationDocumentUpload({ id, label, file, onChange, error, disabled }) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    const frame = requestAnimationFrame(() => setPreview({ file, url }))
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(url) }
  }, [file])
  return <FormField htmlFor={id} label={label} required hint="JPG, PNG hoặc PDF, tối đa 5 MB mỗi tệp." error={error}>
    <FileInput id={id} buttonText="Chọn tệp" selectedFileName={file?.name || ''}
      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={disabled}
      aria-required="true" aria-invalid={Boolean(error)} aria-describedby={`${id}-${error ? 'error' : 'hint'}`}
      onChange={event => { onChange(event.target.files?.[0] ?? null); event.target.value = '' }} />
    {file && preview?.file === file && (file.type === 'application/pdf'
      ? <a href={preview.url} target="_blank" rel="noopener noreferrer">Mở PDF đã chọn</a>
      : <img src={preview.url} alt={`Xem trước ${label}`} style={{ display: 'block', maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }} />)}
    {file && <Button variant="ghost" disabled={disabled} onClick={() => onChange(null)}>Bỏ tệp {label}</Button>}
  </FormField>
}
