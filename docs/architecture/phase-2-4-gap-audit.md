# Phase 2–4 Implementation Gap Audit

- 기준일: 2026-07-19
- 기준 문서: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` v1.1
- 기준 브랜치: `codex/phase-1-foundation`
- 판정 기준: 코드 존재와 구현 검증을 분리하고, staging 실증 전에는 release acceptance를 주장하지 않는다.

## 1. 현재 판정

Phase 2–4의 저장소 구현은 완료됐다. 브랜드 자산 검증부터 QR 발행·렌더·출력,
Queue Worker, 입고·배정·CSV·교체·폐기까지 하나의 모듈 경계로 연결되어 있다.

staging에는 local과 일치하는 36개 migration, `pgtap`/`pgmq`, `pgmq_public`, durable
`qr-generation` Queue를 적용했다. 전체 pgTAP과 인증된 Site/QR 승인·동시성·Phase 4
입고/배정 E2E, Queue send → read → archive probe도 통과했다.

다음 항목은 구현 공백이 아니라 잔여 release acceptance 검증 공백이다.

- Docker 부재로 인한 local reset 미실행. 동일 SQL은 linked staging 전체 pgTAP으로 검증
- 실제 Worker의 1,000개 생성 → export → Queue consume → 재개 전체 staging journey
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
- DB static contract: 36 migrations, 15 pgTAP files PASS
- linked staging runtime pgTAP: 15 files PASS
- WCJ: 100 / C 100 / J 100 / W 100, 54 files
- Secret scan: 369 text files PASS
- immutable logo SHA-256: PASS
- production build: PASS
- Playwright local smoke: desktop/mobile 28 tests PASS
- authenticated staging Playwright: 19 tests PASS
- Supabase `taptolk-staging`: `ACTIVE_HEALTHY`, PostgreSQL 17
- staging migration history: local/remote 36개 일치, `20260719111544`까지 적용
- staging extensions: `pgtap` 1.3.3, `pgmq` 1.5.1
- staging Queue: durable `qr-generation`, active table RLS, anon/authenticated 권한 없음,
  service role/Postgres에만 Queue DML 권한
- Queue Data API probe: send → read → archive → empty PASS
- 최종 승인/취소 경합: 정확히 한 결과만 commit되고 패자 요청은 즉시 conflict로 종료 PASS
- Phase 4: 입고 → 수동 배정 → 중복 Binding 거부 → CSV commit → Super Admin 교체/최종
  폐기 → 이력/audit 보존 → fixture residue zero PASS
- Supabase advisor: browser mutation RPC의 authenticated `SECURITY DEFINER` 경고는 함수 내부
  RBAC·MFA·scope 검증을 전제로 의도된 구조다. 서버 전용 테이블 3개의 no-policy INFO,
  unindexed FK INFO, leaked-password protection 비활성 WARN은 다음 hardening backlog로 유지한다.

`db:check`는 migration transaction boundary와 test contract 존재를 검증하지만 SQL을
실제 PostgreSQL에 적용하지 않는다. Phase 2–4의 RLS, 비밀 테이블 차단, worker 전용
RPC, 이력 보존 marker가 빠질 경우에는 실패하도록 강화했지만 local reset/pgTAP 및
staging E2E를 대체하지 않는다.

## 4. Release acceptance 잔여 Gate

1. 실제 Worker로 1,000 generation → export → Queue consume → resume를 staging에서 실증
2. Docker 사용 가능 환경에서 local reset을 별도 교차 검증
3. 실제 85mm 출력, 실기기 QR 판독, keyboard/screen-reader/contrast/responsive 수동 QA
4. leaked-password protection과 advisor index backlog를 Phase 9 hardening에서 처리

현재는 “Phase 2–4 schema와 Queue staging 적용 완료”라고 보고할 수 있다. 위 Gate 전에는
“Phase 2–4 release complete”라고 보고하지 않는다.
