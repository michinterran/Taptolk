# escalation-abuse - Plan Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Design
> Level: Dynamic

## Goal

Phase 8의 60/180초 미응답 상태, 관리사무소 알리기, rollback과 분리된 durable abuse
evidence, CAPTCHA hook, 신고·차단·Admin 처리와 redacted audit를 구현한다.

## Requirements

- 60초에는 미응답 안내만, 180초에는 caller가 관리사무소 알리기를 선택할 수 있다.
- office action은 caller session+anonymous dual hash, elapsed time, open status를 검증한다.
- rate-limit 실패는 원 transaction rollback 뒤 별도 `abuse_events` row로 남는다.
- CAPTCHA는 provider interface/hook으로 존재하며 production 설정 없이는 fail-closed가
  가능해야 한다.
- report/block는 원문 token/IP/phone을 저장하지 않고 hash/reason/status만 저장한다.
- Admin 처리와 block mutation은 tenant/site scope와 redacted audit를 적용한다.
- repeated blocked caller는 Contact 생성 전에 거부한다.

## Acceptance

- 반복 호출 차단과 durable BLOCKED evidence
- 60/180 상태와 premature office action 거부
- 180초 이후 one office alert intent와 `ESCALATED`
- report → Admin disposition → caller block
- audit와 tenant isolation
- linked pgTAP, staging E2E, WCJ, `pnpm verify`

## Non-goals

- vendor CAPTCHA 연결, production SMS 비용, Phase 9 analytics/cleanup/load/physical QA
- QR Batch 1–100 수량 정책 변경
