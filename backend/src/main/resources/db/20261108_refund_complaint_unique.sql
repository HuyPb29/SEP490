-- Run against the explicitly selected application database.
-- Existing duplicate complaint IDs must be reconciled before creating the index.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

IF OBJECT_ID(N'dbo.refund_request', N'U') IS NULL
    THROW 51000, 'Select the application database before running this migration.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.refund_request', N'U') AND name = N'ux_refund_complaint'
)
    CREATE UNIQUE INDEX ux_refund_complaint ON dbo.refund_request (complaint_id)
        WHERE complaint_id IS NOT NULL;
