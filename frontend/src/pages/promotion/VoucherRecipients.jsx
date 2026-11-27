import { Checkbox as UiCheckbox } from '../../components/ui';
import { useState } from 'react'
import { useVoucherRecipients } from '../../hooks/useVoucherRecipients'
import { ActionForm, Field } from '../WorkspaceLayout'
import { Button, LoadingState, ErrorState, Table } from '../../components/common'
import { dateTime } from '../../utils/formatters'
import styles from './PromotionPages.module.css'

function Pagination({ page, data, onChange }) {
  return data?.totalPages > 1 && <div className={styles.recipientPagination}>
    <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Trang trước</Button>
    <span>Trang {page + 1}/{data.totalPages}</span>
    <Button variant="secondary" size="sm" disabled={page + 1 >= data.totalPages} onClick={() => onChange(page + 1)}>Trang sau</Button>
  </div>
}

export default function VoucherRecipients({ voucher, onGranted }) {
  const [query, setQuery] = useState('')
  const [searchPage, setSearchPage] = useState(0)
  const [grantPage, setGrantPage] = useState(0)
  const [selected, setSelected] = useState([])
  const { players, grants, grant } = useVoucherRecipients(voucher.locationId, voucher.id, query, searchPage, grantPage)
  const toggle = player => setSelected(current => current.some(item => item.id === player.id)
    ? current.filter(item => item.id !== player.id) : [...current, player])
  return <section className={styles.recipients} aria-label="Người nhận voucher">
    <h3>Người nhận voucher</h3>
    {voucher.status === 'PUBLISHED' && <div className={styles.recipientForm}>
      <ActionForm label="Cấp voucher" successMessage="Đã cấp voucher cho người chơi đã chọn." action={() => {
        if (!selected.length) throw new Error('Vui lòng chọn ít nhất một người nhận.')
        return grant(selected.map(player => player.id))
      }} after={async () => { setSelected([]); setGrantPage(0); await grants.reload(); await onGranted?.() }}>
        <div className={styles.recipientPicker}>
          <Field label="Tìm người chơi" type="search" maxLength={100} value={query}
            hint="Nhập tên đăng nhập (ít nhất 2 ký tự), email hoặc số điện thoại đầy đủ."
            onChange={event => { setQuery(event.target.value); setSearchPage(0) }}
            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
          {players.loading ? <LoadingState /> : players.error ? <ErrorState message={players.error} onRetry={players.reload} />
            : players.data?.content.length === 0 ? <p>Không tìm thấy người chơi đang hoạt động.</p>
              : players.data?.content.length > 0 && <ul className={styles.recipientChoices}>{players.data.content.map(player => <li key={player.id}>
                <label><UiCheckbox checked={selected.some(item => item.id === player.id)}
                  disabled={selected.length >= 100 && !selected.some(item => item.id === player.id)} onChange={() => toggle(player)} />
                  <span>{player.fullName} · {player.username}</span></label>
              </li>)}</ul>}
          <Pagination page={searchPage} data={players.data} onChange={setSearchPage} />
          {selected.length > 0 && <div className={styles.recipientSelection}><strong>Đã chọn {selected.length}/100 người</strong>
            {selected.map(player => <Button key={player.id} variant="secondary" size="sm" onClick={() => toggle(player)} aria-label={'Bỏ chọn ' + player.username}>{player.fullName} · {player.username} ×</Button>)}</div>}
        </div>
      </ActionForm>
    </div>}
    <h4>Đã cấp {grants.data?.totalElements ?? '—'} lượt voucher</h4>
    {grants.loading ? <LoadingState /> : grants.error ? <ErrorState message={grants.error} onRetry={grants.reload} />
      : grants.data?.content.length ? <Table columns={[
        { key: 'fullName', header: 'Người nhận', render: item => <>{item.fullName || 'Người chơi'}<br /><small>{item.username}</small></> },
        { key: 'grantedAt', header: 'Ngày cấp', render: item => dateTime(item.grantedAt) },
        { key: 'expiresAt', header: 'Hạn dùng', render: item => item.expiresAt ? dateTime(item.expiresAt) : 'Không giới hạn' },
        { key: 'status', header: 'Trạng thái', render: item => ({ AVAILABLE: 'Chưa dùng', USED: 'Đã dùng', EXPIRED: 'Hết hạn', REVOKED: 'Đã thu hồi' }[item.status] || item.status) },
      ]} data={grants.data.content} rowKey="grantId" /> : <p>Chưa cấp voucher cho người chơi nào.</p>}
    <Pagination page={grantPage} data={grants.data} onChange={setGrantPage} />
  </section>
}
