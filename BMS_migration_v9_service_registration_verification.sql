-- UC05/UC06: giấy tờ xác minh chủ sân; dữ liệu cũ giữ NULL, không tự xác nhận thay người nộp.
-- Chạy trên database cấu hình trong backend/.env sau các migration trước. Có thể chạy lại.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF COL_LENGTH('dbo.service_registration', 'identity_document_path') IS NULL
    ALTER TABLE dbo.service_registration ADD identity_document_path VARCHAR(255) NULL;
IF COL_LENGTH('dbo.service_registration', 'business_license_path') IS NULL
    ALTER TABLE dbo.service_registration ADD business_license_path VARCHAR(255) NULL;
IF COL_LENGTH('dbo.service_registration', 'privacy_accepted_at') IS NULL
    ALTER TABLE dbo.service_registration ADD privacy_accepted_at DATETIME2(0) NULL;
GO
