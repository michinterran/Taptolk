# Taptolk 멀티에이전트 운영 모델 (Operating Model)

> 확정: 2026-07-25 (운영자) · 상태: **binding**
> 이 문서는 "누가 무엇을 만지는가"의 정본이다. `AGENTS.md`의 권위 순서 바로 아래에서
> 강제된다. 코드/디자인 산출물이 서로 엉키는 문제를 없애기 위한 규약이다.

---

## 0. 왜 이 문서가 생겼나

세 에이전트(Claude·Codex·Antigravity)가 **하나의 워킹트리와 하나의 브랜치를 공유**하면서
같은 파일을 동시에 고쳤다. 그 결과:

- 커밋 전 `git status`에 서로의 미커밋 변경이 섞여 `git add`가 위험해졌다.
- 디자인 값(globals.css)과 백엔드 코드가 한 커밋 경계 안에서 충돌했다.
- 같은 화면이 handoff 산문을 근거로 반복해서 다시 만들어졌다.

근본 원인은 실력이 아니라 **경계의 부재**다. 이 문서가 경계를 정한다.

**단일 원칙 — 앱 코드를 메인 브랜치에 쓰는 에이전트는 Codex 하나뿐이다.**

---

## 1. 세 개의 레인 (역할)

| 레인 | 담당 | 산출물 | 메인 브랜치에 쓰나 |
|---|---|---|---|
| **디자인 권위** | Claude | 디자인 토큰, 정본(canon), 화면 상태 목록, KO/EN 카피 계약, 데이터 계약, "구현 준비 완료" 스펙, 거버넌스 문서 | **예 — 디자인 산출물만** |
| **구현** | Codex | 모든 앱 코드: 프론트/백엔드/DB/마이그레이션/테스트/스타일 적용 | **예 — 유일한 앱 코드 작성자** |
| **리뷰·자문** | Antigravity | 코드 리뷰, 더 나은 방향 제안, 위험·부채 지적 | **아니오** |

- Claude는 **앱 코드를 커밋하지 않는다.** 화면이 "어떻게 생기고 어떤 값을 쓰는지"를
  토큰·정본·스펙으로 정하고 넘긴다. 마크업·컴포넌트·globals.css 적용은 Codex가 한다.
- Codex는 **디자인 토큰 값과 정본을 임의로 바꾸지 않는다.** 정본과 다르게 만들 수밖에
  없으면 멈추고 Claude에게 되돌린다(§5).
- Antigravity는 **메인라인에 직접 쓰지 않는다.** 리뷰 결과는 PR 코멘트 또는
  `docs/reviews/`의 리뷰 노트로 남기고, 반영은 Codex가 판단해 커밋한다.

---

## 2. 소유권 지도 (파일·디렉터리 → 소유 레인)

에이전트는 **자기 레인의 경로만** `git add` 한다. `git add -A` / `git add .` **절대 금지.**

### 2.1 Claude(디자인)만 쓴다

```
packages/ui/src/styles/tokens.css        ← 디자인 값의 유일한 원천
docs/design-canon/**                      ← 화면 정본(HTML·PNG·CONTRACTS.md)
DESIGN_SYSTEM.md                          ← 디자인 규칙 정본
docs/governance/**                        ← 이 문서를 포함한 규약
docs/development/plan-design-*.md          ← 디자인 완성 진행표
```

### 2.2 Codex(구현)만 쓴다

```
apps/**                                   ← globals.css·컴포넌트·라우트·API 전부
packages/**  (단, tokens.css 제외)          ← domain·application·db·auth·qr-engine 등
supabase/**                               ← 마이그레이션·pgTAP
e2e/**, scripts/**, config/** (baseline 포함)
turbo.json, package.json, 빌드/CI 설정
```

- `config/design-system-baseline.json`은 **Codex가** `--update-baseline`로 갱신한다.
  부채를 줄이는 코드 변경이 Codex 것이기 때문이다.
- `apps/web/app/globals.css`는 **구현물**이다. Claude는 여기에 손대지 않고,
  Codex가 정본·토큰을 보고 적용한다.

### 2.3 Antigravity(리뷰)만 쓴다

```
docs/reviews/**                           ← 리뷰 노트 (리뷰 브랜치 또는 PR 코멘트)
```

### 2.4 공동 소유 (변경 시 §5의 인계 필요)

