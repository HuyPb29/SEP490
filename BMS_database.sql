-- ============================================================
-- BMS (SEP490-G13) - Tạo database BMS và 36 bảng, SQL Server 2019+. Chỉ có cấu trúc, chưa có dữ liệu.
-- Theo Baseline 2 (UC_FR_NFR_baseline2.xlsx, 21/10/2026). Sinh tự động từ erd_spec.js, khớp BMS_ERD.drawio.
-- Khóa ngoại thêm sau cùng (account <-> location tham chiếu vòng).
-- Trạng thái lưu bằng mã viết hoa theo sheet Trang_thai (@Enumerated(EnumType.STRING)).
-- Giờ trong ngày (cột ..._minute) lưu bằng số phút từ 0 giờ, bội số 30: 06:00 = 360, 23:30 = 1410, 24:00 = 1440.
-- Khóa ngoại kép (fkc_...): cột location_id/player_id lặp lại phải khớp với bảng cha, ví dụ booking.location_id = địa điểm của sân.
-- Cách chạy: mở trong SSMS rồi Execute, hoặc
--   sqlcmd -S localhost -E -C -b -f 65001 -i BMS_database.sql
-- Database BMS đã có bảng thì script dừng, không xóa, không sửa gì. Muốn tạo lại thì tự DROP DATABASE BMS trước.
-- ============================================================
IF DB_ID(N'BMS') IS NULL
    CREATE DATABASE BMS COLLATE Vietnamese_CI_AS;  -- CI: tên đăng nhập, email không phân biệt hoa thường (DR17, DR22)
GO
USE BMS;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;  -- bắt buộc cho filtered unique index
GO
IF OBJECT_ID(N'dbo.account', N'U') IS NOT NULL
BEGIN
    RAISERROR(N'Database BMS đã có bảng. Script dừng, không sửa gì.', 16, 1);
    RETURN;
END;
SET XACT_ABORT ON;  -- lỗi ở bất kỳ câu nào thì hủy toàn bộ, không để database tạo dở
BEGIN TRANSACTION;

