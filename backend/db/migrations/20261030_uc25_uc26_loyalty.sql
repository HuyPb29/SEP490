-- UC25/26, SRS V2 8.2/8.3. Run on the selected BMS database before starting the new backend.
-- Additive, re-runnable upgrade. Existing spending tiers/rewards are retained as legacy audit data.
-- No spending amount is converted into a session count. Configure the session reward through the API.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
IF COL_LENGTH('dbo.player_location_balance','loyalty_sessions') IS NULL
 ALTER TABLE dbo.player_location_balance ADD loyalty_sessions INT NOT NULL CONSTRAINT df_balance_loyalty_sessions DEFAULT 0;
IF COL_LENGTH('dbo.loyalty_tier','session_threshold') IS NULL
 ALTER TABLE dbo.loyalty_tier ADD session_threshold INT NULL;
IF COL_LENGTH('dbo.loyalty_tier','version') IS NULL
 ALTER TABLE dbo.loyalty_tier ADD version INT NOT NULL CONSTRAINT df_tier_version DEFAULT 0;
IF COL_LENGTH('dbo.voucher','allow_points') IS NULL
 ALTER TABLE dbo.voucher ADD allow_points BIT NOT NULL CONSTRAINT df_voucher_allow_points DEFAULT 0;
IF COL_LENGTH('dbo.voucher','max_point_percent') IS NULL
 ALTER TABLE dbo.voucher ADD max_point_percent INT NULL;
IF COL_LENGTH('dbo.booking','loyalty_refund_processed') IS NULL
 ALTER TABLE dbo.booking ADD loyalty_refund_processed BIT NOT NULL CONSTRAINT df_booking_loyalty_refund DEFAULT 0;
IF COL_LENGTH('dbo.booking','loyalty_compensation_processed') IS NULL
 ALTER TABLE dbo.booking ADD loyalty_compensation_processed BIT NOT NULL CONSTRAINT df_booking_loyalty_compensation DEFAULT 0;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='ck_balance_sessions')
 ALTER TABLE dbo.player_location_balance ADD CONSTRAINT ck_balance_sessions CHECK (loyalty_sessions >= 0);
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='ck_tier_sessions')
 ALTER TABLE dbo.loyalty_tier ADD CONSTRAINT ck_tier_sessions CHECK (session_threshold IS NULL OR session_threshold BETWEEN 1 AND 100000);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='ux_tier_session_config' AND object_id=OBJECT_ID('dbo.loyalty_tier'))
 CREATE UNIQUE INDEX ux_tier_session_config ON dbo.loyalty_tier(location_id) WHERE session_threshold IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='ck_voucher_point_policy')
 ALTER TABLE dbo.voucher ADD CONSTRAINT ck_voucher_point_policy CHECK
 ((allow_points=0 AND max_point_percent IS NULL) OR (allow_points=1 AND max_point_percent IS NOT NULL AND max_point_percent BETWEEN 1 AND 100));
IF OBJECT_ID('dbo.loyalty_accrual','U') IS NULL
BEGIN
 CREATE TABLE dbo.loyalty_accrual (
  id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_loyalty_accrual PRIMARY KEY,
  payment_id BIGINT NOT NULL CONSTRAINT uq_loyalty_accrual_payment UNIQUE,
  balance_id BIGINT NOT NULL,
  paid_amount DECIMAL(12,0) NOT NULL,
  earned_points INT NOT NULL,
  earning_rate INT NOT NULL,
  CONSTRAINT fk_loyalty_accrual_payment FOREIGN KEY(payment_id) REFERENCES dbo.payment(id),
  CONSTRAINT fk_loyalty_accrual_balance FOREIGN KEY(balance_id) REFERENCES dbo.player_location_balance(id),
  CONSTRAINT ck_loyalty_accrual CHECK(paid_amount > 0 AND earned_points >= 0 AND earning_rate=10000)
 );
END;
GO
COMMIT TRANSACTION;
GO
