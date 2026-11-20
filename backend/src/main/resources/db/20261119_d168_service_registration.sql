-- ============================================================
-- BMS (SEP490-G13) - D168, D169: đăng ký sử dụng dịch vụ tự phục vụ
-- Feature: F2 - Quản lý địa điểm | FR10, FR11, FR12, FR127, BR61, BR65, DR19, DR28, DR29, P35
--
-- 1. service_registration thêm số năm thuê, số tiền thuê (P35), ảnh chứng từ, thời điểm đồng ý điều khoản.
-- 2. Bảng operator_payment_info: thông tin nhận chuyển khoản của bên vận hành, có sẵn một dòng mặc định (FR127).
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và các migration trước.
--   sqlcmd -S localhost -d BMS_Test -U sa -P "<password>" -I -b -f 65001 -i 20261119_d168_service_registration.sql
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.service_registration', 'rental_years') IS NULL
    ALTER TABLE dbo.service_registration ADD rental_years INT NULL;
IF COL_LENGTH('dbo.service_registration', 'rental_amount') IS NULL
    ALTER TABLE dbo.service_registration ADD rental_amount DECIMAL(12,0) NULL;
IF COL_LENGTH('dbo.service_registration', 'proof_image_path') IS NULL
    ALTER TABLE dbo.service_registration ADD proof_image_path VARCHAR(255) NULL;
IF COL_LENGTH('dbo.service_registration', 'terms_accepted_at') IS NULL
    ALTER TABLE dbo.service_registration ADD terms_accepted_at DATETIME2(0) NULL;
GO

-- Đơn gửi trước D168 không có số năm thuê: coi là 1 năm (DR29), số tiền tính lại theo P35
-- (10.000.000 × số sân ÷ 9 × số năm, làm tròn lên nghìn đồng). Ảnh chứng từ, đồng ý điều khoản để trống.
UPDATE dbo.service_registration SET rental_years = 1 WHERE rental_years IS NULL;
UPDATE dbo.service_registration
SET rental_amount = CEILING(10000000.0 * court_count * rental_years / 9 / 1000) * 1000
WHERE rental_amount IS NULL;
GO

ALTER TABLE dbo.service_registration ALTER COLUMN rental_years INT NOT NULL;
ALTER TABLE dbo.service_registration ALTER COLUMN rental_amount DECIMAL(12,0) NOT NULL;
GO

IF OBJECT_ID('dbo.ck_sreg_rental_years', 'C') IS NULL
    ALTER TABLE dbo.service_registration ADD CONSTRAINT ck_sreg_rental_years CHECK (rental_years >= 1);
IF OBJECT_ID('dbo.ck_sreg_rental_amount', 'C') IS NULL
    ALTER TABLE dbo.service_registration ADD CONSTRAINT ck_sreg_rental_amount CHECK (rental_amount > 0);
GO

-- FR127, DR28: một bộ thông tin nhận chuyển khoản của bên vận hành (chỉ một dòng, id = 1).
-- qr_image_path để trống thì backend trả ảnh QR mặc định đóng gói sẵn (resources/operator/default-qr.png).
IF OBJECT_ID('dbo.operator_payment_info', 'U') IS NULL
    CREATE TABLE dbo.operator_payment_info (
        id INT NOT NULL,
        bank_name NVARCHAR(100) NOT NULL,
        bank_account_no VARCHAR(30) NOT NULL,
        bank_account_holder NVARCHAR(100) NOT NULL,
        qr_image_path VARCHAR(255) NULL,
        updated_by BIGINT NULL,
        updated_at DATETIME2(0) NULL,
        CONSTRAINT pk_operator_payment_info PRIMARY KEY (id),
        CONSTRAINT ck_operator_payment_info_single CHECK (id = 1),
        CONSTRAINT fk_operator_payment_info_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.account (id)
    );
GO

-- Giá trị mặc định khi cài hệ thống (D169). Đây là tài khoản giả: Admin phải sửa thành tài khoản thật trước khi dùng.
IF NOT EXISTS (SELECT 1 FROM dbo.operator_payment_info WHERE id = 1)
    INSERT INTO dbo.operator_payment_info (id, bank_name, bank_account_no, bank_account_holder)
    VALUES (1, N'MB Bank', '0123456789', N'BEN VAN HANH BMS');
GO
