# Completion Report: Admin Single Login and Server Role Routing

> Date: 2026-07-21 | Level: Enterprise | Decision: `AUTOMATED_COMPLETE / MANUAL_GATES_PENDING`

## 1. Summary

Workorder Task 2 is implemented. Every visible administrator journey now starts at one localized
login, while the server continues to route approved customer and platform roles into distinct
screens and authorization boundaries. No browser metadata or frontend-selected area determines
the role.

Final match rate: **100%** against the Task 2 workorder and approved Admin architecture.

## 2. Related Documents

- Workorder: `docs/development/codex-workorder-0720-2055.md`
- Architecture: `docs/02-design/features/admin-console-architecture.design.md`
- Analysis: `docs/03-analysis/admin-single-login-role-routing.analysis.md`
- Pilot gate: `docs/deployment/pilot-readiness-checklist.md`

## 3. Completed Items

- [x] Canonical KO/EN administrator login at `/{locale}/admin/login`.
- [x] Legacy platform-login route redirects server-side to the canonical entry.
- [x] Password and Google flows no longer accept a browser-selected login area.
- [x] Server-loaded active profile, membership, valid scope, role, TOTP factor, and AAL routing.
- [x] Separate customer and platform dashboards and cross-area server redirects.
- [x] Typed KO/EN unified copy plus loading, error, forbidden/access-denied, and expired states.
- [x] Invalid active role/scope pairing fails closed in the central session policy.
- [x] No Task 3, Production provider/secret/plan/Cron, QR enum, or quantity-policy change.

## 4. Quality Evidence

| Gate | Result |
| --- | --- |
| Focused central policy | 6/6 admin-session tests PASS |
| WCJ | 100 / C100 / J100 / W100 over 92 files |
| Responsive browser | 320/768/1280/1920 login overflow zero; semantic heading 2 lines |
| Local Chromium/Mobile smoke | 36/36 PASS; Axe and KO/EN states included |
| Linked pgTAP | 23 files / 590 tests PASS |
| Authenticated staging E2E | 30 PASS / 1 intentional 10x100 opt-in skip |
| Task 2 role-routing proof | Site Admin customer route + Super Admin platform route: 2/2 PASS |
| Full verify | lint 330 files; typecheck PASS; unit 54 files/335 tests; DB 57/23; secret scan 551; build PASS |
| Production Cron | Active definitions remain 0; deferred verifier PASS |

## 5. Lessons Learned

- Keep the login entry simple, but keep authorization decisions server-owned and role-specific.
- A canonical URL removes UX duplication without merging customer and platform permissions.
- Validate role and scope together before membership priority selection so malformed active data
  fails closed.

## 6. Remaining Gates and Next Step

Manual keyboard, screen-reader, computed-contrast, responsive real-device, and real-journey review
remain pending. Production Supabase/provider/secret/plan/Cron/operations-owner decisions remain
user-owned.

The exact next development step is workorder Task 3 only after separate user authorization. This
report does not authorize access-grant, Test Lab, or persona implementation.
