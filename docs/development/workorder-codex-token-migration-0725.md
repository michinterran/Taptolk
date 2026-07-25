# 워크오더 — 디자인 부채 토큰 이관 (2026-07-25)

> 발행: Claude(디자인) · 소비: Codex(구현). 경계는 `OPERATING_MODEL.md`(모델 A — globals.css는
> Codex가 작성). 목표: `config/design-system-baseline.json`의 **301건을 감축**(font-size 162·
> padding 91·radius 29 등, 콘솔·QR·operations 집중).
> 규칙 정본: `DESIGN_SYSTEM.md` §2, `DESIGN_CONSISTENCY_RULES.md`. 값 원천: `tokens.css`.

## 0. 원칙 (먼저 읽기)

- **일괄 치환 금지.** 클러스터 단위로 이관하고, 매번 정본과 눈대조한 뒤 다음으로 넘어간다.
  라운딩이 간격·크기를 눈에 띄게 흔들면 §4의 "판단 필요"로 돌린다.
- **구조값은 그대로 둔다.** 컬럼 `min-width`, 그리드 열 수, `text-overflow`는 화면 CSS가
  가져도 되는 값이다(§2). 이건 이관 대상이 아니다.
- 각 클러스터가 끝나면 `corepack pnpm validate:design-system --update-baseline`로 감축분을
  갱신한다(갱신 주체 = Codex, baseline은 Codex 소유).
- 새 값이 필요하면 화면 CSS가 아니라 Claude에게 토큰 추가를 요청한다(직접 만들지 않는다).

## 1. 새로 추가된 토큰 (Claude, 이미 반영)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--tt-font-size-2xs` | `0.6875rem` | 미세 라벨(사이드바 그룹 라벨·테이블 마이크로 캡션). 0.62~0.71 난립을 하나로 |

그 외에는 **기존 토큰으로 충분**하다(아래 표). 부족하면 판단 목록(§4)에 남기고 요청.

## 2. font-size 이관 밴드 (142곳 → 토큰)

관측값을 아래 밴드로 라운딩한다. 대부분 이 표로 기계적 치환이 된다.

| 관측 리터럴 | → 토큰 | 값 |
|---|---|---|
| ≤ 0.71rem (0.62·0.66·0.68·0.70·0.71) | `--tt-font-size-2xs` | 0.6875 |
| 0.72–0.77 (0.72·0.74·0.75·0.76) | `--tt-font-size-xs` | 0.75 |
| 0.78–0.83 (0.78·0.80·0.82·0.83) | `--tt-font-size-sm` | 0.8125 |
| 0.84–0.90 (0.84·0.85·0.86·0.88·0.90) | `--tt-font-size-base` | 0.875 |
| 0.91–0.98 (0.92·0.95) | `--tt-heading-3-size` | 0.9375 |
| 0.99–1.03 (1.00·1.02) | `--tt-font-size-md` | 1 |
| 1.04–1.12 (1.05·1.10) | `--tt-heading-2-size` | 1.0625 |
| 1.13–1.33 (1.15·1.20·1.30) | `--tt-font-size-lg` | 1.25 |
| 1.60–1.90 (1.80) | `--tt-font-size-xl` | 1.625 |
| 1.91–2.20 (2.00) | `--tt-font-size-2xl` | 2 |
| 2.40–2.60 | `--tt-font-size-3xl` | 2.5 |

- **`var(--tt-label-size)`·`var(--tt-stat-value-size)`로 이미 되어 있는 항목** → 치환 완료됨.
  baseline에만 남은 스테일 항목이니 `--update-baseline`으로 제거(§5).
- **`clamp(...)` 값(히어로·디스플레이)** → 일반 스케일 아님. 공개 표면이면 `--tt-pub-display-size`
  등 `--tt-pub-*`로, 콘솔이면 §4 판단. 예: `clamp(2.5rem,6vw,5.7rem)` 류는 공개 히어로.

## 3. border-radius 이관 (22곳)

| 관측 | → 토큰 |
|---|---|
| 999px | `--tt-radius-pill` |
| 0.5rem | `--tt-radius-xs` (0.5) |
| 0.6·0.65rem | `--tt-radius-sm` (0.75) |
| 1rem | `--tt-radius-sm`(카드 내부 소자) 또는 `--tt-radius-md`(카드 본체) — 정본 보고 택1 |
| `calc(var(--tt-radius-md) - 0.2rem)` | 이미 토큰 파생 — 유지/스테일 |
| `0.2rem 0.2rem 0 0` | 구조적 상단 라운드 — §4 판단 |

