-- UC23 A4: preserve the verified amount for refunds outside recorded revenue.
IF COL_LENGTH(N'dbo.refund_request', N'verified_unrecorded_amount') IS NULL
BEGIN
    ALTER TABLE dbo.refund_request ADD verified_unrecorded_amount DECIMAL(12,0) NULL;
END;
