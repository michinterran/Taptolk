# Workorder — Kakao AlimTalk Live Provider Adapter

> 작성: Claude (리뷰 담당) · 2026-07-21
> 수신: Codex (구현 담당)
> 기준 커밋: `6c8413f` (ephemeral alimtalk contact flow)
> 상태: **착수 불가 — 사용자 제공 정보 대기 중**
> 선행: 카카오 공식 딜러 계약 · 비즈니스 채널 연결 · 정보성 템플릿 검수 완료

---

## 0. 이 문서의 성격과 착수 조건

`6c8413f`에서 Provider **경계(Port)** 는 완성됐고, 비프로덕션은 staging simulator로,
Production은 fail-closed로 동작한다. 본 workorder는 **실제 카카오 알림톡 발송
어댑터(Adapter)** 구현 지시서다.

### 0.1 착수 금지 조건

아래 정보가 **사용자로부터 문서로 제공되기 전에는 착수하지 않는다.**
값을 추측하거나 임시로 만들어 넣지 않는다.

- [ ] 카카오 공식 딜러(발송 대행사)명과 계약 체결 여부
- [ ] 카카오 비즈니스 채널 연결 완료 여부
- [ ] 승인된 KO/EN 정보성 템플릿 문구
- [ ] 승인된 템플릿 ID(템플릿 코드)
- [ ] 발신프로필 키(Sender Key) — **값 자체는 문서·Git·채팅에 남기지 않는다.**
      존재 여부와 주입 경로만 확인한다.
- [ ] Provider별 인증 필드 계약(인증 방식·헤더·만료·갱신)
- [ ] 전송 영수증·비용·rate limit 계약
- [ ] 실패·재시도 검증 방법
- [ ] 3.4의 제품 결정 4건

### 0.2 절대 하지 말 것

- 공식 딜러, 템플릿 ID, 발신프로필 키, Production Secret을 **추측하지 않는다.**
- Production Cron을 활성화하거나 Vercel 요금제를 변경하지 않는다.
- Production Supabase 프로젝트·리전·운영 담당자를 임의로 선택하지 않는다.
- 별도 승인 전에는 Task 3 access grant / Test Lab / persona를 시작하지 않는다.
- 실제 전화번호로 발송 테스트를 하지 않는다.
- QR 수량 `1..100` 계약을 변경하지 않는다.

---

## 1. 현재 확정된 경계 (변경 금지)

Claude가 `6c8413f`를 코드로 검증한 결과다. 어댑터 구현 시 이 경계를 유지한다.

### 1.1 Port 계약

`packages/application/src/notification-reply-service.ts:51`

```ts
export interface OwnerNotificationProvider {
  send(input: {
    idempotencyKey: string;
    notification: OwnerContactNotification;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }>;
}
```

`OwnerContactNotification`(같은 파일 12행)의 변수는 **타입 수준에서 2개로 제한**된다.

```ts
variables: {
  reasonCode: ContactReasonCode;
  responseUrl: string;
}
```

이 타입 제약이 B의 자유입력 본문·차량번호·QR token·activation code·OTP가
Provider로 흘러가는 것을 **구조적으로 차단**한다. **이 타입을 넓히지 않는다.**

### 1.2 Production fail-closed

`apps/web/notification-reply/notification-reply-runtime.ts`

```ts
const stagingMock =
  value.environment.APP_ENV !== "production" &&
  value.environment.OWNER_NOTIFICATION_PROVIDER === "mock";
```

두 조건을 모두 만족해야 simulator가 선택되고, 그 외에는
`UnavailableOwnerNotificationProvider`로 fail-closed된다. **이 이중 조건을 완화하지 않는다.**

### 1.3 응답 토큰

- TTL 기본 `3600`초 (`packages/domain/src/notification-reply-policy.ts:27`)
- `Referrer-Policy: strict-origin-when-cross-origin` (`apps/web/next.config.ts:6`)로
  토큰이 담긴 URL 경로가 외부 사이트로 유출되지 않는다.

---

## 2. ⚠️ 최대 보안 민감 지점 — 복호화 경계

### 2.1 정확한 사실 관계

