-- Court suspension cancels an entire unconfirmed DAY/RECURRING/CUSTOM package.
-- Run after 20261109_booking_order_day.sql. Re-running this migration is safe.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.booking_package', N'U') IS NULL
    THROW 51000, 'Select the application database before running this migration.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.booking_package') AND name = N'ck_pkg_status'
      AND definition LIKE N'%CANCELLED_BY_FACILITY%'
)
BEGIN
    IF OBJECT_ID(N'dbo.ck_pkg_status', N'C') IS NOT NULL
        ALTER TABLE dbo.booking_package DROP CONSTRAINT ck_pkg_status;

    ALTER TABLE dbo.booking_package WITH CHECK ADD CONSTRAINT ck_pkg_status
        CHECK (status IN ('HOLDING','AWAITING_CONFIRMATION','RESUBMIT_REQUESTED','CONFIRMED',
                         'PAYMENT_REJECTED','EXPIRED','CANCELLED_BY_FACILITY')
            OR (package_type = 'DAY' AND status = 'CANCELLED_BY_PLAYER'));
END;

ALTER TABLE dbo.booking_package WITH CHECK CHECK CONSTRAINT ck_pkg_status;
COMMIT TRANSACTION;
