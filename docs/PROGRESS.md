# Tiến độ frontend F1, F6 và F5

## Giai đoạn 2 · 12/11/2026

- F1 dùng tên đăng nhập 6–32 ký tự cho tài khoản mới theo SRS. Thay đổi dùng chung cho đăng ký Player và tạo Staff. Tài khoản hiện có giữ tên đăng nhập. OTP vẫn cho tối đa 5 lần nhập mỗi mã theo xác nhận của người dùng.
- Schema tạo mới đã đồng bộ. DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_srs_username_length.sql` trước khi triển khai phiên bản mới. Seed mới dùng tên Admin `admin1`.
- Build và lint frontend qua. Playwright F1 trên Edge với API mô phỏng qua 3/3. Backend qua 45/45 trên `BMS_Test`, gồm áp migration hai lần, kiểm biên username và vòng đời OTP. Migration đã áp riêng trên `BMS_Test`.
- UC24 dùng cấu hình từng voucher theo lựa chọn của người dùng. Owner có thể tắt kết hợp điểm hoặc nhập trần 1–100% trên số tiền sau voucher. Voucher cũ và voucher hệ thống giữ mặc định 50%. Trần 100% vẫn giữ số tiền phải trả dương. Checkout đơn lẻ, đơn trong ngày và gói kiểm lại chính sách khi tạo booking. Lượt voucher, ngân sách và điểm chỉ thay đổi khi tạo thành công.
- DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_uc24_voucher_point_policy.sql` trước khi chạy phiên bản UC24. Migration đã được kiểm hai lần trên `BMS_Test`. Backend voucher, điểm và checkout đạt 130/130. Build/lint frontend và hai ca Playwright UC24 với API mô phỏng đã qua.
- UC25, UC26 và F5 còn lại. Giai đoạn 3 sẽ viết E2E sau khi hoàn tất các luồng liên quan.

## Cần chốt UC25 trước khi sửa tiếp F6

SRS UC25 N5 yêu cầu Owner chọn Player rồi xác định booking liên quan trong Point Grant. API hiện nhận bookingId và tự xác định Player. BE thiếu API Owner tra cứu Player và booking tương ứng trong địa điểm đã chọn. Cần chốt bổ sung tra cứu để làm picker theo SRS, hoặc tiếp tục dùng bookingId làm đầu vào.

## Tự kiểm UC24

1. Đăng nhập Owner, chọn địa điểm, mở Ưu đãi và điểm. Tạo và công bố một voucher cho kết hợp điểm với trần 25% và một voucher tắt kết hợp. Thử lưu với tỷ lệ ngoài 1–100% và kiểm tra lỗi dưới trường.
2. Đăng nhập Player có số dư, áp voucher trần 25% vào booking còn 100.000đ sau voucher. Nếu số dư đủ, nhập 50 điểm để giảm 25.000đ, còn 75.000đ. Nhập 51 điểm để thấy MSG38 và xác nhận bị chặn. Áp voucher tắt kết hợp để kiểm tra ô điểm bị khóa.
3. Kiểm tra lượt và ngân sách sau thao tác Áp rồi sau Xác nhận tạo booking. Thử một đơn trong ngày và một gói nhiều buổi để kiểm tra trần áp dụng trên toàn đơn. Đăng nhập Admin, vô hiệu voucher đã công bố và thử áp lại.

## Tự kiểm F1

1. Mở đăng ký. Tên dài 5 hoặc 33 ký tự phải báo lỗi dưới ô và chưa gửi OTP. Tên dài 6 hoặc 32 ký tự hợp lệ có thể sang bước OTP nếu thông tin còn lại hợp lệ.
2. Nhập sai OTP 4 lần và kiểm tra số lượt còn lại. Lần thứ 5 làm mã hết hiệu lực. Gửi lại trong hạn hồ sơ chờ rồi xác minh bằng mã mới.
3. Đăng nhập bằng tên hợp lệ vừa tạo và thử tài khoản cũ có tên ngắn hơn 6 ký tự, nếu môi trường có dữ liệu này.
4. Đăng nhập Owner, chọn địa điểm đang hoạt động và tạo Staff có tên 32 ký tự. Đăng nhập bằng tài khoản Staff đó và kiểm tra trang Bảng điều hành.
