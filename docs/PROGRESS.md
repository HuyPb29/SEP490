# Tiến độ frontend F1, F6 và F5

## Giai đoạn 2 · 12/11/2026

- F1 dùng tên đăng nhập 6–32 ký tự cho tài khoản mới theo SRS. Thay đổi dùng chung cho đăng ký Player và tạo Staff. Tài khoản hiện có giữ tên đăng nhập. OTP vẫn cho tối đa 5 lần nhập mỗi mã theo xác nhận của người dùng.
- Schema tạo mới đã đồng bộ. DB đã tồn tại cần áp `backend/src/main/resources/db/20261112_srs_username_length.sql` trước khi triển khai phiên bản mới. Seed mới dùng tên Admin `admin1`.
- Build và lint frontend qua. Playwright F1 trên Edge với API mô phỏng qua 3/3. Backend qua 45/45 trên `BMS_Test`, gồm áp migration hai lần, kiểm biên username và vòng đời OTP. Migration đã áp riêng trên `BMS_Test`.
- Bản UC24 ngày 12/11 từng dùng cấu hình theo voucher. Quyết định D161 áp dụng ở lần cập nhật 13/11 bên dưới đã thay quy tắc đó.

## Giai đoạn 2 · 13/11/2026

- UC25 chọn Player và booking trong Point Grant. Hai API tra cứu phân trang theo địa điểm Owner đã chọn. Backend đối chiếu Player với booking khi lưu và vẫn nhận payload cũ có bookingId. My Points hiển thị tên giao dịch hoàn điểm và booking/gói liên quan. Tóm tắt gói có xác nhận MSG39 khi dùng điểm.
- UC26 tạo/sửa mốc dùng API hiện có. Form hiển thị lỗi dưới ô, kể cả mốc trùng, và giữ thông báo MSG03 sau khi tải lại dữ liệu.
- Build/lint frontend qua. Backend F6 qua 22/22 trên `BMS_Test`. Hai ca Playwright với API mô phỏng qua, gồm chọn Player/booking, lỗi và lưu Point Grant, tạo/sửa mốc và lỗi mốc trùng.
- UC21 thêm điều kiện đổi lịch và mã lỗi vào API hiện có. FE phân biệt tiếp tục phụ thu với mở yêu cầu mới, bỏ báo giá cũ khi đổi slot, và chỉ báo đổi lịch thành công sau APPROVED. PaymentProgress trả biên nhận phụ thu.
- UC22 cập nhật danh sách booking bị ảnh hưởng, có báo lỗi/thử lại riêng và lựa chọn trong chi tiết booking. Owner thấy cảnh báo theo lý do hủy; Player thấy MSG66 trước khi tự hủy và MSG69 khi gửi yêu cầu hoàn.
- UC21/22 qua build/lint, 58 test backend trên `BMS_Test` và 4 ca Playwright Edge với API mô phỏng.
- UC23 hiển thị mã đặt sân, nguồn yêu cầu, số tiền gợi ý và trần hoàn còn lại. Owner ghi nhận sau khi chuyển khoản ngoài hệ thống. MSG70/71 hiện dưới ô tương ứng. Sau khi lưu, MSG72 kèm mã đặt sân và lịch sử hiển thị ngày thanh toán gốc để đối chiếu.
- UC23 qua build/lint và 58 test backend trên `BMS_Test`, gồm phân quyền, giới hạn cộng dồn và phản hồi của form.

## Tự kiểm UC23

1. Owner chọn địa điểm và mở Hoàn tiền. Kiểm yêu cầu tạo từ booking bị ảnh hưởng và yêu cầu từ khiếu nại đã duyệt, nếu môi trường có dữ liệu F8. Đối chiếu mã đặt sân, nguồn, số tiền gợi ý và số tiền còn có thể hoàn.
2. Nhập số tiền vượt trần để kiểm MSG70. Nhập số tiền khác gợi ý và để trống lý do để kiểm MSG71. Thử ngày trước ngày thanh toán hoặc sau hôm nay để kiểm MSG02 dưới ô ngày.
3. Sau khi đã chuyển tiền ngoài hệ thống, nhập dữ liệu và xác nhận. Kiểm MSG72, tab Đã hoàn, ngày thanh toán gốc, ngày hoàn thực tế, số tiền, lý do và ghi chú. Đổi sang địa điểm khác để kiểm phạm vi danh sách.
4. Mở ví Player và đối chiếu lượt voucher, giao dịch hoàn điểm đã dùng và thu hồi điểm tích. Đối chiếu doanh thu theo ngày hoàn đối với khoản đã tính doanh thu.

