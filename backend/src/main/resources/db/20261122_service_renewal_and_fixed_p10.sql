-- F2, bảo vệ 1.1: yêu cầu gia hạn có chứng từ; P10 cố định (v20 D82/D154).
-- Chạy trên database ứng dụng sau các migration 20261119. Idempotent, không xóa dữ liệu.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;
UPDATE dbo.location SET point_redemption_value = 500 WHERE point_redemption_value <> 500;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='ck_location_fixed_p10')
    ALTER TABLE dbo.location ADD CONSTRAINT ck_location_fixed_p10 CHECK (point_redemption_value = 500);
IF OBJECT_ID('dbo.service_renewal_request', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.service_renewal_request (
        id BIGINT IDENTITY PRIMARY KEY,
        location_id BIGINT NOT NULL REFERENCES dbo.location(id),
        owner_id BIGINT NOT NULL REFERENCES dbo.account(id),
        rental_years INT NOT NULL CHECK (rental_years BETWEEN 1 AND 10),
        court_count INT NOT NULL CHECK (court_count > 0),
        previous_end DATE NULL,
        quoted_start DATE NOT NULL,
        quoted_end DATE NOT NULL,
        amount DECIMAL(12,0) NOT NULL CHECK (amount > 0),
        proof_path VARCHAR(255) NOT NULL,
        status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        reject_reason NVARCHAR(500) NULL,
        service_term_id BIGINT NULL REFERENCES dbo.service_term(id),
        created_at DATETIME2 NOT NULL,
        processed_at DATETIME2 NULL,
        processed_by BIGINT NULL REFERENCES dbo.account(id)
    );
    CREATE UNIQUE INDEX ux_renewal_pending_location ON dbo.service_renewal_request(location_id) WHERE status='PENDING';
END;
COMMIT;
