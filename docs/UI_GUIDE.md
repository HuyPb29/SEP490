# Quy ước Giao diện & Bộ Component Chuẩn — BMS (Courtly)

Tài liệu này định nghĩa bộ chuẩn giao diện duy nhất cho toàn bộ Frontend BMS (`frontend/src`), tuân thủ **NFR19** (tiếng Việt 100%, responsive từ `360px` không tràn ngang, lỗi nhập liệu hiển thị ngay dưới trường bị sai, có hộp thoại xác nhận cho thao tác quan trọng), **FR124** (`NotificationBell`), và kiến trúc **3 Layout** (`PublicLayout`, `ManagementLayout`, `AdminLayout`).

---

## 1. Design Tokens Tập Trung (`frontend/src/index.css`)

Mọi màu sắc, font chữ, cỡ chữ, khoảng cách, bo góc, đổ bóng và kích thước khung đều được khai báo tập trung tại `:root` trong `frontend/src/index.css`. Không hard-code mã màu rời rạc trong từng trang.

| Nhóm Token | Biến CSS | Giá trị | Mục đích sử dụng |
|---|---|---|---|
| **Màu chính (Primary)** | `--color-primary` | `#14532d` | Nút chính, tiêu đề nhấn, trạng thái active chính |
| | `--color-primary-hover` | `#0f3f22` | Hover nút chính |
| | `--color-primary-accent` | `#16a34a` | Icon thương hiệu, điểm nhấn trên nền tối |
| | `--color-primary-soft` | `#e4f2e8` | Nền tab/menu đang chọn, vùng highlight |
| **Màu nền & Bề mặt** | `--color-bg` | `#f6f7f3` | Nền tổng thể của trang |
| | `--color-surface` | `#ffffff` | Nền card, bảng, modal, header |
| | `--color-surface-muted` | `#f1f5f9` | Nền header bảng, ô chỉ đọc, vùng phụ |
| **Màu viền & Chữ** | `--color-border` | `#dde3da` | Viền card, bảng, đường phân cách |
| | `--color-border-strong` | `#cbd5e1` | Viền ô nhập (`input`, `select`, `textarea`), nút phụ |
| | `--color-text` | `#142019` | Chữ nội dung chính |
| | `--color-text-secondary` | `#334155` | Nhãn form (`label`), tiêu đề cột |
| | `--color-text-muted` | `#55645a` | Chú thích, mô tả phụ |
| **Màu Sidebar** | `--color-sidebar-bg` | `#0b132b` | Nền sidebar của `ManagementLayout` & `AdminLayout` |
| | `--color-sidebar-surface` | `#192235` | Khung bộ chọn địa điểm / thẻ vai trò trên sidebar |
| **Màu trạng thái** | `--color-success` / `*-bg` / `*-border` | `#15803d` / `#dcfce7` / `#bbf7d0` | Hoàn thành, Đã xác nhận, Đang hoạt động, Được duyệt |
| | `--color-warning` / `*-bg` / `*-border` | `#9a3412` / `#ffedd5` / `#fed7aa` | Đang giữ chỗ, Chờ bổ sung, Chờ xử lý, Chờ hoàn tiền |
| | `--color-info` / `*-bg` / `*-border` | `#1d4ed8` / `#dbeafe` / `#bfdbfe` | Chờ xác nhận, Đang sử dụng |
| | `--color-danger` / `*-bg` / `*-border` | `#b91c1c` / `#fee2e2` / `#fecaca` | Từ chối, Đã hủy, Đã khóa, Lỗi dưới ô nhập (NFR19) |
| | `--color-neutral` / `*-bg` / `*-border` | `#475569` / `#f1f5f9` / `#e2e8f0` | Hết hạn, Đã đóng, Đã hoàn, Bản nháp |
| **Font & Cỡ chữ** | `--font-sans` | `'Be Vietnam Pro', Inter, system-ui, sans-serif` | Font chữ toàn hệ thống |
| | `--text-xs` / `--text-sm` / `--text-base` | `12px` / `13px` / `14px` | Badge, chú thích / Bảng, nhãn / Nội dung chuẩn |
| | `--text-md` / `--text-lg` / `--text-xl` / `--text-2xl` | `16px` / `18px` / `22px` / `clamp(22px, 2vw, 26px)` | Tiêu đề card / Section (`h2`) / Phụ đề / Tiêu đề trang (`h1`) |
| **Spacing** | `--space-1` .. `--space-8` | `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px` | Khoảng cách chuẩn |
| **Bo góc & Bóng** | `--radius-sm` / `md` / `lg` / `xl` / `full` | `8px` / `10px` / `14px` / `18px` / `9999px` | Tag / Input & Button / Card / Modal / Pill |
| | `--shadow-xs` / `sm` / `md` / `lg` | 4 mức độ bóng | Card nhẹ / Panel / Khối nổi / Modal & Drawer |
| **Kích thước khung** | `--container-max` / `--sidebar-width` / `--header-height` | `1240px` / `248px` / `64px` | Độ rộng tối đa nội dung / Sidebar / Chiều cao Header |
| **Breakpoints** | Mobile: `360px–767px`, Tablet: `768px–1023px`, Desktop: `>= 1024px` | `@media (max-width: 767px)` | Mobile thu gọn thành Hamburger/Drawer, không cuộn ngang |

