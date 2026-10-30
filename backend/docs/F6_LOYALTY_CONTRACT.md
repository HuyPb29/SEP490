# UC25 points and UC26 loyalty API contract

## Baseline and decisions

Read against the files supplied on 30 October 2026:
- `SEP490_G13_Report-3_Software Requirement Specification_V2.docx`, sections 8.2 **Earn and Use Points** (SRS UC20), 8.3 **Manage Loyalty Rewards** (SRS UC18), BR12/15/38–42/48/52/54.
- `SEP490_G13_Project_Tracking.xlsx`, WBS rows 41–43 identify this work as UC25/UC26. The tracking workbook describes spending milestones, but SRS 8.3 explicitly uses paid-session counts. The implementation follows the detailed SRS flows. Do not map use cases solely by their numbers: SRS and tracking use different identifiers.
- Reports 1 and 2 supply scope/planning context. They do not override the detailed SRS business flows.

1 point is worth **500 VND**, fixed. Each confirmed payment earns `floor(amountDue / 10000)` points; amountDue excludes overpayment and the portion already paid with points. Reschedule extra payments earn independently, but do not add another session. Points never expire. Staff confirmation, rather than completion of play, triggers accrual. Player cancellation preserves earned points.

Owner manual adjustment is positive only, requires reason and booking, and derives the recipient from that booking. Client input cannot change another Player's balance or select a location outside the Owner's scope.

Each location has one configurable session reward: sessionThreshold, rewardValue in VND, and voucherValidDays. Payment confirmation counts one SINGLE booking or all confirmed child sessions of a package. On reaching the threshold the system issues one LOYALTY/SPECIFIED voucher and resets the counter to **0**, as stated in SRS 8.3 N2 (including a package exceeding the threshold). Subsequent paid sessions start a new cycle. Changing settings preserves existing progress and does not issue retroactive vouchers; the next initial payment evaluates the counter. Existing reward grants preserve their original value and expiration because updates create a fresh voucher template. Admin disabling the current template stops issuance; progress is retained.

Legacy spending tiers are retained with session_threshold NULL and excluded from the new configuration API and reward evaluation. No money-to-session conversion or backfill is inferred. Existing `milestone_amount` remains legacy storage; new configurations initially store their session threshold there for the old NOT NULL constraint. For session tiers, `loyalty_reward.reached_amount` stores an issuance sequence, not spending. Existing legacy reward rows retain their meaning.

## HTTP API

All endpoints require Bearer JWT. Owner endpoints also require `X-Location-Id` for a location owned by the caller. Responses use ApiResponse. Pagination is zero-based, default page=0,size=20, size 1–100, newest id first.

| Method | Path | Role | Request | data |
|---|---|---|---|---|
| GET | /api/me/loyalty-balances | PLAYER | page,size | PageResponse of id,locationId,pointBalance,totalPaid,loyaltySessions,updatedAt |
| GET | /api/me/loyalty-transactions | PLAYER | locationId?,type?,page,size | PageResponse of immutable ledger entries |
| POST | /api/owner/loyalty-adjustments | OWNER | bookingId,points>0,reason | Created ledger entry, HTTP 201 |
| GET | /api/owner/loyalty-milestones | OWNER | no body | Array of session reward settings (0 or 1) |
| POST | /api/owner/loyalty-milestones | OWNER | sessionThreshold,name,rewardValue,voucherValidDays | Settings and generated voucher, HTTP 201 |
| PATCH | /api/owner/loyalty-milestones/{id} | OWNER | version,active,settings (same fields as POST) | Updated settings and fresh voucher |

GET transactions only returns the caller's data, even when another facility id is supplied. Types: EARN, REDEEM, RETURN, REVOKE, ADJUST. Ledger entries contain signed points, balanceAfter, earningRate for EARN, related bookingId/packageId, reason, actor and timestamp. Earning rate is fixed at 10000 per SRS BR38; the older Location.pointEarningRate field does not override it.

Milestone create example:
```json
{"sessionThreshold":10,"name":"Ten paid sessions","rewardValue":50000,"voucherValidDays":30}
```
PATCH example:
```json
{"version":0,"active":true,"settings":{"sessionThreshold":12,"name":"Twelve paid sessions","rewardValue":60000,"voucherValidDays":30}}
```

Errors: 400 input/business rule, 401 unauthenticated, 403 role/ownership/scope, 404 missing resource, 409 stale version/duplicate configuration/inconsistent history. Runtime OpenAPI: `/v3/api-docs/f6-loyalty`, checked snapshot `openapi-f6-loyalty.json`.

