# Checklist kiểm thử thủ công F1, F3 và F4

Dùng môi trường test có hộp thư nhận OTP, hai địa điểm đang hoạt động, một địa điểm ngừng hoạt động, sân có giờ và bảng giá, cùng tài khoản Player, Staff, Owner và Admin. Chuẩn bị hai cửa sổ hoặc hồ sơ trình duyệt để giữ riêng phiên Player và Staff. Chọn ngày có sân trống, dùng giao dịch và ảnh chứng từ mẫu trong môi trường test.

## F1 · Tài khoản

Chạy từng giao dịch trong [checklist F1](./F1_MANUAL_CHECKLIST.md). Kiểm thêm hai điểm khi nối sang F3 và F4.

- Guest chọn slot và đi đến Đăng nhập. Sau đăng nhập bằng Player, lịch trở lại đúng ngày và giữ các slot vẫn còn trống. Đăng nhập bằng vai trò khác đi đến trang mặc định của vai trò đó.
- Trong Network, kiểm Authorization trên API bảo vệ. Với Owner, kiểm X-Location-Id khi đổi địa điểm. Cho phiên hết hạn khi đang mở màn bảo vệ và kiểm trang đăng nhập cùng thông báo MSG06.

## F3 · Tìm sân và đặt sân

| UC | Thao tác | Kết quả mong đợi |
|---|---|---|
| UC11 | Tìm theo tên, rồi theo địa chỉ. Mở một ghim. Cho phép vị trí, sau đó thử với quyền bị từ chối. | Chỉ địa điểm đang hoạt động xuất hiện. Ghim hiện tên và địa chỉ. Khi có vị trí, danh sách xếp gần trước, địa điểm thiếu tọa độ ở cuối. Khi từ chối, tìm kiếm vẫn dùng được. API tìm kiếm chỉ nhận từ khóa. |
| UC12 | Mở chi tiết bằng Guest. Đối chiếu sân, giờ mở cửa, bảng giá theo khung giờ và các trang đánh giá. | Xem được qua API công khai, không cần token. Chỉ thấy đánh giá đang hiển thị. Thử địa điểm không có đánh giá, rồi chặn API đánh giá để kiểm thông báo lỗi và nút tải lại. |
| UC13 | Mở lịch hôm nay, chuyển ngày bằng cả nút và ô ngày. So sánh cùng slot đã đặt bằng Guest, Player, Staff cùng địa điểm và Owner cùng địa điểm. | Mỗi sân là một hàng, mỗi slot 30 phút là một cột. Ô hiển thị trạng thái và giá khi có giá. Ngày chọn nằm trong giới hạn API trả về. Chỉ quản lý đủ quyền thấy tên, SĐT và ghi chú. Guest chọn slot trống rồi bấm tiếp tục thấy MSG07. |
| UC14 | Player chọn hai slot liền nhau trên một sân, rồi thử slot rời hoặc nhiều sân cùng ngày. Thử đặt cá nhân và đội mình làm chủ, voucher lỗi, điểm dưới mức và ghi chú quá dài. | Một dải đi qua API booking lẻ, nhiều dải đi qua API đơn ngày. Giá, giảm trừ và thông báo đúng trường. Xác nhận thành công đi đến đúng bookingId hoặc packageId với hạn giữ 10 phút. |
| UC14 | Hai phiên cùng xác nhận một slot, hoặc thay bảng giá khi Player đang xem tóm tắt. | Phiên đến sau thấy lỗi hoặc giá mới. FE cập nhật preview và không tự đặt lại với giá thay đổi. |
| UC15 | Đặt gói định kỳ với giờ khác nhau theo thứ, rồi thử gói tự chọn ngày và sân. Tạo buổi xung đột, chọn slot bù và thử bỏ buổi trùng còn dưới hai ngày. | Preview khớp danh sách buổi. Buổi xung đột được nêu rõ. Dưới hai ngày có MSG92. Gói hợp lệ chuyển đến đúng packageId và đếm theo hạn giữ 15 phút. |
| UC16 | Staff mở Đặt sân tại quầy, chọn sân/ngày/slot. Thử SĐT trống, họ tên sai và slot vừa bị giữ bởi phiên khác. | Lỗi dưới trường liên quan. Chỉ chọn được slot trống trong giới hạn đặt trước. MSG28 yêu cầu chọn lại slot. Booking tạo thành công có mã, số tiền và đồng hồ 5 phút. |
| UC16 | Xác nhận đã nhận tiền trước hạn ở một booking. Để một booking khác hết hạn. | Booking thứ nhất Đã xác nhận và có biên nhận. Booking thứ hai hiện MSG33, ẩn nút xác nhận và slot được nhả. |
| UC17 | Mở lịch sử có booking lẻ và gói. Lọc từng trạng thái và mở chi tiết. | Booking chờ xử lý xếp đầu. Lọc đúng trạng thái. Chi tiết có địa điểm, sân/ngày/giờ, tiền, trạng thái, ghi chú và biên nhận nếu có. |
| UC17 → UC18 | Từ lịch sử thử Tiếp tục thanh toán và Gửi lại chứng từ trước hạn, rồi để thời hạn về 0 khi modal đang mở. | Hai nút mở đúng giao dịch. Khi hết hạn, nút biến mất. Yêu cầu bổ sung cuối vẫn mở được nếu backend còn trả yêu cầu và hạn hợp lệ. |

