-- ============================================================
-- BMS (SEP490-G13) - Migration v3: trạng thái CANCELLED và vết huỷ yêu cầu bảo trì
-- Feature: F2 - Quản lý địa điểm | UC10 - FR23..FR25 | Owner: Minh Anh
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và BMS_migration_v2_location_slot_setting.sql.
-- Chọn rõ cơ sở dữ liệu đích bằng -d (ví dụ dưới đây dành cho BMS_Test).
--   sqlcmd -S localhost,1433 -d BMS_Test -U sa -P *** -I -b -f 65001 -i BMS_migration_v3_maintenance_cancelled.sql
--
-- LÝ DO: người tạo cần rút được yêu cầu bảo trì khi còn PENDING, nhưng không được
-- xoá dòng vì phải giữ vết (ai rút, rút lúc nào, vì sao). Vì vậy thêm trạng thái
-- CANCELLED và 3 cột lưu vết, KHÔNG xoá bản ghi.
--
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

-- ------------------------------------------------------------
-- 1. maintenance: cho phép CANCELLED.
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_maint_status')
    ALTER TABLE dbo.maintenance DROP CONSTRAINT ck_maint_status;
GO

ALTER TABLE dbo.maintenance ADD CONSTRAINT ck_maint_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
GO

-- ------------------------------------------------------------
-- 2. service_registration: dùng chung enum ApprovalStatus nên cũng mở CANCELLED,
--    tránh tình trạng code có giá trị mà database không lưu được.
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_sreg_status')
    ALTER TABLE dbo.service_registration DROP CONSTRAINT ck_sreg_status;
GO

ALTER TABLE dbo.service_registration ADD CONSTRAINT ck_sreg_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
GO

-- ------------------------------------------------------------
-- 3. Cột lưu vết huỷ. Tách khỏi approved_by / decided_at vì đó là vết quyết định
--    của Owner (duyệt hoặc từ chối), không phải vết người tạo rút đơn.
--
--    cancelled_by cố ý KHÔNG đặt khóa ngoại: script kiểm tra ở cuối BMS_database.sql
--    công bố đúng 90 khóa ngoại một cột, thêm một khóa sẽ làm hỏng con số đó.
--    Giá trị cột này luôn lấy từ tài khoản đang đăng nhập, không nhận từ client,
--    nên rủi ro toàn vẹn không đáng kể.
-- ------------------------------------------------------------
IF COL_LENGTH('dbo.maintenance', 'cancelled_by') IS NULL
    ALTER TABLE dbo.maintenance ADD cancelled_by BIGINT NULL;
GO

IF COL_LENGTH('dbo.maintenance', 'cancelled_at') IS NULL
    ALTER TABLE dbo.maintenance ADD cancelled_at DATETIME2(0) NULL;
GO

IF COL_LENGTH('dbo.maintenance', 'cancel_reason') IS NULL
    ALTER TABLE dbo.maintenance ADD cancel_reason NVARCHAR(500) NULL;
GO

-- ------------------------------------------------------------
-- 4. Kiểm tra sau khi chạy: 4 = đủ 4 cột/giá trị, 3 = đủ 3 cột lưu vết.
-- ------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM sys.check_constraints
     WHERE name = 'ck_maint_status' AND definition LIKE '%CANCELLED%') AS co_cancelled_maint,
    (SELECT COUNT(*) FROM sys.check_constraints
     WHERE name = 'ck_sreg_status' AND definition LIKE '%CANCELLED%') AS co_cancelled_sreg,
    (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.maintenance')
       AND name IN ('cancelled_by', 'cancelled_at', 'cancel_reason')) AS so_cot_luu_vet;
GO