기존 공유 문서에 "전화번호를 Provider payload에서 제외했다"고 기재돼 있으나,
**정확히는 다음과 같다.**

- 전화번호는 **템플릿 변수에서 제외**됐다. ✅
- 그러나 수신자 번호는 `toCiphertext`(암호문)로 **Port를 통과**한다.
- 알림톡 발송에는 수신번호가 반드시 필요하므로, **실제 어댑터는 이 값을 복호화해
  카카오(딜러) API에 평문으로 전달해야 한다.** 이는 불가피하다.

따라서 **어댑터가 시스템 전체에서 차주 전화번호를 평문으로 다루는
거의 유일한 지점**이 된다. 여기가 이번 구현의 최대 위험 구간이다.

### 2.2 어댑터 필수 준수 사항

1. 복호화된 전화번호를 **변수에 오래 보관하지 않는다.** 요청 본문 조립 직전에
   복호화하고, 응답 처리 전에 참조를 버린다.
2. 복호화된 번호를 **로그, 오류 메시지, 예외 message, 재시도 payload, 감사 기록,
   메트릭 라벨, 스택트레이스에 절대 남기지 않는다.**
3. HTTP 클라이언트가 **요청 본문을 자동 로깅하지 않도록** 명시적으로 차단한다.
   딜러 SDK가 디버그 로깅을 내장한 경우 반드시 비활성화한다.
4. 실패 시 재시도 큐에 **평문 번호를 저장하지 않는다.** 기존처럼 `destinationCiphertext`
   기반으로 재시도하고 매번 다시 복호화한다.
5. 오류 분류 결과만 상위로 전달한다. 딜러 API의 원본 오류 응답을 그대로 저장·기록하지
   않는다(수신번호가 echo될 수 있다).
6. `packages/observability`의 redaction 경계를 통과시키고, redaction 단위 테스트에
   **전화번호 패턴 케이스를 추가**한다.

### 2.3 reasonCode가 제3자에게 전달된다는 점

`reasonCode`(`ACCIDENT_CONTACT`, `VEHICLE_DAMAGE` 등)는 템플릿 변수로 카카오에
전달된다. 이는 **상황 정보**이며 수탁자가 보게 된다. 다음을 검토해 사용자에게 보고한다.

- 정보성 템플릿 검수 특성상 사유별 분기가 필요한지, 아니면 중립 문구 단일 템플릿으로
  최소화 가능한지
- 최소화가 가능하다면 개인정보 최소 수집·제공 원칙상 그쪽이 우선이다
- 결정은 사용자가 한다. Codex가 임의로 템플릿 구조를 정하지 않는다.

---

## 3. 구현 범위

### 3.1 어댑터 구현

- 위치: `apps/web/notification-reply/` 아래에 실제 Provider 어댑터를 추가한다.
  `StagingOwnerNotificationProvider`를 수정·전용하지 않는다. 별도 클래스로 만든다.
- `OwnerNotificationProvider` 인터페이스를 그대로 구현한다. Port를 바꾸지 않는다.
- 승인된 템플릿 ID를 `OWNER_CONTACT_REQUEST_V1`에 매핑한다. 매핑 테이블은 **타입 있는
  설정 모듈**에 둔다. 컴포넌트·라우트 하드코딩 금지.
- locale(`ko`/`en`)에 따라 승인된 템플릿을 선택한다. 미승인 locale 요청은 fail-closed.

### 3.2 인증·설정

- 딜러 인증 정보는 **서버 전용 환경변수**로만 주입한다. `NEXT_PUBLIC_` 금지.
- `packages/config`의 서버 환경 스키마에 필드를 추가하고, **값이 없으면
  어댑터가 선택되지 않고 fail-closed**되도록 한다.
- 토큰 만료·갱신이 있는 인증 방식이면 갱신 실패를 `RETRYABLE`로 분류한다.
- **어떤 secret 값도 `.env.example`, 문서, 테스트 fixture, 로그에 넣지 않는다.**

### 3.3 오류·재시도·영수증

