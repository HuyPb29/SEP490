import { useEffect, useRef, useState } from 'react'
import api, { apiErrorMessage } from '../../api'

export default function RegistrationVerificationDocuments({ request }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])
  const show = async kind => {
    setBusy(true); setError('')
    try {
      const { data } = await api.get(`/admin/service-registrations/${request.id}/documents/${kind}`, { responseType: 'blob' })
      if (active.current) setPreview({ url: URL.createObjectURL(data), type: data.type, kind })
    } catch (err) { if (active.current) setError(apiErrorMessage(err, 'Không tải được giấy tờ xác minh.')) }
    finally { if (active.current) setBusy(false) }
  }
  return <section aria-label="Giấy tờ xác minh chủ sân" style={{ minWidth: 0 }}>
    <h3>Giấy tờ xác minh chủ sân</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" className="cw-secondary" disabled={busy || !request.hasIdentityDocument} onClick={() => show('identity')}>Xem CCCD</button>
      <button type="button" className="cw-secondary" disabled={busy || !request.hasBusinessLicense} onClick={() => show('business-license')}>Xem giấy phép kinh doanh</button>
    </div>
    <p>{request.privacyAcceptedAt ? 'Đã đồng ý cam kết bảo mật và xác minh hồ sơ.' : 'Chưa có cam kết bảo mật.'}</p>
    {(!request.hasIdentityDocument || !request.hasBusinessLicense || !request.privacyAcceptedAt) && <p role="status">Hồ sơ thiếu giấy tờ hoặc cam kết. Hãy từ chối với lý do và yêu cầu chủ sân nộp đơn mới.</p>}
    {error && <p role="alert">{error}</p>}
    {preview && <div>
      {preview.type === 'application/pdf'
        ? <a href={preview.url} target="_blank" rel="noopener noreferrer">Mở giấy tờ PDF để kiểm tra</a>
        : <img src={preview.url} alt={preview.kind === 'identity' ? 'CCCD chủ sân' : 'Giấy phép kinh doanh'} style={{ display: 'block', maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />}
      <p><a href={preview.url} download={`ho-so-${request.id}-${preview.kind}.${preview.type === 'application/pdf' ? 'pdf' : preview.type === 'image/png' ? 'png' : 'jpg'}`}>Tải giấy tờ</a></p>
    </div>}
  </section>
}
