# Backend: thay đổi theo API.md (27/10/2026)

## Đã sửa logic F1

- Khôi phục `GET/PATCH /api/users/me` và `GET /api/admin/accounts`, gọi lại service thật.
- Gộp quản lý nhân viên vào `/api/owner/staff-members`; xóa các controller đăng ký, phiên đăng nhập, reset mật khẩu và quản lý tài khoản trùng.
- Hồ sơ chỉ cập nhật `fullName`, `skillLevel`; không đổi username, email, số điện thoại hoặc mật khẩu qua PATCH hồ sơ.
- `POST /api/users/me/password`: PLAYER/OWNER, body `{currentPassword,newPassword}`, MSG113/MSG114. STAFF dùng `POST /api/owner/staff-members/{id}/password`, body `{newPassword}`, do Owner thực hiện.
- Staff được tạo bằng username bắt buộc, không có email. Quên mật khẩu và gửi lại OTP reset không gửi email cho tài khoản STAFF cũ có email.
- Mật khẩu dùng chung quy tắc 8–32 ký tự, có chữ và số, không khoảng trắng; kiểm tra họ tên và số điện thoại bắt đầu bằng 0. Không tự sinh hoặc đổi username người dùng đã chọn.
- Giới hạn gửi OTP theo email, gộp các mục đích: 60 giây/lần, 5 lần/giờ, 10 lần/24 giờ. Vượt giới hạn trả 429 với MSG107; tính cả lần đăng ký đầu tiên.
- Owner chỉ đổi trạng thái Staff thành ACTIVE/DISABLED; Admin chỉ khóa/mở PLAYER/STAFF/OWNER, không sửa trạng thái ADMIN. Kiểm tra phân trang và danh sách trường sắp xếp, trả 400 thay vì lỗi truy vấn 500.

## Phân quyền và địa điểm

- `/api/admin/**`: ADMIN; `/api/owner/**`: OWNER; `/api/staff/**`: STAFF/OWNER.
- Mở GET công khai cho danh sách/chi tiết địa điểm, sân, lịch, ưu đãi theo lô, đánh giá sân và kèo. Danh sách yêu cầu tham gia kèo vẫn cần đăng nhập.
- Chọn cách G3 bằng header `X-Location-Id`. Owner phải gửi header cho API theo địa điểm không có location id trong path. Không suy ra một địa điểm duy nhất từ Owner nữa.
- Với `/api/owner/locations/{id}/...`, path là địa điểm được chọn. Server kiểm tra địa điểm thuộc Owner. Với STAFF, địa điểm lấy từ tài khoản; header nếu có phải trùng.
- Filter kiểm tra quyền truy cập và trạng thái địa điểm; service Staff kiểm tra lại quyền sở hữu và địa điểm của nhân viên mục tiêu.
- Staff tại địa điểm bị khóa bị chặn khi đăng nhập và khi dùng token cũ. Owner được liệt kê địa điểm để chọn; tại địa điểm bị khóa chỉ được gọi GET `/api/owner/exports`.
- Các service feature khác khi được triển khai phải kiểm tra resource `{id}` thuộc địa điểm đã chọn và kiểm tra quyền trên resource. Header không thay thế kiểm tra này.

Ví dụ tạo Staff:

```http
POST /api/owner/staff-members
Authorization: Bearer <owner-token>
X-Location-Id: 12
Content-Type: application/json

{"username":"staff_hanoi","fullName":"Nguyễn Văn An","password":"Staff12345","phone":"0987654321"}
```

## Đã điều chỉnh khung route F3–F9

Các route dưới đây là **hợp đồng khung**, vẫn trả **501** vì chưa có service nghiệp vụ trong repository. Không dùng trạng thái này để đánh dấu feature đã hoàn thành.

- Hoàn tiền chuyển từ `/api/staff/refunds...` sang `/api/owner/refunds...`.
- Thêm Owner hủy booking có loại nguyên nhân/lý do, preview đổi lịch có dữ liệu slot, hướng dẫn thanh toán và gửi thanh toán chênh lệch.
- Xóa `apply-voucher`, `apply-points`, `booking-quotes`. Thêm `/api/bookings/summary`; summary và tạo booking nhận chung `BookingRequest` có `voucherCode`, `pointsToUse`. Chỉ service tạo booking sau này được trừ lượt/điểm trong transaction tạo booking.
- Voucher disable chuyển sang Admin; thêm danh sách voucher cho Admin/Owner và cấp cho danh sách Player; bỏ danh sách voucher công khai theo địa điểm.
- Đổi `loyalty-tiers` thành `loyalty-milestones` ở API/controller; tên bảng SQL không đổi.
- Đồng bộ khung F3/F4 mô tả ở mục 7: hướng dẫn/gửi thanh toán theo booking hoặc package; bỏ `PaymentProofController`; thêm preview package, batch offers công khai, xác nhận tại quầy, đối soát Owner. Giữ một route lịch theo địa điểm với `date` bắt buộc.
- Thêm Owner ẩn đánh giá; gộp route tải dữ liệu thành `/api/owner/exports` (hợp đồng một file Excel ba sheet); thêm route báo cáo hủy, đổi lịch, voucher.

## Swagger và tích hợp FE

- Swagger UI: `/swagger-ui`; OpenAPI JSON: `/v3/api-docs`. Khai báo Bearer JWT và header địa điểm cho các route liên quan.
- Dùng springdoc 3.2.0 tương thích Spring Boot 4.1 theo [bảng tương thích chính thức](https://springdoc.org/#what-is-the-compatibility-matrix-of-springdoc-openapi-with-spring-boot).
- Logout giữ cơ chế JWT hiện tại: FE xóa token; server không thu hồi token đã phát hành.
- FE cần chuyển khỏi `/api/staff`, gửi username khi đăng ký/tạo Staff, dùng endpoint đổi mật khẩu riêng và gửi `X-Location-Id` cho Owner.

## Còn cần triển khai/chốt ngoài các sửa lỗi trên

- F5/F6 chưa có entity/repository/service nghiệp vụ: tính hạn đổi lịch/chênh lệch, xử lý hủy/hoàn tiền, validate/redeem voucher/điểm, cộng/trả điểm và tặng voucher tự động. Thêm route không thực hiện những nghiệp vụ này.
- DTO phản hồi và các DTO request còn thiếu của khung feature cần được hoàn thiện khi xác định hợp đồng nghiệp vụ; chưa coi G4 đã xong toàn bộ.
- F2: chốt trường chính sách/chuyển khoản và nơi lưu/upload ảnh QR; controller địa điểm vẫn là khung.
- F7: đã có PATCH/cancel kèo; cách phối hợp giữ/hủy kèo khi đổi lịch vẫn cần thống nhất giữa chủ feature.
- F9: chưa có service sinh workbook ba sheet hoặc tính báo cáo.
- FR124/UC37: phân công thông báo và job tự động theo nhóm; chưa tự gán người phụ trách.
- Không có Baseline 2, Report-4 hoặc `tracking/BMS_Theo_doi_API.xlsx` trong checkout này; chưa đối chiếu bản gốc, sửa hình sequence hoặc đánh dấu “Đã chốt”.

## Kiểm tra

Chạy `mvnw.cmd test` trong thư mục backend với SQL Server `BMS_Test`. Test tích hợp dùng transaction rollback, tự tạo Owner/Admin/địa điểm, không phụ thuộc tài khoản seed. Các kiểm tra bao gồm khôi phục API, đa địa điểm, phân quyền, khóa địa điểm, mật khẩu, OTP, validation và OpenAPI.
