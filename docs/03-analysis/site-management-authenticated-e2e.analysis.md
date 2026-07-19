# Gap Analysis: site-management-authenticated-e2e

> Date: 2026-07-19 | Design: `docs/02-design/features/site-management.design.md`

## Match Rate: 100%

## Summary

실제 staging Auth session과 TOTP AAL2를 사용하는 Site CRUD·Tenant Isolation browser
gate를 구현했다. Super Admin의 KO/EN 전체 lifecycle, Management Admin의
Management Company scope, Site Admin의 exact Site scope, 변조 form submit 차단,
감사 payload redaction과 fixture residue `0`을 증명했다.

실행 과정에서 정적·SQL rollback 검증이 찾지 못한 두 결함을 발견해 수정했다.

1. Site catalog가 존재하지 않는 direct `sites → tenants` PostgREST relation을
   요청해 `PGRST200`으로 실패했다. Tenant를 Management Company 아래 nested
   relation으로 조회하도록 고쳤다.
2. 하위 scope membership이 자신의 parent Tenant와 Management Company를 읽지 못해
   nested inner join 결과가 사라졌다. mutation/Site scope는 넓히지 않고 parent
   read-only helper만 추가했다.

## Implemented Items

- [x] staging project-ref와 URL 일치 guard
- [x] 실행 중에만 존재하는 Auth 사용자, password, TOTP
- [x] service-role 최소 fixture privilege와 pgTAP contract
- [x] KO 생성 후 EN 운영정보·계약·중지·재개·종료
- [x] Management Admin same-company visibility와 cross-tenant mutation 거부
- [x] Site Admin exact-Site visibility와 sibling-Site mutation 거부
- [x] 성공 command별 actor/action 감사 증거
- [x] audit JSON 민감 키 및 전체 주소 비노출
- [x] 성공·실패 종료 cleanup과 residue `0`

## Evidence

- `pnpm e2e:staging:sites`: 3/3 passed
- `pnpm verify`: passed
- Vitest: 16 files / 71 tests passed
- DB static contract: 15 migrations / 8 database tests passed
- WCJ: W/C/J 100/100/100, 47 files
- Production build: passed
- Desktop/Mobile smoke: 26/26 passed
- Staging residue query: Tenant 0, Management Company 0, Site 0, Admin Profile 0, Audit 0

## Remaining Gap

- Docker가 없어 Supabase Local reset과 local pgTAP runtime은 아직 실행하지 못했다.
- 자동화된 staging E2E 성공은 keyboard, screen reader, computed contrast, real-device
  review를 대체하지 않는다.
- Site lifecycle request/approval queue는 별도 maker-checker slice로 남아 있다.
