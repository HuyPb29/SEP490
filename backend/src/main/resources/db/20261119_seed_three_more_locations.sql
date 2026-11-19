-- Seed thêm 3 địa điểm, mỗi Owner mẫu (owner.sunrise, owner.thanglong, owner_f7) thêm 1 địa điểm.
-- Mỗi địa điểm gồm: 3 sân, giờ mở cửa 06:00-22:00 cả tuần, bảng giá từng sân, hạn dịch vụ 12 tháng,
-- cấu hình slot (30 phút, nghỉ 0, tối đa 4 slot), 1 nhân viên, 2 voucher chiến dịch, 1 mốc tích lũy chi tiêu.
-- Chạy lại được: phần nào đã có thì bỏ qua. Owner nào chưa có trong DB thì địa điểm đó bị bỏ qua.
-- Nhân viên mới dùng mật khẩu chung của dữ liệu mẫu: 123456.
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.location', 'U') IS NULL OR COL_LENGTH('dbo.voucher', 'allow_points') IS NULL
    THROW 51000, 'Select the application database (BMS) before running this seed.', 1;

DECLARE @today DATE = CAST(GETDATE() AS DATE);
DECLARE @admin BIGINT = (SELECT TOP 1 id FROM dbo.account WHERE role = 'ADMIN' ORDER BY id);

DECLARE @spec TABLE (
    k INT PRIMARY KEY, owner_username VARCHAR(32), name NVARCHAR(100), address NVARCHAR(255),
    latitude DECIMAL(9,6), longitude DECIMAL(9,6), contact_phone VARCHAR(10),
    bank_name NVARCHAR(100), bank_account_no VARCHAR(30), bank_account_holder NVARCHAR(100),
    advance_booking_days SMALLINT,
    staff_username VARCHAR(32), staff_phone VARCHAR(10), staff_full_name NVARCHAR(100),
    code_new VARCHAR(20), code_all VARCHAR(20));

INSERT INTO @spec VALUES
 (1, 'owner.sunrise',   N'Cầu lông Sunrise Hà Đông',     N'45 Quang Trung, Hà Đông, Hà Nội',
     20.971500, 105.776800, '0243100004', N'Vietcombank', '0011001234568', N'NGUYEN MINH KHOI', 30,
     'staff.hadong1', '0902000007', N'Đỗ Minh Tuấn', 'HADONG10', 'HADONG30K'),
 (2, 'owner.thanglong', N'Cầu lông Thăng Long Mỹ Đình', N'20 Lê Đức Thọ, Nam Từ Liêm, Hà Nội',
     21.030600, 105.769100, '0243100005', N'Techcombank', '19031234567891', N'TRAN THU HA', 14,
     'staff.mydinh1', '0902000008', N'Vũ Thị Hương', 'MYDINH10', 'MYDINH30K'),
 (3, 'owner_f7',        N'Sân Test F7 Thạch Thất',       N'Km 29 Đại lộ Thăng Long, Thạch Thất, Hà Nội',
     21.006000, 105.540000, '0911000010', NULL, NULL, NULL, 30,
     'staff.thachthat1', '0902000009', N'Bùi Quang Huy', 'THACHTHAT10', 'THACHTHAT30K');

-- 1. Địa điểm
INSERT INTO dbo.location (owner_id, name, address, latitude, longitude, contact_phone,
                          bank_name, bank_account_no, bank_account_holder, advance_booking_days, point_earning_rate, status)
SELECT o.id, s.name, s.address, s.latitude, s.longitude, s.contact_phone,
       s.bank_name, s.bank_account_no, s.bank_account_holder, s.advance_booking_days, 10000, 'ACTIVE'
FROM @spec s
JOIN dbo.account o ON o.username = s.owner_username AND o.role = 'OWNER'
WHERE NOT EXISTS (SELECT 1 FROM dbo.location l WHERE l.owner_id = o.id AND l.name = s.name);

