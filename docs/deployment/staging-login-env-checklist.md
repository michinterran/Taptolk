# staging 로그인 살리기 — 환경변수 체크리스트 (2026-07-24)

`taptolk.vercel.app`에서 로그인이 "로그인 준비 중입니다"로 막힌 이유는 **이 배포에
Supabase 연결 값이 없어서**다. 아래를 Vercel에 채우고 재배포하면 풀린다.

**⚠️ 이 문서에는 실제 값(secret)을 적지 않는다.** 이름·출처·채우는 법만.

## 채우는 곳

vercel.com → **taptolk 프로젝트** → **Settings → Environment Variables** →
각 변수 **Add** (Environment는 Preview/Production 중 staging에 맞는 것 선택) →
저장 후 **Redeploy(재배포)**.

## 1) 로그인이 되려면 반드시 (5개)

| 변수 이름 | 값 출처 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 대시보드 → Project Settings → **API** → Project URL (`https://…supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 같은 API 화면의 publishable key. **`sb_publishable_`로 시작** |
| `SUPABASE_SECRET_KEY` | 같은 API 화면의 secret key. **`sb_secret_`로 시작.** 서버 전용, 절대 공개 금지 |
| `COOKIE_SIGNING_KEY` | **직접 생성한 랜덤 문자열** (아래 §4) |
| `TOKEN_HMAC_KEY` | **직접 생성한 랜덤 문자열** (아래 §4) |

이 5개면 관리자·플랫폼 로그인 화면의 잠금이 풀린다.

## 2) 차주 활성화까지 쓰려면 추가 (2개)

| 변수 이름 | 값 출처 |
|---|---|
| `APP_ENCRYPTION_KEY_V1` | **직접 생성한 랜덤 문자열** (전화번호·차량번호 암호화용) |
| `APP_ENCRYPTION_KEY_VERSION` | 숫자 `1` |

## 3) 직접 DB·QR 인쇄까지 쓰려면 추가

| 변수 이름 | 값 출처 |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → **Database** → Connection string (pooled) |
| `DIRECT_DATABASE_URL` | 같은 화면의 direct connection string |
| `APP_URL` | `https://taptolk.vercel.app` |
| `PUBLIC_QR_BASE_URL` | QR에 구워지는 호스트. 인쇄 확정 전에는 신중히 (인쇄 후 변경 불가) |
| `OWNER_RESPONSE_BASE_URL` | 차주 응답 링크 베이스. 보통 `APP_URL`과 같음 |

## 4) 랜덤 문자열 3개 만드는 법

`COOKIE_SIGNING_KEY` · `TOKEN_HMAC_KEY` · `APP_ENCRYPTION_KEY_V1`은 **아무 값이나 만든
비밀 문자열**이다. 터미널에서 각각 한 번씩 실행해 나온 값을 넣는다:

```bash
openssl rand -hex 32
```

한 번 정하면 바꾸지 않는다(바꾸면 기존 암호화·서명이 깨진다).

## 5) ⚠️ APP_ENV 주의

`APP_ENV`를 **`production`으로 두면** 위 §1~3을 포함해 더 많은 변수를 **전부** 요구해서
빌드가 막힌다. staging에서 로그인만 먼저 보려면 `APP_ENV`를 `production`으로 설정하지
말고 비워 두거나 비-production 값으로 둔다.

## 6) 넣은 뒤

1. **Redeploy** 한 번 (기존 배포는 옛 값이라 자동으로 안 바뀐다)
2. `taptolk.vercel.app/ko/admin/platform/login` 열기 → 입력창이 활성화되면 성공
3. 슈퍼어드민 계정(예: `s@i.co.kr`)으로 로그인

## 값이 이미 있는지 먼저 확인

로컬 `.env`(있다면)나 Supabase 대시보드에 이 값들이 이미 있으면 그대로 옮기면 된다.
없으면 Supabase 값은 대시보드에서 복사, 랜덤 3개는 §4로 생성한다.
