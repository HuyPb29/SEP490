-- F8 UC33: khiếu nại của Player đến thẳng Owner, không chờ Staff chuyển.
-- Chuyển các khiếu nại Player tự gửi còn đang chờ Staff sang chờ Owner.
-- Mốc P33 (forwarded_at) tính từ lúc chạy để Owner không bị báo quá hạn ngay.
-- Khiếu nại Staff lập thay khách tại quầy (player_id khác created_by) giữ nguyên. Chạy lại được.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;

UPDATE dbo.complaint
SET status = 'PENDING_OWNER', forwarded_at = SYSDATETIME()
WHERE status = 'SUBMITTED'
  AND player_id IS NOT NULL
  AND player_id = created_by;

COMMIT TRANSACTION;