---

## 2. Chuẩn 3 Khung Layout & Header Theo Vai Trò (`src/components/layout/`)

Toàn bộ các trang sử dụng chung một trong 3 layout dưới đây. `NotificationBell` (FR124) và `UserMenu` được đặt **bên trong** thanh Header của cả 3 layout (loại bỏ kiểu `position: fixed` đè góc màn hình và bỏ `WorkspaceNav` nổi ở góc dưới trái).

### 2.1. `PublicLayout` (Dành cho Guest & Player)
- **Cấu trúc**:
  - **Top Header dính (`sticky`, cao `64px`)**:
    - Trái: Logo thương hiệu (`C Courtly`).
    - Giữa (Menu điều hướng theo vai trò):
      - **Guest**: `Tìm địa điểm` (`/locations`), `Kèo mở` (`/matches`).
      - **Player**: `Tìm địa điểm` (`/locations`), `Booking của tôi` (`/my-bookings`), `Lịch sử đổi lịch` (`/my-reschedules`), `Kèo & Đội` (`/matches`, `/teams`), `Voucher & Điểm` (`/my-vouchers`), `Khiếu nại` (`/complaints`).
      - *(Nếu tài khoản đang đăng nhập là Staff / Owner / Admin đang xem trang công khai như `/locations/:id`, hiển thị thêm nút chuyển nhanh `Về trang quản lý` dẫn tới `/staff/dashboard`, `/owner/workspace` hoặc `/admin`).*
    - Phải:
      - **Guest**: Nút `Đăng nhập` (`/login`) và `Đăng ký` (`/register`).
      - **Đã đăng nhập**: Chuông thông báo [`NotificationBell`](../frontend/src/components/notification/NotificationBell.jsx) (FR124) + `UserMenu` dropdown (`Hồ sơ cá nhân` `/account`, `Đổi mật khẩu` `/change-password`, `Đăng xuất`).
  - **Mobile (`360px – 767px`)**: Giữ Logo + Chuông thông báo + Nút Hamburger `☰`; toàn bộ danh sách mục menu và thông tin tài khoản thu gọn vào Drawer trượt từ phải sang, đảm bảo không tràn ngang ở `360px`.
  - **Main Content**: Căn giữa, `max-width: var(--container-max)` (`1240px`), padding ngang `24px` (mobile `12px`).

```jsx
import PublicLayout from '../../components/layout/PublicLayout';

export default function FacilitySearchPage() {
  return (
    <PublicLayout>
      {/* Nội dung trang */}
    </PublicLayout>
  );
}
```

