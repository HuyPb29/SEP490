# Tiến độ frontend F1, F6 và F5

## Giai đoạn 2 · 12/11/2026

- F1 dùng tên đăng nhập 6–32 ký tự cho tài khoản mới theo SRS. Thay đổi dùng chung cho đăng ký Player và tạo Staff. Tài khoản hiện có giữ tên đăng nhập. OTP vẫn cho tối đa 5 lần nhập mỗi mã theo xác nhận của người dùng.
- Schema tạo mới đã đồng bộ. DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_srs_username_length.sql` trước khi triển khai phiên bản mới. Seed mới dùng tên Admin `admin1`.
- Build và lint frontend qua. Playwright F1 trên Edge với API mô phỏng qua 3/3. Backend qua 45/45 trên `BMS_Test`, gồm áp migration hai lần, kiểm biên username và vòng đời OTP. Migration đã áp riêng trên `BMS_Test`.
- UC24 dùng cấu hình từng voucher theo lựa chọn của người dùng. Owner có thể tắt kết hợp điểm hoặc nhập trần 1–100% trên số tiền sau voucher. Voucher cũ và voucher hệ thống giữ mặc định 50%. Trần 100% vẫn giữ số tiền phải trả dương. Checkout đơn lẻ, đơn trong ngày và gói kiểm lại chính sách khi tạo booking. Lượt voucher, ngân sách và điểm chỉ thay đổi khi tạo thành công.
- DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_uc24_voucher_point_policy.sql` trước khi chạy phiên bản UC24. Migration đã được kiểm hai lần trên `BMS_Test`. Backend voucher, điểm và checkout đạt 130/130. Build/lint frontend và hai ca Playwright UC24 với API mô phỏng đã qua.

## Giai đoạn 2 · 13/11/2026

- UC25 chọn Player và booking trong Point Grant. Hai API tra cứu phân trang theo địa điểm Owner đã chọn. Backend đối chiếu Player với booking khi lưu và vẫn nhận payload cũ có bookingId. My Points hiển thị tên giao dịch hoàn điểm và booking/gói liên quan. Tóm tắt gói có xác nhận MSG39 khi dùng điểm.
- UC26 tạo/sửa mốc dùng API hiện có. Form hiển thị lỗi dưới ô, kể cả mốc trùng, và giữ thông báo MSG03 sau khi tải lại dữ liệu.
- Build/lint frontend qua. Backend F6 qua 22/22 trên `BMS_Test`. Hai ca Playwright với API mô phỏng qua, gồm chọn Player/booking, lỗi và lưu Point Grant, tạo/sửa mốc và lỗi mốc trùng.
- UC21 thêm điều kiện đổi lịch và mã lỗi vào API hiện có. FE phân biệt tiếp tục phụ thu với mở yêu cầu mới, bỏ báo giá cũ khi đổi slot, và chỉ báo đổi lịch thành công sau APPROVED. PaymentProgress trả biên nhận phụ thu.
- UC22 cập nhật danh sách booking bị ảnh hưởng, có báo lỗi/thử lại riêng và lựa chọn trong chi tiết booking. Owner thấy cảnh báo theo lý do hủy; Player thấy MSG66 trước khi tự hủy và MSG69 khi gửi yêu cầu hoàn.
- UC21/22 qua build/lint, 58 test backend trên `BMS_Test` và 4 ca Playwright Edge với API mô phỏng. Chưa có bộ E2E liên luồng của Giai đoạn 3.
- UC23 còn lại. Giai đoạn 3 sẽ viết E2E liên luồng sau khi hoàn tất UC23.

## Cần chốt hợp đồng UC23

Refund List và Form gọi API hiện có. API trả bookingId và originalPaymentDate, chưa trả mã booking, trần hoàn còn lại hay mã MSG70/71/72. Cần chốt bổ sung các trường và mã lỗi vào hợp đồng hiện có, cùng cách trình bày kỳ thanh toán gốc trong lịch sử.