## Tự kiểm UC21 và UC22

1. Mở booking đã xác nhận còn lượt và hạn. Chọn slot rẻ hơn, kiểm giá mới, số đã trả và MSG64. Đổi lựa chọn trong lúc đang tải báo giá, kiểm nút Xác nhận chỉ bật sau báo giá mới.
2. Đổi sang slot đắt hơn và đi qua thanh toán phụ thu. Trước khi Staff xác nhận, kiểm hai slot còn giữ và lịch Player vẫn là lịch cũ. Sau APPROVED, kiểm lịch mới và biên nhận. Nếu bị từ chối hoặc hết hạn, kiểm lịch cũ và slot mới được nhả.
3. Player tự hủy booking sau MSG66. Dùng booking khác để Owner hủy sân sau MSG15, rồi kiểm Player thấy ba lựa chọn trong danh sách và chi tiết. Chọn hoàn tiền, kiểm MSG69 và yêu cầu trong tab Hoàn tiền của Owner.

## Tự kiểm UC25 và UC26

1. Owner chọn một địa điểm, tìm Player theo tên hoặc username và chọn booking của người đó. Nhập số điểm dương và lý do. Thử đổi địa điểm, tìm người chưa có booking ở đó và gửi form thiếu booking hoặc lý do.
2. Player mở Điểm và lịch sử để kiểm số dư và giao dịch điều chỉnh. Trong đặt nhiều buổi, nhập điểm hợp lệ rồi bấm xác nhận. Hủy hộp MSG39 để kiểm tra chưa tạo booking.
3. Owner tạo một mốc với giá trị và hạn voucher, thử tạo lại cùng ngưỡng để thấy lỗi dưới ô Mốc chi tiêu, rồi sửa hạn dùng và kiểm MSG03. Thanh toán đã xác nhận làm Player vượt mốc sẽ cấp voucher trong ví.

## Tự kiểm UC24

1. Đăng nhập Owner, chọn địa điểm, mở Ưu đãi và điểm. Tạo và công bố một voucher giảm 20.000đ. Kiểm form lưu được mà không cần cấu hình kết hợp điểm.
2. Đăng nhập Player có ít nhất 101 điểm, áp voucher vào booking 120.000đ. Nhập 100 điểm để giảm 50.000đ trên 100.000đ sau voucher, còn 50.000đ. Nhập 101 điểm để thấy MSG38 và xác nhận bị chặn. Bỏ voucher để kiểm trần 50% trên giá niêm yết.
3. Kiểm tra lượt và ngân sách sau thao tác Áp rồi sau Xác nhận tạo booking. Thử một đơn trong ngày và một gói nhiều buổi để kiểm tra trần áp dụng trên toàn đơn. Đăng nhập Admin, vô hiệu voucher đã công bố và thử áp lại.

## Tự kiểm F1

1. Mở đăng ký. Tên dài 5 hoặc 33 ký tự phải báo lỗi dưới ô và chưa gửi OTP. Tên dài 6 hoặc 32 ký tự hợp lệ có thể sang bước OTP nếu thông tin còn lại hợp lệ.
2. Nhập sai OTP 4 lần và kiểm tra số lượt còn lại. Lần thứ 5 làm mã hết hiệu lực. Gửi lại trong hạn hồ sơ chờ rồi xác minh bằng mã mới.
3. Đăng nhập bằng tên hợp lệ vừa tạo và thử tài khoản cũ có tên ngắn hơn 6 ký tự, nếu môi trường có dữ liệu này.
4. Đăng nhập Owner, chọn địa điểm đang hoạt động và tạo Staff có tên 32 ký tự với họ tên và mật khẩu ban đầu. Đăng nhập bằng tài khoản Staff đó và kiểm tra trang Bảng điều hành.

## Checklist liên luồng trên môi trường tích hợp

Chuẩn bị Player có điểm và voucher dùng được, Owner của địa điểm hoạt động, Staff cùng địa điểm, Admin và ít nhất ba booking đã thanh toán còn trước giờ chơi. Dùng chứng từ thử và cơ sở dữ liệu kiểm thử.

