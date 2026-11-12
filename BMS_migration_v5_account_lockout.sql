-- ============================================================
-- BMS (SEP490-G13) - Migration v5: tính năng khóa tài khoản do đăng nhập sai (Account Lockout)
-- Feature: F1 - Xác thực và phân quyền | UC02, DR23 | Owner: Minh Anh / Huy
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql (hoặc trực tiếp trên database BMS hiện có).
-- Mở file này trong SSMS rồi nhấn Execute (F5), hoặc chạy qua sqlcmd:
--   sqlcmd -S localhost -d BMS -U sa -P 123 -I -b -f 65001 -i BMS_migration_v5_account_lockout.sql
--
-- LÝ DO: Backend bổ sung cơ chế khóa tài khoản tạm thời khi người dùng nhập sai mật khẩu
-- liên tiếp quá 5 lần (DR23). Cần 2 cột trong bảng dbo.account:
--   1. failed_login_count TINYINT NOT NULL DEFAULT 0: lưu số lần đăng nhập sai (0..5)
--   2. locked_until DATETIME2(0) NULL: thời điểm tài khoản hết hạn bị khóa tạm thời
--
-- Script idempotent: an toàn, kiểm tra IF NOT EXISTS trước khi thêm, chạy lại nhiều lần
-- không gây lỗi và không làm mất dữ liệu hiện có.
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.account', N'U') IS NULL
BEGIN
    RAISERROR(N'Bảng dbo.account không tồn tại. Vui lòng chạy BMS_database.sql trước.', 16, 1);
    RETURN;
END
GO

-- 1. Bổ sung cột failed_login_count (nếu chưa có)
IF COL_LENGTH('dbo.account', 'failed_login_count') IS NULL
BEGIN
    ALTER TABLE dbo.account ADD failed_login_count TINYINT NOT NULL
        CONSTRAINT df_account_failed_login DEFAULT 0;
END
GO

-- 2. Bổ sung cột locked_until (nếu chưa có)
IF COL_LENGTH('dbo.account', 'locked_until') IS NULL
BEGIN
    ALTER TABLE dbo.account ADD locked_until DATETIME2(0) NULL;
END
GO

-- 3. Bổ sung cột last_login_at (nếu chưa có)
IF COL_LENGTH('dbo.account', 'last_login_at') IS NULL
BEGIN
    ALTER TABLE dbo.account ADD last_login_at DATETIME2(0) NULL;
END
GO

-- 4. Bổ sung check constraint giới hạn failed_login_count từ 0 đến 5 (nếu chưa có)
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'ck_account_failed_login_count' AND parent_object_id = OBJECT_ID('dbo.account')
)
BEGIN
    ALTER TABLE dbo.account ADD CONSTRAINT ck_account_failed_login_count
        CHECK (failed_login_count BETWEEN 0 AND 5);
END
GO

-- 5. Kiểm tra sau khi chạy: cả 4 chỉ số phải trả về 1
SELECT
    (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.account') AND name = 'failed_login_count') AS co_cot_failed_login_count,
    (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.account') AND name = 'locked_until') AS co_cot_locked_until,
    (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.account') AND name = 'last_login_at') AS co_cot_last_login_at,
    (SELECT COUNT(*) FROM sys.check_constraints
     WHERE name = 'ck_account_failed_login_count' AND parent_object_id = OBJECT_ID('dbo.account')) AS co_check_failed_login;
GO
