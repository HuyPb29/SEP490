-- Apply after the v19 account migration on the selected application database.
-- Preserve existing login identities while enforcing 6–32 characters on new usernames.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRANSACTION;

IF OBJECT_ID('dbo.account', 'U') IS NULL OR ISNULL(COL_LENGTH('dbo.account', 'username'), 0) < 32
    THROW 51000, 'Select the application database and apply the account column migration first.', 1;

IF OBJECT_ID('dbo.ck_account_username', 'C') IS NOT NULL
    ALTER TABLE dbo.account DROP CONSTRAINT ck_account_username;

ALTER TABLE dbo.account WITH NOCHECK ADD CONSTRAINT ck_account_username CHECK (
    LEN(username) BETWEEN 6 AND 32
    AND username COLLATE Latin1_General_BIN LIKE '[a-z]%'
    AND username COLLATE Latin1_General_BIN NOT LIKE '%[^a-z0-9._]%'
);

IF NOT EXISTS (
    SELECT 1 FROM dbo.account
    WHERE LEN(username) NOT BETWEEN 6 AND 32
        OR username COLLATE Latin1_General_BIN NOT LIKE '[a-z]%'
        OR username COLLATE Latin1_General_BIN LIKE '%[^a-z0-9._]%'
)
    ALTER TABLE dbo.account WITH CHECK CHECK CONSTRAINT ck_account_username;

COMMIT TRANSACTION;
