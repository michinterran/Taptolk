# Validation

일상 변경의 최소 게이트:

```bash
pnpm verify
```

이 명령은 lint, typecheck, unit test, migration 정적 검사, secret 검사, 로고 무결성,
WCJ, production build를 순서대로 실행한다.

브라우저까지 포함한 전체 게이트:

```bash
pnpm verify:full
```

연결된 staging에서 실제 Auth/TOTP와 Site tenant isolation을 검증할 때:

```bash
pnpm e2e:staging:sites
```

이 명령은 `apps/web/.env.local`의 서버 전용 staging 설정과
`supabase/.temp/project-ref`가 일치할 때만 실행한다. 임시 계정 비밀번호와 TOTP는
메모리에서만 사용하고, trace/video/screenshot/HTML report를 만들지 않으며 모든
fixture를 종료 시 정리한다.

DB migration을 실제 PostgreSQL에 재현할 때:

```bash
pnpm db:start
pnpm db:reset:local
pnpm exec supabase test db
```

Docker가 없는 환경에서는 `db:check`까지만 증명할 수 있으며, Local DB acceptance는
통과로 기록하지 않는다.
