-- SRS III.2.1 P2530: new usernames have 6-32 characters.
-- Run manually against the explicitly selected application database.
-- Existing shorter usernames are preserved; never rename a user's login implicitly.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.account','U') IS NULL
    THROW 51000, 'Select the application database before running this migration.', 1;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.account') AND name='ck_account_username')
    ALTER TABLE dbo.account DROP CONSTRAINT ck_account_username;
IF COL_LENGTH('dbo.account','username') < 32
BEGIN
    ALTER TABLE dbo.account DROP CONSTRAINT uq_account_username;
    ALTER TABLE dbo.account ALTER COLUMN username VARCHAR(32) NOT NULL;
    ALTER TABLE dbo.account ADD CONSTRAINT uq_account_username UNIQUE(username);
END;
IF EXISTS (SELECT 1 FROM dbo.account WHERE LEN(username)<6)
BEGIN
    -- Enforce for new/changed usernames without breaking existing login identities.
    ALTER TABLE dbo.account WITH NOCHECK ADD CONSTRAINT ck_account_username
        CHECK(LEN(username) BETWEEN 6 AND 32 AND username COLLATE Latin1_General_BIN LIKE '[a-z]%'
            AND username COLLATE Latin1_General_BIN NOT LIKE '%[^a-z0-9._]%');
    PRINT 'Legacy usernames shorter than 6 retained; new usernames must have 6-32 characters.';
END
ELSE
    ALTER TABLE dbo.account WITH CHECK ADD CONSTRAINT ck_account_username
        CHECK(LEN(username) BETWEEN 6 AND 32 AND username COLLATE Latin1_General_BIN LIKE '[a-z]%'
            AND username COLLATE Latin1_General_BIN NOT LIKE '%[^a-z0-9._]%');
COMMIT TRANSACTION;
