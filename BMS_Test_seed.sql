-- ============================================================
-- BMS_Test - DỮ LIỆU MẪU (fake) để viết và thử API. Sinh tự động, tuân theo toàn bộ ràng buộc của BMS_database.sql.
-- Chạy trong SSMS (database BMS_Test đã có 35 bảng, đang trống) hoặc:
--   sqlcmd -S HOANGQUACH\Quack -U sa -P <mat_khau> -C -b -f 65001 -i BMS_Test_seed.sql
-- Nếu bảng account đã có dữ liệu thì script dừng, không sửa gì. Muốn nạp lại: xóa dữ liệu (hoặc tạo lại BMS_Test) rồi chạy lại.
-- Tài khoản mẫu (mật khẩu chung: 123456):
--   admin | owner.sunrise, owner.thanglong | staff.sunrise1, staff.sunrise2, staff.thanglong1
--   player: nguyen.an, tran.binh, le.cuong, pham.dung, hoang.em, vu.phuc, dang.giang, bui.hieu (locked.user bị khóa)
-- Ngày giờ tính theo ngày chạy script (hôm nay = ngày chạy): booking quá khứ/tương lai lệch theo đó.
-- ============================================================
USE BMS_Test;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.account)
BEGIN
    RAISERROR(N'BMS_Test đã có dữ liệu. Script dừng, không sửa gì.', 16, 1);
    RETURN;
END;
DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
BEGIN TRANSACTION;