## Tự kiểm UC21 và UC22

1. Mở booking đã xác nhận còn lượt và hạn. Chọn slot rẻ hơn, kiểm giá mới, số đã trả và MSG64. Đổi lựa chọn trong lúc đang tải báo giá, kiểm nút Xác nhận chỉ bật sau báo giá mới.
2. Đổi sang slot đắt hơn và đi qua thanh toán phụ thu. Trước khi Staff xác nhận, kiểm hai slot còn giữ và lịch Player vẫn là lịch cũ. Sau APPROVED, kiểm lịch mới và biên nhận. Nếu bị từ chối hoặc hết hạn, kiểm lịch cũ và slot mới được nhả.
3. Player tự hủy booking sau MSG66. Dùng booking khác để Owner hủy sân sau MSG15, rồi kiểm Player thấy ba lựa chọn trong danh sách và chi tiết. Chọn hoàn tiền, kiểm MSG69 và yêu cầu trong tab Hoàn tiền của Owner.

## Tự kiểm UC25 và UC26

1. Owner chọn một địa điểm, tìm Player theo tên hoặc username và chọn booking của người đó. Nhập số điểm dương và lý do. Thử đổi địa điểm, tìm người chưa có booking ở đó và gửi form thiếu booking hoặc lý do.
2. Player mở Điểm và lịch sử để kiểm số dư và giao dịch điều chỉnh. Trong đặt nhiều buổi, nhập điểm hợp lệ rồi bấm xác nhận. Hủy hộp MSG39 để kiểm tra chưa tạo booking.
3. Owner tạo một mốc với giá trị và hạn voucher, thử tạo lại cùng ngưỡng để thấy lỗi dưới ô Mốc chi tiêu, rồi sửa hạn dùng và kiểm MSG03. Thanh toán đã xác nhận làm Player vượt mốc sẽ cấp voucher trong ví.

## Tự kiểm UC24

1. Đăng nhập Owner, chọn địa điểm, mở Ưu đãi và điểm. Tạo và công bố một voucher cho kết hợp điểm với trần 25% và một voucher tắt kết hợp. Thử lưu với tỷ lệ ngoài 1–100% và kiểm tra lỗi dưới trường.
2. Đăng nhập Player có số dư, áp voucher trần 25% vào booking còn 100.000đ sau voucher. Nếu số dư đủ, nhập 50 điểm để giảm 25.000đ, còn 75.000đ. Nhập 51 điểm để thấy MSG38 và xác nhận bị chặn. Áp voucher tắt kết hợp để kiểm tra ô điểm bị khóa.
3. Kiểm tra lượt và ngân sách sau thao tác Áp rồi sau Xác nhận tạo booking. Thử một đơn trong ngày và một gói nhiều buổi để kiểm tra trần áp dụng trên toàn đơn. Đăng nhập Admin, vô hiệu voucher đã công bố và thử áp lại.

## Tự kiểm F1

1. Mở đăng ký. Tên dài 5 hoặc 33 ký tự phải báo lỗi dưới ô và chưa gửi OTP. Tên dài 6 hoặc 32 ký tự hợp lệ có thể sang bước OTP nếu thông tin còn lại hợp lệ.
2. Nhập sai OTP 4 lần và kiểm tra số lượt còn lại. Lần thứ 5 làm mã hết hiệu lực. Gửi lại trong hạn hồ sơ chờ rồi xác minh bằng mã mới.
3. Đăng nhập bằng tên hợp lệ vừa tạo và thử tài khoản cũ có tên ngắn hơn 6 ký tự, nếu môi trường có dữ liệu này.
4. Đăng nhập Owner, chọn địa điểm đang hoạt động và tạo Staff có tên 32 ký tự. Đăng nhập bằng tài khoản Staff đó và kiểm tra trang Bảng điều hành.
