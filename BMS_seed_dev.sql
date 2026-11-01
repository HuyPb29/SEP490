-- ============================================================
-- BMS - Dữ liệu mẫu cho môi trường dev (chỉ dùng khi code/test, KHÔNG chạy trên production)
-- Chạy sau BMS_database.sql. Script tự dừng nếu bảng account đã có dữ liệu.
--
-- Tài khoản (mật khẩu chung: Bms@12345)
--   admin    / ADMIN  - admin@bms.local
--   owner1   / OWNER  - owner1@bms.local   (sở hữu địa điểm 1 và 2)
--   owner2   / OWNER  - owner2@bms.local   (sở hữu địa điểm 3 - dùng test 403 chéo chủ)
--   staff1   / STAFF  - thuộc địa điểm 1
--   player1, player2  / PLAYER
--
-- Cách chạy:
--   sqlcmd -S localhost -U sa -P <mật khẩu> -C -b -f 65001 -i BMS_seed_dev.sql
-- ============================================================
USE BMS;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.account)
BEGIN
    RAISERROR(N'Bảng account đã có dữ liệu. Script dừng để không ghi đè.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

-- Mật khẩu của mọi tài khoản mẫu là: Bms@12345
DECLARE @pw VARCHAR(100) = '$2a$10$Ed6H/sJiKXsXTc.gjREbiO/l9iIoiShEmDjdEOI0zx5mrszl0FoGK';

INSERT INTO dbo.account (username, email, phone, password_hash, full_name, role, status)
VALUES ('admin',  'admin@bms.local',  '0900000001', @pw, N'Quản trị viên',      'ADMIN',  'ACTIVE'),
       ('owner1', 'owner1@bms.local', '0900000002', @pw, N'Nguyễn Văn Owner',    'OWNER',  'ACTIVE'),
       ('owner2', 'owner2@bms.local', '0900000003', @pw, N'Trần Thị Chủ Sân',    'OWNER',  'ACTIVE'),
       ('player1','player1@bms.local','0900000004', @pw, N'Lê Văn Người Chơi',   'PLAYER', 'ACTIVE'),
       ('player2','player2@bms.local','0900000005', @pw, N'Phạm Thị Cầu Lông',   'PLAYER', 'ACTIVE');

DECLARE @adminId  BIGINT = (SELECT id FROM dbo.account WHERE username = 'admin');
DECLARE @owner1Id BIGINT = (SELECT id FROM dbo.account WHERE username = 'owner1');
DECLARE @owner2Id BIGINT = (SELECT id FROM dbo.account WHERE username = 'owner2');

-- Địa điểm: 2 của owner1, 1 của owner2
INSERT INTO dbo.location (owner_id, name, address, latitude, longitude, contact_phone,
                          bank_name, bank_account_no, bank_account_holder, status)
VALUES (@owner1Id, N'Sân cầu lông Tân Bình', N'120 Trường Chinh, Q. Tân Bình, TP.HCM', 10.801000, 106.652000, '0900000010',
        N'Vietcombank', '0071000123456', N'NGUYEN VAN OWNER', 'ACTIVE'),
       (@owner1Id, N'Sân cầu lông Thủ Đức',  N'45 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',   10.850000, 106.753000, '0900000011',
        N'Techcombank', '19001234567890', N'NGUYEN VAN OWNER', 'ACTIVE'),
       (@owner2Id, N'Sân cầu lông Bình Thạnh', N'88 Điện Biên Phủ, Q. Bình Thạnh, TP.HCM', 10.803000, 106.710000, '0900000012',
        NULL, NULL, NULL, 'ACTIVE');

DECLARE @loc1 BIGINT = (SELECT id FROM dbo.location WHERE name = N'Sân cầu lông Tân Bình');
DECLARE @loc2 BIGINT = (SELECT id FROM dbo.location WHERE name = N'Sân cầu lông Thủ Đức');
DECLARE @loc3 BIGINT = (SELECT id FROM dbo.location WHERE name = N'Sân cầu lông Bình Thạnh');

-- Staff bắt buộc gắn location_id
INSERT INTO dbo.account (username, email, phone, password_hash, full_name, role, location_id, status)
VALUES ('staff1', NULL, '0900000006', @pw, N'Đỗ Thị Nhân Viên', 'STAFF', @loc1, 'ACTIVE');

-- Sân con
INSERT INTO dbo.court (location_id, name, description, is_active)
VALUES (@loc1, N'Sân 1', N'Sân thảm trong nhà', 1),
       (@loc1, N'Sân 2', N'Sân thảm trong nhà', 1),
       (@loc1, N'Sân 3', N'Sân xi măng ngoài trời', 1),
       (@loc2, N'Sân A', N'Sân thảm', 1),
       (@loc2, N'Sân B', N'Sân thảm', 1),
       (@loc3, N'Sân 1', N'Sân thảm', 1);

-- Giờ mở cửa 06:00 - 23:30 cho tất cả các ngày (1 = Thứ 2 ... 7 = Chủ nhật)
INSERT INTO dbo.opening_hour (location_id, day_of_week, open_minute, close_minute)
SELECT l.id, d.dow, 360, 1410
FROM dbo.location l
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) AS d(dow);

-- Bảng giá: T2-T6 thấp điểm 60k, cao điểm 90k; T7-CN 100k
INSERT INTO dbo.price_rule (court_id, apply_days, start_minute, end_minute, price_per_slot, valid_from, valid_to)
SELECT c.id, '1111100', 360,  1020, 60000,  CAST('2026-01-01' AS DATE), NULL FROM dbo.court c
UNION ALL
SELECT c.id, '1111100', 1020, 1410, 90000,  CAST('2026-01-01' AS DATE), NULL FROM dbo.court c
UNION ALL
SELECT c.id, '0000011', 360,  1410, 100000, CAST('2026-01-01' AS DATE), NULL FROM dbo.court c;

-- Thời hạn sử dụng dịch vụ 12 tháng cho mỗi địa điểm
INSERT INTO dbo.service_term (location_id, start_date, end_date, recorded_by)
SELECT l.id, CAST('2026-01-01' AS DATE), CAST('2026-12-31' AS DATE), @adminId FROM dbo.location l;

COMMIT TRANSACTION;

SELECT (SELECT COUNT(*) FROM dbo.account)      AS accounts,
       (SELECT COUNT(*) FROM dbo.location)     AS locations,
       (SELECT COUNT(*) FROM dbo.court)        AS courts,
       (SELECT COUNT(*) FROM dbo.opening_hour) AS opening_hours,
       (SELECT COUNT(*) FROM dbo.price_rule)   AS price_rules,
       (SELECT COUNT(*) FROM dbo.service_term) AS service_terms;