## Booking/payment/cancellation integration

These are internal Java hooks, **not HTTP balance mutation endpoints**. Each mutation hook uses MANDATORY propagation and must run in the F3/F4/F5 transaction. The existing booking/payment/cancellation HTTP controllers remain scaffolds; those modules must call these hooks when implemented. Integration tests exercise the hooks against committed SQL Server fixtures and verify rollback. The My Points and Owner configuration HTTP APIs work independently now.

1. F3 summary calls `LoyaltyPointService.preview(playerId, locationId, amountAfterVoucher, voucherId, points)` to calculate without changing balances. Display MSG39 for the Player's agreement. No deduction occurs for a cancelled confirmation.
2. On confirmed creation, save the HOLDING booking/package with an unexpired hold. Apply voucher first, then call `redeemForBooking(id, points)` or `redeemForPackage(id, points)`. Minimum 2 points, sufficient balance, no WALK_IN/SESSION redemption or use for reschedule differences. Redemption updates the authoritative target amount and records REDEEM immediately. Same target/points retry is safe; changed points or reuse after return conflicts.
3. For packages, F3 must persist finalAmount **after the bulk discount and voucher** before calling the point hook, then allocate the total discount, pointsUsed and finalAmount to child sessions under BR28. The hook preserves the existing bulk discount. Child SESSION booking cannot redeem again. Package voucher consumption is still outside the UC24 implementation.
4. VoucherWriteRequest now accepts `allowPoints` (default false) and `maxPointPercent` (required 1–100 when enabled, absent when disabled). UC24 create/edit freezes this policy on publish. The point hook checks the actual voucher usage and limits point discount to that percentage of the amount after voucher. Applying a voucher after points is rejected, enforcing BR41 order.
5. On failure, persist EXPIRED/PAYMENT_REJECTED then call `restoreForFailedBooking(id)` / `restoreForFailedPackage(id)`. RETURN is idempotent. Player cancellation or slot change cannot use these hooks.
6. F4 saves Payment.CONFIRMED and confirms the booking/all package sessions, then calls `accrueForConfirmedPayment(paymentId)`. Reschedule payment targets resolve their booking and only accrue on the extraAmount. A durable unique payment receipt prevents re-earning or counting twice, including payments earning zero points. Creation rollback rolls back receipts, ledger, grants and progress. Payment/target location and amount must agree.
7. F5 saves the resolved affected choice and CANCELLED_BY_FACILITY, then calls `settleFacilityCancellation(affectedId)` immediately. Requires a confirmed payment. Refund and compensation return the original allocated points once. Refund revokes `min(balance, floor(refundedAmount/10000))`, reduces the session counter by one (floor 0) and preserves issued vouchers. Compensation credits `ceil((allocatedCashAmount + confirmedRescheduleExtras)/500)` without revoking earnings/session progress, and saves an in-app notification. Refund/compensation markers prevent duplicate effects even when the result would be zero. Slot change is rejected by this settlement hook.
8. The F5 orchestration must also return the voucher via the existing voucher hook, release/reallocate slots, create refund records and enforce affected-choice transitions. These actions belong to F5 and are not performed by a point service.

Locks: target booking/package/payment, then facility and Player rows; facility configuration uses the same facility lock. The facility/Player lock serializes first balance creation and concurrent spending before reading balance state. SQL unique constraints are additional safeguards. Keep this order in future orchestration; validate deadlock/retry behavior when integrating all modules.

The current database requires finalAmount and payment.amountDue **strictly positive**. The point hook preserves that constraint and rejects a discount covering the entire remaining amount; the SRS wording also permits zero. Supporting zero-cash checkout needs a coordinated booking/payment schema and flow change and is not silently enabled here.

## Database upgrade and verification

Before deploying, apply `backend/db/migrations/20261030_uc25_uc26_loyalty.sql` on the intended database. The script is additive and re-runnable, retains legacy rows, adds receipt/settlement markers, session progress/configuration and voucher stacking policy. `BMS_database.sql` is synchronized for a fresh schema; never recreate an existing database to upgrade it. Hibernate still uses ddl-auto=none; there is no automatic migration runner.

`LoyaltyApiTests` explicitly requires BMS_Test and applies the additive migration twice before its tests to verify re-runnability. Fixtures are committed to test real transactions/concurrency and removed by scoped cleanup. The existing entity inventory assertion is now 36.
