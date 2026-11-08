-- Additive SRS v18 upgrade. Run against the explicitly selected database, never the fresh-create script.
-- Does not delete/recreate tables, convert sessions to money, or reissue historical vouchers.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.account','U') IS NULL THROW 51000, 'Select the BMS application database before running this migration.', 1;
IF EXISTS (SELECT phone FROM dbo.account WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*)>1)
    THROW 51001, 'Duplicate account phone numbers require manual review before global uniqueness can be enabled.', 1;
IF COL_LENGTH('dbo.account','failed_login_count') IS NULL
    ALTER TABLE dbo.account ADD failed_login_count INT NOT NULL CONSTRAINT df_account_failed_login_count DEFAULT 0;
IF COL_LENGTH('dbo.account','locked_until') IS NULL ALTER TABLE dbo.account ADD locked_until DATETIME2(0) NULL;
IF COL_LENGTH('dbo.account','last_login_at') IS NULL ALTER TABLE dbo.account ADD last_login_at DATETIME2(0) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='ck_account_failed_login_count')
    EXEC('ALTER TABLE dbo.account ADD CONSTRAINT ck_account_failed_login_count CHECK(failed_login_count>=0 AND failed_login_count<=5)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.account') AND name='ux_account_phone')
    CREATE UNIQUE INDEX ux_account_phone ON dbo.account(phone) WHERE phone IS NOT NULL;
IF COL_LENGTH('dbo.refund_request','loyalty_settled_amount') IS NULL
BEGIN
    ALTER TABLE dbo.refund_request ADD loyalty_settled_amount DECIMAL(12,0) NOT NULL CONSTRAINT df_refund_loyalty_amount DEFAULT 0;
    -- The earlier affected-refund implementation already removed the suggested cash amount.
    EXEC('UPDATE r SET loyalty_settled_amount=r.suggested_amount FROM dbo.refund_request r JOIN dbo.booking b ON b.id=r.booking_id WHERE r.affected_booking_id IS NOT NULL AND b.loyalty_refund_processed=1');
END;
IF COL_LENGTH('dbo.refund_request','loyalty_revoked_points') IS NULL
    ALTER TABLE dbo.refund_request ADD loyalty_revoked_points INT NOT NULL CONSTRAINT df_refund_loyalty_points DEFAULT 0;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='ck_loyalty_accrual')
    ALTER TABLE dbo.loyalty_accrual DROP CONSTRAINT ck_loyalty_accrual;
ALTER TABLE dbo.loyalty_accrual ADD CONSTRAINT ck_loyalty_accrual
    CHECK(paid_amount>0 AND earned_points>=0 AND earning_rate BETWEEN 1000 AND 100000);
-- Historical session-based rows/rewards stay intact; only session_threshold IS NULL is a monetary threshold.
-- Do not recalculate past earnings, balances, grant values or expiry times.
IF OBJECT_ID('dbo.account_audit','U') IS NOT NULL
    EXEC('UPDATE a SET last_login_at=h.last_login FROM dbo.account a JOIN (SELECT target_account_id,MAX(created_at) last_login FROM dbo.account_audit WHERE action=''LOGIN'' GROUP BY target_account_id) h ON h.target_account_id=a.id WHERE a.last_login_at IS NULL');
COMMIT TRANSACTION;
