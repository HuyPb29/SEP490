-- ============================================================
-- BMS (SEP490-G13) - Migration v4: trạng thái EXPIRED cho voucher
-- Feature: UC37 - Automated tasks and notifications | Owner: Minh Anh
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql, BMS_migration_v2_location_slot_setting.sql
-- và BMS_migration_v3_maintenance_cancelled.sql.
-- Chọn rõ cơ sở dữ liệu đích bằng -d (ví dụ dưới đây dành cho BMS_Test).
--   sqlcmd -S localhost,1433 -d BMS_Test -U sa -P *** -I -b -f 65001 -i BMS_migration_v4_voucher_expired_status.sql
--
-- LÝ DO: job UC37 (VoucherExpiryJob) tự chuyển voucher PUBLISHED đã quá valid_to sang
-- EXPIRED, để cột status phản ánh đúng thực tế thay vì chỉ gửi lời nhắc.
-- Cột status là VARCHAR(10), giá trị 'EXPIRED' dài 7 ký tự nên không cần đổi kiểu cột.
--
-- LƯU Ý PHỐI HỢP: VoucherStatus và VoucherService thuộc feature voucher (Huy).
-- Thay đổi ở đây chỉ thêm một giá trị trạng thái, không đổi trạng thái cũ.
-- VoucherService.update được nới thêm: EXPIRED cũng sửa được ngày, và khi ngày mới
-- còn hiệu lực thì tự đưa về PUBLISHED — nếu không voucher hết hạn sẽ không thể cứu.
--
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- Dữ liệu cũ: migration KHÔNG tự đổi status. Voucher đã quá hạn sẽ được job chuyển
-- ở lần chạy kế tiếp (mặc định 00:10 hằng ngày).
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_voucher_status')
    ALTER TABLE dbo.voucher DROP CONSTRAINT ck_voucher_status;
GO

ALTER TABLE dbo.voucher ADD CONSTRAINT ck_voucher_status
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'DISABLED', 'EXPIRED'));
GO

-- Kiểm tra sau khi chạy: phải ra 1.
SELECT
    (SELECT COUNT(*) FROM sys.check_constraints
     WHERE name = 'ck_voucher_status' AND definition LIKE '%EXPIRED%') AS co_expired_voucher;
GO
