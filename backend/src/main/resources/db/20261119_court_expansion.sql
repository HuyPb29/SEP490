-- Chạy sau schema BMS. Không sửa/xóa sân hay dữ liệu hiện có.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.court', 'available_from') IS NULL
    ALTER TABLE dbo.court ADD available_from DATE NULL;
IF COL_LENGTH('dbo.court', 'available_until') IS NULL
    ALTER TABLE dbo.court ADD available_until DATE NULL;
IF OBJECT_ID('dbo.court_expansion_request', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.court_expansion_request (
        id BIGINT IDENTITY PRIMARY KEY,
        location_id BIGINT NOT NULL REFERENCES dbo.location(id),
        owner_id BIGINT NOT NULL REFERENCES dbo.account(id),
        court_count INT NOT NULL CHECK(court_count BETWEEN 1 AND 100),
        reference_fee DECIMAL(14,0) NOT NULL CHECK(reference_fee > 0),
        quoted_start DATE NOT NULL, contract_end DATE NOT NULL,
        quoted_amount DECIMAL(14,0) NOT NULL CHECK(quoted_amount > 0),
        proof_path NVARCHAR(255) NOT NULL,
        status VARCHAR(10) NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED')),
        effective_start DATE NULL, final_amount DECIMAL(14,0) NULL,
        received_amount DECIMAL(14,0) NULL, refunded_amount DECIMAL(14,0) NULL,
        settlement_note NVARCHAR(500) NULL, reject_reason NVARCHAR(500) NULL,
        processed_by BIGINT NULL REFERENCES dbo.account(id),
        processed_at DATETIME2 NULL, created_at DATETIME2 NOT NULL,
        CONSTRAINT ck_expansion_dates CHECK(contract_end >= quoted_start),
        CONSTRAINT ck_expansion_settlement CHECK(status='PENDING' OR
            (final_amount IS NOT NULL AND received_amount IS NOT NULL AND refunded_amount IS NOT NULL
             AND final_amount >= 0 AND refunded_amount >= 0 AND received_amount = final_amount + refunded_amount)),
        CONSTRAINT ck_expansion_decision CHECK(status='PENDING' OR (processed_by IS NOT NULL AND processed_at IS NOT NULL)),
        CONSTRAINT ck_expansion_approved CHECK(status<>'APPROVED' OR (effective_start IS NOT NULL AND effective_start<=contract_end AND final_amount>0)),
        CONSTRAINT ck_expansion_rejected CHECK(status<>'REJECTED' OR (reject_reason IS NOT NULL AND final_amount=0))
    );
    CREATE UNIQUE INDEX ux_expansion_pending ON dbo.court_expansion_request(location_id) WHERE status='PENDING';
END;
COMMIT;
