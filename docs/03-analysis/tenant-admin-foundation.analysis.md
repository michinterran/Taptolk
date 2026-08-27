# Gap Analysis: tenant-admin-foundation

> Date: 2026-07-18 | Design: `docs/02-design/features/tenant-admin-foundation.design.md`

---

## Match Rate: 92%

## Summary

Phase 1의 데이터 모델, 복합 tenant 제약, RBAC/MFA policy, RLS, audit 안전장치와
Site application service 기반은 설계대로 구현됐다. 정적 migration 검사, typecheck와
unit test는 통과했다. Docker가 없어 실제 PostgreSQL migration/pgTAP은 실행하지
못했고, Admin Auth UI와 인증된 Site CRUD E2E는 설계상 후속 acceptance로 남는다.

## Implemented Items

- [x] 7개 Phase 1 entity의 Drizzle schema와 Supabase migration
- [x] UUID, `timestamptz`, version, `deleted_at`, normalized slug/index
- [x] tenant/company/site composite unique와 foreign key
- [x] role/scope check constraint와 중앙 permission policy
- [x] privileged role MFA/AAL2 assurance policy
- [x] browser 접근 table의 RLS enable + force
- [x] 고정 `search_path`의 비재귀 security-definer scope helper
- [x] anonymous privilege 제거와 authenticated 최소 table privilege
- [x] audit browser insert 금지와 민감한 top-level JSON key 거부
- [x] Site create/update/archive의 authorization → transaction → audit 흐름
- [x] 교차 tenant application 접근 거부와 RBAC/MFA unit test
- [x] migration transaction/RLS/constraint/policy 정적 검사

## Missing Items

- [ ] Docker PostgreSQL에서 migration reset과 pgTAP runtime 실행
- [ ] 실제 Supabase session을 사용한 same-scope/cross-scope RLS 증명
- [ ] Admin 로그인·MFA enrollment/recovery UI
- [ ] repository/route/UI를 포함한 인증된 Site CRUD E2E

## Changed Items (Deviations from Design)

- [ ] 설계 §5는 Site mutation을 platform role 중심으로 기술했지만 현재 중앙 RBAC와
  RLS는 `MANAGEMENT_ADMIN`의 create/update 및 `SITE_ADMIN`의 update를 허용한다.
  Admin UI 구현 전에 역할별 Site CRUD permission matrix를 명시적으로 확정해야 한다.

## Evidence

- `pnpm verify:full`: 통과
- TypeScript: 10 packages / 14 tasks 통과
- Vitest: 8 files / 25 tests 통과
- DB static check: 2 migrations / 2 DB test files 통과
- Production dependency audit: 알려진 취약점 0건

## Recommendations

1. Docker 준비 즉시 reset과 pgTAP을 먼저 실행해 RLS runtime 증거를 만든다.
2. 역할별 Site CRUD matrix를 설계 문서와 중앙 policy의 단일 기준으로 확정한다.
3. Auth/MFA 다음에 repository와 bilingual Admin Site CRUD를 수직 slice로 연결한다.
4. Service Role repository도 client의 tenant ID를 신뢰하지 않고 membership에서 scope를
   재계산한다.

## Next Steps

- [ ] foundation 구현 일치율은 90% 이상이나 외부 acceptance는 미완료다.
- [ ] report에는 “Phase 1 foundation 완료, Phase 1 전체 미완료”로 기록한다.
