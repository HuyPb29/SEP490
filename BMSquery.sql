-- ====================================================================================
-- SYSTEM: BADMINTON COURT MANAGEMENT SYSTEM (BMS)
-- DATABASE: bms_db
-- TARGET DBMS: Microsoft SQL Server 2019+ / Azure SQL Database
-- STANDARD: ANSI SQL / T-SQL (Clean 3NF, Full 40 Tables, Multi-Tenant Loyalty)
-- ====================================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE master;
GO

IF DB_ID(N'bms_db') IS NULL
BEGIN
    CREATE DATABASE bms_db COLLATE Vietnamese_CI_AS;
END
GO

USE bms_db;
GO

-- ====================================================================================
-- 1. CLEANUP DỌN DẸP BẢNG CŨ THEO THỨ TỰ PHỤ THUỘC NGƯỢC (REVERSE DEPENDENCY)
-- ====================================================================================
IF OBJECT_ID('dbo.audit_logs', 'U') IS NOT NULL DROP TABLE dbo.audit_logs;
IF OBJECT_ID('dbo.notifications', 'U') IS NOT NULL DROP TABLE dbo.notifications;
IF OBJECT_ID('dbo.complaints', 'U') IS NOT NULL DROP TABLE dbo.complaints;
IF OBJECT_ID('dbo.reviews', 'U') IS NOT NULL DROP TABLE dbo.reviews;
IF OBJECT_ID('dbo.match_join_requests', 'U') IS NOT NULL DROP TABLE dbo.match_join_requests;
IF OBJECT_ID('dbo.matches', 'U') IS NOT NULL DROP TABLE dbo.matches;
IF OBJECT_ID('dbo.voucher_usages', 'U') IS NOT NULL DROP TABLE dbo.voucher_usages;
IF OBJECT_ID('dbo.cumulative_reward_grants', 'U') IS NOT NULL DROP TABLE dbo.cumulative_reward_grants;
IF OBJECT_ID('dbo.cumulative_reward_tiers', 'U') IS NOT NULL DROP TABLE dbo.cumulative_reward_tiers;
IF OBJECT_ID('dbo.point_transactions', 'U') IS NOT NULL DROP TABLE dbo.point_transactions;
IF OBJECT_ID('dbo.player_facility_accounts', 'U') IS NOT NULL DROP TABLE dbo.player_facility_accounts;
IF OBJECT_ID('dbo.daily_reconciliations', 'U') IS NOT NULL DROP TABLE dbo.daily_reconciliations;
IF OBJECT_ID('dbo.refund_records', 'U') IS NOT NULL DROP TABLE dbo.refund_records;
IF OBJECT_ID('dbo.booking_reschedules', 'U') IS NOT NULL DROP TABLE dbo.booking_reschedules;
IF OBJECT_ID('dbo.receipts', 'U') IS NOT NULL DROP TABLE dbo.receipts;
IF OBJECT_ID('dbo.payment_proofs', 'U') IS NOT NULL DROP TABLE dbo.payment_proofs;
IF OBJECT_ID('dbo.payments', 'U') IS NOT NULL DROP TABLE dbo.payments;
IF OBJECT_ID('dbo.booking_slots', 'U') IS NOT NULL DROP TABLE dbo.booking_slots;
IF OBJECT_ID('dbo.bookings', 'U') IS NOT NULL DROP TABLE dbo.bookings;
IF OBJECT_ID('dbo.booking_packages', 'U') IS NOT NULL DROP TABLE dbo.booking_packages;
IF OBJECT_ID('dbo.user_vouchers', 'U') IS NOT NULL DROP TABLE dbo.user_vouchers;
IF OBJECT_ID('dbo.voucher_campaigns', 'U') IS NOT NULL DROP TABLE dbo.voucher_campaigns;
IF OBJECT_ID('dbo.bulk_booking_programs', 'U') IS NOT NULL DROP TABLE dbo.bulk_booking_programs;
IF OBJECT_ID('dbo.team_join_requests', 'U') IS NOT NULL DROP TABLE dbo.team_join_requests;
IF OBJECT_ID('dbo.team_members', 'U') IS NOT NULL DROP TABLE dbo.team_members;
IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL DROP TABLE dbo.teams;
IF OBJECT_ID('dbo.maintenance_requests', 'U') IS NOT NULL DROP TABLE dbo.maintenance_requests;
IF OBJECT_ID('dbo.pricing_rules', 'U') IS NOT NULL DROP TABLE dbo.pricing_rules;
IF OBJECT_ID('dbo.operating_hour_exceptions', 'U') IS NOT NULL DROP TABLE dbo.operating_hour_exceptions;
IF OBJECT_ID('dbo.operating_hours', 'U') IS NOT NULL DROP TABLE dbo.operating_hours;
IF OBJECT_ID('dbo.courts', 'U') IS NOT NULL DROP TABLE dbo.courts;
IF OBJECT_ID('dbo.system_settings', 'U') IS NOT NULL DROP TABLE dbo.system_settings;
IF OBJECT_ID('dbo.service_periods', 'U') IS NOT NULL DROP TABLE dbo.service_periods;
IF OBJECT_ID('dbo.facility_service_registrations', 'U') IS NOT NULL DROP TABLE dbo.facility_service_registrations;
IF OBJECT_ID('dbo.facility_photos', 'U') IS NOT NULL DROP TABLE dbo.facility_photos;
IF OBJECT_ID('dbo.user_sessions', 'U') IS NOT NULL DROP TABLE dbo.user_sessions;
IF OBJECT_ID('dbo.otp_codes', 'U') IS NOT NULL DROP TABLE dbo.otp_codes;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
IF OBJECT_ID('dbo.facilities', 'U') IS NOT NULL DROP TABLE dbo.facilities;
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DROP TABLE dbo.roles;
GO

-- ====================================================================================
-- PHÂN HỆ 1: QUẢN TRỊ HỆ THỐNG, TÀI KHOẢN & ĐỊA ĐIỂM (BẢNG 1 - 9)
-- ====================================================================================

-- BẢNG 1: roles (Danh mục vai trò người dùng)
CREATE TABLE dbo.roles (
    role_id             TINYINT NOT NULL PRIMARY KEY,
    role_code           VARCHAR(20) NOT NULL CONSTRAINT UQ_roles_code UNIQUE,
    role_name           NVARCHAR(50) NOT NULL
);
GO

