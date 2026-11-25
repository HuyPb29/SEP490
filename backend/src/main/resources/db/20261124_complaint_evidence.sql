-- Additive, re-runnable. Select the intended BMS database explicitly before running.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.complaint', 'U') IS NULL
    THROW 51000, 'Select the application database with the complaint table.', 1;
IF OBJECT_ID('dbo.complaint_evidence', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.complaint_evidence (
        complaint_id BIGINT NOT NULL CONSTRAINT pk_complaint_evidence PRIMARY KEY,
        image_path NVARCHAR(500) NOT NULL,
        content_type VARCHAR(30) NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT fk_complaint_evidence_complaint FOREIGN KEY (complaint_id) REFERENCES dbo.complaint(id),
        CONSTRAINT ck_complaint_evidence_size CHECK (size_bytes > 0 AND size_bytes <= 5242880),
        CONSTRAINT ck_complaint_evidence_type CHECK (content_type IN ('image/jpeg', 'image/png'))
    );
END;
COMMIT TRANSACTION;
