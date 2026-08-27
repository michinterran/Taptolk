# Phase 2–4 Implementation Gap Audit

- 기준일: 2026-07-19
- 기준 문서: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` v1.1
- 기준 브랜치: `codex/phase-1-foundation`
- 판정 기준: 코드 존재와 구현 검증을 분리하고, staging 실증 전에는 release acceptance를 주장하지 않는다.

## 1. 현재 판정

Phase 2–4의 저장소 구현은 완료됐다. 브랜드 자산 검증부터 QR 발행·렌더·출력,
Queue Worker, 입고·배정·CSV·교체·폐기까지 하나의 모듈 경계로 연결되어 있다.

staging에는 local과 일치하는 39개 migration, `pgtap`/`pgmq`, `pgmq_public`, durable
`qr-generation` Queue를 적용했다. 전체 pgTAP과 인증된 Site/QR 승인·동시성·Phase 4
입고/배정 E2E, 실제 10×100 Worker/Queue/export acceptance도 통과했다.

다음 항목은 구현 공백이 아니라 잔여 release acceptance 검증 공백이다.

- Docker 부재로 인한 local reset 미실행. 동일 SQL은 linked staging 전체 pgTAP으로 검증
- 실제 인쇄물·실기기 QR 판독과 키보드·스크린리더·계산 대비 수동 검수

따라서 자동화 가능한 Phase 2–4 staging acceptance는 완료됐다. 물리적 인쇄·실기기와
보조기술 수동 검수는 release 전 외부 gate로 남는다.

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
| 3 | Batch 1,000 | 완료 | 10×100 실제 staging, 50개 chunk commit 후 lease resume, 중복 0 |
| 3 | Queue/Retry | 완료 | 실제 PGMQ visibility retry, 정상/poison archive 11, active poison 0 |
| 3 | Render/Export | 완료 | 1,000 독립 decode, PDF/CSV/ZIP/manifest 40개 checksum/ledger |
| 3 | Progress | 완료 | scoped batch/job/export read model과 KO/EN progress UI |
| 4 | Batch Receipt/IN_STOCK | 완료 | full-quantity receipt transaction, asset/status/inventory audit |
| 4 | Manual Assign | 완료 | encrypted/hash vehicle plate, site-scoped atomic Binding |
| 4 | CSV Validate/Commit | 완료 | exact header, duplicate/format 검증, 원본 비보존, checksum, atomic commit |
| 4 | Binding | 완료 | QR active binding 및 vehicle primary active QR partial unique index |
| 4 | Replacement/Revoke | 완료 | 이전 Binding 종료, source/replacement state, append-only history와 audit |

## 3. 자동 검증

- `pnpm verify`: PASS
- Vitest: 43 files, 271 tests PASS
- DB static contract: 39 migrations, 16 pgTAP files PASS
- linked staging runtime pgTAP: 16 files PASS
- WCJ: 100 / C 100 / J 100 / W 100, 54 files
- Secret scan: 376 text files PASS
- immutable logo SHA-256: PASS
- production build: PASS
- Playwright local smoke: desktop/mobile 28 tests PASS
- authenticated staging Playwright: 19 tests PASS
- Supabase `taptolk-staging`: `ACTIVE_HEALTHY`, PostgreSQL 17
- staging migration history: local/remote 39개 일치, `20260719132000`까지 적용
- staging extensions: `pgtap` 1.3.3, `pgmq` 1.5.1
- staging Queue: durable `qr-generation`, active table RLS, anon/authenticated 권한 없음,
  service role/Postgres에만 Queue DML 권한
- Queue Data API probe: send → read → archive → empty PASS
- 최종 승인/취소 경합: 정확히 한 결과만 commit되고 패자 요청은 즉시 conflict로 종료 PASS
- Phase 4: 입고 → 수동 배정 → 중복 Binding 거부 → CSV commit → Super Admin 교체/최종
  폐기 → 이력/audit 보존 → fixture residue zero PASS
- 실제 Phase 3: 10개 승인 Batch × 100개, chunk commit 후 process 중단/lease 재개,
  1,000개 중복 0/decode 100%, export 40/40, Queue archive 11, residue zero PASS
- Supabase advisor: browser mutation RPC의 authenticated `SECURITY DEFINER` 경고는 함수 내부
  RBAC·MFA·scope 검증을 전제로 의도된 구조다. 서버 전용 테이블 3개의 no-policy INFO,
  unindexed FK INFO, leaked-password protection 비활성 WARN은 다음 hardening backlog로 유지한다.

`db:check`는 migration transaction boundary와 test contract 존재를 검증하지만 SQL을
실제 PostgreSQL에 적용하지 않는다. Phase 2–4의 RLS, 비밀 테이블 차단, worker 전용
RPC, 이력 보존 marker가 빠질 경우에는 실패하도록 강화했지만 local reset/pgTAP 및
staging E2E를 대체하지 않는다.

## 4. Release acceptance 잔여 Gate

1. Docker 사용 가능 환경에서 local reset을 별도 교차 검증
2. 실제 85mm 출력, 실기기 QR 판독, keyboard/screen-reader/contrast/responsive 수동 QA
3. 6MB 초과 export의 TUS resumable upload 전환을 Phase 9 hardening에서 검토
4. leaked-password protection과 advisor index backlog를 Phase 9 hardening에서 처리

현재는 “Phase 2–4 automated staging acceptance 완료”라고 보고할 수 있다. 물리적
인쇄·실기기·보조기술 수동 Gate 전에는 최종 production release 완료라고 보고하지 않는다.
