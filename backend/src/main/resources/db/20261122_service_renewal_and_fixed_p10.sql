-- F2, bảo vệ 1.1: yêu cầu gia hạn có chứng từ; P10 cố định (v20 D82/D154).
-- Chạy trên database ứng dụng sau các migration 20261119. Idempotent, không xóa dữ liệu.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;
UPDATE dbo.location SET point_redemption_value = 500 WHERE point_redemption_value <> 500;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='ck_location_fixed_p10')
    ALTER TABLE dbo.location ADD CONSTRAINT ck_location_fixed_p10 CHECK (point_redemption_value = 500);
COMMIT;
