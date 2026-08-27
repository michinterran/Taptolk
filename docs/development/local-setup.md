# Local Setup

## 요구사항

- Node.js 24.18.0
- Corepack과 pnpm 10.34.5
- Supabase Local 실행 시 Docker Desktop

## 설치

```bash
corepack enable
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
```

`.env.local`은 Git에 포함하지 않는다. Phase 0의 웹 화면은 원격 Supabase, SMS,
Sentry 자격증명 없이 실행된다.

## 시작

웹만 실행:

```bash
corepack pnpm dev:web
```

Supabase Local과 전체 workspace 실행:

```bash
corepack pnpm dev:local
```

Supabase Local 명령은 Docker Desktop이 실행 중이어야 한다. `supabase status`에서
표시되는 로컬 값만 `.env.local`에 사용한다.