-- BẢNG 2: facilities (Cơ sở / Cụm sân cầu lông - Multi-Tenant)
CREATE TABLE dbo.facilities (
    facility_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    owner_id             BIGINT NOT NULL, -- FK gắn sau với bảng users
    facility_name        NVARCHAR(150) NOT NULL,
    address              NVARCHAR(255) NOT NULL,
    district             NVARCHAR(100) NULL,
    city                 NVARCHAR(100) NULL,
    latitude             DECIMAL(9,6) NULL,
    longitude            DECIMAL(9,6) NULL,
    contact_phone        VARCHAR(15) NOT NULL,
    bank_name            NVARCHAR(100) NULL,
    bank_account_number  VARCHAR(30) NULL,
    bank_account_holder  NVARCHAR(100) NULL,
    qr_image_url         VARCHAR(500) NULL,
    max_advance_days     SMALLINT NOT NULL DEFAULT 30 CONSTRAINT CK_facilities_adv CHECK (max_advance_days > 0),
    point_earn_rate      INT NOT NULL DEFAULT 10000 CONSTRAINT CK_facilities_earn CHECK (point_earn_rate BETWEEN 1000 AND 100000),
    status               VARCHAR(20) NOT NULL DEFAULT 'active'
                         CONSTRAINT CK_facilities_status CHECK (status IN ('pending_approval', 'active', 'locked', 'expired')),
    locked_at            DATETIME2 NULL,
    lock_reason          NVARCHAR(255) NULL,
    created_at           DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at           DATETIME2 NULL
);
GO

-- BẢNG 3: users (Tài khoản người dùng gộp các vai trò)
CREATE TABLE dbo.users (
    user_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    role_id             TINYINT NOT NULL CONSTRAINT FK_users_role REFERENCES dbo.roles(role_id),
    username            VARCHAR(50) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    full_name           NVARCHAR(100) NOT NULL,
    email               VARCHAR(100) NULL,
    phone_number        VARCHAR(15) NULL,
    skill_level         NVARCHAR(30) NULL CONSTRAINT CK_users_skill CHECK (skill_level IN (N'Yếu', N'Trung bình', N'Khá', N'Tốt')),
    consent_share_phone BIT NOT NULL DEFAULT 0,
    facility_id         BIGINT NULL CONSTRAINT FK_users_facility REFERENCES dbo.facilities(facility_id),
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CONSTRAINT CK_users_status CHECK (status IN ('active', 'locked', 'unverified', 'disabled')),
    failed_login_count  TINYINT NOT NULL DEFAULT 0,
    created_by          BIGINT NULL CONSTRAINT FK_users_creator REFERENCES dbo.users(user_id),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at          DATETIME2 NULL,
    CONSTRAINT CK_users_role_data CHECK (
        (role_id = 1 AND email IS NOT NULL AND phone_number IS NOT NULL AND facility_id IS NULL)
        OR (role_id = 2 AND facility_id IS NOT NULL)
        OR (role_id = 3 AND email IS NOT NULL AND facility_id IS NULL)
        OR (role_id = 4 AND facility_id IS NULL)
    )
);
GO

ALTER TABLE dbo.facilities
ADD CONSTRAINT FK_facilities_owner FOREIGN KEY (owner_id) REFERENCES dbo.users(user_id);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_users_email_filtered
ON dbo.users(email) WHERE email IS NOT NULL;
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_users_phone_filtered
ON dbo.users(phone_number) WHERE phone_number IS NOT NULL AND role_id = 1;
GO

