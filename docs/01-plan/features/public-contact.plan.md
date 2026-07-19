# public-contact - Plan Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Design
> Level: Dynamic

## 1. Overview

### 1.1 Purpose

앱 설치나 로그인 없이 Caller가 ACTIVE QR의 차량 뒷자리만 확인하고, 허용된 사유와
최대 200자 메시지를 차주에게 전달할 Contact Session을 20초 안에 만들며, 익명
recovery cookie로 같은 브라우저에서 대기방을 복구하는 Phase 6 기능을 구현한다.

### 1.2 Background

Phase 5에서 QR–Vehicle–Owner 활성화와 owner-scoped session을 완료했다. Phase 6은
최초의 unauthenticated write 경계다. Public DTO 최소화, message moderation, duplicate
merge, rate limit, session-token isolation, notification intent의 원자성이 구현보다 먼저
고정되어야 한다.

## 2. Goals

### 2.1 Primary Goals

- [ ] ACTIVE QR에 한해 site display name과 차량 뒷자리/선택 정보만 공개한다.
- [ ] Owner ID, 전화번호, 전체 차량번호, 동·호수, 내부 token/hash를 노출하지 않는다.
- [ ] 차량 뒷자리 확인, reason, template/제한된 직접 입력, 최종 확인을 KO/EN으로 제공한다.
- [ ] Contact Session, Caller participant, 첫 Message, notification intent를 한 transaction으로 만든다.
- [ ] 동일 익명 사용자·QR·reason의 3분 내 요청은 기존 열린 Session으로 병합한다.
- [ ] QR/IP/anonymous/device window limit을 PostgreSQL에서 원자 적용한다.
- [ ] anonymous/session token은 hash-only로 저장하고 HttpOnly recovery cookie를 발급한다.
- [ ] 3초 polling과 visibility 복귀 즉시 poll, 종료 상태 중단, 네트워크 backoff를 구현한다.
- [ ] 재접속 시 해당 Caller session만 복구하며 cross-session/cross-tenant 접근을 거부한다.

### 2.2 Non-Goals

- 실제 SMS provider 발송, Queue consumer, retry/archive
- Owner response token과 빠른 답장
- Caller 선택적 SMS 답장 수신
- 60/180초 미응답과 관리사무소 전달
- CAPTCHA provider, 신고/차단 Admin 처리
- Phase 9 KPI/dashboard/cleanup scheduler

## 3. Scope

### 3.1 In Scope

- `contact_sessions`, `session_participants`, `messages`
- Phase 7이 consume할 `notification_deliveries` QUEUED intent
- service-only public contact attempt ledger
- public QR inspection, session create, session read/poll
- reason allowlist와 template dictionary
- message 길이/URL/전화번호/email/반복/기본 위해 패턴 차단
- stable anonymous cookie와 per-session recovery cookie
- `/ko|en/q/{publicToken}` caller journey와 `/ko|en/c/{sessionToken}` waiting room
- linked pgTAP, unit, staging E2E, WCJ, cleanup residue 0

### 3.2 Out of Scope

- 단일 1,000-item Batch나 기존 1–100 수량 정책 변경
- public token, cookie, message 원문, authorization 값을 로그/문서/test artifact에 저장
- browser table direct access
- frontend-only rate limit 또는 tenant filtering
- 알림이 실제 발송되기 전에 “차주에게 보냈습니다”라고 표시

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| PC-01 | Public QR inspect는 ACTIVE QR과 active Binding/Vehicle/Owner 관계를 검증한다. |
| PC-02 | DTO는 QR ACTIVE, vehicle last4/color/type, contact enabled, site display name만 반환한다. |
| PC-03 | Caller가 입력한 last4는 공개 DTO와 일치해야 session을 만들 수 있다. |
| PC-04 | reason은 master allowlist만 허용하고 template body는 typed KO/EN dictionary에서 선택한다. |
| PC-05 | free text는 1–200자, URL/phone/email/기본 abuse pattern 금지다. |
| PC-06 | create는 attempt limit, duplicate merge, Session/participant/message/intent/audit를 원자 처리한다. |
| PC-07 | 동일 anonymous/QR/reason 3분 요청은 새 row 없이 기존 열린 Session DTO를 반환한다. |
| PC-08 | recovery token과 anonymous token 원문은 cookie/response에만 존재하고 DB는 HMAC만 저장한다. |
| PC-09 | session read는 session hash와 anonymous hash를 함께 검증한다. |
| PC-10 | polling은 status/message version만 반환하고 Owner identity/contact를 포함하지 않는다. |
| PC-11 | terminal status에서는 polling을 중단하고 명시적 recovery/complete action을 제공한다. |
| PC-12 | 모든 route/copy/state는 `/ko`·`/en`과 typed locale contract를 함께 충족한다. |

## 5. Non-Functional Requirements

- UI → Route → Application → Domain → Repository/RPC layering
- mutations same-origin, JSON/Zod, no-store, no-referrer
- public errors do not distinguish nonexistent token from non-contactable internal states
- hash/HMAC purpose separation for public, anonymous, session, IP, and user-agent values
- security mutation and redacted audit in the same transaction
- unauthenticated tables have no direct browser grants; service-only RPC is the write boundary
- configurable anonymous/QR/IP rate windows; approved defaults remain outside components/routes
- public create request completes inside 20 seconds in staging
- responsive/semantic heading checks at 320/768/1280/1920 CSS pixels

## 6. Success Criteria

- [ ] actual unauthenticated KO caller journey creates a waiting Session within 20 seconds
- [ ] response and rendered HTML contain no Owner ID/phone/full plate/internal hash
- [ ] same anonymous/QR/reason concurrent or 3-minute repeat returns one Session
- [ ] URL/phone/email/over-200 message rejection
- [ ] cross-session and tampered anonymous cookie denial
- [ ] browser reopen restores only the same Session
- [ ] polling reports truthful `NOTIFICATION_QUEUED`, not provider-sent
- [ ] fixture, contact, message, intent, attempt, Auth, cookie-test residue 0
- [ ] linked pgTAP, caller staging E2E, WCJ, `pnpm verify` PASS

## 7. Implementation Order

1. Plan/Design and privacy/threat boundary
2. Domain reason/message/rate/polling policies and tests
3. Application DTO/service contracts and tests
4. Schema, RLS, transaction/read/cleanup RPCs and pgTAP
5. server crypto/repository/runtime and Route Handlers
6. KO/EN caller and waiting-room UI
7. staging fixture/E2E, gap analysis, report/handoff

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Owner/contact data leak | Critical | Medium | minimal DTO, deny direct grants, response scans |
| token brute force | High | Medium | 256-bit opaque token, HMAC lookup, uniform error, rate ledger |
| duplicate caller spam | High | High | advisory lock, 3-minute merge, QR/IP/anonymous DB limits |
| message abuse/PII | High | High | allowlisted template, bounded free text, policy filter, Phase 8 moderation |
| false sent claim | High | Medium | Queue intent status only; UI says preparing until Phase 7 delivery |
| cross-session recovery | Critical | Medium | session+anonymous dual hash verification and E2E tamper tests |
| cleanup deletes real history | Critical | Low | bounded acceptance labels/tokens and service-only cleanup |

## 9. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` §§6.6, 7.3, 8.7, 10.2, 11.2, 16, 17, 19.1, 21.1–21.4, Phase 6
- `docs/handoff-0720-0147.md`
- `docs/04-report/owner-activation.report.md`
- `AGENTS.md`
