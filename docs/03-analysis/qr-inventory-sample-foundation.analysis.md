# Gap Analysis: qr-inventory-sample-foundation

> Date: 2026-07-19 | Design:
> `docs/02-design/features/qr-inventory-sample-foundation.design.md`

---

## Match Rate: 100%

## Summary

The implementation matches all 20 reviewed items in the approved first-slice design. It keeps
sample approval separate from final bulk-generation approval and does not introduce a renderer,
queue, worker, export, token-generation, or QR Asset issuance path.

The browser read boundary was strengthened during Check: Design creator and Batch requester UUIDs
are no longer selectable by authenticated browser sessions. The scoped read RPC returns only
`created_by_current_actor` and `requested_by_current_actor` booleans for maker-checker decisions.
This is consistent with the design requirement that browser DTOs contain no actor identity.

## Implemented Items

- [x] Central Design and QR Batch permissions with role coverage.
- [x] Application service, typed DTOs, validation, scope checks, and maker-checker policy.
- [x] Design `DRAFT → APPROVED → ARCHIVED` state contract.
- [x] First Batch slice: `DRAFT → SAMPLE_READY → SAMPLE_APPROVED`.
- [x] Sample invalidation returns the Batch to `DRAFT` and preserves terminal sample history.
- [x] Requester cancellation from `DRAFT` and `SAMPLE_READY`.
- [x] Full frozen Batch and QR Asset status enums without premature transition commands.
- [x] Tenant/Management Company/Site composite keys and cross-scope foreign keys.
- [x] RLS on every browser-accessible table and browser mutation denial.
- [x] Same-transaction, redacted audit for all seven mutation families.
- [x] Immutable QR Asset status history and retained invalidated samples.
- [x] 1–100 quantity policy in Application and PostgreSQL constraints.
- [x] Sample MIME, checksum, byte-size, storage metadata, and three QA evidence checks.
- [x] Actor-redacted scoped read RPC with stable 100-row collection bounds.
- [x] Server-only Supabase repository and server actions.
- [x] Canonical KO/EN QR inventory route and typed locale copy.
- [x] Explicit UI notice that sample approval does not begin bulk generation.
- [x] Desktop/Mobile unauthenticated access-denial smoke.
- [x] Authenticated Staging Design/Batch/sample/tenant-isolation E2E with residue `0`.
- [x] WCJ, unit, type, DB static, secret, logo, and production-build gates.

## Missing Items

None within this feature's approved first-slice scope.

## Changed Items (Deviations from Design)

- [x] The design named eight command functions, while the implementation adds one read-only
  `SECURITY DEFINER` RPC. This is a security-strengthening implementation detail that reduces
  actor UUIDs to current-actor booleans; it does not add a business command or broaden scope.
- [x] The actor-visibility hardening is isolated in a second forward-only migration because the
  foundation migration had already been applied to Staging before the Check finding.

## Open Acceptance Gates

- Supabase Local reset and runtime pgTAP remain unexecuted because Docker is unavailable.
- Keyboard, screen-reader, computed contrast, and real-device manual review remain manual WCJ
  obligations; automated WCJ and Playwright do not replace them.
- These gates prevent a full Phase 1 completion claim, but they do not represent a design/code gap
  in this scoped feature.

## Recommendations

1. Run Supabase Local reset and pgTAP as soon as Docker is available.
2. Start a separate Plan/Design for final generation approval and a Queue/Worker ADR; do not extend
   the sample-approval command.
3. Keep QR Asset issuance, token generation, rendering, and PDF/ZIP export outside this slice.

## Next Steps

- [x] Proceed to the PDCA report because the scoped match rate is at least 90%.