### 2.2. `ManagementLayout` (Dành cho Staff & Owner — có `LocationContext`)
- **Cấu trúc**:
  - **Sidebar trái (`248px` trên Desktop, Drawer ẩn/hiện qua nút Hamburger trên Mobile `< 768px`)**:
    - Đầu sidebar: Logo `C Courtly` + Nhãn vai trò (`Nhân viên vận hành` hoặc `Chủ cụm sân`).
    - Menu điều hướng lọc chặt theo vai trò (chỉ hiện màn hình vai trò có quyền theo SRS):
      - **Menu của Staff**:
        1. `Bảng điều hành` (`/staff/dashboard` — gồm Đặt sân tại quầy UC16 & Đối soát cuối ngày UC20)
        2. `Xác nhận thanh toán` (`/staff/confirm-payments` — gồm Thanh toán đặt sân UC19 & Phụ thu đổi lịch UC21)
        3. `Lịch sân` (`/facilities/:locationId` — UC13)
        4. `Yêu cầu bảo trì` (`/maintenance` — UC10)
        5. `Khiếu nại của khách` (`/staff/complaints` — UC33)
      - **Menu của Owner**:
        1. `Tổng quan & Vận hành` (`/owner/workspace` — Địa điểm, Nhân viên, Ưu đãi, Khiếu nại, Hoàn tiền, Đánh giá)
        2. `Sân & Bảng giá` (`/owner/courts` — UC07, UC09)
        3. `Giờ mở cửa & Slot` (`/owner/opening-hours` — UC08)
        4. `Cài đặt địa điểm` (`/owner/facility-settings` — UC07)
        5. `Xác nhận thanh toán` (`/staff/confirm-payments` — BR58)
        6. `Đối soát doanh thu` (`/owner/reconciliations` — UC20)
        7. `Báo cáo & Xuất dữ liệu` (`/owner/reports` — UC35, UC36)
        8. `Quản lý bảo trì` (`/maintenance` — UC10)
  - **Topbar (`64px`)**:
    - Trái: Nút Hamburger (trên mobile) + Tiêu đề ngữ cảnh + **Bộ chọn địa điểm (`LocationSelector` kết nối `LocationContext` / `selectedLocationId` trong `AuthContext`)** để Owner/Staff chuyển đổi cơ sở làm việc đồng bộ xuyên suốt mọi trang.
    - Phải: Chuông thông báo `NotificationBell` (FR124) + `UserMenu` (`Hồ sơ cá nhân`, `Đổi mật khẩu`, `Đăng xuất`).

```jsx
import ManagementLayout from '../../components/layout/ManagementLayout';

export default function OwnerCourtsPricingPage() {
  return (
    <ManagementLayout title="Quản lý sân & bảng giá">
      {/* Nội dung trang */}
    </ManagementLayout>
  );
}
```

### 2.3. `AdminLayout` (Dành cho Admin — không có bộ chọn địa điểm)
- **Cấu trúc**: Dùng chung khung Sidebar + Topbar với `ManagementLayout`, nhưng **không có bộ chọn địa điểm** (tuân thủ BR63).
- **Menu của Admin**:
  1. `Quản lý tài khoản` (`/admin/accounts` — UC04)
  2. `Quản lý địa điểm & Yêu cầu dịch vụ` (`/admin/facilities` — UC05, UC06)
  3. `Kiểm duyệt voucher` (`/admin/vouchers` — UC24)
  4. `Kiểm duyệt đánh giá` (`/admin/reviews` — UC32)
- **Topbar**: Chuông thông báo `NotificationBell` + `UserMenu` (`Hồ sơ cá nhân`, `Đổi mật khẩu`, `Đăng xuất`).

```jsx
import AdminLayout from '../../components/layout/AdminLayout';

export default function AdminFacilitiesPage() {
  return (
    <AdminLayout title="Quản lý địa điểm">
      {/* Nội dung trang */}
    </AdminLayout>
  );
}
```

---

## 3. Bộ Component Chung (`src/components/common/`)

### 3.1. `Button`
Hỗ trợ 3 biến thể (`variant="primary" | "secondary" | "danger"`), 3 kích thước (`size="sm" | "md" | "lg"`), và trạng thái `loading` / `disabled`.

```jsx
import { Button } from '../../components/common';

<Button variant="primary" size="md" loading={isSubmitting} onClick={handleSave}>
  Lưu thay đổi
</Button>
<Button variant="secondary" onClick={handleCancel}>Hủy</Button>
<Button variant="danger" size="sm" onClick={handleDelete}>Xóa sân</Button>
```

