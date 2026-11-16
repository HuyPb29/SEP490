SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.location', 'point_redemption_value') IS NULL
BEGIN
    ALTER TABLE dbo.location ADD point_redemption_value INT NOT NULL
        CONSTRAINT df_location_point_redemption_value DEFAULT 500 WITH VALUES;
END;
GO

IF COL_LENGTH('dbo.booking', 'point_earning_rate_snapshot') IS NULL
    ALTER TABLE dbo.booking ADD point_earning_rate_snapshot INT NULL;
IF COL_LENGTH('dbo.booking_package', 'point_earning_rate_snapshot') IS NULL
    ALTER TABLE dbo.booking_package ADD point_earning_rate_snapshot INT NULL;
GO

UPDATE b SET point_earning_rate_snapshot = l.point_earning_rate
FROM dbo.booking b JOIN dbo.location l ON l.id = b.location_id
WHERE b.point_earning_rate_snapshot IS NULL AND b.booking_type <> 'WALK_IN';

UPDATE p SET point_earning_rate_snapshot = l.point_earning_rate
FROM dbo.booking_package p JOIN dbo.location l ON l.id = p.location_id
WHERE p.point_earning_rate_snapshot IS NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.location') AND name = 'ck_location_point_redemption_value'
)
BEGIN
    ALTER TABLE dbo.location WITH CHECK ADD CONSTRAINT ck_location_point_redemption_value
        CHECK (point_redemption_value BETWEEN 1 AND 100000);
END;
GO
