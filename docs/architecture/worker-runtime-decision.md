# Worker Runtime Decision

- 상태: Phase 0 계약만 확정, 운영 runtime 보류

`apps/worker`는 Queue payload validation, handler registry, 구조화 로그, graceful
shutdown 계약만 소유한다. 실제 Supabase Queue polling과 SMS·렌더 작업은 해당
Phase의 idempotency 정책 및 retry/DLQ 설계와 함께 연결한다.

Vercel Functions는 장시간 상주 consumer가 아니므로 Production worker 위치로
자동 확정하지 않는다. Supabase Queues의 전달 방식과 작업 실행시간을 측정한 뒤
Vercel Cron 기반 batch pull 또는 별도 worker runtime 중 하나를 ADR로 승인한다.