- 딜러 오류 코드를 기존 `NotificationProviderErrorCode`로 매핑하는 표를 만든다.
  최소한 다음을 구분한다.
  - 재시도 가능: 일시 장애, rate limit 초과, 타임아웃, 인증 토큰 만료
  - 영구 실패: 템플릿 불일치, 미승인 발신프로필, 수신 거부, 유효하지 않은 수신자
- 기존 `isRetryableNotificationProviderError`와 `getNotificationRetryDelaySeconds`
  정책을 재사용한다. 새 재시도 정책을 만들지 않는다.
- `providerMessageId`는 딜러가 준 식별자를 저장한다. **수신번호를 포함한 값이면
  저장하지 않고 해시한다.**
- rate limit 계약이 있으면 정책 모듈에 상수로 정의하고 초과 시 fail-closed한다.
- 비용·영수증은 **집계 값만** 기록한다. 개인정보를 포함하지 않는다.
  기존 운영 KPI의 `cost`(기록된 발송 비용) 경로를 재사용한다.

### 3.4 사용자 결정이 필요한 제품 사항 (Codex 임의 결정 금지)

| 항목 | 왜 결정이 필요한가 |
|---|---|
| **대체발송(SMS fallback) 사용 여부** | 알림톡 실패 시 SMS로 자동 대체발송하는 옵션이 있다. 활성화하면 **전화번호가 SMS 사업자에게도 전달**되어 수탁자가 늘고 처리방침이 달라진다. 기본은 **비활성**으로 두고 사용자 승인 시에만 켠다. |
| **카카오톡 미사용자 처리** | 수신자가 카카오톡을 쓰지 않으면 발송이 실패한다. 대체 수단 없이 실패 처리할지, 관리사무소 에스컬레이션으로 넘길지 결정 필요. |
| **템플릿 분기 구조** | 2.3 참조. 사유별 템플릿인지 중립 단일 템플릿인지. |
| **발송 시간대 제한** | 정보성 메시지라도 야간 발송 정책을 둘지. 현재 정책 모듈에 해당 개념이 없다. |

### 3.5 처리방침 갱신 (필수)

`docs/development/prd-public-surface-0721.md` Part C의 개인정보처리방침 초안
**6항(위탁)** 은 현재 `(미정)`이다. 카카오 계약 확정 시 다음을 반영한다.

- 수탁자: 카카오 공식 딜러(발송 대행사)명
- 위탁 업무: **"알림 문자 발송"이 아니라 "카카오 알림톡 발송"으로 표현을 수정**한다.
  이번 변경으로 SMS가 아니라 알림톡이 기본 채널이 되었다.
- 보유 리전·국외 이전 여부
- 대체발송을 켠 경우 SMS 사업자도 수탁자로 추가

**처리방침이 갱신되기 전에는 Production 발송을 활성화하지 않는다.**

---

## 4. 별건 — SERVICE stage guard 등록 누락 (본 workorder와 함께 처리 권장)

### 4.1 발견 사실

Claude가 `6c8413f`를 검증하며 확인했다.

```
$ TAPTOLK_STAGE=SERVICE node scripts/verify-service-stage.mjs
[service-stage] SERVICE fail-closed boundary verified; 0 registered test-only surface(s)
$ cat config/service-stage-test-surfaces.json
{ "schemaVersion": 1, "surfaces": [] }
```

Task 1이 만든 guard는 소스에서 `@taptolk-test-only` 마커를 찾아 manifest 등록 여부를
검사하는 **레지스트리 방식**이다. 그런데 마커를 단 파일이 **0건**이라 guard가
**공허하게 통과**한다.

실제로는 다음이 test-only surface다.

- `apps/web/notification-reply/notification-staging-provider.ts` (mock provider)
- `apps/web/app/api/internal/notification-staging/route.ts` (staging inbox 라우트)
- staging fixture RPC(`provision_public_contact_staging_fixture` 등)

### 4.2 위험도 평가

**현재 활성 취약점은 아니다.** 런타임 보호가 이중으로 있다.

- provider 선택: `APP_ENV !== "production" && OWNER_NOTIFICATION_PROVIDER === "mock"`
- staging 라우트: `APP_ENV !== "production"` + `QUEUE_WORKER_SECRET` 검증

