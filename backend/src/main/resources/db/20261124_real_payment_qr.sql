-- QR chuyển khoản thật để demo (24/11).
-- (1) Bên vận hành (FR127, D169): VietinBank. Ảnh QR là ảnh mặc định đóng gói trong backend
--     (resources/operator/default-qr.png), nên chỉ sửa dòng còn giữ tài khoản giả lúc cài và chưa có ảnh Admin tải lên.
-- (2) Địa điểm của các Owner mẫu (owner.sunrise, owner.thanglong, owner_f7): Techcombank.
--     Ảnh nằm ngoài DB (A03): chép nội dung thư mục BMS_seed_uploads vào thư mục upload của backend
--     (app.upload.dir, mặc định %USERPROFILE%\bms-uploads) để màn thanh toán hiện được QR.
-- Chạy lại được.
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

UPDATE dbo.operator_payment_info
SET bank_name = N'VietinBank', bank_account_no = '103876799618', bank_account_holder = N'DUONG DUC MINH'
WHERE id = 1 AND bank_account_no = '0123456789' AND qr_image_path IS NULL;

UPDATE l
SET bank_name = N'Techcombank', bank_account_no = '19077019383011', bank_account_holder = N'DUONG DUC MINH',
    qr_image_path = 'location-qr/2026/11/owner-techcombank.png'
FROM dbo.location AS l
JOIN dbo.account AS a ON a.id = l.owner_id
WHERE a.username IN ('owner.sunrise', 'owner.thanglong', 'owner_f7');
