import { useCallback, useEffect, useId, useState } from 'react'
import { getComplaintEvidence, getComplaintEvidenceImage } from '../../api/complaintEvidenceApi'
import { Button, ErrorState, LoadingState } from '../../components/common'
import { useResource } from '../workspaceSupport'
import styles from './ComplaintEvidence.module.css'

export default function ComplaintEvidence({ complaintId }) {
  const load = useCallback(signal => getComplaintEvidence(complaintId, signal), [complaintId])
  const evidence = useResource(load, complaintId)
  const [open, setOpen] = useState(false)
  const imageId = useId()
  const loadImage = useCallback(signal => open ? getComplaintEvidenceImage(complaintId, signal) : Promise.resolve(null), [complaintId, open])
  const image = useResource(loadImage, complaintId + ':' + open)
  const [preview, setPreview] = useState(null)
  const [invalid, setInvalid] = useState(null)
  useEffect(() => {
    if (!image.data) return undefined
    const url = URL.createObjectURL(image.data)
    const frame = requestAnimationFrame(() => setPreview({ blob: image.data, url }))
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(url) }
  }, [image.data])
  return <section className={styles.evidence} aria-label="Ảnh đính kèm">
    <h3>Ảnh đính kèm</h3>
    {evidence.loading ? <LoadingState message="Đang tải thông tin ảnh…" /> : evidence.error ? <ErrorState message={evidence.error} onRetry={evidence.reload} /> :
      !evidence.data ? <p className={styles.hint}>Khiếu nại này không có ảnh đính kèm.</p> : <>
        <Button variant="secondary" aria-expanded={open} aria-controls={imageId} onClick={() => setOpen(!open)}>{open ? 'Ẩn ảnh đính kèm' : 'Xem ảnh đính kèm'}</Button>
        <div id={imageId} hidden={!open}>
          {open && (image.loading ? <LoadingState message="Đang tải ảnh đính kèm…" /> : image.error ? <ErrorState message={image.error} onRetry={image.reload} /> : invalid === image.data ?
            <ErrorState message="Không hiển thị được ảnh đính kèm. Vui lòng tải lại." onRetry={image.reload} /> : preview?.blob === image.data &&
              <img className={styles.image} src={preview.url} alt={'Ảnh đính kèm khiếu nại #' + complaintId} onError={() => setInvalid(image.data)} />)}
        </div>
      </>}
  </section>
}