-- account (12)
SET IDENTITY_INSERT account ON;
INSERT INTO account (id, username, email, phone, password_hash, full_name, role, skill_level, location_id, status) VALUES
  (1, N'admin', N'admin@bms.vn', NULL, N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Quản trị hệ thống', N'ADMIN', NULL, NULL, N'ACTIVE'),
  (2, N'owner.sunrise', N'owner.sunrise@bms.vn', N'0901000001', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Nguyễn Minh Khôi', N'OWNER', NULL, NULL, N'ACTIVE'),
  (3, N'owner.thanglong', N'owner.thanglong@bms.vn', N'0901000002', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Trần Thu Hà', N'OWNER', NULL, NULL, N'ACTIVE'),
  (7, N'nguyen.an', N'an.nguyen@gmail.com', N'0912000007', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Nguyễn Văn An', N'PLAYER', N'Khá', NULL, N'ACTIVE'),
  (8, N'tran.binh', N'binh.tran@gmail.com', N'0912000008', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Trần Thị Bình', N'PLAYER', N'Trung bình', NULL, N'ACTIVE'),
  (9, N'le.cuong', N'cuong.le@gmail.com', N'0912000009', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Lê Quốc Cường', N'PLAYER', N'Mới chơi', NULL, N'ACTIVE'),
  (10, N'pham.dung', N'dung.pham@gmail.com', N'0912000010', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Phạm Tiến Dũng', N'PLAYER', N'Khá', NULL, N'ACTIVE'),
  (11, N'hoang.em', N'em.hoang@gmail.com', N'0912000011', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Hoàng Thị Em', N'PLAYER', N'Trung bình', NULL, N'ACTIVE'),
  (12, N'vu.phuc', N'phuc.vu@gmail.com', N'0912000012', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Vũ Hồng Phúc', N'PLAYER', N'Mới chơi', NULL, N'ACTIVE'),
  (13, N'dang.giang', N'giang.dang@gmail.com', N'0912000013', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Đặng Minh Giang', N'PLAYER', N'Giỏi', NULL, N'ACTIVE'),
  (14, N'bui.hieu', N'hieu.bui@gmail.com', N'0912000014', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Bùi Trung Hiếu', N'PLAYER', N'Trung bình', NULL, N'ACTIVE'),
  (15, N'locked.user', N'locked.user@gmail.com', N'0912000015', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Tài khoản bị khóa', N'PLAYER', NULL, NULL, N'LOCKED');
SET IDENTITY_INSERT account OFF;

-- location (2)
SET IDENTITY_INSERT location ON;
INSERT INTO location (id, owner_id, name, address, latitude, longitude, contact_phone, bank_name, bank_account_no, bank_account_holder, qr_image_path, advance_booking_days, point_earning_rate, status) VALUES
  (1, 2, N'Cầu lông Sunrise', N'12 Nguyễn Trãi, Thanh Xuân, Hà Nội', 20.99412, 105.80731, N'0243100001', N'Vietcombank', N'0011001234567', N'NGUYEN MINH KHOI', N'uploads/qr/location_1.png', 30, 10000, N'ACTIVE'),
  (2, 3, N'Cầu lông Thăng Long', N'88 Cầu Giấy, Cầu Giấy, Hà Nội', 21.0333, 105.7978, N'0243100002', N'Techcombank', N'19031234567890', N'TRAN THU HA', N'uploads/qr/location_2.png', 14, 10000, N'ACTIVE');
SET IDENTITY_INSERT location OFF;

-- account (3)
SET IDENTITY_INSERT account ON;
INSERT INTO account (id, username, email, phone, password_hash, full_name, role, skill_level, location_id, status) VALUES
  (4, N'staff.sunrise1', NULL, N'0902000004', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Lê Thị Lan', N'STAFF', NULL, 1, N'ACTIVE'),
  (5, N'staff.sunrise2', NULL, N'0902000005', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Phạm Văn Long', N'STAFF', NULL, 1, N'ACTIVE'),
  (6, N'staff.thanglong1', NULL, N'0902000006', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', N'Ngô Thị Mai', N'STAFF', NULL, 2, N'ACTIVE');
SET IDENTITY_INSERT account OFF;

-- service_registration (4)
SET IDENTITY_INSERT service_registration ON;
INSERT INTO service_registration (id, requester_id, location_name, address, latitude, longitude, court_count, contact_name, contact_phone, contact_email, status, reject_reason, processed_by, processed_at, location_id) VALUES
  (1, 2, N'Cầu lông Sunrise', N'12 Nguyễn Trãi, Thanh Xuân, Hà Nội', 20.99412, 105.80731, 4, N'Nguyễn Minh Khôi', N'0901000001', N'owner.sunrise@bms.vn', N'APPROVED', NULL, 1, DATEADD(MINUTE,0,CAST(DATEADD(DAY,-121,@today) AS DATETIME2(0))), 1),
  (2, 3, N'Cầu lông Thăng Long', N'88 Cầu Giấy, Cầu Giấy, Hà Nội', 21.0333, 105.7978, 3, N'Trần Thu Hà', N'0901000002', N'owner.thanglong@bms.vn', N'APPROVED', NULL, 1, DATEADD(MINUTE,0,CAST(DATEADD(DAY,-61,@today) AS DATETIME2(0))), 2),
  (3, NULL, N'Cầu lông Bình Minh', N'5 Lê Văn Lương, Hà Nội', 21.007, 105.8, 6, N'Đỗ Văn Nam', N'0933444555', N'nam.do@gmail.com', N'PENDING', NULL, NULL, NULL, NULL),
  (4, 7, N'Sân cầu lông Hoa Sữa', N'30 Láng Hạ, Hà Nội', 21.015, 105.812, 2, N'Nguyễn Văn An', N'0912000007', N'an.nguyen@gmail.com', N'REJECTED', N'Thiếu giấy phép kinh doanh', 1, DATEADD(MINUTE,0,CAST(DATEADD(DAY,-10,@today) AS DATETIME2(0))), NULL);
SET IDENTITY_INSERT service_registration OFF;

INSERT INTO service_term (location_id, start_date, end_date, recorded_by) VALUES
  (1, DATEADD(DAY,-120,@today), DATEADD(DAY,-1,DATEADD(MONTH,12,DATEADD(DAY,-120,@today))), 1),
  (2, DATEADD(DAY,-60,@today),  DATEADD(DAY,-1,DATEADD(MONTH,12,DATEADD(DAY,-60,@today))), 1);

-- court (7)
SET IDENTITY_INSERT court ON;
INSERT INTO court (id, location_id, name, description, is_active) VALUES
  (1, 1, N'Sân 1', N'Sân thảm PVC tiêu chuẩn thi đấu', 1),
  (2, 1, N'Sân 2', N'Sân thảm PVC', 1),
  (3, 1, N'Sân 3', N'Sân có điều hòa', 1),
  (4, 1, N'Sân 4', N'Sân luyện tập', 1),
  (5, 2, N'Sân A', N'Sân thảm PVC', 1),
  (6, 2, N'Sân B', N'Sân thảm PVC', 1),
  (7, 2, N'Sân C', N'Sân VIP', 1);
SET IDENTITY_INSERT court OFF;

-- opening_hour (13)
SET IDENTITY_INSERT opening_hour ON;
INSERT INTO opening_hour (id, location_id, day_of_week, open_minute, close_minute) VALUES
  (1, 1, 1, 360, 1320),
  (2, 1, 2, 360, 1320),
  (3, 1, 3, 360, 1320),
  (4, 1, 4, 360, 1320),
  (5, 1, 5, 360, 1320),
  (6, 1, 6, 360, 1320),
  (7, 1, 7, 360, 1320),
  (8, 2, 1, 360, 1260),
  (9, 2, 2, 360, 1260),
  (10, 2, 3, 360, 1260),
  (11, 2, 4, 360, 1260),
  (12, 2, 5, 360, 1260),
  (13, 2, 6, 360, 1260);
SET IDENTITY_INSERT opening_hour OFF;

-- opening_exception (2)
SET IDENTITY_INSERT opening_exception ON;
INSERT INTO opening_exception (id, location_id, exception_date, open_minute, close_minute, note) VALUES
  (1, 1, DATEADD(DAY,20,@today), 480, 1080, N'Ngày lễ: mở cửa muộn, đóng sớm'),
  (2, 2, DATEADD(DAY,10,@today), 480, 1200, N'Mở cửa Chủ nhật đặc biệt');
SET IDENTITY_INSERT opening_exception OFF;

-- price_rule (14)
SET IDENTITY_INSERT price_rule ON;
INSERT INTO price_rule (id, court_id, apply_days, start_minute, end_minute, price_per_slot, valid_from, valid_to) VALUES
  (1, 1, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (2, 1, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (3, 2, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (4, 2, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (5, 3, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (6, 3, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (7, 4, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (8, 4, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (9, 5, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (10, 5, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (11, 6, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (12, 6, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL),
  (13, 7, N'1111111', 360, 960, 40000, DATEADD(DAY,-90,@today), NULL),
  (14, 7, N'1111111', 960, 1320, 60000, DATEADD(DAY,-90,@today), NULL);
SET IDENTITY_INSERT price_rule OFF;

-- maintenance (3)
SET IDENTITY_INSERT maintenance ON;
INSERT INTO maintenance (id, court_id, start_at, end_at, reason, status, requested_by, approved_by, decided_at) VALUES
  (1, 3, DATEADD(MINUTE,480,CAST(DATEADD(DAY,6,@today) AS DATETIME2(0))), DATEADD(MINUTE,720,CAST(DATEADD(DAY,6,@today) AS DATETIME2(0))), N'Thay thảm sân và kiểm tra hệ thống đèn', N'PENDING', 4, NULL, NULL),
  (2, 2, DATEADD(MINUTE,960,CAST(DATEADD(DAY,3,@today) AS DATETIME2(0))), DATEADD(MINUTE,1320,CAST(DATEADD(DAY,3,@today) AS DATETIME2(0))), N'Sửa mặt sân bị bong tróc', N'APPROVED', 4, 2, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (3, 4, DATEADD(MINUTE,480,CAST(DATEADD(DAY,-20,@today) AS DATETIME2(0))), DATEADD(MINUTE,600,CAST(DATEADD(DAY,-20,@today) AS DATETIME2(0))), N'Bảo trì lưới', N'REJECTED', 5, 2, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-21,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT maintenance OFF;

-- voucher (7)
SET IDENTITY_INSERT voucher ON;
INSERT INTO voucher (id, location_id, code, name, source, target_group, discount_type, discount_value, min_order_amount, valid_from, valid_to, grant_valid_days, max_uses_per_player, max_total_uses, used_count, budget, budget_used, status) VALUES
  (1, 1, N'WELCOME10', N'Chào bạn mới giảm 10%', N'CAMPAIGN', N'NEW_PLAYERS', N'PERCENT', 10, 0, DATEADD(DAY,-30,@today), DATEADD(DAY,60,@today), NULL, 1, 100, 1, 2000000, 24000, N'PUBLISHED'),
  (2, 1, N'SUMMER50K', N'Giảm 50.000đ cho đơn từ 200.000đ', N'CAMPAIGN', N'ALL_PLAYERS', N'AMOUNT', 50000, 200000, DATEADD(DAY,-10,@today), DATEADD(DAY,30,@today), NULL, 2, NULL, 0, 5000000, 0, N'PUBLISHED'),
  (3, 1, NULL, N'Quà tri ân mốc 1.000.000đ', N'LOYALTY', N'SPECIFIED', N'AMOUNT', 100000, 0, NULL, NULL, 60, 1, NULL, 0, NULL, 0, N'PUBLISHED'),
  (4, 1, N'BATCH15', N'Ưu đãi gói đặt sự kiện giải mùa thu', N'BATCH_OFFER', N'ALL_PLAYERS', N'PERCENT', 15, 500000, DATEADD(DAY,-5,@today), DATEADD(DAY,30,@today), NULL, NULL, NULL, 0, NULL, 0, N'PUBLISHED'),
  (5, 2, N'OPENING20', N'Khai trương giảm 20%', N'CAMPAIGN', N'ALL_PLAYERS', N'PERCENT', 20, 0, DATEADD(DAY,5,@today), DATEADD(DAY,35,@today), NULL, 1, 200, 0, NULL, 0, N'DRAFT'),
  (6, 2, N'TL30K', N'Giảm 30.000đ', N'CAMPAIGN', N'ALL_PLAYERS', N'AMOUNT', 30000, 100000, DATEADD(DAY,-5,@today), DATEADD(DAY,25,@today), NULL, 3, NULL, 0, NULL, 0, N'PUBLISHED'),
  (7, 1, N'OLDPROMO', N'Khuyến mãi cũ (đã tắt)', N'CAMPAIGN', N'ALL_PLAYERS', N'PERCENT', 5, 0, DATEADD(DAY,-60,@today), DATEADD(DAY,-30,@today), NULL, NULL, NULL, 0, NULL, 0, N'DISABLED');
SET IDENTITY_INSERT voucher OFF;

-- batch_offer (1)
SET IDENTITY_INSERT batch_offer ON;
INSERT INTO batch_offer (id, location_id, name, start_date, end_date, min_package_amount, voucher_id) VALUES
  (1, 1, N'Giải cầu lông mùa thu', DATEADD(DAY,-5,@today), DATEADD(DAY,30,@today), 500000, 4);
SET IDENTITY_INSERT batch_offer OFF;

-- team (2)
SET IDENTITY_INSERT team ON;
INSERT INTO team (id, name, captain_id) VALUES
  (1, N'Thunder Smash', 7),
  (2, N'Phoenix BC', 11);
SET IDENTITY_INSERT team OFF;

-- booking_package (1)
SET IDENTITY_INSERT booking_package ON;
INSERT INTO booking_package (id, location_id, player_id, batch_offer_id, package_type, start_date, end_date, list_amount, voucher_discount, points_used, point_discount, final_amount, status) VALUES
  (1, 1, 7, NULL, N'RECURRING', DATEADD(DAY,-14,@today), DATEADD(DAY,14,@today), 960000, 0, 0, 0, 960000, N'CONFIRMED');
SET IDENTITY_INSERT booking_package OFF;

-- booking (25)
SET IDENTITY_INSERT booking ON;
INSERT INTO booking (id, booking_code, booking_type, location_id, court_id, player_id, team_id, package_id, staff_id, customer_name, customer_phone, play_date, start_minute, end_minute, note, list_amount, voucher_discount, points_used, point_discount, final_amount, status, hold_expires_at, cancelled_by, cancelled_at, created_at) VALUES
  (1, N'BK000001', N'SINGLE', 1, 1, 7, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-10,@today), 480, 600, NULL, 160000, 0, 0, 0, 160000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-11,@today) AS DATETIME2(0)))),
  (2, N'BK000002', N'SINGLE', 1, 2, 8, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-9,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-10,@today) AS DATETIME2(0)))),
  (3, N'BK000003', N'SINGLE', 1, 1, 9, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-8,@today), 1020, 1140, NULL, 240000, 24000, 0, 0, 216000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-9,@today) AS DATETIME2(0)))),
  (4, N'BK000004', N'SINGLE', 1, 3, 10, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-5,@today), 1200, 1320, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-6,@today) AS DATETIME2(0)))),
  (5, N'BK000005', N'SINGLE', 1, 1, 7, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-3,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-4,@today) AS DATETIME2(0)))),
  (6, N'BK000006', N'WALK_IN', 1, 4, NULL, NULL, NULL, 4, N'Trần Văn Khách', N'0987654321', DATEADD(DAY,-2,@today), 540, 660, NULL, 160000, 0, 0, 0, 160000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0)))),
  (7, N'BK000007', N'SINGLE', 1, 1, 7, 1, NULL, NULL, NULL, NULL, DATEADD(DAY,1,@today), 1080, 1200, N'Đội Thunder Smash đánh giao hữu', 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (8, N'BK000008', N'SINGLE', 1, 2, 8, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,1,@today), 1200, 1320, NULL, 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (9, N'BK000009', N'SINGLE', 1, 2, 9, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,3,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (10, N'BK000010', N'SINGLE', 1, 3, 9, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,2,@today), 540, 660, NULL, 160000, 0, 0, 0, 160000, N'AWAITING_CONFIRMATION', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (11, N'BK000011', N'SINGLE', 1, 4, 10, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,2,@today), 1080, 1140, NULL, 120000, 0, 0, 0, 120000, N'RESUBMIT_REQUESTED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (12, N'BK000012', N'SINGLE', 1, 3, 11, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,4,@today), 1020, 1080, NULL, 120000, 0, 0, 0, 120000, N'HOLDING', DATEADD(MINUTE,10,SYSDATETIME()), NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (13, N'BK000013', N'SINGLE', 1, 1, 12, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-6,@today), 720, 780, NULL, 80000, 0, 0, 0, 80000, N'PAYMENT_REJECTED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0)))),
  (14, N'BK000014', N'SINGLE', 1, 2, 11, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-4,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'CANCELLED_BY_FACILITY', NULL, 2, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-5,@today) AS DATETIME2(0))), DATEADD(MINUTE,540,CAST(DATEADD(DAY,-5,@today) AS DATETIME2(0)))),
  (15, N'BK000015', N'SINGLE', 1, 3, 12, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-7,@today), 600, 660, NULL, 80000, 0, 0, 0, 80000, N'CANCELLED_BY_PLAYER', NULL, 12, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0))), DATEADD(MINUTE,540,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0)))),
  (16, N'BK000016', N'SINGLE', 1, 4, 8, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-1,@today), 1080, 1140, NULL, 120000, 0, 0, 0, 120000, N'EXPIRED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-2,@today) AS DATETIME2(0)))),
  (17, N'BK000017', N'SINGLE', 2, 5, 13, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-6,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0)))),
  (18, N'BK000018', N'SINGLE', 2, 6, 14, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,-2,@today), 1200, 1320, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0)))),
  (19, N'BK000019', N'SINGLE', 2, 5, 13, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,2,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (20, N'BK000020', N'SINGLE', 2, 7, 14, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,0,@today), 600, 720, NULL, 160000, 0, 0, 0, 160000, N'IN_USE', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (21, N'BK000021', N'SINGLE', 1, 1, 9, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY,5,@today), 540, 660, NULL, 160000, 0, 0, 0, 160000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (22, N'BK000022', N'SESSION', 1, 1, 7, NULL, 1, NULL, NULL, NULL, DATEADD(DAY,-14,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-15,@today) AS DATETIME2(0)))),
  (23, N'BK000023', N'SESSION', 1, 1, 7, NULL, 1, NULL, NULL, NULL, DATEADD(DAY,-7,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'COMPLETED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0)))),
  (24, N'BK000024', N'SESSION', 1, 1, 7, NULL, 1, NULL, NULL, NULL, DATEADD(DAY,7,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0)))),
  (25, N'BK000025', N'SESSION', 1, 1, 7, NULL, 1, NULL, NULL, NULL, DATEADD(DAY,14,@today), 1080, 1200, NULL, 240000, 0, 0, 0, 240000, N'CONFIRMED', NULL, NULL, NULL, DATEADD(MINUTE,540,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT booking OFF;

-- booking_slot (90)
SET IDENTITY_INSERT booking_slot ON;
INSERT INTO booking_slot (id, booking_id, court_id, slot_date, slot_start_minute, price, reschedule_request_id, is_active) VALUES
  (1, 1, 1, DATEADD(DAY,-10,@today), 480, 40000, NULL, 1),
  (2, 1, 1, DATEADD(DAY,-10,@today), 510, 40000, NULL, 1),
  (3, 1, 1, DATEADD(DAY,-10,@today), 540, 40000, NULL, 1),
  (4, 1, 1, DATEADD(DAY,-10,@today), 570, 40000, NULL, 1),
  (5, 2, 2, DATEADD(DAY,-9,@today), 1080, 60000, NULL, 1),
  (6, 2, 2, DATEADD(DAY,-9,@today), 1110, 60000, NULL, 1),
  (7, 2, 2, DATEADD(DAY,-9,@today), 1140, 60000, NULL, 1),
  (8, 2, 2, DATEADD(DAY,-9,@today), 1170, 60000, NULL, 1),
  (9, 3, 1, DATEADD(DAY,-8,@today), 1020, 60000, NULL, 1),
  (10, 3, 1, DATEADD(DAY,-8,@today), 1050, 60000, NULL, 1),
  (11, 3, 1, DATEADD(DAY,-8,@today), 1080, 60000, NULL, 1),
  (12, 3, 1, DATEADD(DAY,-8,@today), 1110, 60000, NULL, 1),
  (13, 4, 3, DATEADD(DAY,-5,@today), 1200, 60000, NULL, 1),
  (14, 4, 3, DATEADD(DAY,-5,@today), 1230, 60000, NULL, 1),
  (15, 4, 3, DATEADD(DAY,-5,@today), 1260, 60000, NULL, 1),
  (16, 4, 3, DATEADD(DAY,-5,@today), 1290, 60000, NULL, 1),
  (17, 5, 1, DATEADD(DAY,-3,@today), 1080, 60000, NULL, 1),
  (18, 5, 1, DATEADD(DAY,-3,@today), 1110, 60000, NULL, 1),
  (19, 5, 1, DATEADD(DAY,-3,@today), 1140, 60000, NULL, 1),
  (20, 5, 1, DATEADD(DAY,-3,@today), 1170, 60000, NULL, 1),
  (21, 6, 4, DATEADD(DAY,-2,@today), 540, 40000, NULL, 1),
  (22, 6, 4, DATEADD(DAY,-2,@today), 570, 40000, NULL, 1),
  (23, 6, 4, DATEADD(DAY,-2,@today), 600, 40000, NULL, 1),
  (24, 6, 4, DATEADD(DAY,-2,@today), 630, 40000, NULL, 1),
  (25, 7, 1, DATEADD(DAY,1,@today), 1080, 60000, NULL, 1),
  (26, 7, 1, DATEADD(DAY,1,@today), 1110, 60000, NULL, 1),
  (27, 7, 1, DATEADD(DAY,1,@today), 1140, 60000, NULL, 1),
  (28, 7, 1, DATEADD(DAY,1,@today), 1170, 60000, NULL, 1),
  (29, 8, 2, DATEADD(DAY,1,@today), 1200, 60000, NULL, 1),
  (30, 8, 2, DATEADD(DAY,1,@today), 1230, 60000, NULL, 1),
  (31, 8, 2, DATEADD(DAY,1,@today), 1260, 60000, NULL, 1),
  (32, 8, 2, DATEADD(DAY,1,@today), 1290, 60000, NULL, 1),
  (33, 9, 2, DATEADD(DAY,3,@today), 1080, 60000, NULL, 1),
  (34, 9, 2, DATEADD(DAY,3,@today), 1110, 60000, NULL, 1),
  (35, 9, 2, DATEADD(DAY,3,@today), 1140, 60000, NULL, 1),
  (36, 9, 2, DATEADD(DAY,3,@today), 1170, 60000, NULL, 1),
  (37, 10, 3, DATEADD(DAY,2,@today), 540, 40000, NULL, 1),
  (38, 10, 3, DATEADD(DAY,2,@today), 570, 40000, NULL, 1),
  (39, 10, 3, DATEADD(DAY,2,@today), 600, 40000, NULL, 1),
  (40, 10, 3, DATEADD(DAY,2,@today), 630, 40000, NULL, 1),
  (41, 11, 4, DATEADD(DAY,2,@today), 1080, 60000, NULL, 1),
  (42, 11, 4, DATEADD(DAY,2,@today), 1110, 60000, NULL, 1),
  (43, 12, 3, DATEADD(DAY,4,@today), 1020, 60000, NULL, 1),
  (44, 12, 3, DATEADD(DAY,4,@today), 1050, 60000, NULL, 1),
  (45, 13, 1, DATEADD(DAY,-6,@today), 720, 40000, NULL, 0),
  (46, 13, 1, DATEADD(DAY,-6,@today), 750, 40000, NULL, 0),
  (47, 14, 2, DATEADD(DAY,-4,@today), 1080, 60000, NULL, 0),
  (48, 14, 2, DATEADD(DAY,-4,@today), 1110, 60000, NULL, 0),
  (49, 14, 2, DATEADD(DAY,-4,@today), 1140, 60000, NULL, 0),
  (50, 14, 2, DATEADD(DAY,-4,@today), 1170, 60000, NULL, 0),
  (51, 15, 3, DATEADD(DAY,-7,@today), 600, 40000, NULL, 0),
  (52, 15, 3, DATEADD(DAY,-7,@today), 630, 40000, NULL, 0),
  (53, 16, 4, DATEADD(DAY,-1,@today), 1080, 60000, NULL, 0),
  (54, 16, 4, DATEADD(DAY,-1,@today), 1110, 60000, NULL, 0),
  (55, 17, 5, DATEADD(DAY,-6,@today), 1080, 60000, NULL, 1),
  (56, 17, 5, DATEADD(DAY,-6,@today), 1110, 60000, NULL, 1),
  (57, 17, 5, DATEADD(DAY,-6,@today), 1140, 60000, NULL, 1),
  (58, 17, 5, DATEADD(DAY,-6,@today), 1170, 60000, NULL, 1),
  (59, 18, 6, DATEADD(DAY,-2,@today), 1200, 60000, NULL, 1),
  (60, 18, 6, DATEADD(DAY,-2,@today), 1230, 60000, NULL, 1),
  (61, 18, 6, DATEADD(DAY,-2,@today), 1260, 60000, NULL, 1),
  (62, 18, 6, DATEADD(DAY,-2,@today), 1290, 60000, NULL, 1),
  (63, 19, 5, DATEADD(DAY,2,@today), 1080, 60000, NULL, 1),
  (64, 19, 5, DATEADD(DAY,2,@today), 1110, 60000, NULL, 1),
  (65, 19, 5, DATEADD(DAY,2,@today), 1140, 60000, NULL, 1),
  (66, 19, 5, DATEADD(DAY,2,@today), 1170, 60000, NULL, 1),
  (67, 20, 7, DATEADD(DAY,0,@today), 600, 40000, NULL, 1),
  (68, 20, 7, DATEADD(DAY,0,@today), 630, 40000, NULL, 1),
  (69, 20, 7, DATEADD(DAY,0,@today), 660, 40000, NULL, 1),
  (70, 20, 7, DATEADD(DAY,0,@today), 690, 40000, NULL, 1),
  (71, 21, 1, DATEADD(DAY,5,@today), 540, 40000, NULL, 1),
  (72, 21, 1, DATEADD(DAY,5,@today), 570, 40000, NULL, 1),
  (73, 21, 1, DATEADD(DAY,5,@today), 600, 40000, NULL, 1),
  (74, 21, 1, DATEADD(DAY,5,@today), 630, 40000, NULL, 1),
  (75, 22, 1, DATEADD(DAY,-14,@today), 1080, 60000, NULL, 1),
  (76, 22, 1, DATEADD(DAY,-14,@today), 1110, 60000, NULL, 1),
  (77, 22, 1, DATEADD(DAY,-14,@today), 1140, 60000, NULL, 1),
  (78, 22, 1, DATEADD(DAY,-14,@today), 1170, 60000, NULL, 1),
  (79, 23, 1, DATEADD(DAY,-7,@today), 1080, 60000, NULL, 1),
  (80, 23, 1, DATEADD(DAY,-7,@today), 1110, 60000, NULL, 1),
  (81, 23, 1, DATEADD(DAY,-7,@today), 1140, 60000, NULL, 1),
  (82, 23, 1, DATEADD(DAY,-7,@today), 1170, 60000, NULL, 1),
  (83, 24, 1, DATEADD(DAY,7,@today), 1080, 60000, NULL, 1),
  (84, 24, 1, DATEADD(DAY,7,@today), 1110, 60000, NULL, 1),
  (85, 24, 1, DATEADD(DAY,7,@today), 1140, 60000, NULL, 1),
  (86, 24, 1, DATEADD(DAY,7,@today), 1170, 60000, NULL, 1),
  (87, 25, 1, DATEADD(DAY,14,@today), 1080, 60000, NULL, 1),
  (88, 25, 1, DATEADD(DAY,14,@today), 1110, 60000, NULL, 1),
  (89, 25, 1, DATEADD(DAY,14,@today), 1140, 60000, NULL, 1),
  (90, 25, 1, DATEADD(DAY,14,@today), 1170, 60000, NULL, 1);
SET IDENTITY_INSERT booking_slot OFF;

-- reschedule_request (1)
SET IDENTITY_INSERT reschedule_request ON;
INSERT INTO reschedule_request (id, booking_id, new_court_id, new_date, new_start_minute, new_end_minute, old_list_amount, new_list_amount, extra_amount, is_free, status, approve_deadline) VALUES
  (1, 21, 2, DATEADD(DAY,5,@today), 1080, 1200, 160000, 240000, 80000, 0, N'AWAITING_CONFIRMATION', DATEADD(MINUTE,1440,SYSDATETIME()));
SET IDENTITY_INSERT reschedule_request OFF;

-- payment (21)
SET IDENTITY_INSERT payment ON;
INSERT INTO payment (id, location_id, booking_id, package_id, reschedule_request_id, amount_due, received_amount, status, resubmit_count, resubmit_reason, resubmit_deadline, reject_reason, submitted_at, confirmed_by, confirmed_at, receipt_no) VALUES
  (1, 1, 1, NULL, NULL, 160000, 160000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-11,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-11,@today) AS DATETIME2(0))), N'RC00000001'),
  (2, 1, 2, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-10,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-10,@today) AS DATETIME2(0))), N'RC00000002'),
  (3, 1, 3, NULL, NULL, 216000, 216000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-9,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-9,@today) AS DATETIME2(0))), N'RC00000003'),
  (4, 1, 4, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-6,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-6,@today) AS DATETIME2(0))), N'RC00000004'),
  (5, 1, 5, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-4,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-4,@today) AS DATETIME2(0))), N'RC00000005'),
  (6, 1, 6, NULL, NULL, 160000, 160000, N'CONFIRMED', 0, NULL, NULL, NULL, NULL, 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0))), N'RC00000006'),
  (7, 1, 7, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), N'RC00000007'),
  (8, 1, 8, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), N'RC00000008'),
  (9, 1, 9, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), N'RC00000009'),
  (10, 1, 10, NULL, NULL, 160000, NULL, N'AWAITING_CONFIRMATION', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), NULL, NULL, NULL),
  (11, 1, 11, NULL, NULL, 120000, NULL, N'RESUBMIT_REQUESTED', 1, N'Ảnh chuyển khoản bị mờ, vui lòng gửi lại', DATEADD(MINUTE,120,SYSDATETIME()), NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), NULL, NULL, NULL),
  (12, 1, 13, NULL, NULL, 80000, NULL, N'REJECTED', 0, NULL, NULL, N'Không tìm thấy giao dịch tương ứng', DATEADD(MINUTE,900,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0))), NULL),
  (13, 1, 14, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-5,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-5,@today) AS DATETIME2(0))), N'RC00000013'),
  (14, 1, 15, NULL, NULL, 80000, 80000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0))), N'RC00000014'),
  (15, 2, 17, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0))), 6, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-7,@today) AS DATETIME2(0))), N'RC00000015'),
  (16, 2, 18, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0))), 6, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0))), N'RC00000016'),
  (17, 2, 19, NULL, NULL, 240000, 240000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), 6, DATEADD(MINUTE,960,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), N'RC00000017'),
  (18, 2, 20, NULL, NULL, 160000, 160000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0))), 6, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-1,@today) AS DATETIME2(0))), N'RC00000018'),
  (19, 1, 21, NULL, NULL, 160000, 160000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), N'RC00000019'),
  (20, 1, NULL, 1, NULL, 960000, 960000, N'CONFIRMED', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,-15,@today) AS DATETIME2(0))), 4, DATEADD(MINUTE,960,CAST(DATEADD(DAY,-15,@today) AS DATETIME2(0))), N'RC00000020'),
  (21, 1, NULL, NULL, 1, 80000, NULL, N'AWAITING_CONFIRMATION', 0, NULL, NULL, NULL, DATEADD(MINUTE,900,CAST(DATEADD(DAY,0,@today) AS DATETIME2(0))), NULL, NULL, NULL);
