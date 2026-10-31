-- ============================================================
-- BMS (SEP490-G13) - Migration v2: cấu hình slot bán sân theo địa điểm
-- Feature: F2 - Quản lý địa điểm | UC08 - FR18 | Owner: Minh Anh
--
-- CÁCH DÙNG: chạy SAU BMS_database.sql (và BMS_seed_dev.sql nếu cần dữ liệu mẫu).
--   sqlcmd -S localhost,1433 -U sa -P *** -I -b -f 65001 -i BMS_migration_v2_location_slot_setting.sql
--
-- NGUYÊN TẮC: không sửa BMS_database.sql cho từng thay đổi nhỏ. Mỗi thay đổi schema
-- đi kèm một file version riêng (v2, v3, ...) để database đã tồn tại vẫn nâng cấp được
-- mà không phải tạo lại từ đầu.
--
-- Script idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
-- ============================================================

USE BMS;
GO

-- location_slot_setting: cấu hình slot bán sân của địa điểm (UC08, FR18).
-- Cấu hình ở cấp ĐỊA ĐIỂM: mọi sân con trong cùng địa điểm dùng chung một cấu hình,
-- nên khóa chính là location_id (quan hệ 1-1 với location, không có cột id riêng).
-- Không có dòng = dùng mặc định 30 phút/slot, không nghỉ, tối đa 4 slot mỗi lần đặt.
IF OBJECT_ID('dbo.location_slot_setting', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.location_slot_setting (
        location_id BIGINT NOT NULL,
        slot_minutes SMALLINT NOT NULL CONSTRAINT df_lslot_slot_minutes DEFAULT 30,
        buffer_minutes SMALLINT NOT NULL CONSTRAINT df_lslot_buffer_minutes DEFAULT 0,
        max_slots_per_booking TINYINT NOT NULL CONSTRAINT df_lslot_max_slots DEFAULT 4,
        updated_at DATETIME2(0) NULL,
        CONSTRAINT pk_location_slot_setting PRIMARY KEY (location_id),
        CONSTRAINT ck_lslot_slot CHECK (slot_minutes BETWEEN 30 AND 240 AND slot_minutes % 30 = 0),
        CONSTRAINT ck_lslot_buffer CHECK (buffer_minutes BETWEEN 0 AND 60 AND buffer_minutes % 30 = 0),
        CONSTRAINT ck_lslot_max CHECK (max_slots_per_booking BETWEEN 1 AND 12)
    );

    ALTER TABLE dbo.location_slot_setting
        ADD CONSTRAINT fk_lslot_location_id FOREIGN KEY (location_id) REFERENCES dbo.location (id);
END
GO

-- Kiểm tra: co_bang = 1, so_khoa_ngoai = 1, so_check = 3.
SELECT CASE WHEN OBJECT_ID('dbo.location_slot_setting', 'U') IS NULL THEN 0 ELSE 1 END AS co_bang,
       (SELECT COUNT(*) FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.location_slot_setting')) AS so_khoa_ngoai,
       (SELECT COUNT(*) FROM sys.check_constraints
         WHERE parent_object_id = OBJECT_ID('dbo.location_slot_setting')) AS so_check;
GO

-- Rollback (chỉ chạy khi cần gỡ hẳn tính năng, sẽ mất cấu hình đã lưu):
-- DROP TABLE dbo.location_slot_setting;
