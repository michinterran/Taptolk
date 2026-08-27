# owner-activation - Plan Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Design
> Level: Dynamic

## 1. Overview

### 1.1 Purpose

차주가 배포된 QR을 스캔하고 활성화 코드, 차량 정보, 휴대전화 OTP, 약관 동의를
완료해 QR–Vehicle–Owner 관계를 안전하게 활성화하는 Phase 5 기능을 구현한다.

### 1.2 Background

Phase 2–4에서 QR issuance, activation code, vehicle preassignment, Binding history,
Queue/Worker/export의 자동화 staging acceptance를 완료했다. Phase 5는 공개 QR에서
Owner PWA로 넘어가는 최초의 개인정보 처리 경계이므로 verified-phone proof,
동시성, tenant isolation, redacted audit, cleanup을 먼저 고정해야 한다.

## 2. Goals

### 2.1 Primary Goals

- [ ] public token hash로 활성화 가능 상태를 inspect하되 차주·전화번호·전체 차량번호를
      노출하지 않는다.
- [ ] 6자리/3분 OTP, 60초 resend, 입력 5회, 전화번호 시간당 5회/일일 10회,
      IP·device 제한을 PostgreSQL 원자 정책으로 강제한다.
- [ ] OTP 성공 후 짧은 TTL의 1회용 verified-phone proof를 발급한다.
- [ ] activation complete를 하나의 PostgreSQL transaction으로 처리한다.
- [ ] Owner, Vehicle, vehicle-owner 관계와 QR Binding/history를 보존한다.
- [ ] 두 동시 활성화 요청 중 정확히 하나만 성공한다.
- [ ] `/ko`·`/en` activation journey와 Owner PWA static shell을 제공한다.
- [ ] cross-owner/cross-tenant 조회를 backend policy와 RLS에서 각각 차단한다.

### 2.2 Non-Goals

- 실제 국내 SMS 사업자 계약과 production 발신번호 연결
- Public Contact Session, Caller message, Owner reply
- Push subscription과 background notification
- 관리사무소 escalation, moderation, abuse dashboard
- Owner 전화번호 변경, 분실·교체 self-service 전체 구현

## 3. Scope

### 3.1 In Scope

- `owners`, `owner_devices`, `vehicle_owners`
- OTP challenge/attempt와 verified-phone proof
- Owner session token/cookie의 hash-only persistence
- activation inspect, OTP request/verify, activation complete
- 신규 차량 self-registration과 기존 preassigned vehicle confirmation
- QR status `IN_STOCK|ASSIGNED → ACTIVATION_PENDING → ACTIVE`
- activation code `ISSUED → USED`
- Binding create 또는 preassigned Binding owner attach
- consent version/consented timestamp
- KO/EN activation page, success/error/retry states
- Owner PWA manifest, standalone shell, offline fallback; 민감정보 cache 금지
- linked pgTAP, unit, authenticated/service staging E2E, WCJ

### 3.2 Out of Scope

- 단일 1,000-item Batch 또는 기존 Batch 수량 정책 변경
- OTP·전화번호·activation code·public token 원문 로그/문서/fixture 저장
- browser table direct mutation
- frontend-only tenant filtering
- Phase 6–9 기능의 선행 구현

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| OA-01 | inspect는 public token hash와 QR 상태를 검증하고 최소 DTO만 반환한다. |
| OA-02 | activation code는 hash 비교, ISSUED/expiry/unused를 검증한다. |
| OA-03 | OTP request는 phone/IP/device window limit과 resend cooldown을 원자 적용한다. |
| OA-04 | OTP verify는 최대 5회, 3분 expiry, 성공 즉시 challenge consume을 적용한다. |
| OA-05 | verified-phone proof는 hash-only, 짧은 TTL, activation 1회 소비다. |
| OA-06 | complete는 QR/code/proof를 잠그고 Owner/Vehicle/Binding/Audit을 한 transaction으로 commit한다. |
| OA-07 | preassigned vehicle는 plate proof가 일치할 때 기존 Binding에 Owner를 연결한다. |
| OA-08 | self-registration은 exact Site 안에서 plate hash 충돌과 active Binding 충돌을 차단한다. |
| OA-09 | Owner session은 HttpOnly/Secure production/SameSite=Lax cookie로 발급한다. |
| OA-10 | Owner read model은 해당 Owner의 vehicle/QR만 반환하고 전화번호는 masked DTO만 허용한다. |
| OA-11 | 모든 copy/state는 typed KO/EN dictionary에 함께 추가한다. |
| OA-12 | offline에서는 activation 완료를 주장하지 않고 network recovery action을 제공한다. |

## 5. Non-Functional Requirements

- Phone lookup은 purpose-separated keyed HMAC, 저장 원문은 AES-256-GCM + key version
- OTP/proof/session/code/token 원문 로그 금지
- security mutation과 redacted audit은 동일 transaction
- browser-accessible Owner read model은 explicit RLS와 policy test
- service-only OTP/proof tables는 browser grant 없음
- rate/TTL/attempt 수치는 typed environment policy에서 application/RPC 입력으로 전달
- 입력 validation은 Application DTO와 PostgreSQL constraints 양쪽에서 수행
- 모든 locale route는 320/768/1280/1920 CSS px 의미/리듬 검증

## 6. Success Criteria

- [ ] concurrent activation complete 2개 중 1 success / 1 conflict
- [ ] QR `ACTIVE`, activation code `USED`, proof consumed, one current Binding
- [ ] OTP expiry/resend/attempt/phone/IP/device limit PASS
- [ ] Owner A가 Owner B vehicle/read model을 볼 수 없음
- [ ] preassigned와 self-registration journey 모두 PASS
- [ ] phone/OTP/code/token/cookie/authorization secret scan PASS
- [ ] fixture, Auth/session, OTP/proof residue 0
- [ ] linked pgTAP, owner staging E2E, WCJ, `pnpm verify` PASS

## 7. Implementation Order

1. Plan/Design and threat/data-flow review
2. Domain policy and Application DTO/service tests
3. Schema, transaction RPC, RLS, pgTAP
4. Server repositories, encryption/HMAC and OTP provider adapter
5. Route handlers and Owner session cookie
6. KO/EN activation UI and PWA shell
7. Staging fixture/E2E, gap analysis, report/handoff

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| OTP replay/brute force | High | Medium | hash-only code, row lock, attempt/TTL/rate limit, one-time proof |
| Concurrent double activation | High | High | QR/code/proof `FOR UPDATE`, unique active Binding, one transaction |
| Cross-owner data leak | High | Medium | owner session policy + owner-scoped RPC + RLS policy tests |
| Preassigned Binding mismatch | High | Medium | exact Site/plate hash/QR lock and immutable history |
| SMS provider unavailable | Medium | High | provider interface + bounded staging mock inbox, no production claim |
| PII in logs/audit | High | Medium | allowlisted DTO/audit and existing central redaction scan |
| Supabase Auth phone setup unavailable | Medium | High | `owners.auth_user_id` nullable; first slice uses one-time owner session compatible with later Auth link |

## 9. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` §§6.4, 8.6, 9.1, 11.3, 12.3, 18, 19.2, 22, Phase 5
- `docs/handoff-0720-0038.md`
- `docs/04-report/qr-generation-staging-acceptance.report.md`
- `AGENTS.md`
