-- ============================================================
-- BMS (SEP490-G13) - Migration v6: bổ sung cột reschedule_pending cho bảng match
-- Feature: Đổi lịch giao lưu (Match Reschedule)
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql và các migration trước.
--   sqlcmd -S localhost -d BMS -U sa -P "<password>" -I -b -f 65001 -i BMS_migration_v6_match_reschedule.sql
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.match', 'reschedule_pending') IS NULL
BEGIN
    ALTER TABLE dbo.match
    ADD reschedule_pending BIT NOT NULL CONSTRAINT df_match_reschedule_pending DEFAULT 0;
END
GO