### 3.2. `FormField`, `Input`, `Select`, `Textarea` (Tuân thủ NFR19)
Hiển thị nhãn (`label`), dấu bắt buộc (`required`), ô nhập và **thông báo lỗi màu đỏ (`role="alert"`) nằm ngay bên dưới trường bị sai**.

```jsx
import { FormField, Input, Select, Textarea } from '../../components/common';

<FormField label="Tên khách hàng" required error={errors.customerName} htmlFor="customerName">
  <Input id="customerName" value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.customerName)} />
</FormField>

<FormField label="Sân thi đấu" required error={errors.courtId}>
  <Select value={courtId} onChange={(e) => setCourtId(e.target.value)} options={courtOptions} />
</FormField>

<FormField label="Lý do chênh lệch" error={errors.reason}>
  <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
</FormField>
```

### 3.3. `PageHeader`
Chuẩn hóa phần đầu mỗi trang gồm: đường dẫn quay lại / breadcrumb (tùy chọn), tiêu đề trang (`h1`), mô tả phụ (`subtitle`), và cụm nút hành động bên phải (`actions`).

```jsx
import { PageHeader, Button } from '../../components/common';

<PageHeader
  backTo={{ label: 'Quay lại chi tiết sân', to: `/locations/${locationId}` }}
  title="Xác nhận thông tin đặt sân"
  subtitle="Kiểm tra kỹ khung giờ và ưu đãi trước khi giữ chỗ 10 phút"
  actions={<Button onClick={reload}>Làm mới</Button>}
/>
```

### 3.4. `StatusBadge` (Map chuẩn từ sheet `Trang_thai` trong SRS)
Tự động tra cứu nhãn tiếng Việt chuẩn và tông màu (`success`, `warning`, `info`, `danger`, `neutral`) theo cặp `(category, status)` hoặc mã trạng thái.

| Nhóm (`category`) | Mã trạng thái (hoa/thường) | Nhãn hiển thị chuẩn (Tiếng Việt) | Tông màu (`tone`) |
|---|---|---|---|
| **Booking** (`booking`) | `HOLDING` | Đang giữ chỗ | `warning` |
| | `AWAITING_CONFIRMATION` | Chờ xác nhận | `info` |
| | `RESUBMIT_REQUESTED` | Chờ bổ sung | `warning` |
| | `CONFIRMED` | Đã xác nhận | `success` |
| | `IN_USE` | Đang sử dụng | `info` |
| | `COMPLETED` | Hoàn thành | `success` |
| | `PAYMENT_REJECTED` | Bị từ chối thanh toán | `danger` |
| | `EXPIRED` | Hết hạn | `neutral` |
| | `CANCELLED_BY_PLAYER` | Khách hủy | `danger` |
| | `CANCELLED_BY_FACILITY` | Sân hủy | `danger` |
| **Đổi lịch** (`reschedule`) | `PENDING_PAYMENT` | Chờ trả thêm | `warning` |
| | `AWAITING_CONFIRMATION` | Chờ xác nhận | `info` |
| | `APPROVED` | Thành công | `success` |
| | `REJECTED` | Bị từ chối | `danger` |
| | `EXPIRED` | Hết hạn | `neutral` |
| **Hoàn tiền** (`refund`) | `PENDING_REFUND` | Chờ hoàn tiền | `warning` |
| | `REFUNDED` | Đã hoàn | `neutral` |
| **Kèo** (`match`) | `OPEN` | Đang tuyển | `success` |
| | `CLOSED` | Đã đóng | `neutral` |
| | `CANCELLED` | Đã hủy | `danger` |
| | `EXPIRED` | Hết hạn | `neutral` |
| **Tham gia kèo** (`join_request`) | `PENDING` | Đang chờ | `warning` |
| | `APPROVED` | Được duyệt | `success` |
| | `REJECTED` | Bị từ chối | `danger` |
| | `CANCELLED` | Đã hủy | `neutral` |
| **Khiếu nại** (`complaint`) | `SUBMITTED` | Mới gửi | `warning` |
| | `PENDING_OWNER` | Chờ Owner quyết định | `warning` |
| | `RESOLVED` | Đã xử lý | `success` |
| | `REJECTED` | Bị từ chối | `danger` |
| **Đăng ký dịch vụ** (`service_request`) | `PENDING` / `APPROVED` / `REJECTED` | Chờ xử lý / Đã duyệt / Bị từ chối | `warning` / `success` / `danger` |
| **Địa điểm** (`location`) | `ACTIVE` / `LOCKED` | Đang hoạt động / Đã khóa | `success` / `danger` |

