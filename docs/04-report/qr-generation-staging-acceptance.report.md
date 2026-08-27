# QR Generation 10×100 Staging Acceptance Report

- 완료일: 2026-07-20
- 브랜치: `codex/phase-1-foundation`
- 범위: 실제 Worker → `qr-generation` Queue → PDF/CSV/ZIP/manifest
- 수량 계약: Batch당 1–100 유지, 승인된 100-item Batch 10개 조합

## Outcome

staging에서 실제 1,000-item issuance/export journey를 완료했다. 단일 1,000-item
Batch를 만들거나 `chk_qr_batches_requested_quantity`를 완화하지 않았다.

- 10개 Batch × 100개 = 1,000개 생성
- 첫 Job은 50개 chunk를 실제 commit한 뒤 process를 중단
- 60초 visibility lease 만료 후 동일 Queue message를 다시 읽어 재개
- ordinal, public token hash, QR Asset, activation code row 중복 0
- 생성 시 decode 외에 Storage PNG 1,000개를 다시 내려받아 독립 decode 100%
- Batch마다 PDF, CSV, ZIP, checksum manifest 생성
- 40개 export의 byte size와 SHA-256을 Storage object와 DB ledger에서 재검증
- 10개 정상 message와 1개 poison message archive, poison active 0
- acceptance tenant, Auth actor, Queue active/archive, Storage object residue 0

## Runtime corrections

실제 staging 부하에서 발견한 계약 오류를 다음처럼 수정했다.

1. QR render/store와 print source load의 무제한 fan-out을 typed concurrency policy로
   제한했다.
2. PDF/CSV/ZIP/manifest 저장을 기본 concurrency 1로 직렬화했다.
3. `get_qr_print_export_context`의 PL/pgSQL 지역 변수/컬럼 이름 충돌(`42702`)을
   forward migration으로 수정했다.
4. 100-item PDF 약 28MB와 ZIP bundle의 실제 크기에 맞춰 private `qr-artifacts`
   bucket 상한을 50MB로 조정했다.
5. PDF는 독립 export이므로 ZIP에서 중복 PDF만 제거했다. ZIP은 CSV, manifest,
   100개 PNG와 100개 SVG를 유지한다.
6. pre-commit Storage 중단도 lease 만료 뒤 동일 message를 재수신하도록 acceptance
   driver를 강화했다.
7. acceptance E2E가 exact tenant/batch generation/export prefix를 비우고 재조회하도록
   cleanup을 강화했다.

## Validation evidence

| Gate | 결과 |
|---|---|
| 실제 staging acceptance | PASS, 1 test / 약 1.1시간 |
| 생성 | 10 Batch / 1,000 item |
| 중복 | ordinal/token/asset/activation 0 |
| QR decode | 1,000 / 1,000 |
| Export ledger | 40 / 40 checksum·byte size PASS |
| Queue | retry observed, archive 11, poison active 0 |
| Cleanup | tenant/Auth/Queue/Storage residue 0 |
| Linked staging pgTAP | 16 files PASS |
| Authenticated staging E2E | 19 passed / acceptance 1 skipped by default |
| `pnpm verify` | PASS |
| Vitest | 43 files / 271 tests PASS |
| DB static contract | 39 migrations / 16 tests PASS |
| WCJ | 100 / C100 / J100 / W100 |
| Secret scan | 376 text files PASS |
| Logo integrity | required SHA-256 PASS |
| Production build | PASS |

## Evidence boundary

이 보고서는 자동화 가능한 Phase 3 Worker/Queue/export staging acceptance를 닫는다.
Docker가 없어 local reset은 실행하지 못했지만 동일 migration chain은 linked staging
pgTAP 전체를 통과했다. 실제 85mm 인쇄, 대표 iOS/Android 실기기, keyboard,
screen-reader, computed contrast와 responsive 수동 QA는 물리적 release gate로 남는다.

Supabase 공식 문서는 6MB를 넘는 파일에 TUS resumable upload를 권장한다. 현재
100-item PDF/ZIP은 staging에서 standard upload와 Queue retry로 acceptance를
통과했지만, TUS 전환은 Phase 9 운영 hardening 항목으로 유지한다.
