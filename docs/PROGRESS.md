# Tiến độ frontend F1, F6 và F5

## Giai đoạn 2 · 12/11/2026

- F1 dùng tên đăng nhập 6–32 ký tự cho tài khoản mới theo SRS. Thay đổi dùng chung cho đăng ký Player và tạo Staff. Tài khoản hiện có giữ tên đăng nhập. OTP vẫn cho tối đa 5 lần nhập mỗi mã theo xác nhận của người dùng.
- Schema tạo mới đã đồng bộ. DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_srs_username_length.sql` trước khi triển khai phiên bản mới. Seed mới dùng tên Admin `admin1`.
- Build và lint frontend qua. Playwright F1 trên Edge với API mô phỏng qua 3/3. Backend qua 45/45 trên `BMS_Test`, gồm áp migration hai lần, kiểm biên username và vòng đời OTP. Migration đã áp riêng trên `BMS_Test`.
- F6 và F5 chưa sửa. Giai đoạn 3 sẽ viết E2E sau khi hoàn tất các luồng liên quan.

## Cần chốt UC24 trước khi sửa F6

SRS UC24 N1.6 ghi Owner cài được quyền kết hợp voucher với điểm và tỷ lệ tối đa cho từng voucher. FR82 trong cùng SRS quy định luôn cho kết hợp và cố định trần 50% số tiền còn lại sau voucher. API hiện thực thi FR82. Cần chọn chính sách cố định để Voucher Form hiển thị quy tắc, hoặc cho Owner cấu hình và mở rộng hợp đồng backend.

## Tự kiểm F1

1. Mở đăng ký. Tên dài 5 hoặc 33 ký tự phải báo lỗi dưới ô và chưa gửi OTP. Tên dài 6 hoặc 32 ký tự hợp lệ có thể sang bước OTP nếu thông tin còn lại hợp lệ.
2. Nhập sai OTP 4 lần và kiểm tra số lượt còn lại. Lần thứ 5 làm mã hết hiệu lực. Gửi lại trong hạn hồ sơ chờ rồi xác minh bằng mã mới.
3. Đăng nhập bằng tên hợp lệ vừa tạo và thử tài khoản cũ có tên ngắn hơn 6 ký tự, nếu môi trường có dữ liệu này.
4. Đăng nhập Owner, chọn địa điểm đang hoạt động và tạo Staff có tên 32 ký tự. Đăng nhập bằng tài khoản Staff đó và kiểm tra trang Bảng điều hành.
