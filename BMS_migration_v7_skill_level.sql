-- ============================================================
-- BMS (SEP490-G13) - Migration v7: trình độ chơi 4 mức cố định, đội có trình độ
-- Feature: F7 - Đội và kèo, F1 - Hồ sơ | D165, DR33, FR06, FR91-FR94, FR99, FR104
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và các migration trước.
--   sqlcmd -S localhost -d BMS_Test -U sa -P "<password>" -I -b -f 65001 -i BMS_migration_v7_skill_level.sql
--
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- DR33: chỉ còn 4 mức. Dữ liệu cũ: "Giỏi" chuyển thành "Nâng cao", giá trị khác ngoài danh sách xóa trống (D165).
UPDATE dbo.account SET skill_level = N'Nâng cao' WHERE skill_level = N'Giỏi';
UPDATE dbo.account SET skill_level = NULL
WHERE skill_level IS NOT NULL
  AND skill_level NOT IN (N'Mới chơi', N'Trung bình', N'Khá', N'Nâng cao');
GO

IF OBJECT_ID('dbo.ck_account_skill_level', 'C') IS NULL
    ALTER TABLE dbo.account ADD CONSTRAINT ck_account_skill_level
        CHECK (skill_level IS NULL OR skill_level IN (N'Mới chơi', N'Trung bình', N'Khá', N'Nâng cao'));
GO

-- FR91: đội có trình độ do chủ đội chọn. Cột cho phép NULL để giữ các đội tạo trước D165;
-- backend bắt buộc chọn khi tạo đội mới.
IF COL_LENGTH('dbo.team', 'skill_level') IS NULL
    ALTER TABLE dbo.team ADD skill_level NVARCHAR(30) NULL;
GO

IF OBJECT_ID('dbo.ck_team_skill_level', 'C') IS NULL
    ALTER TABLE dbo.team ADD CONSTRAINT ck_team_skill_level
        CHECK (skill_level IS NULL OR skill_level IN (N'Mới chơi', N'Trung bình', N'Khá', N'Nâng cao'));
GO

-- Kiểm tra: co_cot = 1, so_check = 2, so_trinh_do_la = 0.
SELECT CASE WHEN COL_LENGTH('dbo.team', 'skill_level') IS NULL THEN 0 ELSE 1 END AS co_cot,
       (SELECT COUNT(*) FROM sys.check_constraints
         WHERE name IN ('ck_account_skill_level', 'ck_team_skill_level')) AS so_check,
       (SELECT COUNT(*) FROM dbo.account
         WHERE skill_level IS NOT NULL
           AND skill_level NOT IN (N'Mới chơi', N'Trung bình', N'Khá', N'Nâng cao')) AS so_trinh_do_la;
GO