-- BẢNG 4: otp_codes (Mã OTP xác thực đăng ký & quên mật khẩu)
CREATE TABLE dbo.otp_codes (
    otp_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    email               VARCHAR(100) NOT NULL,
    phone_number        VARCHAR(15) NULL,
    purpose             VARCHAR(20) NOT NULL CONSTRAINT CK_otp_purpose CHECK (purpose IN ('register', 'reset_password')),
    otp_code            VARCHAR(10) NOT NULL,
    expires_at          DATETIME2 NOT NULL,
    is_verified         BIT NOT NULL DEFAULT 0,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE INDEX IX_otp_codes_lookup ON dbo.otp_codes(email, created_at);
GO

-- BẢNG 5: user_sessions (Quản lý phiên đăng nhập)
CREATE TABLE dbo.user_sessions (
    session_id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id             BIGINT NOT NULL CONSTRAINT FK_sessions_user REFERENCES dbo.users(user_id),
    token_hash          VARCHAR(255) NOT NULL CONSTRAINT UQ_sessions_token UNIQUE,
    expires_at          DATETIME2 NOT NULL,
    revoked_at          DATETIME2 NULL,
    ip_address          VARCHAR(45) NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 6: facility_photos (Ảnh quảng bá cơ sở sân)
CREATE TABLE dbo.facility_photos (
    photo_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_photos_facility REFERENCES dbo.facilities(facility_id) ON DELETE CASCADE,
    image_url           VARCHAR(500) NOT NULL,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 7: facility_service_registrations (Đơn đăng ký mở cơ sở mới)
CREATE TABLE dbo.facility_service_registrations (
    registration_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    requester_owner_id  BIGINT NULL CONSTRAINT FK_servicereg_owner REFERENCES dbo.users(user_id),
    representative_name NVARCHAR(100) NOT NULL,
    contact_phone       VARCHAR(15) NOT NULL,
    email               VARCHAR(100) NOT NULL,
    facility_name       NVARCHAR(150) NOT NULL,
    address             NVARCHAR(255) NOT NULL,
    district            NVARCHAR(100) NULL,
    city                NVARCHAR(100) NULL,
    latitude            DECIMAL(9,6) NULL,
    longitude           DECIMAL(9,6) NULL,
    number_of_courts    INT NOT NULL CONSTRAINT CK_servicereg_courts CHECK (number_of_courts > 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CONSTRAINT CK_servicereg_status CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason       NVARCHAR(255) NULL,
    processed_by_admin_id BIGINT NULL CONSTRAINT FK_servicereg_admin REFERENCES dbo.users(user_id),
    processed_at        DATETIME2 NULL,
    created_facility_id BIGINT NULL CONSTRAINT FK_servicereg_facility REFERENCES dbo.facilities(facility_id),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 8: service_periods (Hạn hợp đồng dịch vụ SaaS tối thiểu 12 tháng)
CREATE TABLE dbo.service_periods (
    period_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_serviceperiods_facility REFERENCES dbo.facilities(facility_id),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    recorded_by_admin_id BIGINT NOT NULL CONSTRAINT FK_serviceperiods_admin REFERENCES dbo.users(user_id),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_serviceperiods_min_year CHECK (end_date >= DATEADD(MONTH, 12, start_date))
);
GO

-- BẢNG 9: system_settings (Tham số cấu hình hệ thống / cơ sở P01..P33)
CREATE TABLE dbo.system_settings (
    setting_id          INT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NULL CONSTRAINT FK_settings_facility REFERENCES dbo.facilities(facility_id),
    setting_code        VARCHAR(50) NOT NULL,
    setting_name        NVARCHAR(150) NOT NULL,
    setting_value       NVARCHAR(255) NOT NULL,
    data_type           VARCHAR(30) NOT NULL DEFAULT 'STRING'
                        CONSTRAINT CK_settings_datatype CHECK (data_type IN ('INTEGER', 'STRING', 'BOOLEAN', 'DECIMAL')),
    description         NVARCHAR(255) NULL,
    updated_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_facility_setting_code UNIQUE (facility_id, setting_code)
);
GO

-- ====================================================================================
-- PHÂN HỆ 2: CỤM SÂN, GIỜ HOẠT ĐỘNG, BẢNG GIÁ & BẢO TRÌ (BẢNG 10 - 14)
-- ====================================================================================

-- BẢNG 10: courts (Danh sách sân con)
CREATE TABLE dbo.courts (
    court_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_courts_facility REFERENCES dbo.facilities(facility_id),
    court_name          NVARCHAR(50) NOT NULL,
    court_type          NVARCHAR(100) NOT NULL DEFAULT N'Thảm tiêu chuẩn',
    description         NVARCHAR(255) NULL,
    display_order       INT NOT NULL DEFAULT 1,
    is_active           BIT NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CONSTRAINT CK_courts_status CHECK (status IN ('active', 'maintenance', 'disabled')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_facility_court_name UNIQUE (facility_id, court_name)
);
GO

-- BẢNG 11: operating_hours (Giờ mở cửa định kỳ trong tuần)
CREATE TABLE dbo.operating_hours (
    operating_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_ophours_facility REFERENCES dbo.facilities(facility_id),
    day_of_week         TINYINT NOT NULL CONSTRAINT CK_ophours_dow CHECK (day_of_week BETWEEN 1 AND 7), -- 1: T2 ... 7: CN
    open_time           TIME(0) NOT NULL,
    close_time          TIME(0) NOT NULL,
    CONSTRAINT UQ_facility_dow UNIQUE (facility_id, day_of_week),
    CONSTRAINT CK_ophours_range CHECK (
        open_time < close_time 
        AND DATEPART(MINUTE, open_time) IN (0, 30) 
        AND DATEPART(MINUTE, close_time) IN (0, 30)
    )
);
GO

-- BẢNG 12: operating_hour_exceptions (Ngoại lệ ngày lễ / Ngày đóng cửa đột xuất)
CREATE TABLE dbo.operating_hour_exceptions (
    exception_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_opexceptions_facility REFERENCES dbo.facilities(facility_id),
    exception_date      DATE NOT NULL,
    is_closed           BIT NOT NULL DEFAULT 0,
    open_time           TIME(0) NULL,
    close_time          TIME(0) NULL,
    note                NVARCHAR(255) NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_facility_exception_date UNIQUE (facility_id, exception_date),
    CONSTRAINT CK_opexceptions_times CHECK (is_closed = 1 OR (open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time))
);
GO

-- BẢNG 13: pricing_rules (Bảng giá slot 30 phút)
CREATE TABLE dbo.pricing_rules (
    pricing_rule_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_pricing_facility REFERENCES dbo.facilities(facility_id),
    court_id            BIGINT NULL CONSTRAINT FK_pricing_court REFERENCES dbo.courts(court_id),
    day_of_week         TINYINT NULL CONSTRAINT CK_pricing_dow CHECK (day_of_week BETWEEN 1 AND 7),
    day_type            VARCHAR(20) NULL CONSTRAINT CK_pricing_daytype CHECK (day_type IN ('weekday', 'weekend', 'holiday')),
    start_time          TIME(0) NOT NULL,
    end_time            TIME(0) NOT NULL,
    price_per_slot      DECIMAL(12,2) NOT NULL CONSTRAINT CK_pricing_price CHECK (price_per_slot >= 0),
    effective_start_date DATE NOT NULL DEFAULT '2026-01-01',
    effective_end_date   DATE NULL,
    is_active           BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_pricing_time_range CHECK (start_time < end_time AND (effective_end_date IS NULL OR effective_start_date <= effective_end_date))
);
GO

-- TRIGGER CHẶN TRÙNG CHÉO BẢNG GIÁ THEO KHUNG GIỜ VÀ HIỆU LỰC
CREATE TRIGGER trg_pricing_rules_no_overlap 
ON dbo.pricing_rules 
AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        JOIN dbo.pricing_rules p 
          ON p.facility_id = i.facility_id
         AND ISNULL(p.court_id, 0) = ISNULL(i.court_id, 0)
         AND p.pricing_rule_id <> i.pricing_rule_id
         AND p.is_active = 1 AND i.is_active = 1
         AND (p.day_of_week IS NULL OR i.day_of_week IS NULL OR p.day_of_week = i.day_of_week)
         AND (p.day_type IS NULL OR i.day_type IS NULL OR p.day_type = i.day_type)
        WHERE p.start_time < i.end_time 
          AND i.start_time < p.end_time
          AND p.effective_start_date <= ISNULL(i.effective_end_date, '9999-12-31')
          AND i.effective_start_date <= ISNULL(p.effective_end_date, '9999-12-31')
    )
    BEGIN
        THROW 50017, N'Bảng giá mới bị chồng lấn khung giờ với một quy tắc giá đang hoạt động.', 1;
    END
END;
GO

-- BẢNG 14: maintenance_requests (Lịch bảo trì sân)
CREATE TABLE dbo.maintenance_requests (
    maintenance_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_maint_facility REFERENCES dbo.facilities(facility_id),
    court_id            BIGINT NOT NULL CONSTRAINT FK_maint_court REFERENCES dbo.courts(court_id),
    requested_by_user_id BIGINT NOT NULL CONSTRAINT FK_maint_requester REFERENCES dbo.users(user_id),
    decided_by_owner_id BIGINT NULL CONSTRAINT FK_maint_decider REFERENCES dbo.users(user_id),
    start_at            DATETIME2 NOT NULL,
    end_at              DATETIME2 NOT NULL,
    reason              NVARCHAR(255) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CONSTRAINT CK_maint_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_maint_range CHECK (end_at > start_at)
);
GO

-- ====================================================================================
-- PHÂN HỆ 3: CỤM ĐỘI NHÓM & KHUYẾN MÃI (BẢNG 15 - 20)
-- ====================================================================================

-- BẢNG 15: teams (Câu lạc bộ / Đội chơi)
CREATE TABLE dbo.teams (
    team_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    captain_id          BIGINT NOT NULL CONSTRAINT FK_teams_captain REFERENCES dbo.users(user_id),
    team_name           NVARCHAR(100) NOT NULL,
    normalized_name     AS LOWER(LTRIM(RTRIM(team_name))) PERSISTED,
    description         NVARCHAR(500) NULL,
    skill_level         NVARCHAR(30) NULL DEFAULT N'Trung bình',
    member_count        INT NOT NULL DEFAULT 1,
    max_members         INT NOT NULL DEFAULT 20 CONSTRAINT CK_teams_max CHECK (max_members <= 20),
    status              VARCHAR(20) NOT NULL DEFAULT 'active' CONSTRAINT CK_teams_status CHECK (status IN ('active', 'disbanded')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_teams_normalized_name ON dbo.teams(normalized_name);
GO

-- BẢNG 16: team_members (Thành viên Đội)
CREATE TABLE dbo.team_members (
    team_member_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    team_id             BIGINT NOT NULL CONSTRAINT FK_teammembers_team REFERENCES dbo.teams(team_id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL CONSTRAINT FK_teammembers_user REFERENCES dbo.users(user_id),
    role_in_team        VARCHAR(20) NOT NULL DEFAULT 'member' CONSTRAINT CK_teammembers_role CHECK (role_in_team IN ('captain', 'member')),
    joined_at           DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_team_user_unique UNIQUE (team_id, user_id)
);
GO

-- BẢNG 17: team_join_requests (Đơn xin gia nhập Đội)
CREATE TABLE dbo.team_join_requests (
    request_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    team_id             BIGINT NOT NULL CONSTRAINT FK_teamreq_team REFERENCES dbo.teams(team_id),
    user_id             BIGINT NOT NULL CONSTRAINT FK_teamreq_user REFERENCES dbo.users(user_id),
    message             NVARCHAR(300) NULL,
    consent_share_phone BIT NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CONSTRAINT CK_teamreq_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    processed_at        DATETIME2 NULL
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_teamreq_pending_unique 
ON dbo.team_join_requests(team_id, user_id) WHERE status = 'pending';
GO

-- BẢNG 18: bulk_booking_programs (Chương trình ưu đãi đặt theo lô)
CREATE TABLE dbo.bulk_booking_programs (
    program_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_bulkprog_facility REFERENCES dbo.facilities(facility_id),
    program_name        NVARCHAR(100) NOT NULL,
    min_sessions        INT NOT NULL CONSTRAINT CK_bulkprog_minsess CHECK (min_sessions >= 2),
    discount_percentage DECIMAL(5,2) NOT NULL CONSTRAINT CK_bulkprog_disc CHECK (discount_percentage BETWEEN 0.01 AND 99.99),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_active           BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_bulkprog_range CHECK (end_date >= start_date)
);
GO

-- BẢNG 19: voucher_campaigns (Chiến dịch phát hành Voucher)
CREATE TABLE dbo.voucher_campaigns (
    campaign_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NULL CONSTRAINT FK_vouchercamp_facility REFERENCES dbo.facilities(facility_id),
    campaign_code       VARCHAR(30) NULL,
    campaign_name       NVARCHAR(100) NOT NULL,
    discount_type       VARCHAR(20) NOT NULL CONSTRAINT CK_vouchercamp_type CHECK (discount_type IN ('fixed_amount', 'percentage')),
    discount_value      DECIMAL(12,2) NOT NULL CONSTRAINT CK_vouchercamp_val CHECK (discount_value > 0),
    min_booking_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_discount_cap    DECIMAL(12,2) NULL,
    target_audience     VARCHAR(20) NOT NULL DEFAULT 'all' 
                        CONSTRAINT CK_vouchercamp_target CHECK (target_audience IN ('all', 'new_player', 'specific_player')),
    valid_from          DATETIME2 NOT NULL,
    valid_to            DATETIME2 NOT NULL,
    per_user_limit      INT NULL DEFAULT 1,
    total_limit         INT NULL,
    used_count          INT NOT NULL DEFAULT 0,
    total_budget        DECIMAL(14,2) NULL,
    used_budget         DECIMAL(14,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CONSTRAINT CK_vouchercamp_status CHECK (status IN ('draft', 'active', 'expired', 'disabled')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_vouchercamp_code_filtered
ON dbo.voucher_campaigns(facility_id, campaign_code) WHERE campaign_code IS NOT NULL;
GO

-- BẢNG 20: user_vouchers (Ví voucher cá nhân của người chơi)
CREATE TABLE dbo.user_vouchers (
    user_voucher_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    campaign_id         BIGINT NOT NULL CONSTRAINT FK_uservouchers_campaign REFERENCES dbo.voucher_campaigns(campaign_id),
    user_id             BIGINT NOT NULL CONSTRAINT FK_uservouchers_user REFERENCES dbo.users(user_id),
    serial_code         VARCHAR(60) NOT NULL CONSTRAINT UQ_uservouchers_serial UNIQUE,
    issued_at           DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    expires_at          DATETIME2 NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'available'
                        CONSTRAINT CK_uservouchers_status CHECK (status IN ('available', 'used', 'expired')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ====================================================================================
-- PHÂN HỆ 4: CỤM ĐẶT SÂN & KHÓA CHỐNG DOUBLE-BOOKING (BẢNG 21 - 23)
-- ====================================================================================

-- BẢNG 21: booking_packages (Gói đặt sân nhiều buổi)
CREATE TABLE dbo.booking_packages (
    package_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    package_code        VARCHAR(30) NOT NULL CONSTRAINT UQ_packages_code UNIQUE,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_packages_facility REFERENCES dbo.facilities(facility_id),
    user_id             BIGINT NOT NULL CONSTRAINT FK_packages_user REFERENCES dbo.users(user_id),
    package_type        VARCHAR(20) NOT NULL CONSTRAINT CK_packages_type CHECK (package_type IN ('recurring', 'flexible')),
    package_name        NVARCHAR(150) NOT NULL,
    total_sessions      INT NOT NULL CONSTRAINT CK_packages_sessions CHECK (total_sessions >= 2),
    completed_sessions  INT NOT NULL DEFAULT 0,
    total_list_price    DECIMAL(12,2) NOT NULL,
    bulk_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    voucher_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    points_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount        DECIMAL(12,2) NOT NULL,
    hold_expires_at     DATETIME2 NULL,
    voucher_campaign_id BIGINT NULL CONSTRAINT FK_packages_vouchercamp REFERENCES dbo.voucher_campaigns(campaign_id),
    user_voucher_id     BIGINT NULL CONSTRAINT FK_packages_uservoucher REFERENCES dbo.user_vouchers(user_voucher_id),
    bulk_program_id     BIGINT NULL CONSTRAINT FK_packages_bulkprogram REFERENCES dbo.bulk_booking_programs(program_id),
    status              VARCHAR(30) NOT NULL DEFAULT 'holding'
                        CONSTRAINT CK_packages_status CHECK (
                            status IN ('holding', 'awaiting_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired')
                        ),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at          DATETIME2 NULL
);
GO

-- BẢNG 22: bookings (Đơn đặt sân tổng thể)
CREATE TABLE dbo.bookings (
    booking_id               BIGINT IDENTITY(1,1) PRIMARY KEY,
    booking_code             VARCHAR(30) NOT NULL CONSTRAINT UQ_bookings_code UNIQUE,
    facility_id              BIGINT NOT NULL CONSTRAINT FK_bookings_facility REFERENCES dbo.facilities(facility_id),
    user_id                  BIGINT NULL CONSTRAINT FK_bookings_user REFERENCES dbo.users(user_id),
    team_id                  BIGINT NULL CONSTRAINT FK_bookings_team REFERENCES dbo.teams(team_id),
    package_id               BIGINT NULL CONSTRAINT FK_bookings_package REFERENCES dbo.booking_packages(package_id),
    created_by_staff_id      BIGINT NULL CONSTRAINT FK_bookings_staff REFERENCES dbo.users(user_id),
    booking_type             VARCHAR(20) NOT NULL CONSTRAINT CK_bookings_type CHECK (booking_type IN ('single', 'package', 'walk_in')),
    guest_name               NVARCHAR(100) NULL,
    guest_phone              VARCHAR(15) NULL,
    total_list_price         DECIMAL(12,2) NOT NULL,
    bulk_discount_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    voucher_discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
    points_discount_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    final_amount             DECIMAL(12,2) NOT NULL,
    voucher_campaign_id      BIGINT NULL CONSTRAINT FK_bookings_vouchercamp REFERENCES dbo.voucher_campaigns(campaign_id),
    user_voucher_id          BIGINT NULL CONSTRAINT FK_bookings_uservoucher REFERENCES dbo.user_vouchers(user_voucher_id),
    points_used              INT NOT NULL DEFAULT 0 CONSTRAINT CK_bookings_pts CHECK (points_used >= 0),
    hold_expires_at          DATETIME2 NULL,
    status                   VARCHAR(30) NOT NULL CONSTRAINT CK_bookings_status CHECK (
                             status IN (
                                 'holding', 'awaiting_confirmation', 'confirmed', 'in_use', 
                                 'completed', 'cancelled_by_player', 'cancelled_by_facility', 
                                 'expired', 'payment_rejected', 'resubmit_requested'
                             )
                            ),
    affected_reason          VARCHAR(30) NULL CONSTRAINT CK_bookings_affected CHECK (affected_reason IN ('facility_cancel', 'maintenance', 'court_off', 'hours_change')),
    affected_choice          VARCHAR(20) NULL CONSTRAINT CK_bookings_choice CHECK (affected_choice IN ('reschedule', 'refund', 'points')),
    created_at               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at               DATETIME2 NULL,
    row_version              ROWVERSION
);
GO

-- BẢNG 23: booking_slots (Chi tiết từng slot 30 phút - Khóa chống trùng)
CREATE TABLE dbo.booking_slots (
    slot_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    booking_id          BIGINT NOT NULL CONSTRAINT FK_slots_booking REFERENCES dbo.bookings(booking_id) ON DELETE CASCADE,
    court_id            BIGINT NOT NULL CONSTRAINT FK_slots_court REFERENCES dbo.courts(court_id),
    booking_date        DATE NOT NULL,
    start_time          TIME(0) NOT NULL CONSTRAINT CK_slots_starttime CHECK (DATEPART(MINUTE, start_time) IN (0, 30)),
    end_time            TIME(0) NOT NULL,
    list_price          DECIMAL(12,2) NOT NULL DEFAULT 0,
    allocated_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
    checkin_status      VARCHAR(20) NOT NULL DEFAULT 'pending' CONSTRAINT CK_slots_checkin CHECK (checkin_status IN ('pending', 'checked_in', 'absent')),
    checkin_at          DATETIME2 NULL,
    is_active           BIT NOT NULL DEFAULT 1
);
GO

-- KHÓA CHỐNG TRÙNG LỊCH BẰNG FILTERED UNIQUE INDEX (ANTI DOUBLE-BOOKING)
CREATE UNIQUE NONCLUSTERED INDEX IX_booking_slots_anti_collision
ON dbo.booking_slots(court_id, booking_date, start_time)
WHERE is_active = 1;
GO

-- ====================================================================================
-- PHÂN HỆ 5: THANH TOÁN, HOÀN TIỀN & ĐỐI SOÁT (BẢNG 24 - 29)
-- ====================================================================================

-- BẢNG 24: payments (Giao dịch thanh toán)
CREATE TABLE dbo.payments (
    payment_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    payment_code            VARCHAR(30) NOT NULL CONSTRAINT UQ_payments_code UNIQUE,
    booking_id              BIGINT NULL CONSTRAINT FK_payments_booking REFERENCES dbo.bookings(booking_id),
    package_id              BIGINT NULL CONSTRAINT FK_payments_package REFERENCES dbo.booking_packages(package_id),
    reschedule_id           BIGINT NULL, -- FK thêm sau
    amount_due              DECIMAL(12,2) NOT NULL,
    amount_paid             DECIMAL(12,2) NULL,
    payment_type            VARCHAR(30) NOT NULL CONSTRAINT CK_payments_type CHECK (payment_type IN ('full_payment', 'deposit', 'reschedule_surplus', 'counter_settlement')),
    payment_method          VARCHAR(20) NOT NULL CONSTRAINT CK_payments_method CHECK (payment_method IN ('vietqr', 'cash')),
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending_proof'
                            CONSTRAINT CK_payments_status CHECK (status IN ('pending_proof', 'pending_approval', 'approved', 'rejected', 'resubmit_requested')),
    rejection_reason        NVARCHAR(255) NULL,
    resubmit_attempts_left  TINYINT NOT NULL DEFAULT 3,
    resubmit_deadline       DATETIME2 NULL,
    verified_by_staff_id    BIGINT NULL CONSTRAINT FK_payments_staff REFERENCES dbo.users(user_id),
    verified_at             DATETIME2 NULL,
    created_at              DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 25: payment_proofs (Ảnh chụp chứng từ chuyển khoản)
CREATE TABLE dbo.payment_proofs (
    proof_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    payment_id          BIGINT NOT NULL CONSTRAINT FK_proofs_payment REFERENCES dbo.payments(payment_id) ON DELETE CASCADE,
    image_url           VARCHAR(500) NOT NULL,
    uploaded_by_user_id BIGINT NOT NULL CONSTRAINT FK_proofs_user REFERENCES dbo.users(user_id),
    submission_count    INT NOT NULL DEFAULT 1,
    uploaded_at         DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 26: receipts (Hóa đơn / Phiếu thu điện tử)
CREATE TABLE dbo.receipts (
    receipt_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    receipt_code        VARCHAR(30) NOT NULL CONSTRAINT UQ_receipts_code UNIQUE,
    payment_id          BIGINT NOT NULL CONSTRAINT UQ_receipts_payment UNIQUE CONSTRAINT FK_receipts_payment REFERENCES dbo.payments(payment_id),
    amount              DECIMAL(12,2) NOT NULL,
    issued_at           DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 27: booking_reschedules (Yêu cầu đổi lịch đặt sân)
CREATE TABLE dbo.booking_reschedules (
    reschedule_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    booking_id          BIGINT NOT NULL CONSTRAINT FK_reschedule_booking REFERENCES dbo.bookings(booking_id),
    old_slot_id         BIGINT NOT NULL CONSTRAINT FK_reschedule_old_slot REFERENCES dbo.booking_slots(slot_id),
    new_court_id        BIGINT NOT NULL CONSTRAINT FK_reschedule_new_court REFERENCES dbo.courts(court_id),
    new_date            DATE NOT NULL,
    new_start_time      TIME(0) NOT NULL,
    new_end_time        TIME(0) NOT NULL,
    price_difference    DECIMAL(12,2) NOT NULL DEFAULT 0,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_extra_payment'
                        CONSTRAINT CK_reschedule_status CHECK (status IN ('pending_extra_payment', 'awaiting_confirmation', 'approved', 'rejected', 'expired')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

ALTER TABLE dbo.payments
ADD CONSTRAINT FK_payments_reschedule FOREIGN KEY (reschedule_id) REFERENCES dbo.booking_reschedules(reschedule_id);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_reschedule_one_pending
ON dbo.booking_reschedules(booking_id) WHERE status IN ('pending_extra_payment', 'awaiting_confirmation');
GO

-- BẢNG 28: refund_records (Hồ sơ hoàn tiền)
CREATE TABLE dbo.refund_records (
    refund_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    booking_id          BIGINT NOT NULL CONSTRAINT FK_refunds_booking REFERENCES dbo.bookings(booking_id),
    complaint_id        BIGINT NULL, -- FK thêm sau
    amount              DECIMAL(12,2) NOT NULL DEFAULT 0,
    points_refunded     INT NOT NULL DEFAULT 0,
    bank_name           NVARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(30) NOT NULL,
    bank_account_holder NVARCHAR(100) NOT NULL,
    refund_type         VARCHAR(30) NOT NULL 
                        CONSTRAINT CK_refunds_type CHECK (refund_type IN ('facility_cancellation', 'overpayment', 'complaint_bounty')),
    refund_status       VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CONSTRAINT CK_refunds_status CHECK (refund_status IN ('pending', 'approved', 'transferred', 'rejected')),
    approved_by_owner_id BIGINT NULL CONSTRAINT FK_refunds_approver REFERENCES dbo.users(user_id),
    proof_image_url     VARCHAR(500) NULL,
    transferred_at      DATETIME2 NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 29: daily_reconciliations (Đối soát ca trực và kiểm kê cuối ngày)
CREATE TABLE dbo.daily_reconciliations (
    reconciliation_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_recon_facility REFERENCES dbo.facilities(facility_id),
    recon_date          DATE NOT NULL,
    system_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
    bank_received       DECIMAL(12,2) NOT NULL DEFAULT 0,
    cash_received       DECIMAL(12,2) NOT NULL DEFAULT 0,
    difference_cash     AS (bank_received + cash_received - system_total) PERSISTED,
    note                NVARCHAR(500) NULL,
    staff_id            BIGINT NOT NULL CONSTRAINT FK_recon_staff REFERENCES dbo.users(user_id),
    status              VARCHAR(30) NOT NULL DEFAULT 'submitted'
                        CONSTRAINT CK_recon_status CHECK (status IN ('draft', 'submitted', 'owner_approved')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_facility_recon_date UNIQUE (facility_id, recon_date)
);
GO

-- ====================================================================================
-- PHÂN HỆ 6: CỤM MULTI-TENANT LOYALTY & TÍCH ĐIỂM (BẢNG 30 - 34)
-- ====================================================================================

-- BẢNG 30: player_facility_accounts (Ví điểm & chi tiêu tích lũy theo từng cơ sở)
CREATE TABLE dbo.player_facility_accounts (
    account_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    player_id           BIGINT NOT NULL CONSTRAINT FK_pfacc_player REFERENCES dbo.users(user_id),
    facility_id         BIGINT NOT NULL CONSTRAINT FK_pfacc_facility REFERENCES dbo.facilities(facility_id),
    point_balance       INT NOT NULL DEFAULT 0 CONSTRAINT CK_pfacc_points CHECK (point_balance >= 0),
    total_spending      DECIMAL(14,2) NOT NULL DEFAULT 0 CONSTRAINT CK_pfacc_spending CHECK (total_spending >= 0),
    total_sessions      INT NOT NULL DEFAULT 0 CONSTRAINT CK_pfacc_sessions CHECK (total_sessions >= 0),
    updated_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_player_facility_acc UNIQUE (player_id, facility_id)
);
GO

-- BẢNG 31: point_transactions (Lịch sử biến động cộng / trừ điểm)
CREATE TABLE dbo.point_transactions (
    point_tx_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    player_id           BIGINT NOT NULL CONSTRAINT FK_pttx_player REFERENCES dbo.users(user_id),
    facility_id         BIGINT NOT NULL CONSTRAINT FK_pttx_facility REFERENCES dbo.facilities(facility_id),
    booking_id          BIGINT NULL CONSTRAINT FK_pttx_booking REFERENCES dbo.bookings(booking_id),
    points_changed      INT NOT NULL,
    balance_after       INT NOT NULL,
    tx_type             VARCHAR(20) NOT NULL CONSTRAINT CK_pttx_type CHECK (tx_type IN ('earn', 'redeem', 'refund', 'compensation', 'adjustment')),
    earn_rate_applied   INT NULL,
    reason              NVARCHAR(255) NOT NULL,
    created_by_user_id  BIGINT NULL CONSTRAINT FK_pttx_creator REFERENCES dbo.users(user_id),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 32: cumulative_reward_tiers (Mốc chi tiêu tích lũy nhận thưởng Voucher)
CREATE TABLE dbo.cumulative_reward_tiers (
    tier_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_rewardtiers_facility REFERENCES dbo.facilities(facility_id),
    threshold_amount    DECIMAL(14,2) NOT NULL CONSTRAINT CK_rewardtiers_thresh CHECK (threshold_amount > 0),
    voucher_value       DECIMAL(12,2) NOT NULL CONSTRAINT CK_rewardtiers_val CHECK (voucher_value > 0),
    voucher_valid_days  SMALLINT NOT NULL DEFAULT 30 CONSTRAINT CK_rewardtiers_days CHECK (voucher_valid_days > 0),
    reward_campaign_id  BIGINT NULL CONSTRAINT FK_rewardtiers_campaign REFERENCES dbo.voucher_campaigns(campaign_id),
    is_active           BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_facility_tier_threshold UNIQUE (facility_id, threshold_amount)
);
GO

-- BẢNG 33: cumulative_reward_grants (Lưu vết trao thưởng theo mốc)
CREATE TABLE dbo.cumulative_reward_grants (
    grant_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    player_id           BIGINT NOT NULL CONSTRAINT FK_rewardgrants_player REFERENCES dbo.users(user_id),
    tier_id             BIGINT NOT NULL CONSTRAINT FK_rewardgrants_tier REFERENCES dbo.cumulative_reward_tiers(tier_id),
    cycle_no            INT NOT NULL DEFAULT 1,
    user_voucher_id     BIGINT NOT NULL CONSTRAINT FK_rewardgrants_uservoucher REFERENCES dbo.user_vouchers(user_voucher_id),
    granted_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_player_tier_cycle UNIQUE (player_id, tier_id, cycle_no)
);
GO

-- BẢNG 34: voucher_usages (Nhật ký áp dụng Voucher vào đơn đặt)
CREATE TABLE dbo.voucher_usages (
    usage_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    campaign_id         BIGINT NOT NULL CONSTRAINT FK_vusages_campaign REFERENCES dbo.voucher_campaigns(campaign_id),
    player_id           BIGINT NOT NULL CONSTRAINT FK_vusages_player REFERENCES dbo.users(user_id),
    booking_id          BIGINT NOT NULL CONSTRAINT FK_vusages_booking REFERENCES dbo.bookings(booking_id),
    user_voucher_id     BIGINT NULL CONSTRAINT FK_vusages_uservoucher REFERENCES dbo.user_vouchers(user_voucher_id),
    discount_applied_amount DECIMAL(12,2) NOT NULL,
    used_at             DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ====================================================================================
-- PHÂN HỆ 7: GHÉP KÈO GIAO LƯU, ĐÁNH GIÁ, KHIẾU NẠI & HỆ THỐNG (BẢNG 35 - 40)
-- ====================================================================================

-- BẢNG 35: matches (Kèo giao lưu tìm người chơi)
CREATE TABLE dbo.matches (
    match_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    match_code          VARCHAR(30) NOT NULL CONSTRAINT UQ_matches_code UNIQUE,
    booking_id          BIGINT NOT NULL CONSTRAINT UQ_matches_booking UNIQUE CONSTRAINT FK_matches_booking REFERENCES dbo.bookings(booking_id),
    host_team_id        BIGINT NULL CONSTRAINT FK_matches_team REFERENCES dbo.teams(team_id),
    host_user_id        BIGINT NOT NULL CONSTRAINT FK_matches_host REFERENCES dbo.users(user_id),
    title               NVARCHAR(150) NOT NULL,
    skill_level_required NVARCHAR(50) NOT NULL DEFAULT N'Trung bình',
    current_players     INT NOT NULL DEFAULT 1,
    needed_players      INT NOT NULL CONSTRAINT CK_matches_needed CHECK (needed_players BETWEEN 1 AND 7),
    total_capacity      INT NOT NULL DEFAULT 8 CONSTRAINT CK_matches_cap CHECK (total_capacity <= 8),
    cost_note           NVARCHAR(255) NULL DEFAULT N'Chi phí chia đều tại sân',
    share_phone         BIT NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                        CONSTRAINT CK_matches_status CHECK (status IN ('open', 'full', 'closed', 'cancelled', 'expired')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 36: match_join_requests (Yêu cầu tham gia kèo giao lưu)
CREATE TABLE dbo.match_join_requests (
    request_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    match_id            BIGINT NOT NULL CONSTRAINT FK_matchreq_match REFERENCES dbo.matches(match_id) ON DELETE CASCADE,
    player_id           BIGINT NOT NULL CONSTRAINT FK_matchreq_player REFERENCES dbo.users(user_id),
    self_skill_level    NVARCHAR(50) NOT NULL DEFAULT N'Trung bình',
    note                NVARCHAR(255) NULL,
    share_phone         BIT NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CONSTRAINT CK_matchreq_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_matchreq_unique ON dbo.match_join_requests(match_id, player_id) WHERE status <> 'cancelled';
GO

-- BẢNG 37: reviews (Đánh giá chất lượng sân)
CREATE TABLE dbo.reviews (
    review_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    booking_id          BIGINT NOT NULL CONSTRAINT UQ_reviews_booking UNIQUE CONSTRAINT FK_reviews_booking REFERENCES dbo.bookings(booking_id),
    court_id            BIGINT NOT NULL CONSTRAINT FK_reviews_court REFERENCES dbo.courts(court_id),
    user_id             BIGINT NOT NULL CONSTRAINT FK_reviews_user REFERENCES dbo.users(user_id),
    facility_id         BIGINT NOT NULL CONSTRAINT FK_reviews_facility REFERENCES dbo.facilities(facility_id),
    rating_stars        TINYINT NOT NULL CONSTRAINT CK_reviews_rating CHECK (rating_stars BETWEEN 1 AND 5),
    comment             NVARCHAR(1000) NULL,
    owner_reply         NVARCHAR(1000) NULL,
    replied_at          DATETIME2 NULL,
    is_hidden           BIT NOT NULL DEFAULT 0,
    hidden_by_user_id   BIGINT NULL CONSTRAINT FK_reviews_hiddenby REFERENCES dbo.users(user_id),
    hidden_at           DATETIME2 NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 38: complaints (Gửi và xử lý khiếu nại)
CREATE TABLE dbo.complaints (
    complaint_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    complaint_code      VARCHAR(30) NOT NULL CONSTRAINT UQ_complaints_code UNIQUE,
    facility_id         BIGINT NOT NULL CONSTRAINT FK_complaints_facility REFERENCES dbo.facilities(facility_id),
    booking_id          BIGINT NULL CONSTRAINT FK_complaints_booking REFERENCES dbo.bookings(booking_id),
    payment_id          BIGINT NULL CONSTRAINT FK_complaints_payment REFERENCES dbo.payments(payment_id),
    user_id             BIGINT NOT NULL CONSTRAINT FK_complaints_user REFERENCES dbo.users(user_id),
    complaint_type      VARCHAR(30) NOT NULL CONSTRAINT CK_complaints_type CHECK (complaint_type IN ('payment', 'court', 'service', 'reschedule', 'cancellation', 'other')),
    title               NVARCHAR(150) NOT NULL,
    content             NVARCHAR(2000) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'submitted'
                        CONSTRAINT CK_complaints_status CHECK (status IN ('submitted', 'pending_owner', 'resolved', 'rejected')),
    outcome             VARCHAR(30) NULL CONSTRAINT CK_complaints_outcome CHECK (outcome IN ('refund', 'compensation_points', 'apology', 'no_compensation')),
    staff_note          NVARCHAR(1000) NULL,
    decision_reason     NVARCHAR(1000) NULL,
    resolved_by_user_id BIGINT NULL CONSTRAINT FK_complaints_resolver REFERENCES dbo.users(user_id),
    resolved_at         DATETIME2 NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_complaints_target CHECK (booking_id IS NOT NULL OR payment_id IS NOT NULL)
);
GO

ALTER TABLE dbo.refund_records
ADD CONSTRAINT FK_refunds_complaint FOREIGN KEY (complaint_id) REFERENCES dbo.complaints(complaint_id);
GO

-- BẢNG 39: notifications (Thông báo trong ứng dụng In-app)
CREATE TABLE dbo.notifications (
    notification_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id             BIGINT NOT NULL CONSTRAINT FK_notif_user REFERENCES dbo.users(user_id),
    facility_id         BIGINT NULL CONSTRAINT FK_notif_facility REFERENCES dbo.facilities(facility_id),
    message_code        VARCHAR(20) NULL,
    title               NVARCHAR(150) NOT NULL,
    message             NVARCHAR(1000) NOT NULL,
    notification_type   VARCHAR(30) NOT NULL CONSTRAINT CK_notif_type CHECK (notification_type IN ('booking', 'payment', 'match', 'team', 'complaint', 'system')),
    is_read             BIT NOT NULL DEFAULT 0,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- BẢNG 40: audit_logs (Nhật ký kiểm toán hệ thống)
CREATE TABLE dbo.audit_logs (
    audit_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id             BIGINT NULL CONSTRAINT FK_audit_user REFERENCES dbo.users(user_id),
    action_name         NVARCHAR(150) NOT NULL,
    entity_name         VARCHAR(100) NOT NULL,
    entity_id           VARCHAR(50) NOT NULL,
    change_details      NVARCHAR(MAX) NULL,
    ip_address          VARCHAR(45) NULL,
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ====================================================================================
-- SEED DATA BAN ĐẦU (VAI TRÒ VÀ THAM SỐ TOÀN HỆ THỐNG P01..P33)
-- ====================================================================================
INSERT INTO dbo.roles (role_id, role_code, role_name) VALUES
(1, 'player', N'Người chơi'),
(2, 'staff',  N'Nhân viên'),
(3, 'owner',  N'Chủ sân'),
(4, 'admin',  N'Quản trị viên');
GO

INSERT INTO dbo.system_settings (facility_id, setting_code, setting_name, setting_value, data_type, description) VALUES
(NULL, 'P01', N'Giá mặc định 1 slot', '100000', 'INTEGER', N'Giá mặc định 1 slot 30 phút (VND)'),
(NULL, 'P02', N'Thời gian giữ chỗ booking lẻ', '5', 'INTEGER', N'Thời gian giữ chỗ đếm ngược booking lẻ (Phút) - BR03'),
(NULL, 'P03', N'Hạn chót đổi lịch tối thiểu', '6', 'INTEGER', N'Hạn chót đổi lịch tối thiểu trước giờ chơi (Giờ) - BR25'),
(NULL, 'P04', N'Số lần đổi lịch tối đa', '1', 'INTEGER', N'Số lần đổi lịch tối đa cho mỗi buổi - BR29'),
(NULL, 'P05', N'Tỷ lệ thời gian đệm đổi lịch', '50', 'INTEGER', N'Tỷ lệ % T thời gian đệm tính hạn chót đổi lịch - BR25'),
(NULL, 'P06', N'Số lần nộp lại chứng từ tối đa', '3', 'INTEGER', N'Số lần nộp lại bill chuyển khoản tối đa - BR34'),
(NULL, 'P08', N'Số booking chờ thanh toán tối đa', '2', 'INTEGER', N'Số booking chờ thanh toán tối đa của 1 Player - BR35'),
(NULL, 'P09', N'Số tiền thực trả để đổi 1 điểm', '10000', 'INTEGER', N'Số tiền thực trả quy đổi 1 điểm thưởng (VND) - BR38'),
(NULL, 'P10', N'Giá trị quy đổi 1 điểm thưởng', '500', 'INTEGER', N'Giá trị quy đổi 1 điểm thưởng (VND) - BR39'),
(NULL, 'P15', N'Số thành viên tối đa của Đội', '20', 'INTEGER', N'Số lượng thành viên tối đa của 1 Đội - BR23'),
(NULL, 'P16', N'Số người chơi tối đa của Kèo', '8', 'INTEGER', N'Số lượng người chơi tối đa của 1 Kèo - BR46'),
(NULL, 'P19', N'Thời gian cảnh báo kết thúc', '5', 'INTEGER', N'Thời gian cảnh báo trước khi booking kết thúc (Phút) - FR79'),
(NULL, 'P24', N'Thời gian chờ xác nhận báo khẩn', '15', 'INTEGER', N'Thời gian chờ xác nhận thanh toán tối đa báo khẩn (Phút) - FR94'),
(NULL, 'P27', N'Thời gian giữ chỗ gói', '15', 'INTEGER', N'Thời gian giữ chỗ khi đặt gói nhiều buổi (Phút) - BR53');
GO


