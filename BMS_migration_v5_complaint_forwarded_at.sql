-- ============================================================
-- BMS (SEP490-G13) - Migration v5: cột forwarded_at cho bảng complaint
-- Feature: F8 - Feedback & complaints | UC37 job P33 | Owner: Hoang
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và các migration v2, v3, v4.
-- Chọn rõ cơ sở dữ liệu đích bằng -d (ví dụ dưới đây dành cho BMS_Test).
--   sqlcmd -S localhost,1433 -d BMS_Test -U sa -P *** -I -b -f 65001 -i BMS_migration_v5_complaint_forwarded_at.sql
--
-- LÝ DO: P33 (cố định, D154) yêu cầu Owner xử lý khiếu nại trong 3 giờ tính trong giờ
-- mở cửa, quá hạn báo gấp Owner (MSG111). Job ComplaintOverdueJob cần mốc "khiếu nại
-- đến tay Owner": Staff chuyển lên (forward) hoặc lúc tạo với khiếu nại chậm xác nhận
-- thanh toán (loại này đến thẳng Owner theo D86/BR58).
--
-- Dữ liệu cũ: cột để NULL, job tự lấy created_at thay thế nên KHÔNG cần backfill.
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.complaint') AND name = 'forwarded_at')
    ALTER TABLE dbo.complaint ADD forwarded_at DATETIME2 NULL;
GO

-- Kiểm tra sau khi chạy: phải ra 1.
SELECT COUNT(*) AS co_cot_forwarded_at
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.complaint') AND name = 'forwarded_at';
GO
