# Phase 2–4 Implementation Report

- 완료일: 2026-07-19
- 브랜치: `codex/phase-1-foundation`
- 범위: Brand·Sticker Design, QR Issuance·Batch, Inventory·Assignment

## Outcome

Taptolk 관리자의 Phase 2–4 작업 흐름을 UI → Application Service → Domain
Authorization → Repository/RPC → PostgreSQL 계층으로 구현했다.

### Phase 2

- PNG/SVG 고객 로고 업로드와 active SVG 차단
- private Storage와 tenant/Site scoped brand asset ledger
- 명세 4개 85mm/300 DPI 템플릿
- 고객 로고 선택이 포함된 디자인 Wizard
- top customer logo / center QR white plate / immutable bottom Taptolk logo
- 실제 QR 생성·PNG 재디코드·checksum·private preview
- desktop/mobile 미리보기와 maker-checker 승인

### Phase 3

- 128-bit public token, Human Code checksum, activation code
- SHA-256 lookup hash와 AES-256-GCM ciphertext/key version
- 1,000개 중복 0, 50개 chunk, ordinal 기반 중단 재개
- PGMQ Worker read/visibility/archive와 제한 재시도
- 완료 Job·chunk idempotency
- 고객 로고 포함 SVG/300 DPI PNG
- actual 85mm A4 PDF, CSV, ZIP, checksum manifest
- 생성·실패·출력 progress read model

### Phase 4

- delivered Batch full receipt와 `IN_STOCK`
- 차량번호 AES-GCM ciphertext, keyed hash, last4 read model
- 수동 QR 배정
- CSV exact header/format/duplicate 검증과 원본 비보존
- validation ledger와 atomic commit
- active double-binding database 차단
- replacement/revoke와 이전 Binding·상태 이력 보존
- 모든 security mutation의 redacted audit

## Validation

| Gate | 결과 |
|---|---|
| `pnpm verify` | PASS |
| Vitest | 43 files / 270 tests PASS |
| DB static contract | 32 migrations / 14 database tests PASS |
| WCJ | 100 / C100 / J100 / W100 |
| Secret scan | 360 files PASS |
| Logo integrity | required SHA-256 PASS |
| Production build | PASS |
| Playwright local smoke | desktop/mobile 28 PASS |

## Evidence boundary

Docker 부재로 새 migration의 local reset/pgTAP runtime 적용은 실행하지 못했다.
staging migration과 실제 Queue는 아직 적용하지 않았다. Queue는 공식
`pgmq_public.read(queue_name, sleep_seconds, n)` 및 `archive` 계약에 맞춰
구현했지만 staging Queue의 생성·노출·권한 설정은 사용자 소유 외부 작업이다.

따라서 이 보고서는 저장소 개발 완료 보고이며 release acceptance 보고가 아니다.
잔여 Gate는 `docs/architecture/phase-2-4-gap-audit.md`를 따른다.
