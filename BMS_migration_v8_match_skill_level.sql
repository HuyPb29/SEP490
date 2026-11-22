-- ============================================================
-- BMS (SEP490-G13) - Migration v8: kèo có trình độ do chủ kèo chọn khi mở kèo
-- Feature: F7 - Đội và kèo | UC28 #1, UC29 #3, FR97, FR104, DR33
--
-- Chủ kèo chọn một trong 4 mức của DR33 hoặc "Không yêu cầu" (NULL) khi mở kèo;
-- form mặc định lấy trình độ của đội. Trình độ chỉ là nhãn để lọc, không chặn ai xin vào kèo.
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và các migration trước (cần v7).
--   sqlcmd -S localhost -d BMS_Test -U sa -P "<password>" -I -b -f 65001 -i BMS_migration_v8_match_skill_level.sql
--
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.match', 'skill_level') IS NULL
BEGIN
    ALTER TABLE dbo.match ADD skill_level NVARCHAR(30) NULL;

    -- Kèo mở trước v8 giữ nhãn cũ: lấy trình độ của đội đứng tên booking (D165).
    EXEC (N'UPDATE m SET m.skill_level = t.skill_level
            FROM dbo.match m
            JOIN dbo.booking b ON b.id = m.booking_id
            JOIN dbo.team t ON t.id = b.team_id
            WHERE m.skill_level IS NULL');
END
GO

IF OBJECT_ID('dbo.ck_match_skill_level', 'C') IS NULL
    ALTER TABLE dbo.match ADD CONSTRAINT ck_match_skill_level
        CHECK (skill_level IS NULL OR skill_level IN (N'Mới chơi', N'Trung bình', N'Khá', N'Nâng cao'));
GO

-- Kiểm tra: co_cot = 1, co_check = 1.
SELECT CASE WHEN COL_LENGTH('dbo.match', 'skill_level') IS NULL THEN 0 ELSE 1 END AS co_cot,
       (SELECT COUNT(*) FROM sys.check_constraints WHERE name = 'ck_match_skill_level') AS co_check;
GO