-- account: Tài khoản của Player, Staff, Owner, Admin (Guest không có tài khoản).
CREATE TABLE account (
    id BIGINT IDENTITY(1,1) NOT NULL,
    username VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    phone VARCHAR(10) NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name NVARCHAR(50) NOT NULL,
    role VARCHAR(10) NOT NULL,
    skill_level NVARCHAR(30) NULL,
    location_id BIGINT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_account_status DEFAULT 'ACTIVE',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_account_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL,
    CONSTRAINT pk_account PRIMARY KEY (id),
    CONSTRAINT uq_account_username UNIQUE (username),
    CONSTRAINT ck_account_role CHECK (role IN ('PLAYER','STAFF','OWNER','ADMIN')),
    CONSTRAINT ck_account_status CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
    CONSTRAINT ck_account_staff_location CHECK ((role = 'STAFF' AND location_id IS NOT NULL) OR (role <> 'STAFF' AND location_id IS NULL)),
    CONSTRAINT ck_account_email CHECK (role NOT IN ('PLAYER','OWNER') OR email IS NOT NULL),
    CONSTRAINT ck_account_phone CHECK (role NOT IN ('PLAYER','OWNER') OR phone IS NOT NULL),
    CONSTRAINT ck_account_phone_digits CHECK (phone IS NULL OR (LEN(phone) = 10 AND phone COLLATE Latin1_General_BIN NOT LIKE '%[^0-9]%')),
    CONSTRAINT ck_account_username CHECK (LEN(username) >= 4 AND username COLLATE Latin1_General_BIN LIKE '[a-z]%' AND username COLLATE Latin1_General_BIN NOT LIKE '%[^a-z0-9._]%')
);
CREATE UNIQUE INDEX ux_account_email ON account (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ux_account_player_phone ON account (phone) WHERE role = 'PLAYER';

-- otp_request: Mã OTP gửi qua email khi đăng ký và quên mật khẩu (DR25).
CREATE TABLE otp_request (
    id BIGINT IDENTITY(1,1) NOT NULL,
    email VARCHAR(100) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    code_hash VARCHAR(100) NOT NULL,
    pending_data NVARCHAR(MAX) NULL,
    failed_attempts TINYINT NOT NULL CONSTRAINT df_otp_request_failed_attempts DEFAULT 0,
    expires_at DATETIME2(0) NOT NULL,
    used_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_otp_request_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_otp_request PRIMARY KEY (id),
    CONSTRAINT ck_otp_purpose CHECK (purpose IN ('REGISTER','RESET_PASSWORD'))
);
CREATE INDEX ix_otp_email ON otp_request (email, created_at);

-- service_registration: Yêu cầu đăng ký sử dụng dịch vụ (UC05, UC06).
CREATE TABLE service_registration (
    id BIGINT IDENTITY(1,1) NOT NULL,
    requester_id BIGINT NULL,
    location_name NVARCHAR(100) NOT NULL,
    address NVARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    court_count INT NOT NULL,
    contact_name NVARCHAR(50) NULL,
    contact_phone VARCHAR(10) NULL,
    contact_email VARCHAR(100) NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_service_registration_status DEFAULT 'PENDING',
    reject_reason NVARCHAR(500) NULL,
    processed_by BIGINT NULL,
    processed_at DATETIME2(0) NULL,
    location_id BIGINT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_service_registration_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_service_registration PRIMARY KEY (id),
    CONSTRAINT ck_sreg_courts CHECK (court_count > 0),
    CONSTRAINT ck_sreg_phone_digits CHECK (contact_phone IS NULL OR (LEN(contact_phone) = 10 AND contact_phone COLLATE Latin1_General_BIN NOT LIKE '%[^0-9]%')),
    CONSTRAINT ck_sreg_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    CONSTRAINT ck_sreg_guest_contact CHECK (requester_id IS NOT NULL OR (contact_name IS NOT NULL AND contact_phone IS NOT NULL AND contact_email IS NOT NULL)),
    CONSTRAINT ck_sreg_reject_reason CHECK (status <> 'REJECTED' OR reject_reason IS NOT NULL)
);
CREATE UNIQUE INDEX ux_sreg_location ON service_registration (location_id) WHERE location_id IS NOT NULL;

-- location: Địa điểm (cơ sở) thuê dịch vụ; mọi dữ liệu nghiệp vụ tính riêng theo địa điểm (BR60).
CREATE TABLE location (
    id BIGINT IDENTITY(1,1) NOT NULL,
    owner_id BIGINT NOT NULL,
    name NVARCHAR(100) NOT NULL,
    address NVARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    contact_phone VARCHAR(10) NOT NULL,
    bank_name NVARCHAR(100) NULL,
    bank_account_no VARCHAR(30) NULL,
    bank_account_holder NVARCHAR(100) NULL,
    qr_image_path VARCHAR(255) NULL,
    advance_booking_days SMALLINT NOT NULL CONSTRAINT df_location_advance_booking_days DEFAULT 30,
    point_earning_rate INT NOT NULL CONSTRAINT df_location_point_earning_rate DEFAULT 10000,
    status VARCHAR(10) NOT NULL CONSTRAINT df_location_status DEFAULT 'ACTIVE',
    locked_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_location_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL,
    CONSTRAINT pk_location PRIMARY KEY (id),
    CONSTRAINT ck_location_status CHECK (status IN ('ACTIVE','LOCKED')),
    CONSTRAINT ck_location_phone_digits CHECK (contact_phone IS NULL OR (LEN(contact_phone) = 10 AND contact_phone COLLATE Latin1_General_BIN NOT LIKE '%[^0-9]%')),
    CONSTRAINT ck_location_advance CHECK (advance_booking_days > 0),
    CONSTRAINT ck_location_rate CHECK (point_earning_rate BETWEEN 1000 AND 100000)
);
CREATE INDEX ix_location_owner ON location (owner_id);

-- service_term: Thời hạn sử dụng dịch vụ, mỗi lần đăng ký mới hoặc gia hạn một dòng (FR12).
CREATE TABLE service_term (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    recorded_by BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_service_term_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_service_term PRIMARY KEY (id),
    CONSTRAINT ck_sterm_12_months CHECK (end_date >= DATEADD(DAY, -1, DATEADD(MONTH, 12, start_date)))
);
CREATE INDEX ix_sterm_location ON service_term (location_id, end_date);

-- court: Sân con của địa điểm (UC07).
CREATE TABLE court (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    name NVARCHAR(50) NOT NULL,
    description NVARCHAR(255) NULL,
    is_active BIT NOT NULL CONSTRAINT df_court_is_active DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_court_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL,
    CONSTRAINT pk_court PRIMARY KEY (id),
    CONSTRAINT ux_court_name UNIQUE (location_id, name),
    CONSTRAINT uk_court_id_location UNIQUE (id, location_id)
);

-- opening_hour: Giờ mở cửa theo thứ trong tuần (FR18). Không có dòng = ngày đó đóng cửa.
CREATE TABLE opening_hour (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    day_of_week TINYINT NOT NULL,
    open_minute SMALLINT NOT NULL,
    close_minute SMALLINT NOT NULL,
    CONSTRAINT pk_opening_hour PRIMARY KEY (id),
    CONSTRAINT ux_ohour_day UNIQUE (location_id, day_of_week),
    CONSTRAINT ck_ohour_dow CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_ohour_time CHECK (close_minute > open_minute),
    CONSTRAINT ck_ohour_minute CHECK (open_minute BETWEEN 0 AND 1410 AND open_minute % 30 = 0 AND close_minute BETWEEN 30 AND 1440 AND close_minute % 30 = 0)
);

-- opening_exception: Ngày mở cửa ngoại lệ (FR18, BR04).
CREATE TABLE opening_exception (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    exception_date DATE NOT NULL,
    open_minute SMALLINT NOT NULL,
    close_minute SMALLINT NOT NULL,
    note NVARCHAR(255) NULL,
    CONSTRAINT pk_opening_exception PRIMARY KEY (id),
    CONSTRAINT ux_oexc_date UNIQUE (location_id, exception_date),
    CONSTRAINT ck_oexc_time CHECK (close_minute > open_minute),
    CONSTRAINT ck_oexc_minute CHECK (open_minute BETWEEN 0 AND 1410 AND open_minute % 30 = 0 AND close_minute BETWEEN 30 AND 1440 AND close_minute % 30 = 0)
);

-- price_rule: Mức giá theo sân, ngày, khung giờ, thời gian áp dụng (FR20, FR21).
CREATE TABLE price_rule (
    id BIGINT IDENTITY(1,1) NOT NULL,
    court_id BIGINT NOT NULL,
    apply_days CHAR(7) NOT NULL,
    start_minute SMALLINT NOT NULL,
    end_minute SMALLINT NOT NULL,
    price_per_slot DECIMAL(12,0) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_price_rule_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_price_rule PRIMARY KEY (id),
    CONSTRAINT ck_price_days CHECK (apply_days LIKE '[01][01][01][01][01][01][01]' AND apply_days <> '0000000'),
    CONSTRAINT ck_price_time CHECK (end_minute > start_minute),
    CONSTRAINT ck_price_minute CHECK (start_minute BETWEEN 0 AND 1410 AND start_minute % 30 = 0 AND end_minute BETWEEN 30 AND 1440 AND end_minute % 30 = 0),
    CONSTRAINT ck_price_amount CHECK (price_per_slot > 0),
    CONSTRAINT ck_price_valid CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX ix_price_court ON price_rule (court_id, valid_from);

-- maintenance: Yêu cầu bảo trì sân: Staff tạo, Owner duyệt (FR23–FR25).
CREATE TABLE maintenance (
    id BIGINT IDENTITY(1,1) NOT NULL,
    court_id BIGINT NOT NULL,
    start_at DATETIME2(0) NOT NULL,
    end_at DATETIME2(0) NOT NULL,
    reason NVARCHAR(500) NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_maintenance_status DEFAULT 'PENDING',
    requested_by BIGINT NOT NULL,
    approved_by BIGINT NULL,
    decided_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_maintenance_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_maintenance PRIMARY KEY (id),
    CONSTRAINT ck_maint_time CHECK (end_at > start_at),
    CONSTRAINT ck_maint_half CHECK (DATEPART(MINUTE, start_at) IN (0, 30) AND DATEPART(SECOND, start_at) = 0 AND DATEPART(MINUTE, end_at) IN (0, 30) AND DATEPART(SECOND, end_at) = 0),
    CONSTRAINT ck_maint_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE INDEX ix_maint_court ON maintenance (court_id, start_at);

-- booking_package: Gói đặt nhiều buổi (booking tổng); các buổi con là booking loại SESSION (BR10, DR06).
CREATE TABLE booking_package (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    batch_offer_id BIGINT NULL,
    package_type VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    list_amount DECIMAL(12,0) NOT NULL,
    voucher_discount DECIMAL(12,0) NOT NULL CONSTRAINT df_booking_package_voucher_discount DEFAULT 0,
    points_used INT NOT NULL CONSTRAINT df_booking_package_points_used DEFAULT 0,
    point_discount DECIMAL(12,0) NOT NULL CONSTRAINT df_booking_package_point_discount DEFAULT 0,
    final_amount DECIMAL(12,0) NOT NULL,
    status VARCHAR(30) NOT NULL CONSTRAINT df_booking_package_status DEFAULT 'HOLDING',
    hold_expires_at DATETIME2(0) NULL,
    version INT NOT NULL CONSTRAINT df_booking_package_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_booking_package_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_booking_package PRIMARY KEY (id),
    CONSTRAINT uk_pkg_id_location UNIQUE (id, location_id),
    CONSTRAINT ck_pkg_type CHECK (package_type IN ('RECURRING','CUSTOM')),
    CONSTRAINT ck_pkg_status CHECK (status IN ('HOLDING','AWAITING_CONFIRMATION','RESUBMIT_REQUESTED','CONFIRMED','PAYMENT_REJECTED','EXPIRED')),
    CONSTRAINT ck_pkg_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_pkg_amount CHECK (final_amount > 0 AND voucher_discount >= 0 AND point_discount >= 0 AND points_used >= 0),
    CONSTRAINT ck_pkg_point_min CHECK (points_used = 0 OR point_discount >= 1000)
);
CREATE INDEX ix_pkg_player ON booking_package (player_id, status);

-- booking: Booking lẻ, buổi trong gói, booking tại quầy (UC14–UC17).
CREATE TABLE booking (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_code VARCHAR(20) NOT NULL,
    booking_type VARCHAR(10) NOT NULL,
    location_id BIGINT NOT NULL,
    court_id BIGINT NOT NULL,
    player_id BIGINT NULL,
    team_id BIGINT NULL,
    package_id BIGINT NULL,
    staff_id BIGINT NULL,
    customer_name NVARCHAR(50) NULL,
    customer_phone VARCHAR(10) NULL,
    play_date DATE NOT NULL,
    start_minute SMALLINT NOT NULL,
    end_minute SMALLINT NOT NULL,
    note NVARCHAR(200) NULL,
    list_amount DECIMAL(12,0) NOT NULL,
    voucher_discount DECIMAL(12,0) NOT NULL CONSTRAINT df_booking_voucher_discount DEFAULT 0,
    points_used INT NOT NULL CONSTRAINT df_booking_points_used DEFAULT 0,
    point_discount DECIMAL(12,0) NOT NULL CONSTRAINT df_booking_point_discount DEFAULT 0,
    final_amount DECIMAL(12,0) NOT NULL,
    status VARCHAR(30) NOT NULL CONSTRAINT df_booking_status DEFAULT 'HOLDING',
    hold_expires_at DATETIME2(0) NULL,
    reschedule_count TINYINT NOT NULL CONSTRAINT df_booking_reschedule_count DEFAULT 0,
    cancelled_by BIGINT NULL,
    cancelled_at DATETIME2(0) NULL,
    version INT NOT NULL CONSTRAINT df_booking_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_booking_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL,
    loyalty_refund_processed BIT NOT NULL CONSTRAINT df_booking_loyalty_refund DEFAULT 0,
    loyalty_compensation_processed BIT NOT NULL CONSTRAINT df_booking_loyalty_compensation DEFAULT 0,
    CONSTRAINT pk_booking PRIMARY KEY (id),
    CONSTRAINT uq_booking_booking_code UNIQUE (booking_code),
    CONSTRAINT uk_booking_id_location UNIQUE (id, location_id),
    CONSTRAINT uk_booking_id_player UNIQUE (id, player_id),
    CONSTRAINT ck_booking_type CHECK (booking_type IN ('SINGLE','SESSION','WALK_IN')),
    CONSTRAINT ck_booking_phone_digits CHECK (customer_phone IS NULL OR (LEN(customer_phone) = 10 AND customer_phone COLLATE Latin1_General_BIN NOT LIKE '%[^0-9]%')),
    CONSTRAINT ck_booking_status CHECK (status IN ('HOLDING','AWAITING_CONFIRMATION','RESUBMIT_REQUESTED','CONFIRMED','IN_USE','COMPLETED','PAYMENT_REJECTED','EXPIRED','CANCELLED_BY_PLAYER','CANCELLED_BY_FACILITY')),
    CONSTRAINT ck_booking_walkin CHECK ((booking_type = 'WALK_IN' AND player_id IS NULL AND team_id IS NULL AND staff_id IS NOT NULL AND customer_name IS NOT NULL AND customer_phone IS NOT NULL) OR (booking_type <> 'WALK_IN' AND player_id IS NOT NULL)),
    CONSTRAINT ck_booking_session CHECK ((booking_type = 'SESSION' AND package_id IS NOT NULL) OR (booking_type <> 'SESSION' AND package_id IS NULL)),
    CONSTRAINT ck_booking_time CHECK (end_minute > start_minute),
    CONSTRAINT ck_booking_minute CHECK (start_minute BETWEEN 0 AND 1410 AND start_minute % 30 = 0 AND end_minute BETWEEN 30 AND 1440 AND end_minute % 30 = 0),
    CONSTRAINT ck_booking_amount CHECK (final_amount > 0 AND voucher_discount >= 0 AND point_discount >= 0 AND points_used >= 0),
    CONSTRAINT ck_booking_resched CHECK (reschedule_count <= 1),
    CONSTRAINT ck_booking_walkin_no_discount CHECK (booking_type <> 'WALK_IN' OR (voucher_discount = 0 AND points_used = 0 AND point_discount = 0)),
    CONSTRAINT ck_booking_point_min CHECK (booking_type = 'SESSION' OR points_used = 0 OR point_discount >= 1000)
);
CREATE INDEX ix_booking_player ON booking (player_id, status);
CREATE INDEX ix_booking_location_date ON booking (location_id, play_date);
CREATE INDEX ix_booking_package ON booking (package_id);
CREATE INDEX ix_booking_court ON booking (court_id, play_date);
CREATE INDEX ix_booking_team ON booking (team_id) WHERE team_id IS NOT NULL;

-- booking_slot: Từng slot 30 phút mà booking đang giữ; khóa chống đặt trùng (NFR04).
CREATE TABLE booking_slot (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    court_id BIGINT NOT NULL,
    slot_date DATE NOT NULL,
    slot_start_minute SMALLINT NOT NULL,
    price DECIMAL(12,0) NOT NULL,
    reschedule_request_id BIGINT NULL,
    is_active BIT NOT NULL CONSTRAINT df_booking_slot_is_active DEFAULT 1,
    CONSTRAINT pk_booking_slot PRIMARY KEY (id),
    CONSTRAINT ck_slot_minute CHECK (slot_start_minute BETWEEN 0 AND 1410 AND slot_start_minute % 30 = 0)
);
CREATE UNIQUE INDEX ux_slot_active ON booking_slot (court_id, slot_date, slot_start_minute) WHERE is_active = 1;
CREATE INDEX ix_slot_booking ON booking_slot (booking_id);

-- payment: Giao dịch thanh toán của một booking, một gói hoặc phần trả thêm khi đổi lịch (UC18, UC19).
CREATE TABLE payment (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    booking_id BIGINT NULL,
    package_id BIGINT NULL,
    reschedule_request_id BIGINT NULL,
    amount_due DECIMAL(12,0) NOT NULL,
    received_amount DECIMAL(12,0) NULL,
    status VARCHAR(30) NOT NULL CONSTRAINT df_payment_status DEFAULT 'AWAITING_CONFIRMATION',
    resubmit_count TINYINT NOT NULL CONSTRAINT df_payment_resubmit_count DEFAULT 0,
    resubmit_reason NVARCHAR(255) NULL,
    resubmit_deadline DATETIME2(0) NULL,
    reject_reason NVARCHAR(255) NULL,
    submitted_at DATETIME2(0) NULL,
    confirmed_by BIGINT NULL,
    confirmed_at DATETIME2(0) NULL,
    receipt_no VARCHAR(20) NULL,
    version INT NOT NULL CONSTRAINT df_payment_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_payment_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_payment PRIMARY KEY (id),
    CONSTRAINT uk_payment_id_location UNIQUE (id, location_id),
    CONSTRAINT ck_payment_target CHECK (CASE WHEN booking_id IS NULL THEN 0 ELSE 1 END + CASE WHEN package_id IS NULL THEN 0 ELSE 1 END + CASE WHEN reschedule_request_id IS NULL THEN 0 ELSE 1 END = 1),
    CONSTRAINT ck_payment_status CHECK (status IN ('AWAITING_CONFIRMATION','RESUBMIT_REQUESTED','CONFIRMED','REJECTED')),
    CONSTRAINT ck_payment_resubmit CHECK (resubmit_count <= 3),
    CONSTRAINT ck_payment_amount CHECK (amount_due > 0)
);
CREATE UNIQUE INDEX ux_payment_booking ON payment (booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payment_package ON payment (package_id) WHERE package_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payment_reschedule ON payment (reschedule_request_id) WHERE reschedule_request_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payment_receipt ON payment (receipt_no) WHERE receipt_no IS NOT NULL;
CREATE INDEX ix_payment_location_status ON payment (location_id, status);
CREATE INDEX ix_payment_confirmed ON payment (location_id, confirmed_at);

-- payment_proof: Ảnh chứng từ; mỗi lần gửi hoặc gửi lại thêm một dòng (FR54, FR55).
CREATE TABLE payment_proof (
    id BIGINT IDENTITY(1,1) NOT NULL,
    payment_id BIGINT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    uploaded_at DATETIME2(0) NOT NULL CONSTRAINT df_payment_proof_uploaded_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_payment_proof PRIMARY KEY (id)
);
CREATE INDEX ix_proof_payment ON payment_proof (payment_id);

-- reconciliation: Đối soát doanh thu cuối ngày (UC20, FR61).
CREATE TABLE reconciliation (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    recon_date DATE NOT NULL,
    system_amount DECIMAL(12,0) NOT NULL,
    actual_amount DECIMAL(12,0) NOT NULL,
    difference AS (actual_amount - system_amount) PERSISTED,
    reason NVARCHAR(500) NULL,
    staff_id BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_reconciliation_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_reconciliation PRIMARY KEY (id),
    CONSTRAINT ux_recon_day UNIQUE (location_id, recon_date),
    CONSTRAINT ck_recon_reason CHECK (actual_amount = system_amount OR reason IS NOT NULL)
);

-- reschedule_request: Yêu cầu đổi lịch (UC21) và đổi slot miễn phí khi sân hủy lịch (BR17a).
CREATE TABLE reschedule_request (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    new_court_id BIGINT NOT NULL,
    new_date DATE NOT NULL,
    new_start_minute SMALLINT NOT NULL,
    new_end_minute SMALLINT NOT NULL,
    old_list_amount DECIMAL(12,0) NOT NULL,
    new_list_amount DECIMAL(12,0) NOT NULL,
    extra_amount DECIMAL(12,0) NOT NULL CONSTRAINT df_reschedule_request_extra_amount DEFAULT 0,
    is_free BIT NOT NULL CONSTRAINT df_reschedule_request_is_free DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    hold_expires_at DATETIME2(0) NULL,
    approve_deadline DATETIME2(0) NULL,
    version INT NOT NULL CONSTRAINT df_reschedule_request_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_reschedule_request_created_at DEFAULT SYSDATETIME(),
    decided_at DATETIME2(0) NULL,
    CONSTRAINT pk_reschedule_request PRIMARY KEY (id),
    CONSTRAINT ck_resched_status CHECK (status IN ('PENDING_PAYMENT','AWAITING_CONFIRMATION','APPROVED','REJECTED','EXPIRED')),
    CONSTRAINT ck_resched_time CHECK (new_end_minute > new_start_minute),
    CONSTRAINT ck_resched_minute CHECK (new_start_minute BETWEEN 0 AND 1410 AND new_start_minute % 30 = 0 AND new_end_minute BETWEEN 30 AND 1440 AND new_end_minute % 30 = 0),
    CONSTRAINT ck_resched_extra CHECK (extra_amount >= 0 AND (is_free = 0 OR extra_amount = 0))
);
CREATE UNIQUE INDEX ux_resched_pending ON reschedule_request (booking_id) WHERE status IN ('PENDING_PAYMENT','AWAITING_CONFIRMATION');
CREATE INDEX ix_resched_booking ON reschedule_request (booking_id);

-- affected_booking: Booking bị ảnh hưởng do sân hủy lịch và lựa chọn của Player (BR17, FR62, FR73).
CREATE TABLE affected_booking (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    cause VARCHAR(20) NOT NULL,
    maintenance_id BIGINT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_affected_booking_status DEFAULT 'PENDING',
    choice VARCHAR(10) NULL,
    is_default_choice BIT NOT NULL CONSTRAINT df_affected_booking_is_default_choice DEFAULT 0,
    compensation_points INT NULL,
    reschedule_request_id BIGINT NULL,
    created_by BIGINT NULL,
    version INT NOT NULL CONSTRAINT df_affected_booking_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_affected_booking_created_at DEFAULT SYSDATETIME(),
    chosen_at DATETIME2(0) NULL,
    CONSTRAINT pk_affected_booking PRIMARY KEY (id),
    CONSTRAINT ck_affected_cause CHECK (cause IN ('OWNER_CANCELLED','MAINTENANCE','COURT_DISABLED','HOURS_CHANGED')),
    CONSTRAINT ck_affected_status CHECK (status IN ('PENDING','RESOLVED')),
    CONSTRAINT ck_affected_choice CHECK (choice IS NULL OR choice IN ('RESCHEDULE','REFUND','POINTS')),
    CONSTRAINT ck_affected_resolved CHECK (status = 'PENDING' OR choice IS NOT NULL),
    CONSTRAINT ck_affected_maint CHECK (cause <> 'MAINTENANCE' OR maintenance_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_affected_pending ON affected_booking (booking_id) WHERE status = 'PENDING';
CREATE INDEX ix_affected_booking ON affected_booking (booking_id);

-- refund_request: Yêu cầu hoàn tiền và khoản hoàn Owner ghi nhận (UC23, BR36).
CREATE TABLE refund_request (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    booking_id BIGINT NOT NULL,
    affected_booking_id BIGINT NULL,
    complaint_id BIGINT NULL,
    suggested_amount DECIMAL(12,0) NOT NULL,
    refunded_amount DECIMAL(12,0) NULL,
    refund_date DATE NULL,
    original_payment_date DATE NOT NULL,
    reason NVARCHAR(500) NULL,
    note NVARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_refund_request_status DEFAULT 'PENDING_REFUND',
    recorded_by BIGINT NULL,
    recorded_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_refund_request_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_refund_request PRIMARY KEY (id),
    CONSTRAINT ck_refund_source CHECK (CASE WHEN affected_booking_id IS NULL THEN 0 ELSE 1 END + CASE WHEN complaint_id IS NULL THEN 0 ELSE 1 END = 1),
    CONSTRAINT ck_refund_status CHECK (status IN ('PENDING_REFUND','REFUNDED')),
    CONSTRAINT ck_refund_done CHECK (status <> 'REFUNDED' OR (refunded_amount IS NOT NULL AND refund_date IS NOT NULL)),
    CONSTRAINT ck_refund_reason CHECK (refunded_amount IS NULL OR refunded_amount = suggested_amount OR reason IS NOT NULL)
);
CREATE INDEX ix_refund_location ON refund_request (location_id, status);
CREATE INDEX ix_refund_booking ON refund_request (booking_id);

-- voucher: Đợt voucher của một địa điểm, gồm cả voucher hệ thống tặng (UC24).
CREATE TABLE voucher (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    code VARCHAR(20) NULL,
    name NVARCHAR(100) NOT NULL,
    source VARCHAR(20) NOT NULL,
    target_group VARCHAR(15) NOT NULL,
    discount_type VARCHAR(10) NOT NULL,
    discount_value DECIMAL(12,0) NOT NULL,
    min_order_amount DECIMAL(12,0) NOT NULL CONSTRAINT df_voucher_min_order_amount DEFAULT 0,
    valid_from DATE NULL,
    valid_to DATE NULL,
    grant_valid_days INT NULL,
    max_uses_per_player INT NULL,
    max_total_uses INT NULL,
    used_count INT NOT NULL CONSTRAINT df_voucher_used_count DEFAULT 0,
    budget DECIMAL(12,0) NULL,
    budget_used DECIMAL(12,0) NOT NULL CONSTRAINT df_voucher_budget_used DEFAULT 0,
    status VARCHAR(10) NOT NULL CONSTRAINT df_voucher_status DEFAULT 'DRAFT',
    disabled_by BIGINT NULL,
    version INT NOT NULL CONSTRAINT df_voucher_version DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_voucher_created_at DEFAULT SYSDATETIME(),
    allow_points BIT NOT NULL CONSTRAINT df_voucher_allow_points DEFAULT 0,
    max_point_percent INT NULL,
    CONSTRAINT ck_voucher_point_policy CHECK ((allow_points=0 AND max_point_percent IS NULL) OR (allow_points=1 AND max_point_percent IS NOT NULL AND max_point_percent BETWEEN 1 AND 100)),
    CONSTRAINT pk_voucher PRIMARY KEY (id),
    CONSTRAINT ck_voucher_source CHECK (source IN ('CAMPAIGN','LOYALTY','BATCH_OFFER','COMPENSATION')),
    CONSTRAINT ck_voucher_target CHECK (target_group IN ('ALL_PLAYERS','NEW_PLAYERS','SPECIFIED')),
    CONSTRAINT ck_voucher_code CHECK ((target_group = 'SPECIFIED' AND code IS NULL) OR (target_group <> 'SPECIFIED' AND code IS NOT NULL)),
    CONSTRAINT ck_voucher_type CHECK (discount_type IN ('PERCENT','AMOUNT')),
    CONSTRAINT ck_voucher_value CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value BETWEEN 1 AND 99)),
    CONSTRAINT ck_voucher_status CHECK (status IN ('DRAFT','PUBLISHED','DISABLED')),
    CONSTRAINT ck_voucher_uses CHECK (max_total_uses IS NULL OR used_count <= max_total_uses),
    CONSTRAINT ck_voucher_budget CHECK (budget IS NULL OR budget_used <= budget)
);
CREATE UNIQUE INDEX ux_voucher_code ON voucher (location_id, code) WHERE code IS NOT NULL;

-- voucher_grant: Voucher tặng thẳng vào tài khoản Player (FR84).
CREATE TABLE voucher_grant (
    id BIGINT IDENTITY(1,1) NOT NULL,
    voucher_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_voucher_grant_status DEFAULT 'AVAILABLE',
    granted_at DATETIME2(0) NOT NULL CONSTRAINT df_voucher_grant_granted_at DEFAULT SYSDATETIME(),
    expires_at DATETIME2(0) NULL,
    note NVARCHAR(255) NULL,
    CONSTRAINT pk_voucher_grant PRIMARY KEY (id),
    CONSTRAINT ck_vgrant_status CHECK (status IN ('AVAILABLE','USED'))
);
CREATE INDEX ix_vgrant_player ON voucher_grant (player_id, status);
CREATE INDEX ix_vgrant_voucher ON voucher_grant (voucher_id);

-- voucher_usage: Lần dùng voucher cho một booking hoặc một gói (BR14, BR45).
CREATE TABLE voucher_usage (
    id BIGINT IDENTITY(1,1) NOT NULL,
    voucher_id BIGINT NOT NULL,
    voucher_grant_id BIGINT NULL,
    player_id BIGINT NOT NULL,
    booking_id BIGINT NULL,
    package_id BIGINT NULL,
    discount_amount DECIMAL(12,0) NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_voucher_usage_status DEFAULT 'USED',
    used_at DATETIME2(0) NOT NULL CONSTRAINT df_voucher_usage_used_at DEFAULT SYSDATETIME(),
    returned_at DATETIME2(0) NULL,
    CONSTRAINT pk_voucher_usage PRIMARY KEY (id),
    CONSTRAINT ck_vusage_target CHECK (CASE WHEN booking_id IS NULL THEN 0 ELSE 1 END + CASE WHEN package_id IS NULL THEN 0 ELSE 1 END = 1),
    CONSTRAINT ck_vusage_status CHECK (status IN ('USED','RETURNED'))
);
CREATE UNIQUE INDEX ux_vusage_booking ON voucher_usage (booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX ux_vusage_package ON voucher_usage (package_id) WHERE package_id IS NOT NULL;
CREATE UNIQUE INDEX ux_vusage_grant ON voucher_usage (voucher_grant_id) WHERE voucher_grant_id IS NOT NULL AND status = 'USED';
CREATE INDEX ix_vusage_voucher_player ON voucher_usage (voucher_id, player_id);

-- player_location_balance: Điểm và tổng tiền tích lũy của một Player tại một địa điểm (FR89).
CREATE TABLE player_location_balance (
    id BIGINT IDENTITY(1,1) NOT NULL,
    player_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    loyalty_sessions INT NOT NULL CONSTRAINT df_balance_loyalty_sessions DEFAULT 0,
    point_balance INT NOT NULL CONSTRAINT df_player_location_balance_point_balance DEFAULT 0,
    total_paid DECIMAL(14,0) NOT NULL CONSTRAINT df_player_location_balance_total_paid DEFAULT 0,
    version INT NOT NULL CONSTRAINT df_player_location_balance_version DEFAULT 0,
    updated_at DATETIME2(0) NULL,
    CONSTRAINT pk_player_location_balance PRIMARY KEY (id),
    CONSTRAINT ux_balance_player_location UNIQUE (player_id, location_id),
    CONSTRAINT ck_balance_nonneg CHECK (point_balance >= 0 AND total_paid >= 0),
    CONSTRAINT ck_balance_sessions CHECK (loyalty_sessions >= 0)
);

-- point_transaction: Lịch sử điểm (FR85, DR09).
CREATE TABLE point_transaction (
    id BIGINT IDENTITY(1,1) NOT NULL,
    balance_id BIGINT NOT NULL,
    booking_id BIGINT NULL,
    package_id BIGINT NULL,
    type VARCHAR(10) NOT NULL,
    points INT NOT NULL,
    balance_after INT NOT NULL,
    earning_rate INT NULL,
    reason NVARCHAR(255) NULL,
    created_by BIGINT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_point_transaction_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_point_transaction PRIMARY KEY (id),
    CONSTRAINT ck_ptx_type CHECK (type IN ('EARN','REDEEM','RETURN','REVOKE','ADJUST')),
    CONSTRAINT ck_ptx_balance CHECK (balance_after >= 0),
    CONSTRAINT ck_ptx_sign CHECK ((type IN ('EARN','RETURN','ADJUST') AND points > 0) OR (type IN ('REDEEM','REVOKE') AND points < 0)),
    CONSTRAINT ck_ptx_earn_rate CHECK (type <> 'EARN' OR earning_rate IS NOT NULL),
    CONSTRAINT ck_ptx_adjust CHECK (type <> 'ADJUST' OR (reason IS NOT NULL AND (booking_id IS NOT NULL OR package_id IS NOT NULL)))
);
CREATE INDEX ix_ptx_balance ON point_transaction (balance_id, created_at);

-- loyalty_accrual: durable payment receipt, including payments earning zero points.
CREATE TABLE loyalty_accrual (
  id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_loyalty_accrual PRIMARY KEY,
  payment_id BIGINT NOT NULL CONSTRAINT uq_loyalty_accrual_payment UNIQUE,
  balance_id BIGINT NOT NULL,
  paid_amount DECIMAL(12,0) NOT NULL,
  earned_points INT NOT NULL,
  earning_rate INT NOT NULL,
  CONSTRAINT fk_loyalty_accrual_payment FOREIGN KEY(payment_id) REFERENCES payment(id),
  CONSTRAINT fk_loyalty_accrual_balance FOREIGN KEY(balance_id) REFERENCES player_location_balance(id),
  CONSTRAINT ck_loyalty_accrual CHECK(paid_amount > 0 AND earned_points >= 0 AND earning_rate=10000)
 );

-- loyalty_tier: SRS V2 8.3/BR12 paid-session reward configuration; legacy spending fields retained.
CREATE TABLE loyalty_tier (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    session_threshold INT NULL, -- SRS V2: number of paid sessions; NULL marks a legacy spending tier
    version INT NOT NULL CONSTRAINT df_tier_version DEFAULT 0,
    milestone_amount DECIMAL(14,0) NOT NULL, -- legacy storage, no longer the reward criterion
    voucher_id BIGINT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_loyalty_tier_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_loyalty_tier_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_loyalty_tier PRIMARY KEY (id),
    CONSTRAINT ux_tier_amount UNIQUE (location_id, milestone_amount),
    CONSTRAINT ck_tier_sessions CHECK (session_threshold IS NULL OR session_threshold BETWEEN 1 AND 100000),
    CONSTRAINT ck_tier_amount CHECK (milestone_amount > 0)
);

CREATE UNIQUE INDEX ux_tier_session_config ON loyalty_tier(location_id) WHERE session_threshold IS NOT NULL;

-- loyalty_reward: SRS V2 session reward audit; reached_amount stores a reward sequence for session tiers.
CREATE TABLE loyalty_reward (
    id BIGINT IDENTITY(1,1) NOT NULL,
    player_id BIGINT NOT NULL,
    loyalty_tier_id BIGINT NOT NULL,
    reached_amount DECIMAL(14,0) NOT NULL,
    voucher_grant_id BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_loyalty_reward_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_loyalty_reward PRIMARY KEY (id),
    CONSTRAINT uq_loyalty_reward_voucher_grant_id UNIQUE (voucher_grant_id),
    CONSTRAINT ux_reward_once UNIQUE (player_id, loyalty_tier_id, reached_amount)
);

-- batch_offer: Chương trình ưu đãi đặt theo lô gắn với sự kiện (FR22, BR47).
CREATE TABLE batch_offer (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    name NVARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    min_package_amount DECIMAL(12,0) NOT NULL,
    voucher_id BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_batch_offer_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_batch_offer PRIMARY KEY (id),
    CONSTRAINT ck_batch_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_batch_amount CHECK (min_package_amount > 0)
);

-- team: Đội: nhóm chơi cố định (BR55).
CREATE TABLE team (
    id BIGINT IDENTITY(1,1) NOT NULL,
    name NVARCHAR(30) NOT NULL,
    captain_id BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_team_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_team PRIMARY KEY (id),
    CONSTRAINT uq_team_name UNIQUE (name)
);

-- team_member: Thành viên của đội (FR95, FR96); tối đa 20 (DR12).
CREATE TABLE team_member (
    id BIGINT IDENTITY(1,1) NOT NULL,
    team_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_team_member_status DEFAULT 'ACTIVE',
    joined_at DATETIME2(0) NOT NULL CONSTRAINT df_team_member_joined_at DEFAULT SYSDATETIME(),
    left_at DATETIME2(0) NULL,
    CONSTRAINT pk_team_member PRIMARY KEY (id),
    CONSTRAINT ck_tmember_status CHECK (status IN ('ACTIVE','LEFT','REMOVED'))
);
CREATE UNIQUE INDEX ux_tmember_active ON team_member (team_id, player_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_tmember_player ON team_member (player_id, status);

-- team_join_request: Yêu cầu xin vào đội (FR92, FR93).
CREATE TABLE team_join_request (
    id BIGINT IDENTITY(1,1) NOT NULL,
    team_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    phone_consent BIT NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_team_join_request_status DEFAULT 'PENDING',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_team_join_request_created_at DEFAULT SYSDATETIME(),
    decided_at DATETIME2(0) NULL,
    CONSTRAINT pk_team_join_request PRIMARY KEY (id),
    CONSTRAINT ck_tjoin_status CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
    CONSTRAINT ck_tjoin_consent CHECK (phone_consent = 1)
);
CREATE UNIQUE INDEX ux_tjoin_pending ON team_join_request (team_id, player_id) WHERE status = 'PENDING';

-- match: Kèo mở từ booking đã xác nhận của đội (UC28, BR55).
CREATE TABLE match (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    current_players TINYINT NOT NULL,
    needed_players TINYINT NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_match_status DEFAULT 'OPEN',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_match_created_at DEFAULT SYSDATETIME(),
    closed_at DATETIME2(0) NULL,
    CONSTRAINT pk_match PRIMARY KEY (id),
    CONSTRAINT ck_match_players CHECK (current_players >= 1 AND needed_players >= 0 AND current_players + needed_players <= 8),
    CONSTRAINT ck_match_status CHECK (status IN ('OPEN','CLOSED','CANCELLED','EXPIRED'))
);
CREATE UNIQUE INDEX ux_match_booking_active ON match (booking_id) WHERE status IN ('OPEN','CLOSED');

-- match_join_request: Yêu cầu tham gia kèo (UC30).
CREATE TABLE match_join_request (
    id BIGINT IDENTITY(1,1) NOT NULL,
    match_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    phone_consent BIT NOT NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_match_join_request_status DEFAULT 'PENDING',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_match_join_request_created_at DEFAULT SYSDATETIME(),
    decided_at DATETIME2(0) NULL,
    CONSTRAINT pk_match_join_request PRIMARY KEY (id),
    CONSTRAINT ck_mjoin_status CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
    CONSTRAINT ck_mjoin_consent CHECK (phone_consent = 1)
);
CREATE UNIQUE INDEX ux_mjoin_once ON match_join_request (match_id, player_id) WHERE status IN ('PENDING','APPROVED','REJECTED');

-- review: Đánh giá sân (UC31, UC32).
CREATE TABLE review (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    rating TINYINT NOT NULL,
    comment NVARCHAR(1000) NULL,
    owner_reply NVARCHAR(1000) NULL,
    is_hidden BIT NOT NULL CONSTRAINT df_review_is_hidden DEFAULT 0,
    hidden_by BIGINT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_review_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_review PRIMARY KEY (id),
    CONSTRAINT uq_review_booking_id UNIQUE (booking_id),
    CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX ix_review_location ON review (location_id, created_at);

-- complaint: Khiếu nại (UC33, BR49, BR58).
CREATE TABLE complaint (
    id BIGINT IDENTITY(1,1) NOT NULL,
    location_id BIGINT NOT NULL,
    booking_id BIGINT NULL,
    payment_id BIGINT NULL,
    player_id BIGINT NULL,
    created_by BIGINT NOT NULL,
    complaint_type VARCHAR(30) NOT NULL,
    content NVARCHAR(1000) NOT NULL,
    status VARCHAR(15) NOT NULL CONSTRAINT df_complaint_status DEFAULT 'SUBMITTED',
    staff_note NVARCHAR(1000) NULL,
    handled_by BIGINT NULL,
    result VARCHAR(30) NULL,
    reject_reason NVARCHAR(500) NULL,
    compensation_points INT NULL,
    decided_by BIGINT NULL,
    decided_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_complaint_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_complaint PRIMARY KEY (id),
    CONSTRAINT ck_complaint_target CHECK (booking_id IS NOT NULL OR payment_id IS NOT NULL),
    CONSTRAINT ck_complaint_status CHECK (status IN ('SUBMITTED','PENDING_OWNER','RESOLVED','REJECTED')),
    CONSTRAINT ck_complaint_result CHECK (result IS NULL OR result IN ('LATE_PAYMENT_CONFIRMED','REFUND','POINTS','NO_COMPENSATION')),
    CONSTRAINT ck_complaint_resolved CHECK (status <> 'RESOLVED' OR result IS NOT NULL),
    CONSTRAINT ck_complaint_rejected CHECK (status <> 'REJECTED' OR reject_reason IS NOT NULL),
    CONSTRAINT ck_complaint_points CHECK (result IS NULL OR result <> 'POINTS' OR compensation_points > 0),
    CONSTRAINT ck_complaint_late_payment CHECK (complaint_type <> 'LATE_PAYMENT_CONFIRMATION' OR payment_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_complaint_late_payment ON complaint (payment_id) WHERE complaint_type = 'LATE_PAYMENT_CONFIRMATION' AND payment_id IS NOT NULL;
CREATE INDEX ix_complaint_location ON complaint (location_id, status);
CREATE INDEX ix_complaint_booking ON complaint (booking_id);
CREATE INDEX ix_complaint_payment ON complaint (payment_id);

-- notification: Thông báo trong ứng dụng (FR124, FR119, FR120).
CREATE TABLE notification (
    id BIGINT IDENTITY(1,1) NOT NULL,
    recipient_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title NVARCHAR(150) NOT NULL,
    content NVARCHAR(500) NOT NULL,
    ref_type VARCHAR(30) NULL,
    ref_id BIGINT NULL,
    is_read BIT NOT NULL CONSTRAINT df_notification_is_read DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_notification_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT pk_notification PRIMARY KEY (id)
);
CREATE INDEX ix_notif_recipient ON notification (recipient_id, is_read, created_at);

-- ---------------- Khóa ngoại ----------------
ALTER TABLE account ADD CONSTRAINT fk_account_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE service_registration ADD CONSTRAINT fk_service_registration_requester_id FOREIGN KEY (requester_id) REFERENCES account (id);
ALTER TABLE service_registration ADD CONSTRAINT fk_service_registration_processed_by FOREIGN KEY (processed_by) REFERENCES account (id);
ALTER TABLE service_registration ADD CONSTRAINT fk_service_registration_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE location ADD CONSTRAINT fk_location_owner_id FOREIGN KEY (owner_id) REFERENCES account (id);
ALTER TABLE service_term ADD CONSTRAINT fk_service_term_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE service_term ADD CONSTRAINT fk_service_term_recorded_by FOREIGN KEY (recorded_by) REFERENCES account (id);
ALTER TABLE court ADD CONSTRAINT fk_court_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE opening_hour ADD CONSTRAINT fk_opening_hour_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE opening_exception ADD CONSTRAINT fk_opening_exception_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE price_rule ADD CONSTRAINT fk_price_rule_court_id FOREIGN KEY (court_id) REFERENCES court (id);
ALTER TABLE maintenance ADD CONSTRAINT fk_maintenance_court_id FOREIGN KEY (court_id) REFERENCES court (id);
ALTER TABLE maintenance ADD CONSTRAINT fk_maintenance_requested_by FOREIGN KEY (requested_by) REFERENCES account (id);
ALTER TABLE maintenance ADD CONSTRAINT fk_maintenance_approved_by FOREIGN KEY (approved_by) REFERENCES account (id);
ALTER TABLE booking_package ADD CONSTRAINT fk_booking_package_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE booking_package ADD CONSTRAINT fk_booking_package_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE booking_package ADD CONSTRAINT fk_booking_package_batch_offer_id FOREIGN KEY (batch_offer_id) REFERENCES batch_offer (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_court_id FOREIGN KEY (court_id) REFERENCES court (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_team_id FOREIGN KEY (team_id) REFERENCES team (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_package_id FOREIGN KEY (package_id) REFERENCES booking_package (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_staff_id FOREIGN KEY (staff_id) REFERENCES account (id);
ALTER TABLE booking ADD CONSTRAINT fk_booking_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES account (id);
ALTER TABLE booking_slot ADD CONSTRAINT fk_booking_slot_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE booking_slot ADD CONSTRAINT fk_booking_slot_court_id FOREIGN KEY (court_id) REFERENCES court (id);
ALTER TABLE booking_slot ADD CONSTRAINT fk_booking_slot_reschedule_request_id FOREIGN KEY (reschedule_request_id) REFERENCES reschedule_request (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_package_id FOREIGN KEY (package_id) REFERENCES booking_package (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_reschedule_request_id FOREIGN KEY (reschedule_request_id) REFERENCES reschedule_request (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES account (id);
ALTER TABLE payment_proof ADD CONSTRAINT fk_payment_proof_payment_id FOREIGN KEY (payment_id) REFERENCES payment (id);
ALTER TABLE reconciliation ADD CONSTRAINT fk_reconciliation_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE reconciliation ADD CONSTRAINT fk_reconciliation_staff_id FOREIGN KEY (staff_id) REFERENCES account (id);
ALTER TABLE reschedule_request ADD CONSTRAINT fk_reschedule_request_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE reschedule_request ADD CONSTRAINT fk_reschedule_request_new_court_id FOREIGN KEY (new_court_id) REFERENCES court (id);
ALTER TABLE affected_booking ADD CONSTRAINT fk_affected_booking_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE affected_booking ADD CONSTRAINT fk_affected_booking_maintenance_id FOREIGN KEY (maintenance_id) REFERENCES maintenance (id);
ALTER TABLE affected_booking ADD CONSTRAINT fk_affected_booking_reschedule_request_id FOREIGN KEY (reschedule_request_id) REFERENCES reschedule_request (id);
ALTER TABLE affected_booking ADD CONSTRAINT fk_affected_booking_created_by FOREIGN KEY (created_by) REFERENCES account (id);
ALTER TABLE refund_request ADD CONSTRAINT fk_refund_request_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE refund_request ADD CONSTRAINT fk_refund_request_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE refund_request ADD CONSTRAINT fk_refund_request_affected_booking_id FOREIGN KEY (affected_booking_id) REFERENCES affected_booking (id);
ALTER TABLE refund_request ADD CONSTRAINT fk_refund_request_complaint_id FOREIGN KEY (complaint_id) REFERENCES complaint (id);
ALTER TABLE refund_request ADD CONSTRAINT fk_refund_request_recorded_by FOREIGN KEY (recorded_by) REFERENCES account (id);
ALTER TABLE voucher ADD CONSTRAINT fk_voucher_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE voucher ADD CONSTRAINT fk_voucher_disabled_by FOREIGN KEY (disabled_by) REFERENCES account (id);
ALTER TABLE voucher_grant ADD CONSTRAINT fk_voucher_grant_voucher_id FOREIGN KEY (voucher_id) REFERENCES voucher (id);
ALTER TABLE voucher_grant ADD CONSTRAINT fk_voucher_grant_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE voucher_usage ADD CONSTRAINT fk_voucher_usage_voucher_id FOREIGN KEY (voucher_id) REFERENCES voucher (id);
ALTER TABLE voucher_usage ADD CONSTRAINT fk_voucher_usage_voucher_grant_id FOREIGN KEY (voucher_grant_id) REFERENCES voucher_grant (id);
ALTER TABLE voucher_usage ADD CONSTRAINT fk_voucher_usage_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE voucher_usage ADD CONSTRAINT fk_voucher_usage_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE voucher_usage ADD CONSTRAINT fk_voucher_usage_package_id FOREIGN KEY (package_id) REFERENCES booking_package (id);
ALTER TABLE player_location_balance ADD CONSTRAINT fk_player_location_balance_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE player_location_balance ADD CONSTRAINT fk_player_location_balance_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE point_transaction ADD CONSTRAINT fk_point_transaction_balance_id FOREIGN KEY (balance_id) REFERENCES player_location_balance (id);
ALTER TABLE point_transaction ADD CONSTRAINT fk_point_transaction_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE point_transaction ADD CONSTRAINT fk_point_transaction_package_id FOREIGN KEY (package_id) REFERENCES booking_package (id);
ALTER TABLE point_transaction ADD CONSTRAINT fk_point_transaction_created_by FOREIGN KEY (created_by) REFERENCES account (id);
ALTER TABLE loyalty_tier ADD CONSTRAINT fk_loyalty_tier_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE loyalty_tier ADD CONSTRAINT fk_loyalty_tier_voucher_id FOREIGN KEY (voucher_id) REFERENCES voucher (id);
ALTER TABLE loyalty_reward ADD CONSTRAINT fk_loyalty_reward_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE loyalty_reward ADD CONSTRAINT fk_loyalty_reward_loyalty_tier_id FOREIGN KEY (loyalty_tier_id) REFERENCES loyalty_tier (id);
ALTER TABLE loyalty_reward ADD CONSTRAINT fk_loyalty_reward_voucher_grant_id FOREIGN KEY (voucher_grant_id) REFERENCES voucher_grant (id);
ALTER TABLE batch_offer ADD CONSTRAINT fk_batch_offer_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE batch_offer ADD CONSTRAINT fk_batch_offer_voucher_id FOREIGN KEY (voucher_id) REFERENCES voucher (id);
ALTER TABLE team ADD CONSTRAINT fk_team_captain_id FOREIGN KEY (captain_id) REFERENCES account (id);
ALTER TABLE team_member ADD CONSTRAINT fk_team_member_team_id FOREIGN KEY (team_id) REFERENCES team (id);
ALTER TABLE team_member ADD CONSTRAINT fk_team_member_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE team_join_request ADD CONSTRAINT fk_team_join_request_team_id FOREIGN KEY (team_id) REFERENCES team (id);
ALTER TABLE team_join_request ADD CONSTRAINT fk_team_join_request_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE match ADD CONSTRAINT fk_match_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE match_join_request ADD CONSTRAINT fk_match_join_request_match_id FOREIGN KEY (match_id) REFERENCES match (id);
ALTER TABLE match_join_request ADD CONSTRAINT fk_match_join_request_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE review ADD CONSTRAINT fk_review_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE review ADD CONSTRAINT fk_review_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE review ADD CONSTRAINT fk_review_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE review ADD CONSTRAINT fk_review_hidden_by FOREIGN KEY (hidden_by) REFERENCES account (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_location_id FOREIGN KEY (location_id) REFERENCES location (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_booking_id FOREIGN KEY (booking_id) REFERENCES booking (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_payment_id FOREIGN KEY (payment_id) REFERENCES payment (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_player_id FOREIGN KEY (player_id) REFERENCES account (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_created_by FOREIGN KEY (created_by) REFERENCES account (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_handled_by FOREIGN KEY (handled_by) REFERENCES account (id);
ALTER TABLE complaint ADD CONSTRAINT fk_complaint_decided_by FOREIGN KEY (decided_by) REFERENCES account (id);
ALTER TABLE notification ADD CONSTRAINT fk_notification_recipient_id FOREIGN KEY (recipient_id) REFERENCES account (id);
-- Khóa ngoại kép: bảo đảm cột lặp lại khớp với bảng cha (không kiểm tra khi cột khóa ngoại để trống)
ALTER TABLE booking ADD CONSTRAINT fkc_booking_court_location FOREIGN KEY (court_id, location_id) REFERENCES court (id, location_id);
ALTER TABLE booking ADD CONSTRAINT fkc_booking_package_location FOREIGN KEY (package_id, location_id) REFERENCES booking_package (id, location_id);
ALTER TABLE payment ADD CONSTRAINT fkc_payment_booking_location FOREIGN KEY (booking_id, location_id) REFERENCES booking (id, location_id);
ALTER TABLE payment ADD CONSTRAINT fkc_payment_package_location FOREIGN KEY (package_id, location_id) REFERENCES booking_package (id, location_id);
ALTER TABLE refund_request ADD CONSTRAINT fkc_refund_booking_location FOREIGN KEY (booking_id, location_id) REFERENCES booking (id, location_id);
ALTER TABLE review ADD CONSTRAINT fkc_review_booking_location FOREIGN KEY (booking_id, location_id) REFERENCES booking (id, location_id);
ALTER TABLE review ADD CONSTRAINT fkc_review_booking_player FOREIGN KEY (booking_id, player_id) REFERENCES booking (id, player_id);
ALTER TABLE complaint ADD CONSTRAINT fkc_complaint_booking_location FOREIGN KEY (booking_id, location_id) REFERENCES booking (id, location_id);
ALTER TABLE complaint ADD CONSTRAINT fkc_complaint_payment_location FOREIGN KEY (payment_id, location_id) REFERENCES payment (id, location_id);

COMMIT TRANSACTION;
GO
-- Kiểm tra: phải ra 36 bảng, 90 khóa ngoại một cột, 9 khóa ngoại kép.
SELECT COUNT(*) AS so_bang_BMS FROM sys.tables WHERE name IN ('account', 'otp_request', 'service_registration', 'location', 'service_term', 'court', 'opening_hour', 'opening_exception', 'price_rule', 'maintenance', 'booking_package', 'booking', 'booking_slot', 'payment', 'payment_proof', 'reconciliation', 'reschedule_request', 'affected_booking', 'refund_request', 'voucher', 'voucher_grant', 'voucher_usage', 'player_location_balance', 'point_transaction', 'loyalty_tier', 'loyalty_reward', 'loyalty_accrual', 'batch_offer', 'team', 'team_member', 'team_join_request', 'match', 'match_join_request', 'review', 'complaint', 'notification');
SELECT COUNT(*) AS so_khoa_ngoai_BMS FROM sys.foreign_keys WHERE name LIKE 'fk[_]%' COLLATE Latin1_General_CS_AS;
SELECT COUNT(*) AS so_khoa_ngoai_kep FROM sys.foreign_keys WHERE name LIKE 'fkc[_]%' COLLATE Latin1_General_CS_AS;
-- Database mới được sao từ database hệ thống model. Nếu model có bảng thì các bảng đó hiện ở đây: không thuộc BMS, nên xóa.
SELECT name AS bang_khong_thuoc_BMS FROM sys.tables WHERE name NOT IN ('account', 'otp_request', 'service_registration', 'location', 'service_term', 'court', 'opening_hour', 'opening_exception', 'price_rule', 'maintenance', 'booking_package', 'booking', 'booking_slot', 'payment', 'payment_proof', 'reconciliation', 'reschedule_request', 'affected_booking', 'refund_request', 'voucher', 'voucher_grant', 'voucher_usage', 'player_location_balance', 'point_transaction', 'loyalty_tier', 'loyalty_reward', 'loyalty_accrual', 'batch_offer', 'team', 'team_member', 'team_join_request', 'match', 'match_join_request', 'review', 'complaint', 'notification');
GO
