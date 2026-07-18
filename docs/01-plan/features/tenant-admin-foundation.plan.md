# tenant-admin-foundation - Plan

> Version: 1.0.0 | Date: 2026-07-18 | Status: Approved
> Level: Enterprise

## 1. Purpose

Phase 1의 Tenant, Management Company, Site, Contract, Admin Profile,
Membership, RBAC, RLS, Audit 기반을 먼저 데이터 모델과 정책 테스트로 확정한다.

## 2. Goals

- Tenant를 최상위 데이터 격리 단위로 강제한다.
- Management Company와 Site의 tenant 일치를 DB 제약으로 보장한다.
- Supabase `auth.users`와 Admin Profile을 1:1로 연결한다.
- Membership scope가 tenant/company/site 계층을 벗어나지 못하게 한다.
- 역할과 MFA 요구사항을 중앙 정책으로 모델링한다.
- 브라우저 접근 테이블에 RLS를 기본 활성화한다.
- Audit log에 개인정보가 무제한 저장되지 않도록 field contract를 둔다.

## 3. Scope

### In

- 용어집, Entity list, ERD, field specification
- Phase 1 Drizzle schema
- Supabase migration과 indexes/constraints/RLS
- RBAC domain policy
- tenant isolation pgTAP test
- 최소 Admin/Site application interface

### Out

- 실제 Supabase Auth UI와 MFA enrollment
- 원격 Supabase 연결
- Production seed/admin 생성
- QR/Vehicle/Contact 업무 기능
- 전체 Admin dashboard 디자인

## 4. Success Criteria

- 다른 tenant membership은 Site를 읽거나 수정할 수 없다.
- tenant/company/site scope가 불일치하는 row는 DB가 거부한다.
- role별 Site CRUD 권한이 명세 RBAC와 일치한다.
- RLS는 명시적 policy 없이 browser role 접근을 허용하지 않는다.
- migration, Drizzle typecheck, policy unit test가 통과한다.
- Docker 환경에서는 reset + pgTAP으로 최종 acceptance를 확인한다.

## 5. Risks

| 위험 | 통제 |
|---|---|
| RLS policy recursion | `app_private` security-definer scope helper 사용 |
| Service Role의 RLS 우회 | Application service에서 trusted scope를 재계산 |
| nullable scope 조합 오용 | role별 scope check constraint |
| 교차 tenant FK | tenant를 포함한 composite unique/FK |
| audit JSON의 PII | server allowlist와 redaction test |
| Docker 부재 | 정적 migration 검증과 unit test 후 runtime acceptance 보류 |

## 6. Delivery

Schema 문서 → migration/Drizzle → domain policy → DB/unit 검증 → Gap Analysis 순이다.

## 7. References

- Master Spec §6.1, §8.1–8.3, §9.4–9.5, §10, Phase 1
- `docs/architecture/gap-analysis.md`
