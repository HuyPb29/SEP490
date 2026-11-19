-- WEB-03: sửa đúng chiến dịch demo "Giảm 10% lần đầu" tại BMS Hòa Lạc.
-- Điều kiện nhận diện giữ nguyên các chiến dịch khác và cho phép chạy lại.
SET QUOTED_IDENTIFIER ON;

UPDATE v
SET target_group = 'NEW_PLAYERS'
FROM dbo.voucher AS v
JOIN dbo.location AS l ON l.id = v.location_id
WHERE v.code = 'WELCOME10'
  AND l.name = N'BMS Hòa Lạc'
  AND v.name = N'Giảm 10% lần đầu'
  AND v.source = 'CAMPAIGN'
  AND v.discount_type = 'PERCENT' AND v.discount_value = 10
  AND v.min_order_amount = 80000
  AND v.target_group = 'ALL_PLAYERS';
