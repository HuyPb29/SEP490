-- Preserve the previous effective policy (allow points, 50%) for existing vouchers.
-- The new default constraint marks the backfill so reruns preserve configured policies.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.voucher', 'U') IS NULL
    OR COL_LENGTH('dbo.voucher', 'allow_points') IS NULL
    OR COL_LENGTH('dbo.voucher', 'max_point_percent') IS NULL
    THROW 51000, 'Select the application database with the loyalty voucher columns.', 1;

IF OBJECT_ID('dbo.df_voucher_allow_points_uc24', 'D') IS NULL
BEGIN
    UPDATE dbo.voucher
    SET allow_points = 1, max_point_percent = 50
    WHERE allow_points = 0 OR max_point_percent <> 50;

    IF OBJECT_ID('dbo.df_voucher_allow_points', 'D') IS NOT NULL
        ALTER TABLE dbo.voucher DROP CONSTRAINT df_voucher_allow_points;
    ALTER TABLE dbo.voucher ADD CONSTRAINT df_voucher_allow_points_uc24 DEFAULT 1 FOR allow_points;
    ALTER TABLE dbo.voucher ADD CONSTRAINT df_voucher_max_point_percent DEFAULT 50 FOR max_point_percent;
END;

COMMIT TRANSACTION;
