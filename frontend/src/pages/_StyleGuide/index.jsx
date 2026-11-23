import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, FormField, Input, Select, Textarea, PageHeader, Table, StatusBadge,
  STATUS_CATALOG, LoadingState, EmptyState, ErrorState, Toast, Pagination, Tabs,
  Modal, ConfirmDialog, LoadingSpinner, PasswordField, OtpInput } from '../../components/common';
import PublicLayout, { PublicHeader } from '../../components/layout/PublicLayout';
import LocationSwitcher from '../../components/layout/LocationSwitcher';
import NavigationDrawer from '../../components/layout/NavigationDrawer';
import { FileInput } from '../../components/common/FileInput';
import shell from '../../components/layout/AppLayouts.module.css';
import { money } from '../../utils/formatters';
import styles from './StyleGuide.module.css';

const demoLocations = [{ id: '1', name: 'Cầu lông Thành Công' }, { id: '2', name: 'Cầu lông Bình Minh' }];
const rows = [
  { id: 'BK001', court: 'Sân 01', time: '17:30 – 18:30', status: 'HOLDING', price: 160000 },
  { id: 'BK002', court: 'Sân 02', time: '18:30 – 19:30', status: 'CONFIRMED', price: 180000 },
  { id: 'BK003', court: 'Sân 03', time: '19:30 – 20:30', status: 'IN_USE', price: 180000 },
];
const columns = [
  { key: 'id', header: 'Mã đặt sân' }, { key: 'court', header: 'Sân' },
  { key: 'time', header: 'Khung giờ' },
  { key: 'status', header: 'Trạng thái', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'price', header: 'Thành tiền', align: 'right', render: (row) => money(row.price).replace(/\s*₫/, 'đ') },
];

function Sample({ id, title, description, children }) {
  return <section id={id} className={styles.sample} aria-labelledby={id + '-title'}>
    <div className={styles.sectionHeading}><h2 id={id + '-title'}>{title}</h2>{description && <p>{description}</p>}</div>
    {children}
  </section>;
}