DECLARE @loc TABLE (k INT PRIMARY KEY, id BIGINT);
INSERT INTO @loc
SELECT s.k, l.id
FROM @spec s
JOIN dbo.account o ON o.username = s.owner_username AND o.role = 'OWNER'
JOIN dbo.location l ON l.owner_id = o.id AND l.name = s.name;

-- 2. Sân (chỉ tạo khi địa điểm chưa có sân nào)
INSERT INTO dbo.court (location_id, name, description, is_active)
SELECT l.id, c.name, c.descr, 1
FROM @loc l
CROSS JOIN (VALUES (N'Sân 1', N'Sân thảm PVC tiêu chuẩn thi đấu'),
                   (N'Sân 2', N'Sân thảm PVC'),
                   (N'Sân 3', N'Sân luyện tập')) c(name, descr)
WHERE NOT EXISTS (SELECT 1 FROM dbo.court x WHERE x.location_id = l.id);

-- 3. Giờ mở cửa 06:00-22:00 cả tuần
INSERT INTO dbo.opening_hour (location_id, day_of_week, open_minute, close_minute)
SELECT l.id, d.dow, 360, 1320
FROM @loc l CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) d(dow)
WHERE NOT EXISTS (SELECT 1 FROM dbo.opening_hour x WHERE x.location_id = l.id AND x.day_of_week = d.dow);

-- 4. Bảng giá: 06:00-16:00 40.000đ/slot, 16:00-22:00 60.000đ/slot (sân chưa có giá)
INSERT INTO dbo.price_rule (court_id, apply_days, start_minute, end_minute, price_per_slot, valid_from)
SELECT c.id, '1111111', p.s, p.e, p.price, @today
FROM @loc l
JOIN dbo.court c ON c.location_id = l.id
CROSS JOIN (VALUES (360, 960, 40000), (960, 1320, 60000)) p(s, e, price)
WHERE NOT EXISTS (SELECT 1 FROM dbo.price_rule x WHERE x.court_id = c.id);

-- 5. Hạn dịch vụ 12 tháng
INSERT INTO dbo.service_term (location_id, start_date, end_date, recorded_by)
SELECT l.id, @today, DATEADD(DAY, -1, DATEADD(MONTH, 12, @today)), @admin
FROM @loc l
WHERE @admin IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.service_term x WHERE x.location_id = l.id);

-- 6. Cấu hình slot (bằng giá trị mặc định của hệ thống, ghi rõ ra bảng)
INSERT INTO dbo.location_slot_setting (location_id, slot_minutes, buffer_minutes, max_slots_per_booking, updated_at)
SELECT l.id, 30, 0, 4, SYSDATETIME()
FROM @loc l
WHERE NOT EXISTS (SELECT 1 FROM dbo.location_slot_setting x WHERE x.location_id = l.id);

-- 7. Nhân viên (mật khẩu 123456)
INSERT INTO dbo.account (username, email, phone, password_hash, full_name, role, location_id, status)
SELECT s.staff_username, NULL, s.staff_phone,
       '$2b$10$u9WZ/qRUXCNyBRnw5ekb0O4HHYqMt6z2GDYrWOTZmKjXpYjkHDrSe',
       s.staff_full_name, 'STAFF', l.id, 'ACTIVE'
FROM @spec s JOIN @loc l ON l.k = s.k
WHERE NOT EXISTS (SELECT 1 FROM dbo.account a WHERE a.username = s.staff_username)
  AND NOT EXISTS (SELECT 1 FROM dbo.account a WHERE a.phone = s.staff_phone);

-- 8. Voucher chiến dịch: giảm 10% cho người mới, giảm 30.000đ cho đơn từ 150.000đ
INSERT INTO dbo.voucher (location_id, code, name, source, target_group, discount_type, discount_value,
                         min_order_amount, valid_from, valid_to, max_uses_per_player, max_total_uses, budget,
                         status, allow_points, max_point_percent)
