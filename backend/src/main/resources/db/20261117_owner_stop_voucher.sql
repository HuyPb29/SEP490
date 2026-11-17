-- D166. Keep legacy DISABLED rows and give vouchers stopped by an Owner a separate status.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.voucher')
      AND name = 'ck_voucher_status'
      AND definition NOT LIKE '%STOPPED%'
)
    ALTER TABLE dbo.voucher DROP CONSTRAINT ck_voucher_status;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.voucher') AND name = 'ck_voucher_status'
)
    ALTER TABLE dbo.voucher WITH CHECK ADD CONSTRAINT ck_voucher_status
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'DISABLED', 'EXPIRED', 'STOPPED'));

COMMIT TRANSACTION;