**그러나 CI guard가 제 역할을 못 한다.** stage policy 6절은 "SERVICE 구성에서
test-only route·provider·fixture·capability가 도달 가능하면 CI가 실패해야 한다"고
요구하는데, 등록이 비어 있으면 **앞으로 누군가 보호 없는 test surface를 추가해도
guard가 PASS한다.** 방어 심도의 공백이다.

### 4.3 조치

1. 위 3개 surface에 `@taptolk-test-only` 마커를 달고
   `config/service-stage-test-surfaces.json`에 `kind`(`provider` / `route` /
   `fixture-command`)와 함께 등록한다.
2. guard가 **등록된 surface가 0건이면 경고 또는 실패**하도록 보강할지 검토한다.
   (레지스트리가 비어 있는 상태가 정상으로 통과하는 현재 동작이 문제의 핵심이다.)
3. 등록 후 `TAPTOLK_STAGE=SERVICE node scripts/verify-service-stage.mjs`가
   실제 surface 수를 보고하는지 확인한다.

---

## 5. 수용 기준

### 5.1 어댑터

- [ ] 실제 딜러 어댑터 구현, `OwnerNotificationProvider` Port 무변경
- [ ] 승인된 템플릿 ID ↔ `OWNER_CONTACT_REQUEST_V1` 매핑을 타입 있는 설정에서 관리
- [ ] locale별 승인 템플릿 선택, 미승인 locale fail-closed
- [ ] 인증 정보 서버 전용, 미설정 시 fail-closed
- [ ] 딜러 오류 → `NotificationProviderErrorCode` 매핑표, 재시도/영구 구분
- [ ] 기존 재시도 정책 재사용(신규 정책 생성 금지)

### 5.2 개인정보 (가장 중요)

- [ ] 복호화된 전화번호가 로그·오류·예외·재시도 payload·감사·메트릭에 없음을
      **테스트로 증명**
- [ ] HTTP 클라이언트/SDK 요청 본문 자동 로깅 차단 확인
- [ ] redaction 단위 테스트에 전화번호 패턴 케이스 추가
- [ ] `providerMessageId`에 수신번호가 포함되지 않음(포함 시 해시) 확인
- [ ] 비용·영수증 기록에 개인정보 없음
- [ ] `corepack pnpm verify:secrets` PASS

### 5.3 경계 유지

- [ ] Production Cron 활성 정의 `0` 유지
      (`corepack pnpm verify:production-cron:deferred` PASS)
- [ ] QR 수량 `1..100` 무변경
- [ ] 중앙 RBAC · RLS · MFA · 감사 경계 무변경
- [ ] Task 3 access grant / Test Lab / persona 미착수
- [ ] EN `caller` 유지, QR enum·액션 라벨 무변경

### 5.4 검증

- [ ] `corepack pnpm verify` PASS
- [ ] clean local reset + 전체 local pgTAP PASS
- [ ] linked staging pgTAP PASS
- [ ] authenticated staging A–B E2E PASS (simulator 경로 회귀 없음)
- [ ] **실제 발송 검증은 사용자가 지정한 테스트 수신번호로만** 수행하고,
      번호·메시지·영수증 원문을 문서·로그·채팅에 남기지 않는다.
      집계 결과만 보고한다.

---

## 6. 보고 규칙

- 결과와 사용자에게 남은 결정 사항을 먼저 말한다.
- 구현 완료 / 자동 검증 완료 / 수동·외부 검증 대기를 구분한다.
- PASS 주장에는 명령·범위·테스트 수 또는 CI run을 붙인다.
- `Production`은 실제 Production에 배포·검증된 경우에만 사용한다.
- 완료 후 `docs/handoff-MMDD-HHmm.md`를 `AGENTS.md` 프로토콜대로 작성하고,
  미해결 위험에 **처리방침 갱신 여부**와 **차주 본인확인 Provider 미선정**을 명시한다.
- 카카오 알림톡 정보성 메시지는 **차주 본인확인 수단이 아니다.**
  Production 본인확인 Provider는 별도 선정 대상으로 남긴다.
