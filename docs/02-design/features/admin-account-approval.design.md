# admin-account-approval - Design

> Version: 1.0.0 | Date: 2026-07-19 | Plan:
> `docs/01-plan/features/admin-account-approval.plan.md`

## 1. Module boundary

```text
Approval Center Page
→ Server Action / Server Component
→ AdminAccountApprovalService
→ Domain RBAC + role/scope policy
→ Auth Directory Repository (server Secret Key)
→ Approval Command Repository (authenticated RPC)
→ PostgreSQL transaction + audit
```

Auth directory 조회와 권한 변경 repository를 분리한다. Secret Key client는 Auth 사용자
목록에만 사용한다. 승인 후보 profile 상태는 AAL2 Platform Super Admin RLS를 적용한
SSR session으로 조회한다. 승인·거절 command도 현재 슈퍼어드민의 SSR session으로
RPC를 호출하며, DB 함수가 `auth.uid()`, AAL2와 활성 PLATFORM `SUPER_ADMIN`
membership을 재검증한다.

## 2. Read model

```ts
interface PendingAdminAccount {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  provider: "email" | "google" | "other";
  suggestedDisplayName: string;
  userId: string;
}

interface AdminApprovalScopeCatalog {
  tenants: ScopeOption[];
  managementCompanies: ScopeOption[];
  sites: ScopeOption[];
}
```

Auth Admin API는 한 번에 최대 1,000명까지 bounded scan한다. 이 한도를 넘으면
`truncated` 상태를 표시하고 이후 검색/index 전용 read model을 별도 Phase로 만든다.

## 3. Command contract

승인 입력:

- target user UUID
- display name
- role
- scope type
- tenant/company/site UUID (역할에 따라 nullable)
- approval reason
- idempotency용 request UUID

거절 입력:

- target user UUID
- display name
- rejection reason
- request UUID

승인은 profile `ACTIVE`와 membership `ACTIVE`를 생성한다. 거절은 profile `CLOSED`를
기록하며 Auth identity를 삭제하지 않는다. 기존 ACTIVE/SUSPENDED/CLOSED profile에는
승인·거절 command를 재적용하지 않는다.

## 4. UI direction

기존 design concept의 밝은 grid, 넓은 여백, 원본 Taptolk 로고와 보라/주황 signal을
유지한다. 승인 센터는 장식적 dashboard 대신 검토 큐로 구성한다.

- 상단: 의미 기반 KO/EN 제목과 서버/RLS 보안 메모
- 요약: 대기 건수, Secret Key 연결 상태, scan 범위
- 본문: 계정별 review card
- 각 card: 가입 방식·이메일 확인·가입 시각·표시 이름·역할·scope·사유
- action: 승인과 거절을 시각·문구로 분리
- mobile: field를 한 열로 배치하고 action을 전체 폭으로 제공

## 5. Error and state policy

- `CONFIGURATION`: Secret Key가 없어 목록을 조회하지 못함
- `UNAVAILABLE`: Auth/DB 외부 오류
- `VALIDATION`: 역할·scope·표시 이름·사유 오류
- `FORBIDDEN`: AAL2/role/scope 정책 거부
- `CONFLICT`: 이미 처리된 계정
- `EMPTY`: 현재 승인 대기 계정 없음
- `SUCCESS`: 승인 또는 거절 완료 후 PRG redirect
