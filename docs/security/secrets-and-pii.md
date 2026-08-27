# Secrets and PII

## 브라우저 허용값

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

위 값도 오직 `packages/config/src/env.client.ts`를 통해 읽는다. 이외의 환경변수는
Client Component에 전달하지 않는다.

## 서버 전용값

DB URL, `SUPABASE_SECRET_KEY`, 암호화·서명 키, SMS 자격증명, Queue·Cron secret,
Sentry auth token은 서버 전용이다. 로그, 오류 응답, analytics payload에 포함하지
않는다.

## 개인정보

전화번호, 차량번호, 메시지 본문, cookie, authorization header, response token은
기본 redaction 대상이다. 로그에는 내부 request ID와 허용된 상태 코드만 남긴다.

## 운영 원칙

- `.env.example`에는 값 없이 키만 둔다.
- Local, Staging, Production은 서로 다른 자격증명과 Supabase 프로젝트를 사용한다.
- Secret 유출 의심 시 코드를 가리는 것으로 끝내지 않고 즉시 폐기·회전한다.
- 원격 연결과 secret 입력은 별도 승인 후 수행한다.