## F4 · Thanh toán, xác nhận và đối soát

| UC | Thao tác | Kết quả mong đợi |
|---|---|---|
| UC18 | Mở booking đang giữ. Thử địa điểm có QR thật, chưa tải QR hoặc ảnh trả lỗi. | Thấy số tiền, tài khoản, mã chuyển khoản và thời gian còn lại. Chỉ tải được QR khi có ảnh thật. Khi thiếu ảnh, dùng thông tin chuyển khoản. |
| UC18 | Bấm Báo đã thanh toán khi thiếu ảnh. Chọn ảnh hợp lệ rồi thay bằng tệp sai định dạng hoặc quá 5 MB. Sau đó gửi JPG/PNG hợp lệ. | MSG106 hoặc MSG02 dưới ô ảnh. Tệp cũ được bỏ khi tệp mới không hợp lệ. Gửi multipart có part proof, hiện MSG48 và Chờ xác nhận. |
| UC19 → UC18/17 | Staff mở giao dịch, kiểm ảnh, ghi chú và tiền rồi xác nhận. Giữ màn Player đang mở. Thử giao dịch khác chuyển thừa. | Staff thấy MSG53 trước khi gửi và MSG46 kèm biên nhận sau khi thành công. Player tự thấy đã xác nhận và biên nhận. Khi chuyển thừa, ghi nhận số thực nhận và Owner nhận thông báo MSG55. |
| UC19 | Chuyển từ giao dịch A đang mở sang B khi request chi tiết B lỗi. Sau đó dùng hai phiên Staff cùng mở A và thử xác nhận lần lượt. | Không thấy ảnh, chi tiết hoặc nút xử lý của A dưới B. Phiên thao tác sau khi A đã xử lý thấy MSG54 và hàng chờ được tải lại. |
| UC19 → UC18 | Yêu cầu bổ sung với ảnh mờ, rồi thử lỗi thiết bị hoặc ngân hàng trễ. Thử khách đã chuyển thiếu và thử hết hạn bổ sung. | Chỉ lý do do Player làm giảm lượt. Staff thấy hạn và số lượt API trả về. Player thấy lý do, phần tiền còn thiếu nếu có và gửi lại đúng paymentId. Hết hạn hiện MSG52 và không còn nút gửi. |
| UC19 | Từ chối sau khi chọn lý do. | Player thấy lý do, trạng thái từ chối và MSG51. Giao dịch biến mất khỏi hàng chờ. |
| UC20 | Staff mở Đối soát cuối ngày. Đổi ngày nhanh, thử ngày không có dữ liệu, nhập ngân hàng 75.500 và tiền mặt 24.500 bằng chữ số 75500/24500. | Số liệu thuộc đúng ngày đang chọn. Form cộng thành 100.000, chấp nhận tiền nguyên không theo bước 1.000. Network chỉ gửi date, actualAmount và reason. |
| UC20 | Tạo chênh lệch và lưu thiếu lý do, rồi lưu với lý do hợp lệ. Mở lại đúng ngày và thử bằng Staff thứ hai. | MSG59 kèm chênh lệch nằm dưới lý do. Thành công có MSG60 và chỉ còn kết quả đã lưu. Hai phiên không thể lưu trùng ngày. |
| UC20 | Owner mở Báo cáo → Đối soát doanh thu, lọc khoảng ngày và thử địa điểm khác. Player hoặc Staff mở URL Owner trực tiếp. | Owner chỉ thấy kết quả của địa điểm đang chọn, có trạng thái tải/lỗi/rỗng và phân trang. Vai trò khác bị chặn trước khi gọi API Owner. |

## Chạy bộ trình duyệt

Trong thư mục frontend, chạy:

```sh
npm ci
npx playwright install chromium
npx playwright test
```

Có thể đặt PLAYWRIGHT_CHANNEL=msedge để dùng Edge đã cài. Bài booking-lifecycle.spec.js dùng fixture HTTP có trạng thái để nối bốn bước đăng ký → đặt sân → xác nhận → yêu cầu bổ sung và gửi lại. Bài Guest kiểm đường từ địa điểm đến yêu cầu đăng nhập. Checklist ở trên dùng backend và SMTP test để kiểm hợp đồng thực, gửi mail, ảnh QR và dữ liệu lưu.

Để kiểm nền bản đồ, đặt VITE_LOCATION_MAP_TILE_URL với mẫu {z}/{x}/{y} của nhà cung cấp được cấu hình cho dự án và VITE_LOCATION_MAP_ATTRIBUTION theo điều khoản của nguồn bản đồ.