- [ ] Đăng nhập bằng Player, Owner và Admin. Kiểm tra trang chủ, menu và quyền truy cập URL của vai trò khác.
- [ ] Owner tạo và công bố voucher giảm 20.000đ. Player áp vào đơn 120.000đ và nhập 100 điểm. Tổng là 50.000đ. Thử 101 điểm để thấy MSG38. Kiểm tra lượt và ngân sách trước khi tạo đơn, sau khi tạo thành công và khi tạo thất bại.
- [ ] Player đổi lịch sang slot đắt hơn, gửi ảnh chứng từ phụ thu. Kiểm lịch cũ vẫn hiển thị và hai slot còn giữ trong khi chờ. Staff xác nhận. Kiểm slot mới, biên nhận và slot cũ được nhả.
- [ ] Player tự hủy sau MSG66. Kiểm tiền, điểm và voucher của booking này không được trả. Owner hủy một booking khác sau MSG15. Player chọn hoàn sau khi thấy ba phương án, kiểm MSG69. Owner ghi nhận và đối chiếu ngày thanh toán gốc. Player kiểm hoàn điểm, thu hồi điểm tích và voucher dùng lại được.
- [ ] Owner cấu hình mốc chi tiêu. Xác nhận một thanh toán thử làm Player vượt mốc rồi kiểm giá trị, hạn dùng trong ví. Admin vô hiệu hóa một voucher đã công bố và Player thử áp lại mã.
- [ ] Nếu có dữ liệu F8, mở khiếu nại đã duyệt có yêu cầu hoàn, kiểm liên kết đến đúng yêu cầu và phạm vi địa điểm.

## Giai đoạn 3 · 13/11/2026

- Playwright Edge qua 5/5 luồng nêu trong checklist với API mô phỏng. File `frontend/e2e/f1-f6-f5.spec.js` được giữ local theo quy ước của repo. Chạy từ `frontend/` với PowerShell:

  ```powershell
  $env:PLAYWRIGHT_CHANNEL = 'msedge'
  npx --no-install playwright test f1-f6-f5.spec.js --workers=1
  ```

- Kiểm thử trình duyệt trên backend thật, SMTP và đối chiếu khoản chuyển thực tế vẫn cần môi trường tích hợp có dữ liệu thử. Backend UC23 đã được kiểm riêng trên SQL Server `BMS_Test`. Kỳ thanh toán gốc trong UC23 hiển thị bằng ngày thanh toán gốc theo quyết định đã chốt.

## Đối chiếu quyết định nghiệp vụ · 13/11/2026

- D154/D161 và BR41 áp trần điểm 50% cho booking lẻ, đơn trong ngày và gói. Checkout tính trên tiền sau voucher khi có voucher. Hai cột policy cũ được giữ trong schema để tương thích với dữ liệu hiện có. Giá trị của chúng không tham gia tính điểm. Voucher Write/Response giữ hai trường cũ ở giá trị cố định để tương thích với client trước UC24; Voucher Check trả số tiền giảm.
- FR07 theo ghi chú Leader ngày 24/10 trong `CLAUDE.md` bỏ số điện thoại khỏi form và hợp đồng tạo Staff. Tài khoản Staff mới lưu phone NULL. Dữ liệu Staff đã tạo được giữ.
- D159 thống nhất nhãn Sân hủy. Mã `CANCELLED_BY_FACILITY` dùng trong API và DB.
- D136 giữ năm lần nhập sai OTP theo xác nhận trực tiếp. D142 khớp với kiểm quyền OWNER của API hủy sân. D162–D164 đã có trong code hiện tại, gồm giới hạn gói ba tháng, ít nhất hai ngày và giữ chỗ 10 phút với đặt lẻ online, 5 phút tại quầy.
- Sau đối chiếu, Maven qua 439/439 trên `BMS_Test`, frontend build/lint qua và Playwright Edge qua 5/5 với API mô phỏng. D161, D159 và thay đổi tạo Staff không thêm migration.
- Đặc tả Report-3 cần người phụ trách cập nhật nếu bản đang dùng còn cấu hình điểm theo từng voucher hoặc yêu cầu SĐT Staff.
