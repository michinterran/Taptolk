# Completion Report: qr-inventory-sample-foundation

> Date: 2026-07-19 | Level: Enterprise

---

## 1. Summary

### 1.1 Feature Overview

Implemented the first QR inventory vertical slice from the approved handoff: scoped Sticker Design
Version management, 1–100 QR Batch requests, sample artifact QA, independent sample approval,
history-preserving invalidation, requester cancellation, and the frozen QR Asset lifecycle schema.
The KO/EN admin journey is live against `taptolk-staging`.

Bulk-generation final approval, Queue/Worker execution, asset issuance, token generation, rendering,
and PDF/ZIP export remain deliberately unimplemented.

### 1.2 Final Match Rate

100% (Target: 90%)

## 2. Completed Items

- [x] Plan and design with glossary, ownership, retention, ERD, state machines, and test gates.
- [x] Central RBAC additions and Application policies with maker-checker unit coverage.
- [x] Five tenant-owned tables, full lifecycle enums, composite constraints, RLS, and safe grants.
- [x] Seven audited mutation families and one actor-redacted scoped read RPC.
- [x] Drizzle schema and pgTAP/static contract coverage.
- [x] Server-only Supabase repository and KO/EN admin server actions.
- [x] Responsive QR inventory/sample UI with no generation side effect.
- [x] Staging migrations `20260719040000` and `20260719043000`.
- [x] Authenticated Staging E2E: QR 6 plus existing Site 4, all passing with residue `0`.
- [x] Desktop/Mobile Playwright smoke: 28 passing.
- [x] `pnpm verify`: lint, types, 89 unit tests, 19 migrations/10 DB tests, secret/logo, WCJ 100,
  and production build passing.

## 3. Deviations from Design

- Added a read-only `SECURITY DEFINER` RPC beyond the eight originally named database functions.
  It is not a business command; it enforces the approved no-actor-identity DTO boundary.
- Applied actor-visibility hardening as a second forward migration after the foundation migration
  had already reached Staging.

## 4. Metrics

| Metric | Value |
|---|---|
| Files changed or added | 27 |
| Approximate diff | +7,057 / -33 lines, including migrations and docs |
| PDCA iterations | 1 |
| Design match rate | 100% |
| Unit tests | 89 passed |
| Browser tests | 28 smoke + 10 authenticated Staging |
| Duration | About 1 hour |

## 5. Learnings

1. Maker-checker UI needs only a current-actor boolean; transmitting actor UUIDs creates an
   unnecessary browser data boundary.
2. `SAMPLE_APPROVED` must remain visibly and structurally separate from
   `GENERATION_APPROVED`; naming, state constraints, and the UI notice all reinforce the same gate.
3. Running the QR suite together with the existing Site suite catches cleanup and shared
   authorization regressions that an isolated feature run can miss.

## 6. Follow-up Items

- [ ] Run Supabase Local reset and runtime pgTAP when Docker becomes available.
- [ ] Perform keyboard, screen-reader, computed contrast, and real-device manual WCJ review.
- [ ] Create a separate Plan/Design for final generation approval.
- [ ] Decide the Queue/Worker runtime in an ADR before implementing generation.
- [ ] Keep QR Asset issuance/token/render/export work behind its own approved scope.
