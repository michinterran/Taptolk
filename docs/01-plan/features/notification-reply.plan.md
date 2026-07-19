# notification-reply - Plan Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Design
> Level: Dynamic

## 1. Purpose

Phase 6의 durable `QUEUED` notification intent를 lease 기반 SMS Worker가 중복 없이
처리하고, 256-bit hash-only Response Token으로 차주가 요청을 확인·답장하며, 기존
caller waiting room이 답장을 표시하는 Phase 7 기능을 구현한다.

## 2. Goals

- [ ] Queue claim은 `SKIP LOCKED`, 5–300초 lease, due/retry/expired lease만 선택한다.
- [ ] destination 원문은 server provider boundary에서만 복호화하며 저장·로그하지 않는다.
- [ ] provider idempotency key는 delivery별로 안정적이고 재시도에도 동일하다.
- [ ] 256-bit Response Token 원문은 SMS URL에만 존재하고 DB에는 purpose hash만 저장한다.
- [ ] 기본 TTL 60분이며 session 종료·최종 실패·답장 완료 시 revoke한다.
- [ ] retryable provider failure는 bounded backoff, permanent failure는 즉시 final 처리한다.
- [ ] Owner는 KO/EN request view에서 allowlisted quick reply 또는 제한된 custom reply를 보낸다.
- [ ] reply transaction은 Message, session `OWNER_REPLIED`, token revoke, audit를 함께 commit한다.
- [ ] caller poll DTO가 Owner reply를 identity/contact 정보 없이 표시한다.
- [ ] optional caller SMS는 명시적 opt-in 전에는 저장·발송하지 않는다.

## 3. Non-Goals

- 실제 provider credential 배포와 production SMS 비용 발생
- 60/180초 미응답, 관리사무소 알리기, CAPTCHA, 신고·차단
- analytics dashboard, cleanup scheduler, load/security/physical QA
- 기존 QR Batch 1–100 수량 계약 변경

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| NR-01 | claim은 QUEUED/FAILED_RETRYABLE 또는 만료 PROCESSING만 lease한다. |
| NR-02 | claim transaction은 one active Response Token과 PROCESSING 상태를 만든다. |
| NR-03 | provider success는 one receipt, SENT, OWNER_NOTIFIED, redacted audit를 기록한다. |
| NR-04 | retryable failure는 retry count/backoff를 기록하고 max 초과 시 FAILED_FINAL이다. |
| NR-05 | permanent/auth/invalid recipient failure는 FAILED_FINAL이다. |
| NR-06 | 같은 delivery의 provider idempotency key는 lease/retry 간 동일하다. |
| NR-07 | Response Token은 CONTACT_REPLY scope, 60분 TTL, hash-only, one active/session이다. |
| NR-08 | valid token inspect는 reason/message/vehicle last4/site display만 반환한다. |
| NR-09 | Owner reply code는 명세 allowlist이며 CUSTOM은 1–200자 policy를 통과한다. |
| NR-10 | reply는 token/session lock 후 one message, OWNER_REPLIED, revoke, audit를 commit한다. |
| NR-11 | expired/revoked/wrong-scope token은 uniform denial이다. |
| NR-12 | caller polling은 reply code/body/time만 반환하고 Owner identity를 노출하지 않는다. |

## 5. Success Criteria

- [ ] concurrent/repeated Worker execution sends one SMS only
- [ ] retryable failure → scheduled retry → success
- [ ] expired lease recovery without duplicate token or send
- [ ] permanent failure archives/finalizes with poison active 0
- [ ] Owner reply appears in caller waiting room
- [ ] expired/revoked token denial
- [ ] notification/token/message/Auth/fixture/Queue residue 0
- [ ] linked pgTAP, staging E2E, WCJ, `pnpm verify` PASS

## 6. Implementation Order

1. Domain provider error/retry/reply/token policy
2. Application Worker and Owner reply contracts
3. response token + delivery lease/receipt schema and RPCs
4. staging provider adapter and internal Worker handler
5. KO/EN Owner response routes and caller reply rendering
6. linked pgTAP and staging E2E
7. gap analysis, report, handoff

## 7. Risks

| Risk | Mitigation |
|---|---|
| duplicate SMS after crash | stable provider idempotency + leased state + receipt uniqueness |
| token leakage | raw token only provider payload; hash DB; no logs/referrer |
| destination leakage | decrypt only immediately before provider call; redacted errors |
| stale token reply | expiry/revoke/session-status checks under DB lock |
| provider ambiguity | bounded staging adapter; production fail-closed without credential |

## 8. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` §§6.7–6.8, 7.3–7.4, 9.2, 15, 16.3–16.4, Phase 7
- `docs/handoff-0720-0228.md`
- `docs/04-report/public-contact.report.md`
- `AGENTS.md`
