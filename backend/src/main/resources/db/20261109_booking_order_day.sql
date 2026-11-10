-- D164, BR64: đơn đặt lẻ lưu trong booking_package với package_type = 'DAY'.
-- Run against the explicitly selected application database.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF OBJECT_ID(N'dbo.booking_package', N'U') IS NULL
    THROW 51000, 'Select the application database before running this migration.', 1;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.booking_package') AND name = N'ck_pkg_type'
      AND definition NOT LIKE N'%DAY%'
)
    ALTER TABLE dbo.booking_package DROP CONSTRAINT ck_pkg_type;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.booking_package') AND name = N'ck_pkg_type'
)
    ALTER TABLE dbo.booking_package ADD CONSTRAINT ck_pkg_type
        CHECK (package_type IN ('RECURRING','CUSTOM','DAY'));
GO