SET IDENTITY_INSERT payment OFF;

-- payment_proof (20)
SET IDENTITY_INSERT payment_proof ON;
INSERT INTO payment_proof (id, payment_id, image_path) VALUES
  (1, 1, N'uploads/proofs/payment_1.jpg'),
  (2, 2, N'uploads/proofs/payment_2.jpg'),
  (3, 3, N'uploads/proofs/payment_3.jpg'),
  (4, 4, N'uploads/proofs/payment_4.jpg'),
  (5, 5, N'uploads/proofs/payment_5.jpg'),
  (6, 7, N'uploads/proofs/payment_7.jpg'),
  (7, 8, N'uploads/proofs/payment_8.jpg'),
  (8, 9, N'uploads/proofs/payment_9.jpg'),
  (9, 10, N'uploads/proofs/payment_10.jpg'),
  (10, 11, N'uploads/proofs/payment_11.jpg'),
  (11, 12, N'uploads/proofs/payment_12.jpg'),
  (12, 13, N'uploads/proofs/payment_13.jpg'),
  (13, 14, N'uploads/proofs/payment_14.jpg'),
  (14, 15, N'uploads/proofs/payment_15.jpg'),
  (15, 16, N'uploads/proofs/payment_16.jpg'),
  (16, 17, N'uploads/proofs/payment_17.jpg'),
  (17, 18, N'uploads/proofs/payment_18.jpg'),
  (18, 19, N'uploads/proofs/payment_19.jpg'),
  (19, 20, N'uploads/proofs/payment_20.jpg'),
  (20, 21, N'uploads/proofs/payment_21.jpg');
