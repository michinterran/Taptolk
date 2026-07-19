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
| Vitest | 43 files / 271 tests PASS |
| DB static contract | 39 migrations / 16 database tests PASS |
| Linked staging pgTAP | 16 files PASS |
| Authenticated staging E2E | 19 tests PASS |
| Actual 10×100 Worker acceptance | 1,000 generated, duplicate 0, decode 100%, export 40/40 PASS |
| Staging Queue | lease resume, retry, archive 11, poison active 0 PASS |
| WCJ | 100 / C100 / J100 / W100 |
| Secret scan | 376 files PASS |
| Logo integrity | required SHA-256 PASS |
| Production build | PASS |
| Playwright local smoke | desktop/mobile 28 PASS |

## Evidence boundary

Docker 부재로 local reset은 실행하지 못했지만, linked staging에 39개 migration을
정렬 적용하고 전체 pgTAP 16개를 실행했다. `pgmq_public`을 노출하고 durable
`qr-generation` Queue를 생성했으며 anon/authenticated 권한 차단과 service-role
send → read → archive를 검증했다.

인증된 staging 19개 E2E에서 Site CRUD·격리, QR Design/Sample/Final Approval 동시성과
Phase 4 입고 → 수동 배정 → 중복 Binding 거부 → CSV commit → Super Admin 교체/최종
폐기를 통과했다. 종료 Binding, 상태 이력, 재고 transaction, redacted audit을 보존하고
QR·고객·관리자·Auth fixture residue가 0임을 확인했다.

실제 Worker 10×100 journey는 chunk commit 후 lease 만료 재개, 1,000개 독립 decode,
40개 export checksum, Queue/archive/poison과 residue 0까지 통과했다. 세부 증거는
`docs/04-report/qr-generation-staging-acceptance.report.md`에 있다.

실제 출력·기기·접근성 수동 검수는 남아 있다. 따라서 이 보고서는 자동화 가능한
staging acceptance 완료 보고이며 물리적 release acceptance 보고는 아니다.