SELECT l.id, v.code, v.name, 'CAMPAIGN', v.target_group, v.discount_type, v.discount_value,
       v.min_order_amount, @today, DATEADD(DAY, 60, @today), v.max_uses_per_player, v.max_total_uses, v.budget,
       'PUBLISHED', 1, 50
FROM @spec s
JOIN @loc l ON l.k = s.k
CROSS APPLY (VALUES
    (s.code_new, N'Chào bạn mới giảm 10%', 'NEW_PLAYERS', 'PERCENT', CAST(10 AS DECIMAL(12,0)), CAST(0 AS DECIMAL(12,0)),
     1, 100, CAST(2000000 AS DECIMAL(12,0))),
    (s.code_all, N'Giảm 30.000đ cho đơn từ 150.000đ', 'ALL_PLAYERS', 'AMOUNT', 30000, 150000,
     2, NULL, CAST(3000000 AS DECIMAL(12,0)))
) v(code, name, target_group, discount_type, discount_value, min_order_amount, max_uses_per_player, max_total_uses, budget)
WHERE NOT EXISTS (SELECT 1 FROM dbo.voucher x WHERE x.location_id = l.id AND x.code = v.code);

-- 9. Tích lũy chi tiêu: đạt mốc 1.000.000đ tặng voucher 100.000đ, hạn dùng 60 ngày
--    (giống LoyaltyMilestoneService: voucher mẫu LOYALTY/SPECIFIED/AMOUNT/PUBLISHED, session_threshold NULL)
DECLARE @tpl TABLE (location_id BIGINT, voucher_id BIGINT);
INSERT INTO dbo.voucher (location_id, code, name, source, target_group, discount_type, discount_value,
                         grant_valid_days, status, allow_points, max_point_percent)
OUTPUT inserted.location_id, inserted.id INTO @tpl
SELECT l.id, NULL, N'Quà tri ân mốc 1.000.000đ', 'LOYALTY', 'SPECIFIED', 'AMOUNT', 100000, 60, 'PUBLISHED', 1, 50
FROM @loc l
WHERE NOT EXISTS (SELECT 1 FROM dbo.loyalty_tier t WHERE t.location_id = l.id AND t.milestone_amount = 1000000);

INSERT INTO dbo.loyalty_tier (location_id, milestone_amount, voucher_id, is_active)
SELECT t.location_id, 1000000, t.voucher_id, 1
FROM @tpl t;

COMMIT TRANSACTION;

SELECT l.id, o.username AS owner, l.name,
       (SELECT COUNT(*) FROM dbo.court c WHERE c.location_id = l.id) AS courts,
       (SELECT COUNT(*) FROM dbo.opening_hour h WHERE h.location_id = l.id) AS open_days,
       (SELECT COUNT(*) FROM dbo.price_rule p JOIN dbo.court c ON c.id = p.court_id WHERE c.location_id = l.id) AS prices,
       (SELECT COUNT(*) FROM dbo.service_term t WHERE t.location_id = l.id) AS terms,
       (SELECT COUNT(*) FROM dbo.location_slot_setting x WHERE x.location_id = l.id) AS slot_cfg,
       (SELECT STRING_AGG(a.username, ',') FROM dbo.account a WHERE a.location_id = l.id) AS staff,
       (SELECT STRING_AGG(ISNULL(v.code, '(loyalty)'), ',') FROM dbo.voucher v WHERE v.location_id = l.id) AS vouchers,
       (SELECT COUNT(*) FROM dbo.loyalty_tier t WHERE t.location_id = l.id) AS tiers
FROM dbo.location l JOIN dbo.account o ON o.id = l.owner_id
WHERE l.name IN (N'Cầu lông Sunrise Hà Đông', N'Cầu lông Thăng Long Mỹ Đình', N'Sân Test F7 Thạch Thất');
