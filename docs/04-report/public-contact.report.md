# Phase 6 Public Contact Completion Report

- 완료일: 2026-07-20
- 브랜치: `codex/phase-1-foundation`
- 기준: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- Plan: `docs/01-plan/features/public-contact.plan.md`
- Design: `docs/02-design/features/public-contact.design.md`
- Analysis: `docs/03-analysis/public-contact.analysis.md`

## 구현 완료

- ACTIVE 공개 QR 조회, 차량 뒷자리 확인, reason/message, 검토, 전송, 대기방의 KO/EN 여정
- Contact Session, participant, message, notification intent, public rate attempt 데이터 모델
- rate/duplicate merge/owner 비노출을 포함한 service-only 원자적 session 생성 RPC
- raw token을 저장하지 않는 anonymous/session HttpOnly recovery cookie
- 동일 caller·QR·reason 3분 merge와 session/message/notification 중복 방지
- adaptive 3/5/10/15초 polling, visibility recovery, no-store response
- bounded staging fixture와 Contact/Owner/Auth 정확 cleanup

## 변경 영역

- `packages/domain`: Contact reason, moderation, rate, polling 정책
- `packages/application`: public inspect/create/read orchestration과 DTO/repository 계약
- `packages/db`: Phase 6 schema, 관계, 제약, 인덱스
- `apps/web/public-contact`, `apps/web/app/api/public`: crypto/repository/runtime/API
- `apps/web/app/[locale]/q`, `apps/web/app/[locale]/c`: KO/EN caller journey
- `supabase/migrations/2026071915*.sql`: schema/RPC/fixture/forward fixes
- `supabase/tests/database/phase_6_public_contact.sql`: linked pgTAP
- `e2e/staging/public-contact.spec.ts`: actual unauthenticated staging journey

## 테스트

| Gate | 결과 |
|---|---|
| Phase 6 linked pgTAP | 50/50 PASS |
| Full linked pgTAP | 전체 file PASS |
| Full staging E2E | 23 passed / 1 expected long-run skip |
| Public Contact staging E2E | 2/2 PASS |
| 무회원 전송 | 20초 이내 PASS |
| same-session merge | session 1 / message 1 / delivery 1 |
| owner data disclosure | 0 |
| unsafe input persistence | 0 |
| Contact/Owner/Auth cleanup | residue 0 |
| Axe | violation 0 |
| Responsive | 320/768/1280/1920 overflow 0 |
| WCJ | 100 / C100 / J100 / W100 |
| Vitest | 47 files / 299 tests PASS |
| `pnpm verify` | PASS |

## 보안 확인

- public QR, anonymous identity, Contact Session token은 원문을 DB, audit, 로그, 문서에
  저장하지 않았다.
- caller DTO에 Owner identity, phone, destination hash, raw session credential이 없다.
- browser가 service-role credential, DB client, HMAC key, provider secret을 import하지
  않는다.
- Contact table은 RLS enable/force와 service-only privilege를 적용했다.
- HttpOnly/SameSite caller cookie, same-origin mutation, no-store response를 적용했다.

## 미완료·리스크

- 실제 SMS Queue leasing/provider send/retry와 Response Token은 Phase 7 범위다.
- blocked rate attempt의 독립 durable abuse ledger와 CAPTCHA/report/block는 Phase 8 범위다.
- Docker local reset은 환경 제약으로 미실행이며 전체 linked staging pgTAP이 실행 증거다.
- 실제 screen reader, 대표 iOS/Android, 85mm 물리 인쇄는 Phase 9 pilot gate다.

## 다음 작업

Phase 7 Notification and Reply를 별도 Plan/Design으로 시작한다. 기존 `QUEUED`
notification intent를 leased Queue로 소비하고, 256-bit hash-only Response Token, 60분
TTL, idempotent SMS provider adapter, retry/final failure, Owner quick reply, caller polling,
optional caller SMS를 구현한다.