SET IDENTITY_INSERT payment_proof OFF;

SET IDENTITY_INSERT reconciliation ON;
INSERT INTO reconciliation (id, location_id, recon_date, system_amount, actual_amount, reason, staff_id) VALUES
  (1, 1, DATEADD(DAY,-3,@today), 240000, 240000, NULL, 4),
  (2, 1, DATEADD(DAY,-2,@today), 400000, 390000, N'Khách nhận lại 10.000đ tiền thừa chưa ghi sổ', 4),
  (3, 2, DATEADD(DAY,-2,@today), 240000, 240000, NULL, 6);
SET IDENTITY_INSERT reconciliation OFF;

-- affected_booking (2)
SET IDENTITY_INSERT affected_booking ON;
INSERT INTO affected_booking (id, booking_id, cause, maintenance_id, status, choice, is_default_choice, compensation_points, created_by, chosen_at) VALUES
  (1, 9, N'MAINTENANCE', 2, N'PENDING', NULL, 0, NULL, 4, NULL),
  (2, 14, N'OWNER_CANCELLED', NULL, N'RESOLVED', N'REFUND', 0, NULL, 2, DATEADD(MINUTE,700,CAST(DATEADD(DAY,-4,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT affected_booking OFF;

-- complaint (3)
SET IDENTITY_INSERT complaint ON;
INSERT INTO complaint (id, location_id, booking_id, payment_id, player_id, created_by, complaint_type, content, status, staff_note, handled_by, result, decided_by, decided_at) VALUES
  (1, 1, 13, 12, 12, 12, N'PAYMENT_ISSUE', N'Tôi đã chuyển khoản nhưng booking bị từ chối thanh toán.', N'SUBMITTED', NULL, NULL, NULL, NULL, NULL),
  (2, 1, 10, 10, 9, 9, N'LATE_PAYMENT_CONFIRMATION', N'Đã gửi chứng từ hơn 2 giờ nhưng chưa được xác nhận.', N'PENDING_OWNER', N'Đã kiểm tra, chờ chủ sân quyết định', 4, NULL, NULL, NULL),
  (3, 1, 2, NULL, 8, 8, N'COURT_SERVICE', N'Sân hơi trơn, đề nghị lau sàn thường xuyên hơn.', N'RESOLVED', N'Đã nhắc nhân viên vệ sinh', 5, N'NO_COMPENSATION', 2, DATEADD(MINUTE,800,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT complaint OFF;

-- refund_request (1)
SET IDENTITY_INSERT refund_request ON;
INSERT INTO refund_request (id, location_id, booking_id, affected_booking_id, complaint_id, suggested_amount, original_payment_date, status) VALUES
  (1, 1, 14, 2, NULL, 240000, DATEADD(DAY,-5,@today), N'PENDING_REFUND');
SET IDENTITY_INSERT refund_request OFF;

-- voucher_grant (2)
SET IDENTITY_INSERT voucher_grant ON;
INSERT INTO voucher_grant (id, voucher_id, player_id, status, expires_at, note) VALUES
  (1, 3, 7, N'AVAILABLE', DATEADD(MINUTE,0,CAST(DATEADD(DAY,60,@today) AS DATETIME2(0))), N'Quà tri ân đạt mốc 1.000.000đ'),
  (2, 3, 9, N'AVAILABLE', DATEADD(MINUTE,0,CAST(DATEADD(DAY,30,@today) AS DATETIME2(0))), N'Tặng thủ công bởi chủ sân');
SET IDENTITY_INSERT voucher_grant OFF;

-- voucher_usage (1)
SET IDENTITY_INSERT voucher_usage ON;
INSERT INTO voucher_usage (id, voucher_id, voucher_grant_id, player_id, booking_id, package_id, discount_amount, status) VALUES
  (1, 1, NULL, 9, 3, NULL, 24000, N'USED');
SET IDENTITY_INSERT voucher_usage OFF;

-- player_location_balance (6)
SET IDENTITY_INSERT player_location_balance ON;
INSERT INTO player_location_balance (id, player_id, location_id, point_balance, total_paid) VALUES
  (1, 7, 1, 156, 1360000),
  (2, 8, 1, 24, 240000),
  (3, 9, 1, 21, 216000),
  (4, 13, 2, 24, 240000),
  (5, 10, 1, 24, 240000),
  (6, 14, 2, 24, 240000);
SET IDENTITY_INSERT player_location_balance OFF;

-- point_transaction (9)
SET IDENTITY_INSERT point_transaction ON;
INSERT INTO point_transaction (id, balance_id, booking_id, package_id, type, points, balance_after, earning_rate, reason, created_by, created_at) VALUES
  (1, 1, NULL, 1, N'EARN', 96, 96, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-14,@today) AS DATETIME2(0)))),
  (2, 1, 1, NULL, N'EARN', 16, 112, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-10,@today) AS DATETIME2(0)))),
  (3, 2, 2, NULL, N'EARN', 24, 24, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-9,@today) AS DATETIME2(0)))),
  (4, 3, 3, NULL, N'EARN', 21, 21, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-8,@today) AS DATETIME2(0)))),
  (5, 4, 17, NULL, N'EARN', 24, 24, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-6,@today) AS DATETIME2(0)))),
  (6, 5, 4, NULL, N'EARN', 24, 24, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-5,@today) AS DATETIME2(0)))),
  (7, 1, 5, NULL, N'EARN', 24, 136, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0)))),
  (8, 6, 18, NULL, N'EARN', 24, 24, 10000, NULL, NULL, DATEADD(MINUTE,600,CAST(DATEADD(DAY,-2,@today) AS DATETIME2(0)))),
  (9, 1, 5, NULL, N'ADJUST', 20, 156, NULL, N'Tặng điểm bù do sự cố mạng khi thanh toán', 4, DATEADD(MINUTE,700,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT point_transaction OFF;

-- loyalty_tier (1)
SET IDENTITY_INSERT loyalty_tier ON;
INSERT INTO loyalty_tier (id, location_id, milestone_amount, voucher_id) VALUES
  (1, 1, 1000000, 3);
SET IDENTITY_INSERT loyalty_tier OFF;

-- loyalty_reward (1)
SET IDENTITY_INSERT loyalty_reward ON;
INSERT INTO loyalty_reward (id, player_id, loyalty_tier_id, reached_amount, voucher_grant_id) VALUES
  (1, 7, 1, 1000000, 1);
SET IDENTITY_INSERT loyalty_reward OFF;

-- team_member (8)
SET IDENTITY_INSERT team_member ON;
INSERT INTO team_member (id, team_id, player_id, status, left_at) VALUES
  (1, 1, 7, N'ACTIVE', NULL),
  (2, 1, 8, N'ACTIVE', NULL),
  (3, 1, 9, N'ACTIVE', NULL),
  (4, 1, 10, N'ACTIVE', NULL),
  (5, 2, 11, N'ACTIVE', NULL),
  (6, 2, 12, N'ACTIVE', NULL),
  (7, 2, 13, N'ACTIVE', NULL),
  (8, 2, 14, N'LEFT', DATEADD(MINUTE,0,CAST(DATEADD(DAY,-3,@today) AS DATETIME2(0))));
SET IDENTITY_INSERT team_member OFF;

-- team_join_request (2)
SET IDENTITY_INSERT team_join_request ON;
INSERT INTO team_join_request (id, team_id, player_id, phone_consent, status) VALUES
  (1, 1, 14, 1, N'PENDING'),
  (2, 2, 8, 1, N'REJECTED');
SET IDENTITY_INSERT team_join_request OFF;

-- match (1)
SET IDENTITY_INSERT match ON;
INSERT INTO match (id, booking_id, current_players, needed_players, status) VALUES
  (1, 7, 4, 4, N'OPEN');
SET IDENTITY_INSERT match OFF;

-- match_join_request (2)
SET IDENTITY_INSERT match_join_request ON;
INSERT INTO match_join_request (id, match_id, player_id, phone_consent, status) VALUES
  (1, 1, 11, 1, N'PENDING'),
  (2, 1, 13, 1, N'APPROVED');
SET IDENTITY_INSERT match_join_request OFF;

-- review (7)
SET IDENTITY_INSERT review ON;
INSERT INTO review (id, booking_id, location_id, player_id, rating, comment, owner_reply, is_hidden, hidden_by) VALUES
  (1, 1, 1, 7, 5, N'Sân đẹp, nhân viên thân thiện.', N'Cảm ơn bạn đã ủng hộ!', 0, NULL),
  (2, 2, 1, 8, 4, N'Sân tốt nhưng hơi trơn.', NULL, 0, NULL),
  (3, 3, 1, 9, 5, N'Giá hợp lý, voucher dùng dễ.', NULL, 0, NULL),
  (4, 4, 1, 10, 3, N'Đèn hơi tối ở góc sân.', N'Chúng tôi sẽ kiểm tra lại, cảm ơn góp ý.', 0, NULL),
  (5, 5, 1, 7, 4, N'Sẽ quay lại.', NULL, 0, NULL),
  (6, 17, 2, 13, 5, N'Sân rộng, thoáng mát.', NULL, 0, NULL),
  (7, 18, 2, 14, 1, N'Nội dung quảng cáo không phù hợp.', NULL, 1, 1);
SET IDENTITY_INSERT review OFF;

-- notification (8)
SET IDENTITY_INSERT notification ON;
INSERT INTO notification (id, recipient_id, type, title, content, ref_type, ref_id, is_read) VALUES
  (1, 7, N'BOOKING_CONFIRMED', N'Đặt sân thành công', N'Booking BK000007 đã được xác nhận.', N'BOOKING', 7, 1),
  (2, 9, N'PAYMENT_PENDING', N'Chờ xác nhận thanh toán', N'Chứng từ của booking BK000010 đang chờ nhân viên xác nhận.', N'BOOKING', 10, 0),
  (3, 10, N'PAYMENT_RESUBMIT', N'Cần gửi lại chứng từ', N'Ảnh chuyển khoản của booking BK000011 bị mờ.', N'BOOKING', 11, 0),
  (4, 12, N'PAYMENT_REJECTED', N'Thanh toán bị từ chối', N'Booking BK000013 bị từ chối thanh toán.', N'BOOKING', 13, 1),
  (5, 9, N'COURT_MAINTENANCE', N'Sân bảo trì', N'Booking BK000009 bị ảnh hưởng do bảo trì, vui lòng chọn phương án.', N'AFFECTED_BOOKING', 1, 0),
  (6, 2, N'MAINTENANCE_REQUEST', N'Yêu cầu bảo trì mới', N'Nhân viên gửi yêu cầu bảo trì Sân 3.', N'MAINTENANCE', 1, 0),
  (7, 4, N'PAYMENT_TO_CONFIRM', N'Thanh toán chờ xác nhận', N'Có 2 thanh toán đang chờ xác nhận.', NULL, NULL, 1),
  (8, 1, N'NEW_REGISTRATION', N'Đăng ký dịch vụ mới', N'Cầu lông Bình Minh gửi yêu cầu đăng ký.', N'SERVICE_REGISTRATION', 3, 0);
SET IDENTITY_INSERT notification OFF;

-- otp_request (2)
SET IDENTITY_INSERT otp_request ON;
INSERT INTO otp_request (id, email, purpose, code_hash, failed_attempts, expires_at, used_at) VALUES
  (1, N'moi.dangky@gmail.com', N'REGISTER', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', 0, DATEADD(MINUTE,5,SYSDATETIME()), NULL),
  (2, N'an.nguyen@gmail.com', N'RESET_PASSWORD', N'$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe', 1, DATEADD(MINUTE,-60,SYSDATETIME()), DATEADD(MINUTE,-65,SYSDATETIME()));
SET IDENTITY_INSERT otp_request OFF;

COMMIT TRANSACTION;
GO
-- Kiểm tra số dòng từng bảng
SELECT t.name AS bang, SUM(p.rows) AS so_dong FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) GROUP BY t.name ORDER BY t.name;
GO