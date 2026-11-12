# Checklist kiểm thử thủ công F1

Dùng môi trường test có SMTP nhận được mã, 4 vai trò, Owner quản lý 2 địa điểm ACTIVE và 1 địa điểm LOCKED, cùng ít nhất 1 Staff tại mỗi địa điểm ACTIVE. Dùng email và SĐT mới cho mỗi lượt đăng ký. Ghi trạng thái trước và sau từng bước trong Network và giao diện.

| Giao dịch | Thao tác | Kết quả mong đợi |
|---|---|---|
| UC01 #1 | Mở Đăng ký từ trang công khai | Thấy đủ username, họ tên, email, SĐT và mật khẩu. |
| UC01 #2 | Bỏ trống từng ô, thử username 3/4/20/21 ký tự, họ tên có số, SĐT sai định dạng, mật khẩu thiếu chữ hoặc số hay có khoảng trắng. Sau đó thử trùng từng định danh | MSG01/MSG02 dưới ô. Email trùng có MSG09, username/SĐT trùng có MSG112. Chưa sang bước OTP nếu dữ liệu sai. |
| UC01 #3 | Đăng ký dữ liệu mới rồi đóng hộp MSG08 | Hộp ghi đúng email và hạn 10 phút. Bước OTP tự mở. Thử đăng nhập trước xác thực và kiểm tra chưa có tài khoản Player. |
| UC01 #4 | Nhập sai OTP, thử đến lần thứ 5, thử mã hết hạn và OTP hợp lệ ở lượt mới | Mã sai báo số lượt còn lại qua MSG95. Mã bị hủy có MSG96 và có thể xin mã mới trong hạn đăng ký. Quá 10 phút quay lại Đăng ký. OTP đúng tạo Player, hiện MSG94 rồi có thể đăng nhập. |
| UC01 #5 | Bấm gửi lại trước/sau 60 giây. Kiểm tra mã cũ, giới hạn 5 lượt/giờ và 10 lượt/ngày | Trong cooldown nút bị chặn. Mã mới vô hiệu hóa mã cũ, giữ hạn đăng ký ban đầu. MSG107 dưới nút có thời gian thử lại. |
| UC02 #1 | Đăng nhập Player bằng cả username và email. Đăng nhập Staff bằng username. Thử bỏ trống, sai mật khẩu, tài khoản khóa/vô hiệu hóa | Hai kiểu định danh hợp lệ đăng nhập được. MSG01/02, MSG10 và MSG11 đúng ngữ cảnh. |
| UC02 #2 | Đăng nhập lần lượt Player, Staff, Owner và Admin. Thử returnTo có quyền và khác vai trò. Owner chọn địa điểm khóa | Đến trang mặc định đúng hoặc trang đích được phép. Owner thấy danh sách địa điểm. Địa điểm khóa hiển thị MSG102 và chỉ tải dữ liệu trong hạn. |
| UC02 #3 | Đăng xuất từ trang công khai và workspace, thử dùng lại phiên cũ trong môi trường test | Trở về trang công khai. Token và địa điểm chọn được xóa. API bảo vệ từ chối phiên cũ. |
| UC02 #4 | Cho token hết hạn lúc đang xem trang hoặc mở lại URL bảo vệ bằng phiên đã hết hạn | Về Đăng nhập và thấy hộp MSG06. Sau khi đăng nhập có thể quay lại đích còn quyền. |
| UC02 #5 | Quên mật khẩu với email hợp lệ, không tồn tại và sai định dạng | Email sai báo dưới ô. Email hợp lệ đều nhận MSG97 chung. Chỉ hộp thư tài khoản đủ điều kiện nhận OTP. |
| UC02 #6 | Thử OTP sai, hết hạn và đúng. Thử mật khẩu yếu và xác nhận không khớp | MSG95/96 đúng nhánh. DR23 và ô xác nhận được kiểm. MSG98 khi thành công. Đăng nhập được bằng mật khẩu mới, mật khẩu cũ bị từ chối. |
| UC02 #7 | Player/Owner đổi mật khẩu. Thử mật khẩu hiện tại sai, mật khẩu mới sai DR23, rồi hợp lệ | MSG113 dưới ô mật khẩu hiện tại. Thành công về Đăng nhập với MSG114. Staff và Admin bị chặn ở màn đổi mật khẩu. |
| UC03 #1 | Player mở Tài khoản của tôi | Thấy hồ sơ và trình độ đã lưu. Username, email, SĐT chỉ đọc. |
| UC03 #2 | Nhập họ tên không hợp lệ, rồi lưu họ tên mới và tải lại | MSG01/02 đúng ô. Tên hợp lệ lưu qua MSG03 và còn sau tải lại. |
| UC03 #3 | Chọn trình độ và lưu riêng, tải lại | Trình độ mới còn sau tải lại. Họ tên giữ nguyên. Có MSG03. |
| UC04 #1 | Owner chọn địa điểm A, tạo Staff, rồi chuyển sang B. Thử tên đăng nhập/SĐT trùng | Staff mới chỉ ở A. Có MSG12 kèm tên và MSG112 dưới ô khi trùng. Tài khoản đăng nhập bằng username. |
| UC04 #2 | Hủy hộp xác nhận vô hiệu hóa, sau đó xác nhận | MSG13 có tên. Hủy giữ trạng thái. Xác nhận chuyển DISABLED và phiên Staff cũ bị thu hồi. |
| UC04 #3 | Admin lọc vai trò/trạng thái, tìm theo SĐT, mở chi tiết, kiểm ngày tạo và lịch sử đăng nhập. Khóa Player/Staff/Owner | Danh sách đủ cột. MSG13 có tên. Xác nhận chuyển LOCKED, có nhật ký, phiên cũ bị thu hồi. |
| UC04 #4 | Admin mở khóa tài khoản LOCKED, thử với tài khoản DISABLED | Có MSG14 kèm tên khi thành công. Tài khoản đã mở khóa đăng nhập bằng phiên mới. Tài khoản DISABLED không có nút mở khóa. |
| UC04 #5 | Guest, Player, Staff, Owner, Admin mở URL F1 bằng thanh địa chỉ | Guest về Đăng nhập. Vai trò sai thấy MSG05 và không thấy dữ liệu trang. Owner chỉ thao tác Staff tại địa điểm đang chọn. |
| UC04 #6 | Owner cấp lại mật khẩu Staff cùng địa điểm. Thử mật khẩu sai DR23 và đúng. Thử Staff LOCKED | Lỗi đúng ô. Mật khẩu mới được dùng sau khi tài khoản đủ điều kiện đăng nhập. Cấp lại không tự mở khóa. Staff không có màn tự cấp lại. |

## Chạy Playwright

Tại thư mục frontend, chạy `npm ci`, `npx playwright install chromium` và `npm run test:e2e:f1`. Có thể đặt biến `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge đã cài. Bộ test chạy trên trình duyệt với API được giả lập để kiểm thứ tự thao tác, request và trạng thái FE. Dùng checklist với backend và hộp thư test để xác nhận tạo tài khoản, lưu mật khẩu và thu hồi phiên trên hệ thống thật.
