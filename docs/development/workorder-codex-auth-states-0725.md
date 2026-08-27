# 워크오더 — 로그인·가입·MFA 카드 상태 폴리시 (2026-07-25)

> 발행: Claude(디자인) · 소비: Codex(구현). 경계는 `OPERATING_MODEL.md`(모델 A —
> globals.css는 Codex가 작성). 이 문서는 **무엇을 어떻게 보이게** 할지의 스펙이다.
> 정본: `DESIGN_SYSTEM.md` §0·§2 + 공개 타입스케일. 계약: `CONTRACTS.md` "관리자 인증 상태".

## 배경 — 지금 상태와 갭

인증 화면(`admin-login-screen`·`admin-mfa-code-form`·`admin-mfa-enrollment`·signup)은
상태를 **기능적으로는** 처리하나 **시각 폴리시가 비어 있다.**

| 상태 | 지금 | 갭 |
|---|---|---|
| 블록 알림 `.admin-notice(--warning/danger/success)` | globals.css에 스타일 있음 | 없음 (유지) |
| **인라인 오류 `.admin-form-error`** | `role="alert"`만, **스타일 없음** | 🔴 시각 처리 필요 |
| 로딩 — MFA·signup | `isPending`→`admin.shared.working`+disabled | 버튼 폭 흔들림·스피너 없음 |
| **로딩 — 로그인** | 서버 액션 `signInAdmin`, **pending 없음** | 🔴 제출 중 표시 없음 |
| 비활성 | `input:disabled` opacity 0.65 | 버튼 `:disabled` 일관성 확인 |
| 포커스 | — | `--tt-focus-ring` 미적용 |

**새 토큰은 필요 없다.** 아래 토큰이 모두 존재한다:
`--tt-color-danger` / `--tt-color-danger-surface` / `--tt-color-danger-fg`,
`--tt-note-padding-block/inline` / `--tt-note-radius`, `--tt-focus-ring`,
`--tt-color-success-surface/fg`, 간격은 공개/폼 스케일 토큰.

## 해야 할 것 (globals.css + 컴포넌트, Codex)

### 1. 인라인 오류 `.admin-form-error` 시각화 🔴
- 컴팩트 danger 노티스로: 글자 `--tt-color-danger-fg`, 배경
  `--tt-color-danger-surface`, 패딩 `--tt-note-padding-block/inline`, 라운드
  `--tt-note-radius`. 위 여백은 폼 스케일 간격 토큰 하나.
- `role="alert"` 유지. **블록 알림(`.admin-notice`)과 위계 구분:** 페이지 수준 사유
  (설정 없음·서비스 불가)는 `.admin-notice`, 폼 제출 실패(자격 오류·코드 오류)는
  `.admin-form-error`. 둘을 같은 크기로 그리지 않는다.

### 2. 로딩(제출 중) 일관화 🔴
- **로그인:** 서버 액션이므로 제출 버튼을 `useFormStatus()`를 읽는 자식 컴포넌트로
  분리해 `pending`일 때 라벨을 `admin.shared.working`로 바꾸고 `disabled`. MFA와 동일한
  거동으로 맞춘다.
- **MFA·signup:** 이미 `isPending` 사용 — 그대로 두되 아래 폭 안정화 적용.
- **폭 안정화:** working 라벨로 바뀔 때 버튼이 줄었다 늘지 않게 `min-width` 예약 또는
  라벨 폭 고정. 레이아웃이 튀면 정본 대조가 깨진다(§0 상태 규칙).
- 제출 중 입력·대체 로그인(구글 등)도 `disabled`.

### 3. 비활성 일관화
- `.tt-button:disabled`(또는 Button 프리미티브)가 `input:disabled`와 같은 무게로
  보이게: `cursor: not-allowed`, opacity 또는 muted 표면. 세 화면 버튼이 동일하게.
- **설정 없음/서비스 불가**로 인한 비활성은 항상 그 사유를 말하는 `.admin-notice`와
  **함께** 나타난다 — 사유 없는 비활성 폼을 그리지 않는다(고장처럼 읽힌다).

### 4. 포커스(접근성)
- 인증 입력·버튼·링크에 `:focus-visible { box-shadow: var(--tt-focus-ring); }`.
  키보드 이동이 세 화면에서 동일하게 보이게.

### 5. 간격을 스케일에 맞춤
- 카드 내부 리듬(제목 → 설명 → 알림 → 폼 → 대체 로그인 → 하단 링크)의 간격은
  전부 스케일 간격 토큰에서. 일회성 `margin` 리터럴을 두지 않는다(`validate:design-system`).
- 캡션·아이브로우 크기는 이미 `--tt-pub-caption-size`·`--tt-pub-eyebrow-size`로 정규화됨.

### 6. 정보성 노티스 톤 (선택)
- "로그인 준비 중"(스테이징 미연결)은 **경고가 아니라 정보**다. `AdminAuthNotice`의
  `tone`에 중립/`info`(예: `--tt-color-brand-surface`/`brand-fg` 또는 surface-muted)를
  추가해 danger·warning과 구분하면 더 정확하다. 없으면 warning 유지.

## 카피 (KO/EN 함께)
- 재사용: `admin.shared.working`("처리 중"/"Working"), `admin.auth.error.*`(사유별 이미 있음),
  `admin.signup.error.*`. **새 카피가 필요하면 KO/EN 동시**에 `content/messages.ts`에 추가.

## 완료 판정 (DoD)
- 세 화면(로그인·가입·MFA 등록/확인)에서 빈·로딩·오류·비활성·(가능하면 성공) 상태가
  스케일 간격·상태 토큰으로 일관되게 보인다.
- 로그인 제출에도 pending 표시가 있다. 상태 전환에 레이아웃이 튀지 않는다.
- `validate:design-system`(리터럴 미증가)·`validate:wcj`(J004 오류 복구·A11y) 통과.
- 로그인 게이트라 **눈 대조는 스텝 D(스테이징 로그인) 후 Claude가** 수행.

## 계약 근거
`CONTRACTS.md` "관리자 인증 상태" 참조 — 오류 사유는 **구분해서 내려주되**, 자격 오류는
어느 필드가 틀렸는지 알려주지 않는다(보안).
