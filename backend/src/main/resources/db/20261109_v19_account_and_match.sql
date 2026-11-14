SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Keep the column wide enough for existing usernames. Enforce DR22 on new writes.
IF OBJECT_ID('dbo.ck_account_username', 'C') IS NOT NULL
    ALTER TABLE dbo.account DROP CONSTRAINT ck_account_username;
ALTER TABLE dbo.account WITH NOCHECK ADD CONSTRAINT ck_account_username CHECK (
    LEN(username) BETWEEN 4 AND 20
    AND username COLLATE Latin1_General_BIN LIKE '[a-z]%'
    AND username COLLATE Latin1_General_BIN NOT LIKE '%[^a-z0-9._]%'
);

IF COL_LENGTH('dbo.match', 'reschedule_pending') IS NULL
    ALTER TABLE dbo.[match] ADD reschedule_pending BIT NOT NULL
        CONSTRAINT df_match_reschedule_pending DEFAULT 0;

COMMIT TRANSACTION;