export default function StyleGuide() {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null);
  const [locationId, setLocationId] = useState('1');
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);

  async function simulateSave() {
    if (saving) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSaving(false);
    setConfirm(false);
    setToast({ tone: 'success', text: 'Đã hoàn tất thao tác mẫu. Không có dữ liệu thực bị thay đổi.' });
  }

  return <PublicLayout hideFooter>
    <PageHeader eyebrow="Courtly / Bộ giao diện" title="Gọn gàng. Rõ ràng. Sẵn sàng ra sân."
      subtitle="Thư viện giao diện dùng chung · Chỉ hiển thị trong môi trường phát triển."
      breadcrumbs={[{ to: '/', label: 'Trang chủ' }, { label: 'Bộ giao diện' }]}
      actions={<Button onClick={() => setModal(true)}>Mở hộp thoại mẫu</Button>} />
    <nav className={styles.jumpLinks} aria-label="Các nhóm giao diện">
      {[['palette', 'Màu sắc'], ['buttons', 'Nút bấm'], ['forms', 'Biểu mẫu'], ['statuses', 'Trạng thái'], ['tables', 'Bảng dữ liệu'], ['states', 'Phản hồi'], ['layouts', 'Bố cục']].map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}
    </nav>
    <div className={styles.stack}>
      <Sample id="palette" title="01 / Nền tảng màu sắc" description="Xanh ngọc cho tương tác, xanh lá làm điểm nhấn, bề mặt trung tính để tập trung vào công việc.">
        <div className={styles.swatches}>{[['primary', 'Xanh ngọc'], ['primary-accent', 'Xanh lá'], ['primary-soft', 'Nền nhấn'], ['bg', 'Nền trang'], ['surface', 'Bề mặt'], ['sidebar-bg', 'Thanh bên']].map(([token, label]) =>
          <div key={token}><span className={styles.swatch} style={{ background: `var(--color-${token})` }} /><strong>{label}</strong><small>--color-{token}</small></div>)}</div>
        <div className={styles.typeSample}><h3>Be Vietnam Pro</h3><p>Đặt sân nhanh. Vận hành rõ ràng.</p><small>400 · 500 · 600 · 700 / Số liệu: 17:30 · 24/10/2026 · {money(160000).replace(/\s*₫/, 'đ')}</small></div>
      </Sample>
      <Sample id="buttons" title="02 / Nút bấm" description="Vùng bấm tối thiểu 44px. Trạng thái xử lý khóa thao tác lặp lại.">
        <div className={styles.row}>{['primary', 'secondary', 'ghost', 'danger'].map((variant, index) => <Button key={variant} variant={variant} onClick={() => setToast({ tone: 'info', text: 'Bạn vừa bấm nút mẫu.' })}>{['Đặt sân', 'Xem chi tiết', 'Quay lại', 'Hủy thao tác'][index]}</Button>)}</div>
        <div className={styles.row}><Button size="sm">Nút nhỏ</Button><Button size="md">Nút tiêu chuẩn</Button><Button disabled>Chưa khả dụng</Button><Button loading>Đang xử lý</Button><Button loading={saving} onClick={simulateSave}>Thử trạng thái gửi</Button></div>
      </Sample>
      <Sample id="forms" title="03 / Biểu mẫu" description="Nhãn, gợi ý và lỗi được liên kết với ô nhập cho công nghệ hỗ trợ.">
        <div className={styles.grid}>
          <PasswordField id="sample-password" value={password} onChange={event => setPassword(event.target.value)} strength hint="8–32 ký tự, gồm chữ và số." />
          <OtpInput id="sample-otp" value={code} onChange={setCode} />
          <FormField label="Họ và tên" required hint="Nhập tên để nhân viên dễ nhận diện."><Input placeholder="Nguyễn Minh Anh" autoComplete="name" /></FormField>
          <FormField label="Địa điểm"><Select options={demoLocations.map((item) => [item.id, item.name])} /></FormField>
          <FormField label="Số điện thoại" error="Vui lòng nhập số điện thoại hợp lệ."><Input type="tel" defaultValue="090" /></FormField>
          <FormField label="Địa điểm cố định" hint="Bạn không thể sửa trường này."><Input disabled value="Cầu lông Thành Công" readOnly /></FormField>
          <FormField label="Ghi chú" hint="Thông tin thêm cho nhân viên sân."><Textarea placeholder="Nhập ghi chú…" /></FormField>
          <FormField label="Ảnh minh họa" htmlFor="sample-photo" hint="Chọn ảnh để xem tên tệp; ảnh không được gửi đi."><FileInput id="sample-photo" accept="image/*" /></FormField>
        </div>
      </Sample>
      <Sample id="statuses" title="04 / Trạng thái" description="Nhãn lấy từ danh mục chung. Chấm màu luôn đi kèm chữ.">
        <h3 className={styles.subheading}>Khung giờ trên lịch sân</h3>
        <div className={styles.slotGrid}>{Object.entries(STATUS_CATALOG.slot).map(([key, meta]) => <div key={key} className={styles.slot} style={{ background: `var(--slot-${meta.slot}-bg)`, borderColor: `var(--slot-${meta.slot}-border)`, color: `var(--slot-${meta.slot}-text)` }}><strong>17:30 – 18:30</strong><StatusBadge status={key} category="slot" /></div>)}</div>
        {Object.entries(STATUS_CATALOG).filter(([category]) => category !== 'slot').map(([category, entries]) => <div className={styles.statusGroup} key={category}><h3>{({ booking: 'Đặt sân', reschedule: 'Đổi lịch', refund: 'Hoàn tiền', match: 'Kèo', join_request: 'Yêu cầu tham gia', complaint: 'Khiếu nại', service_request: 'Đăng ký dịch vụ', location: 'Địa điểm', voucher: 'Ưu đãi', maintenance: 'Bảo trì' })[category]}</h3><div className={styles.row}>{Object.keys(entries).map((status) => <StatusBadge key={status} status={status} category={category} />)}</div></div>)}
      </Sample>
      <Sample id="tables" title="05 / Bảng dữ liệu" description="Tiêu đề dính trong vùng cuộn. Trên điện thoại, mỗi hàng trở thành một thẻ có nhãn.">
        <Table columns={columns} data={rows} />
        <Pagination page={page} totalPages={3} onPageChange={setPage} />
        <h3 className={styles.subheading}>Bảng dùng nội dung có sẵn</h3>
        <Table><thead><tr><th scope="col">Địa điểm</th><th scope="col">Trạng thái</th></tr></thead><tbody><tr><td>Cầu lông Thành Công</td><td><StatusBadge status="ACTIVE" category="location" /></td></tr></tbody></Table>
        <Table columns={columns} emptyText="Chưa có lịch đặt sân. Hãy chọn địa điểm và khung giờ để bắt đầu." />
      </Sample>
      <Sample id="states" title="06 / Trạng thái tải & phản hồi">
        <div className={styles.grid}><LoadingState /><EmptyState title="Chưa có lịch đặt sân" description="Chọn địa điểm và khung giờ phù hợp để bắt đầu buổi chơi." action={<Button onClick={() => setToast({ tone: 'info', text: 'Đây là hành động mẫu tìm sân.' })}>Tìm sân</Button>} /></div>
        {retrying ? <LoadingState message="Đang thử lại…" /> : <ErrorState message="Không thể tải danh sách. Vui lòng kiểm tra kết nối." onRetry={async () => { setRetrying(true); await new Promise((resolve) => setTimeout(resolve, 700)); setRetrying(false); setToast({ tone: 'success', text: 'Đã hoàn tất lần thử lại mẫu.' }); }} />}
        <div className={styles.row}><Button variant="secondary" onClick={() => setToast({ tone: 'success', text: 'Đã lưu thay đổi thành công.' })}>Thông báo thành công</Button><Button variant="secondary" onClick={() => setToast({ tone: 'error', text: 'Không thể lưu thay đổi. Vui lòng thử lại.' })}>Thông báo thất bại</Button><Button variant="danger" onClick={() => setConfirm(true)}>Mở xác nhận hủy</Button></div>
        <LoadingSpinner message="Đang đồng bộ lịch sân…" />
      </Sample>
      <Sample id="tabs" title="07 / Thẻ nội dung">
        <Tabs label="Thông tin sân mẫu" value={tab} onChange={setTab} items={[
          { value: 'overview', label: 'Tổng quan', content: <p>Dùng phím ← →, Home và End để chuyển thẻ.</p> },
          { value: 'schedule', label: 'Lịch sân', content: <Table columns={columns} data={rows} /> },
          { value: 'disabled', label: 'Chưa khả dụng', disabled: true, content: null },
        ]} />
      </Sample>
      <Sample id="layouts" title="08 / Bố cục & điều hướng" description="Dùng chung nền, thanh bên tối, bộ chọn địa điểm và drawer có giữ focus.">
        <p>Chuông thông báo và menu tài khoản xuất hiện trên thanh đầu trang khi đăng nhập. Có thể kiểm tra tải, lỗi, danh sách rỗng và đánh dấu đã đọc bằng tài khoản thử nghiệm.</p>
        <div className={styles.headerPreview}><PublicHeader user={null} /></div>
        <div className={styles.layoutPreview}>
          <aside className={styles.sidebarPreview} aria-label="Thanh bên mẫu"><Link to="/dev/style-guide" className={`${shell.brandLink} ${shell.brandLinkDark}`}><span className={shell.brandMark}>C</span>Courtly</Link>
            <LocationSwitcher locations={demoLocations} value={locationId} onChange={(event) => setLocationId(event.target.value)} />
            <p className={shell.navGroup}>Vận hành</p><span className={`${shell.sidebarLink} ${shell.sidebarLinkActive}`}>Bảng điều hành</span><span className={shell.sidebarLink}>Lịch sân</span><p className={shell.navGroup}>Cấu hình địa điểm</p><span className={shell.sidebarLink}>Sân & Bảng giá</span>
          </aside>
          <div className={styles.previewMain}><PageHeader title="Không gian vận hành" subtitle="Bản xem trước bố cục quản lý." /><p>Địa điểm đang chọn: {demoLocations.find((item) => item.id === locationId)?.name}</p><Button variant="secondary" onClick={() => setDrawer(true)}>Xem drawer quản lý</Button></div>
        </div>
      </Sample>
    </div>
    <Modal open={modal} title="Thông tin buổi chơi" onClose={() => setModal(false)} footer={<><Button variant="secondary" onClick={() => setModal(false)}>Đóng</Button><Button onClick={() => { setModal(false); setToast({ tone: 'success', text: 'Đã lưu thông tin mẫu.' }); }}>Lưu thông tin mẫu</Button></>}>
      <div className={styles.stack}><p>Thứ Bảy, 24/10/2026 · 17:30 – 18:30</p><StatusBadge status="HOLDING" />
        <FormField label="Ghi chú cho nhân viên"><Textarea placeholder="Nhập nội dung…" /></FormField>
        <details><summary>Xem nội dung dài để kiểm tra cuộn</summary>{Array.from({ length: 12 }, (_, index) => <p key={index}>Thông tin buổi chơi {index + 1}. Nội dung hộp thoại cuộn độc lập; các nút vẫn dễ thao tác.</p>)}</details>
      </div>
    </Modal>
    <ConfirmDialog open={confirm} title="Hủy lịch đặt sân mẫu?" message="Lịch đặt mẫu sẽ bị hủy và khung giờ được mở lại. Bạn không thể hoàn tác thao tác này. Đây là ví dụ giao diện, không tác động dữ liệu thực." confirmText="Xác nhận hủy" tone="danger" busy={saving} onClose={() => setConfirm(false)} onConfirm={simulateSave} />
    {drawer && <NavigationDrawer left label="Bố cục quản lý mẫu" onClose={() => setDrawer(false)}><Button variant="secondary" onClick={() => setDrawer(false)}>Đóng menu</Button><LocationSwitcher locations={demoLocations} value={locationId} onChange={(event) => setLocationId(event.target.value)} /><p className={shell.navGroup}>Vận hành</p><span className={`${shell.sidebarLink} ${shell.sidebarLinkActive}`}>Bảng điều hành</span><span className={shell.sidebarLink}>Lịch sân</span></NavigationDrawer>}
    {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}
  </PublicLayout>;
}