```
AGENTS.md                                 ← 엔지니어링 계약 (변경은 운영자 승인)
TAPTOLK_MASTER_DEVELOPMENT_SPEC.md         ← 최상위 스펙 (변경은 운영자 승인)
docs/development/workorder-*.md            ← Claude가 발행, Codex가 소비
docs/development/PROJECT_COMPLETION_PLAN.md ← Claude가 발행, Codex가 진척 체크
```

> 경계가 애매한 새 파일이 나오면 **먼저 이 표에 한 줄 추가하고 나서** 만든다.

---

## 3. 브랜치·커밋 규율

1. **레인별 작업 브랜치를 쓴다.** 공유 브랜치(`codex/*`)에서 세 에이전트가 동시에
   커밋하지 않는다.
   - Claude: `design/<주제>` — 디자인 산출물만
   - Codex: `codex/<phase-또는-주제>` — 구현
   - Antigravity: 브랜치를 만들지 않고 리뷰만. 노트가 필요하면 `review/<주제>`
2. **커밋 전 반드시 `git status`.** 다른 레인의 미커밋 변경이 보이면 **그 파일을 절대
   add 하지 않는다.** 자기 파일만 명시적으로 `git add <path>` 한다.
3. **한 커밋 = 한 레인.** 디자인 토큰 변경과 백엔드 변경을 한 커밋에 섞지 않는다.
4. **머지는 PR로.** 리뷰(Antigravity) 통과 후 메인에 올린다. 로컬 브랜치를 그대로
   메인처럼 쓰지 않는다.
5. **커밋 메시지에 근거를 남긴다.** 화면 변경은 어느 정본을 봤는지, 코드 변경은 어느
   워크오더/계약을 구현했는지 적는다.

---

## 4. 파이프라인 (디자인 → 구현 → 리뷰)

```
① Claude   화면을 "구현 준비 완료" 상태로 만든다
           = 정본 근거 + 토큰 + 상태 전부 + KO/EN 카피 계약 + CONTRACTS.md 한 행
           → DESIGN_CONSISTENCY_RULES.md의 "Design-Ready 7조건" 통과
           → 워크오더로 Codex에 넘긴다

② Codex    워크오더 + 정본 + 토큰으로 구현한다 (마크업·로직·DB·테스트)
           → 정본과 다르게 만들 수밖에 없으면 멈추고 Claude에 되돌린다
           → validate:design-system·validate:wcj·verify 통과
           → PR 생성

③ Antigravity  PR을 리뷰한다 (정확성·부채·보안·정본 일치·더 나은 방향)
           → 승인 또는 변경 요청. 직접 커밋하지 않는다

④ 머지     리뷰 승인 후 메인에 머지. Codex가 반영·재검증
```

**역류 금지 규칙:** 이 파이프라인은 한 방향이다. Codex가 디자인 값을 바꾸거나(② → ①),
Antigravity가 코드를 직접 고치는(③ → ②) 역류는 금지다. 필요하면 되돌려서 소유 레인이
처리한다.

---

## 5. 인계(핸드오프) 규약

- 화면 하나가 "구현 준비 완료"가 되면 Claude는 `docs/development/workorder-*.md`를 쓰고,
  거기에 정본 파일·토큰·상태·카피 계약·CONTRACTS.md 행을 링크한다.
- Codex가 구현하다 **정본으로 답이 안 나오는 지점**을 만나면, 산문으로 추측하지 말고
  Claude에게 "이 화면의 이 상태가 정본에 없다"고 되돌린다. handoff 산문은 설계 근거가
  아니다(`AGENTS.md`).
- 세션 인계는 `AGENTS.md`의 "Session handoff protocol"을 그대로 따른다.
  handoff는 **세션 상태만** 기록하고 설계·범위 근거로 인용하지 않는다.

---

## 6. 지금 당장의 정리 (이 규약 적용 첫걸음)

1. 공유 `codex/phase-1-foundation` 워킹트리의 **미커밋 변경을 레인별로 분리**해서
   각자 커밋한다(디자인 파일 vs 구현 파일). 섞인 커밋을 만들지 않는다.
2. 다음 작업부터 §3의 브랜치 규율을 적용한다.
3. Antigravity를 공유 브랜치의 커밋 권한에서 뺀다(리뷰 전용).

이 세 가지가 끝나면 "부채가 엉키는" 구조적 원인이 사라진다.
