# Phase 2–4 Implementation Gap Audit

- 기준일: 2026-07-19
- 기준 문서: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` v1.1
- 기준 브랜치: `codex/phase-1-foundation`
- 판정 기준: 코드 존재와 구현 검증을 분리하고, staging 실증 전에는 release acceptance를 주장하지 않는다.

## 1. 현재 판정

Phase 2–4의 저장소 구현은 완료됐다. 브랜드 자산 검증부터 QR 발행·렌더·출력,
Queue Worker, 입고·배정·CSV·교체·폐기까지 하나의 모듈 경계로 연결되어 있다.

다음 항목은 구현 공백이 아니라 외부 검증 공백이다.

- 새 migration 10개의 local reset 및 pgTAP 실행: Docker 부재
- 새 migration의 staging 적용과 인증된 Phase 2–4 journey E2E: 아직 미실행
- staging `pgmq` extension, `pgmq_public` API, `qr-generation` Queue 생성: 사용자 소유 설정
- 실제 인쇄물·실기기 QR 판독과 키보드·스크린리더·계산 대비 수동 검수

따라서 개발 진행 단계는 Phase 4에 도달했지만, Phase 2–4 release acceptance는 위
외부 증거가 확보될 때까지 `PENDING`이다.

## 2. 요구사항 추적표

| Phase | 요구사항 | 구현 상태 | 저장소 증거 |
|---|---|---|---|
| 2 | Brand Asset Upload | 완료 | PNG magic/MIME/크기/checksum, SVG sanitize, private Storage, audited registration |
| 2 | SVG Sanitize | 완료 | script, event handler, `foreignObject`, 외부 reference 거부 unit |
| 2 | Templates 4 | 완료 | 명세 코드 4개 seed, 85mm/300 DPI, immutable trigger |
| 2 | Design Wizard | 완료 | Site·template·선택 고객 로고, canonical zone config, KO/EN |
| 2 | Sample Render | 완료 | 서버 생성 PNG/SVG, private artifact, 인증된 desktop/mobile preview |
| 2 | QR Decode Check | 완료 | 생성 PNG를 `jsQR`로 재디코드하고 URL 불일치 시 실패 |
| 2 | Approval | 완료 | maker-checker, audit, 승인 디자인 identity/config immutable |
| 3 | Token/Human/Activation | 완료 | CSPRNG, SHA-256, AES-256-GCM, key version, checksum, collision retry |
| 3 | Batch 1,000 | 완료 | 50개 chunk, 1,000개 중복 0 unit, ordinal resume |
| 3 | Queue/Retry | 완료 | strict v1 DTO, PGMQ read/archive, visibility timeout, bounded retry, poison archive |
| 3 | Render/Export | 완료 | 고객 로고 포함 300 DPI PNG/SVG, actual 85mm PDF, CSV/ZIP/manifest/checksum |
| 3 | Progress | 완료 | scoped batch/job/export read model과 KO/EN progress UI |
| 4 | Batch Receipt/IN_STOCK | 완료 | full-quantity receipt transaction, asset/status/inventory audit |
| 4 | Manual Assign | 완료 | encrypted/hash vehicle plate, site-scoped atomic Binding |
| 4 | CSV Validate/Commit | 완료 | exact header, duplicate/format 검증, 원본 비보존, checksum, atomic commit |
| 4 | Binding | 완료 | QR active binding 및 vehicle primary active QR partial unique index |
| 4 | Replacement/Revoke | 완료 | 이전 Binding 종료, source/replacement state, append-only history와 audit |

## 3. 자동 검증

- `pnpm verify`: PASS
- Vitest: 43 files, 270 tests PASS
- DB static contract: 32 migrations, 14 pgTAP files PASS
- WCJ: 100 / C 100 / J 100 / W 100, 54 files
- Secret scan: 360 text files PASS
- immutable logo SHA-256: PASS
- production build: PASS
- Playwright local smoke: desktop/mobile 28 tests PASS

`db:check`는 migration transaction boundary와 test contract 존재를 검증하지만 SQL을
실제 PostgreSQL에 적용하지 않는다. 그러므로 local reset/pgTAP 및 staging E2E를
대체하지 않는다.

## 4. Release acceptance 잔여 Gate

1. Docker 사용 가능 환경에서 `pnpm db:start`, `pnpm db:reset:local`, 전체 pgTAP 실행
2. staging에 migration 적용
3. staging Queue 생성·노출·권한 설정 후 publish → consume → resume → archive 실증
4. 인증된 Brand/Design/Sample, 1,000 generation, receipt/assign/CSV/replace/revoke E2E
5. 실제 85mm 출력, 실기기 QR 판독, keyboard/screen-reader/contrast/responsive 수동 QA

위 Gate 전에는 “staging 배포 완료”, “Queue live”, “Phase 2–4 release complete”라고
보고하지 않는다.