## 4. padding 이관 (91곳) — 의미 토큰 우선

padding은 0.25 그리드에 안 맞는 값이 많다. **먼저 의미 토큰에 맞춘다**(그게 이 값들의 원래 정체다):

| 쓰임(정본 기준) | → 토큰 |
|---|---|
| 패널 헤더 (≈1rem / 1rem 1.15rem) | `--tt-panel-head-padding-block/inline` |
| 패널 본문 (≈1.15rem) | `--tt-panel-body-padding` |
| 카드 (`var(--tt-card-padding)` 이미/유사) | `--tt-card-padding` |
| 인라인 노티스 (≈0.7rem 0.85rem) | `--tt-note-padding-block/inline` |
| 버튼·소형 컨트롤 (≈0.42rem·compact) | `--tt-button-padding-*`(-compact) |

단축 안 되는 **단일축 값**은 space 스케일로 라운딩:

| 관측 | → 토큰 |
|---|---|
| 0.25 | `--tt-space-1` | 
| 0.4–0.55 | `--tt-space-2` (0.5) |
| 0.6–0.85 | `--tt-space-3` (0.75) |
| 0.9–1.1 | `--tt-space-4` (1) |
| 1.15–1.6 | `--tt-space-5` (1.5) |
| 1.9–2.2 | `--tt-space-6` (2) |

- **다축 패딩**(예: `0.65rem 0.9rem`, `1.1rem 1.2rem`)은 축마다 위 표로. 두 축이 서로 다른
  의미면(예: 알약형 컨트롤) §4 판단.
- **섹션 세로 리듬 `clamp(...)`**(예: `clamp(3rem,7vw,6rem)`)은 레이아웃 리듬이다. 끝점이
  space 값이면 그대로 두되, baseline에 남으면 판단 목록으로. 억지로 토큰화하지 않는다.

## 4-b. 판단 필요 (기계 치환 금지 — 정본 대조 후 결정)

- 콘솔의 1.35·1.40·1.45·2.9rem 같은 중간·특대 폰트(스케일 사이) → 정본에서 그 화면의 랭크를
  확인해 인접 토큰으로. 애매하면 Claude에 되돌린다.
- 다축·비대칭 패딩, `0.2rem 0.2rem 0 0` 류 부분 라운드.
- `clamp` 섹션 패딩/폰트가 공개 표면인지 콘솔인지에 따라 `--tt-pub-*` vs 일반 스케일.

## 5. 스테일 baseline 항목 (빠른 감축)

- baseline 301건 중 **43건은 현재 globals.css에서 셀렉터가 안 잡힌다**(삭제·개명됨).
- 여러 항목이 이미 `var(--tt-*)` 값이다(치환 완료됨).
- → 코드 치환 없이 `--update-baseline`만으로 제거된다. **가장 먼저 이걸로 숫자를 떨어뜨린다.**

## 6. 착수 순서 (부채 많은 클러스터 순)

1. **스테일 정리** — `--update-baseline`로 43건 + var()화된 항목 제거(코드 변경 없음).
2. `qr-quantity`(26) + `qr-*`(29) — QR 재고·위자드
3. `operations-*`(27) — 운영 대시보드 (⚠️ 현재 Codex가 편집 중인 파일과 겹침 — 그 변경과
   같은 커밋에서 정리)
4. `admin-catalog-decision`(14) — 관리회사 목록
5. `admin-console-account`(8)·`admin-dashboard-shell`(7)·`admin-company-identity`(6)·
   `admin-overview-attention`(6)·`admin-profile-panel`(6)
6. 나머지 admin-* 잔여

각 단계: 치환 → `validate:design-system` → 정본 눈대조(로그인 뒤 화면은 스텝 D 후) →
`--update-baseline` → 커밋.

## 7. 완료 판정

- baseline 부채가 클러스터 완료마다 줄고, 최종적으로 구조값·판단항목만 남는다.
- 표면 간 같은 역할 값이 **하나의 토큰**을 공유한다(`DESIGN_CONSISTENCY_RULES.md` §7).
- `validate:design-system`·`validate:wcj` 통과. 정본 대조는 콘솔의 경우 스텝 D 이후.
