-- Run on the intended BMS database before deploying the backend. No USE or destructive DDL.
-- Additive/re-runnable. Pre-upgrade JWTs without tokenVersion are rejected after deployment.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF OBJECT_ID(N'dbo.account', N'U') IS NULL
    THROW 51000, 'Account schema is required before the security upgrade', 1;
IF COL_LENGTH('dbo.account', 'token_version') IS NULL
    ALTER TABLE dbo.account ADD token_version BIGINT NOT NULL
        CONSTRAINT df_account_token_version DEFAULT 0 WITH VALUES;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_account_token_version' AND parent_object_id = OBJECT_ID('dbo.account'))
    ALTER TABLE dbo.account ADD CONSTRAINT ck_account_token_version CHECK (token_version >= 0);

-- Historical identifiers deliberately have no FK/cascade: deleting an account must not erase its audit trail.
-- Only successful, committed account operations are recorded. No credentials or request bodies.
IF OBJECT_ID(N'dbo.account_audit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.account_audit (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_account_audit PRIMARY KEY,
        actor_id BIGINT NOT NULL,
        actor_role VARCHAR(10) NOT NULL,
        target_account_id BIGINT NOT NULL,
        location_id BIGINT NULL,
        action VARCHAR(40) NOT NULL,
        previous_status VARCHAR(10) NULL,
        new_status VARCHAR(10) NULL,
        reason NVARCHAR(500) NULL,
        outcome VARCHAR(10) NOT NULL,
        created_at DATETIME2(7) NOT NULL CONSTRAINT df_account_audit_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT ck_account_audit_role CHECK (actor_role IN ('PLAYER','STAFF','OWNER','ADMIN')),
        CONSTRAINT ck_account_audit_outcome CHECK (outcome = 'SUCCESS'),
        CONSTRAINT ck_account_audit_action CHECK (action IN ('REGISTER_VERIFIED','LOGIN','LOGOUT_ALL',
            'PROFILE_UPDATED','PASSWORD_CHANGED','PASSWORD_RESET','STAFF_CREATED','STAFF_PASSWORD_RESET',
            'STAFF_STATUS_CHANGED','ACCOUNT_STATUS_CHANGED')),
        CONSTRAINT ck_account_audit_previous_status CHECK (previous_status IS NULL OR previous_status IN ('ACTIVE','LOCKED','DISABLED')),
        CONSTRAINT ck_account_audit_new_status CHECK (new_status IS NULL OR new_status IN ('ACTIVE','LOCKED','DISABLED'))
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.account_audit') AND name = 'ix_account_audit_target')
    CREATE INDEX ix_account_audit_target ON dbo.account_audit(target_account_id, id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.account_audit') AND name = 'ix_account_audit_actor')
    CREATE INDEX ix_account_audit_actor ON dbo.account_audit(actor_id, id DESC);
COMMIT TRANSACTION;
GO
