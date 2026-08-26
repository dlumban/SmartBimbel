# Task 5.3 — Platform Commission & Transaction Ledger

**Sprint:** 5 — Payments & Payouts
**Estimate:** 2 days

## Goal

Track commission and give both sides an accurate, auditable transaction history, per PRD §6.1.E ("Configurable platform commission... Full transaction history for both sides") and §11 (monetization).

## Scope

- Commission configuration: default 15% (PRD §6.1.E/§11), stored as a configurable value (env var or a simple settings table — not hardcoded, since PRD §14 flags the final rate as still open).
- On successful payment, `Transaction` records: gross amount, commission amount, net amount owed to tutor, gateway reference, status, timestamps.
- `GET /transactions` (role-scoped: student sees their payments, tutor sees their earnings) with filtering by date range/status.
- Ledger integrity: commission calculation is deterministic and covered by tests across edge cases (rounding on odd amounts, since IDR has no subunits in practice — decide and document a rounding rule).

## Acceptance Criteria

- [ ] Every successful payment produces a `Transaction` with correct gross/commission/net breakdown.
- [ ] Changing the configured commission rate affects only new transactions, never recalculates historical ones.
- [ ] Student and tutor each see an accurate, role-appropriate transaction history via the API.
- [ ] Rounding behavior for commission calculation is explicit and tested (no silent off-by-one-rupiah discrepancies accumulating at scale).

## Technical Notes

- Keep commission rate configuration simple (env var or single settings row) for MVP — a full per-tutor or promotional commission override system is not in scope; PRD §11 only asks for a single configurable rate.

## Dependencies

- [Task 5.2 — Booking Payment Flow](task-2-booking-payment-flow.md)
