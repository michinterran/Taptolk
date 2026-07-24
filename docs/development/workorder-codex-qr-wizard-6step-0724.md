# Codex 작업지시 — QR 위자드 6단계·슈퍼어드민 전용 (2026-07-24)

**운영자 확정:** QR 제작은 **슈퍼어드민 전용**이다. 슈퍼어드민이 생성·인쇄 발주·배송까지
하고 관리회사·사이트에 납품한다. 위자드는 **6단계**다.

```
① 관리회사 → ② 사이트 → ③ 디자인 → ④ 수량 → ⑤ 검토 → ⑥ 제작·발주·배송
```

**정본은 `docs/design-canon/console-qr-wizard.html`이다**(6단계로 갱신됨). 화면 형태·문구·
순서는 정본과 `DESIGN_SYSTEM.md` §3.6을 따른다. 이 지시서는 **데이터·라우팅**만 정한다.

## 지금 구현과의 차이

현재 `apps/web/components/qr-wizard-stepper.tsx`의 `QR_WIZARD_STEPS`는
`["site","design","quantity","review","production"]` **5단계**다. 6단계로 바꾼다:

```ts
["company", "site", "design", "quantity", "review", "fulfillment"]
```

- `site` 앞에 **`company`(관리회사 선택)** 를 넣는다
- `production` → `fulfillment`로 이름을 바꾼다(제작·발주·배송). **입고는 이 위자드에 없다**

## 해야 할 것

### 1. 단계 모델

`qr-wizard-stepper.tsx` — `QR_WIZARD_STEPS`를 위 6개로. `resolveQrWizardStep` 기본값은
`"company"`. **`lockedSteps`·`QrWizardStepState`의 `"locked"`를 제거한다** — 슈퍼어드민만
위자드에 들어오므로 잠금 단계가 없다.

### 2. 라우팅·상태 전달

스텝 링크가 나르는 값이 하나 늘어난다: **`company`(관리회사 id) + `site`(사이트 id)**.
`getQrWizardStepHref`가 둘 다 쿼리에 싣는다. 사이트 목록은 **선택된 관리회사로 필터**한다.

### 3. 관리회사 선택 단계 (신규 데이터)

| 필드 | 출처 | 비고 |
|---|---|---|
| 관리회사 목록 (이름·계약 상태·사이트 수) | 기존 `management_companies` | 슈퍼어드민은 전부 본다 |
| `is_platform_direct` | 기존 플래그 | "직영" 배지. **이름으로 판정하지 않는다** |
| **test 데이터 숨김** | §7-C 플래그 | 콘솔 기본 목록에서 test 픽스처 제외 |

### 4. 접근 제어 — 슈퍼어드민 고정

- 위자드 라우트(`/admin/qr-inventory`)를 **SUPER_ADMIN에게만** 연다. 다른 역할은 진입 자체를
  막는다(현황 열람이 필요하면 별도 읽기 화면으로, 위자드로는 아니다)
- `qr-batch:generation-approve`는 그대로 SUPER_ADMIN 전용. 이제 **생성자=승인자**이므로
  ⑤ 검토는 승인 큐가 아니라 **샘플·디코드 확인 게이트**다. 승인 버튼 잠금 로직은 제거

### 5. ⑥ 제작·발주·배송 — 입고 제거

트랙에서 **`수령 확인`·`재고 입고`를 뺀다.** 남기는 것: `생성 → 인쇄 발주 → 배송`.
입고(수령·재고)는 **받는 사이트가 하는 downstream**이다. 라이프사이클 상태 `Site 입고`는
사이트 운영 화면(별도 워크오더)에서 처리한다. **위자드에서 입고 상태로 전이시키지 않는다.**

### 6. 카피 정리

`apps/web/content/messages.ts`의 위자드 카피가 현재 3개 단계 라벨(`wizard.step1~3`)만
있고 스테퍼 5단계와 어긋난다. **6단계에 맞춰 라벨·설명을 정본 문구로 채운다.**
`admin.qr.wizard.step6`(제작·발주·배송)까지. KO/EN 함께.

## ⚠️ 건드리지 마라

- **QR `1..100` 배치 분할 계약** — 한 배치 최대 100개, 총수량 초과 시 분할. 변경 금지
- **하단 Taptolk 마크는 원본 그대로** — 재색·크롭 금지(`AGENTS.md` Brand assets)
- **canonical QR 호스트 확정 전 실물 인쇄 생성 차단** — 정본 ⑤의 경고가 이것이다
- 정본에 없는 단계·구역 분리 URL(`?section=`)을 만들지 않는다

## 완료 판정

- 위자드가 `관리회사 → 사이트 → 디자인 → 수량 → 검토 → 제작·발주·배송` 6단계로 흐른다
- 사이트 목록이 선택된 관리회사로 필터된다
- SUPER_ADMIN 외에는 위자드에 진입하지 못한다
- ⑥에 입고 상태가 없다
- `corepack pnpm verify` 통과 · 정본과 눈으로 대조(로그인 캡처)

## 보고 형식

구현 완료 / 자동 검증 완료 / 수동 검증 대기를 구분한다. PASS 주장에 명령·범위·수를 붙인다.
