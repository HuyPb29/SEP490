-- BR64/D164: converge local SINGLE_ORDER rows and integration DAY rows on DAY.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.booking_package', N'U') IS NULL
    THROW 51000, 'Select the application database before running this migration.', 1;

IF OBJECT_ID(N'dbo.ck_pkg_type', N'C') IS NOT NULL
    ALTER TABLE dbo.booking_package DROP CONSTRAINT ck_pkg_type;
IF OBJECT_ID(N'dbo.ck_pkg_status', N'C') IS NOT NULL
    ALTER TABLE dbo.booking_package DROP CONSTRAINT ck_pkg_status;

UPDATE dbo.booking_package SET package_type = 'DAY' WHERE package_type = 'SINGLE_ORDER';

ALTER TABLE dbo.booking_package WITH CHECK ADD CONSTRAINT ck_pkg_type
    CHECK (package_type IN ('RECURRING','CUSTOM','DAY'));
ALTER TABLE dbo.booking_package WITH CHECK ADD CONSTRAINT ck_pkg_status
    CHECK (status IN ('HOLDING','AWAITING_CONFIRMATION','RESUBMIT_REQUESTED','CONFIRMED','PAYMENT_REJECTED','EXPIRED')
        OR (package_type = 'DAY' AND status = 'CANCELLED_BY_PLAYER'));
COMMIT TRANSACTION;
