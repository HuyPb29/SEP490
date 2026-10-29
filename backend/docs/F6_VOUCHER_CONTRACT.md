# F6 / UC24 — Voucher contract

OpenAPI JSON: [openapi-f6-vouchers.json](openapi-f6-vouchers.json).
Runtime group: `GET /v3/api-docs/f6-vouchers` (also selectable in Swagger UI).
The JSON is exported from the actual Springdoc endpoint by `VoucherApiTests` to
`target/f6-openapi.json`; copy it here after contract changes pass tests.

## Endpoints

All responses use `ApiResponse<T>`. Lists use `PageResponse<T>` with `content`,
`pageNumber`, `pageSize`, `totalElements`, `totalPages`, `last`.
Pagination: zero-based `page=0`, `size=20`, size 1–100, descending id.

| Method | Path | Access | Result |
|---|---|---|---|
| GET | `/api/locations/{id}/vouchers` | Public | Published public vouchers currently in date/quantity/budget range |
| GET | `/api/me/vouchers` | PLAYER | Own grants including used/expired history, with voucher and expiry |
| GET | `/api/owner/vouchers` | OWNER + X-Location-Id | Facility vouchers; optional `status` |
| GET | `/api/admin/vouchers` | ADMIN | All vouchers; optional `locationId`, `status` |
| POST | `/api/owner/vouchers` | OWNER + X-Location-Id | 201, create CAMPAIGN DRAFT |
| PATCH | `/api/owner/vouchers/{id}` | OWNER + X-Location-Id | Replace complete DRAFT configuration using `{version, voucher}` |
| POST | `/api/owner/vouchers/{id}/publish` | OWNER + X-Location-Id | Publish; repeat is safe; DISABLED cannot be republished |
| POST | `/api/admin/vouchers/{id}/disable` | ADMIN | Disable; repeat is safe; records disabledBy |
| POST | `/api/owner/vouchers/{id}/grants` | OWNER + X-Location-Id | 201, grant published SPECIFIED campaign via `{playerIds: [...]}` |
| POST | `/api/vouchers/check` | PLAYER | Quote only: `{locationId, orderAmount, selection: {code, grantId}}` |

Errors: 400 invalid inputs/eligibility, 401 unauthenticated, 403 role/scope,
404 missing resource/inactive facility, 409 duplicate code/stale version/state conflict.
Security filter errors currently use Spring `sendError`; controller errors use ApiResponse.
Code uniqueness is per facility, uppercase normalization, 1–20 ASCII letters/digits/underscore/hyphen.
The database constraint also handles concurrent creates.

## Voucher configuration and lifecycle

- Owner can author CAMPAIGN only. LOYALTY, BATCH_OFFER and COMPENSATION issuance is outside UC24 authoring.
- Required configuration: `name`, `targetGroup`, `discountType`, `discountValue`,
  `minOrderAmount`, `validFrom`, `validTo`. Optional: `code`, `grantValidDays`,
  `maxUsesPerPlayer`, `maxTotalUses`, `budget`. See OpenAPI schemas for bounds.
- ALL_PLAYERS/NEW_PLAYERS require a public code; SPECIFIED requires no code and uses grants.
- Only DRAFT is editable. Publish freezes campaign terms; an Owner cannot bypass Admin disable.
- Admin alone disables vouchers. Scope/resource ownership is checked in service, in addition to endpoint RBAC.
- NEW_PLAYERS: no CONFIRMED/IN_USE/COMPLETED booking at the facility (confirmed by user on 29/10/2026).
- Dates are inclusive local dates. A grant expires at the earlier of `grantedAt + grantValidDays`
  and midnight after `validTo`; expiry is exclusive. Null limits mean unlimited.
- Grant requests deduplicate Player ids within one request, require ACTIVE PLAYER accounts,
  and accept at most 100 ids. Repeating the request creates additional grants; it is not idempotent.
- Personal history includes disabled/expired vouchers; listing is not a promise of eligibility.

## Eligibility and price calculation

`selection` contains exactly one nonblank `code` or positive `grantId`.
Check verifies active facility, location, PUBLISHED status, date range, target group,
grant ownership/status/expiry, minimum order, per-Player limit, total limit and remaining budget.
Only USED usage counts toward Player quota. PERCENT rounds down to integer VND.
AMOUNT is capped so at least 1 VND remains, matching existing SQL `final_amount > 0`.
Insufficient remaining budget rejects the request; it does not silently reduce the discount.

Check never consumes a grant, usage, quota or budget. Client `orderAmount` is only a preview;
clients cannot submit a computed discount or change voucher counters through an endpoint.
Booking creation must recalculate against server-authoritative amounts and points.

## Booking integration boundary

F3 HTTP booking creation/expiry/payment/cancellation services are still scaffolds.
These hooks are implemented and tested on SQL Server with persisted SINGLE booking fixtures;
there is no complete HTTP booking flow yet.

```java
// Inside F3's @Transactional creation method, after persisting/flushing a SINGLE booking:
VoucherUsage usage = voucherService.consumeForBooking(bookingId, selection);
// If subsequent slot/point/payment preparation fails, throw: the whole transaction rolls back.

// Inside a later @Transactional failure handler, set the booking failure status first:
voucherService.restoreForFailedBooking(bookingId);
```

Both hooks use MANDATORY propagation: they cannot commit independently from booking changes.
Consumption derives Player, facility and list amount from the locked booking row; rejects
WALK_IN, SESSION/package bookings, non-HOLDING and expired holds. Voucher row lock serializes
quota/budget updates, refreshes after waiting, and rechecks all conditions.
It sets voucherDiscount/finalAmount and writes voucher_usage, increments usedCount/budgetUsed,
and marks a selected grant USED in one transaction. The same booking/selection returns the
existing USED usage on retry; a different selection or a returned usage conflicts.

Restore accepts only EXPIRED, PAYMENT_REJECTED and CANCELLED_BY_FACILITY bookings.
It returns quota/budget/grant once, records RETURNED/returnedAt and keeps historical booking prices.
An expired or disabled voucher/grant remains unusable even after counters are restored.
Player cancellation policy, package consume/restore, automatic jobs, booking hooks wiring,
loyalty points and automatic reward issuance remain outside this implementation.

No schema migration or dependency changes are required.
