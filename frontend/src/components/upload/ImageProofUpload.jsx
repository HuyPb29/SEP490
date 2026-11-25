import { useEffect, useRef, useState } from 'react';
import { FileInput } from '../common/FileInput';
import { Button } from '../common/Button';
import styles from './ImageProofUpload.module.css';

export default function ImageProofUpload({ file, onChange, onDropFile, onClear, error, disabled = false, inputRef, id = 'payment-proof',
  label = 'Ảnh chứng từ thanh toán', chooseText = 'Kéo thả hoặc chọn ảnh chứng từ',
  hint = 'Ảnh cần rõ số tiền, tài khoản nhận và nội dung chuyển khoản.', required = true,
  previewAlt = 'Xem trước chứng từ thanh toán đã chọn' }) {
  const localInput = useRef(null);
  const nativeInput = inputRef || localInput;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setPreview({ file, url }));
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(url); };
  }, [file]);
  const size = file && (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`);
  return <div className={styles.uploader}>
    <div className={`${styles.dropzone} ${dragging && !disabled ? styles.dragging : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={event => { event.preventDefault(); setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) onDropFile?.(event.dataTransfer.files?.[0]); }}>
      <button type="button" disabled={disabled} className={styles.target} onClick={() => nativeInput.current?.click()} aria-describedby={error ? `${id}-error` : `${id}-hint`}>
        <span className={styles.icon} aria-hidden="true">↑</span><strong>{file ? 'Chọn ảnh khác hoặc kéo thả để thay' : chooseText}</strong><span>JPG, JPEG hoặc PNG · Tối đa 5 MB</span>
      </button>
      <label className={styles.label} htmlFor={id}>{label} {required && <span aria-hidden="true" />}</label>
      <FileInput id={id} inputRef={nativeInput} onChange={onChange} selectedFileName={file?.name || ''} accept=".jpg,.jpeg,.png,image/jpeg,image/png" disabled={disabled} aria-required={required || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-hint`} />
    </div>
    <p className={styles.hint} id={`${id}-hint`}>{hint}</p>
    {file && <div className={styles.selected}>
      {preview?.file === file && previewError !== file && <img src={preview.url} alt={previewAlt} onError={() => setPreviewError(file)} />}
      {previewError === file && <p role="status">Không xem trước được ảnh này. Bạn có thể đổi ảnh để kiểm tra nội dung.</p>}
      <div className={styles.meta}><div><strong>{file.name}</strong><span>{size}</span></div><Button variant="ghost" disabled={disabled} onClick={onClear}>Bỏ ảnh</Button></div>
    </div>}
    {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
  </div>;
}