```jsx
import { StatusBadge } from '../../components/common';

<StatusBadge category="booking" status={booking.status} />
<StatusBadge category="complaint" status={complaint.status} />
```

### 3.5. `Table`
Bao bọc bảng dữ liệu trong khung cuộn ngang an toàn (`overflow-x: auto`) để không làm vỡ layout ở màn hình `360px`, hỗ trợ hiển thị trạng thái rỗng.

```jsx
import { Table } from '../../components/common';

<Table
  columns={[
    { key: 'date', header: 'Ngày' },
    { key: 'amount', header: 'Doanh thu', align: 'right' },
  ]}
  data={rows}
  rowKey="id"
  emptyText="Chưa có dữ liệu đối soát."
/>
```

### 3.6. `Modal` & `ConfirmDialog` (Tuân thủ NFR19)
Thay thế `window.confirm` / `window.alert` và các lớp modal rời rạc. Dùng cho cả modal chứa form và hộp thoại xác nhận thao tác làm mất tiền hoặc không hoàn tác được (hủy booking, dùng điểm, đổi lịch, từ chối thanh toán, khóa tài khoản).

```jsx
import { Modal, ConfirmDialog } from '../../components/common';

<ConfirmDialog
  open={Boolean(cancellingBooking)}
  title="Xác nhận hủy đặt sân"
  message="Nếu hủy booking này, bạn sẽ không được hoàn tiền (BR07). Bạn có chắc chắn muốn tiếp tục?"
  confirmText="Đồng ý hủy"
  cancelText="Quay lại"
  variant="danger"
  onConfirm={handleConfirmCancel}
  onClose={() => setCancellingBooking(null)}
/>
```

### 3.7. `LoadingState`, `EmptyState`, `ErrorState`
Chuẩn hóa 3 trạng thái tải dữ liệu, không có dữ liệu và lỗi tải dữ liệu (kèm nút `Thử lại`).

```jsx
import { LoadingState, EmptyState, ErrorState } from '../../components/common';

{loading && <LoadingState message="Đang tải danh sách đặt sân…" />}
{error && <ErrorState message={error} onRetry={reload} />}
{!loading && !error && items.length === 0 && (
  <EmptyState title="Chưa có lượt đặt sân nào" description="Hãy chọn địa điểm để đặt sân ngay hôm nay." />
)}
```

### 3.8. `Toast` & `Pagination`
- `Toast`: Hiển thị thông báo ngắn góc dưới phải (`tone="success" | "danger" | "info"`).
- `Pagination`: Điều hướng phân trang chuẩn (`page`, `totalPages`, `onPageChange`).

```jsx
import { Toast, Pagination } from '../../components/common';

{toastMessage && <Toast tone="success" onClose={() => setToastMessage('')}>{toastMessage}</Toast>}
<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
```

---

## 4. Quy Chuẩn Định Dạng Tiền VND & Ngày Giờ (`src/utils/formatters.js`)

Tất cả các trang import trực tiếp từ `src/utils/formatters.js` (hoặc alias `src/utils/format.js`), **không tự viết hàm format riêng**:
- `money(value)`: Định dạng tiền tệ chuẩn Việt Nam (ví dụ: `150.000 ₫`).
- `shortDate(value)`: Định dạng ngày `dd/mm/yyyy` theo múi giờ `Asia/Ho_Chi_Minh`.
- `dateTime(value)`: Định dạng ngày giờ `HH:mm dd/mm/yyyy`.
- `minuteLabel(minute)`: Chuyển số phút trong ngày thành `HH:mm` (ví dụ `360` -> `06:00`).
- `today()`: Ngày hiện tại `YYYY-MM-DD` theo múi giờ `Asia/Ho_Chi_Minh`.
