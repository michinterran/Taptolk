# Taptolk Phase 1 Glossary

| English term | Korean | Definition |
|---|---|---|
| Tenant | 테넌트 | Taptolk data isolation's highest customer boundary |
| Management Company | 관리회사 | Organization operating one or more Sites |
| Site | 운영 장소 | Apartment, officetel, building, or other physical operation unit |
| Contract | 계약 | Plan, term, billing basis, and vehicle-capacity agreement |
| Admin Profile | 관리자 프로필 | `auth.users` extension containing non-auth display state |
| Membership | 관리자 소속 | User role and exact hierarchy scope |
| Role | 역할 | Named permission set such as Site Admin or Read Only |
| Scope | 권한 범위 | Platform, Tenant, Management Company, or Site boundary |
| RBAC | 역할 기반 권한 | Application permission decision based on role and scope |
| RLS | 행 수준 보안 | PostgreSQL policy that independently limits rows |
| Audit Log | 감사 로그 | Append-only redacted security/operation event |
| Site Lifecycle Request | Site 생명주기 요청 | Tenant-owned request to suspend, reactivate, or close one Site |
| Maker | 요청자 | Admin who creates a lifecycle request within an authorized scope |
| Checker | 승인자 | Different authorized admin who approves or rejects a pending request |
| Pending Request | 대기 요청 | Mutable review state before approval, rejection, or requester cancellation |
| Terminal Request | 종결 요청 | Immutable approved, rejected, or cancelled request history |
| Caller B | 호출자 B | External QR user without an account |
| Owner A | 차주 A | Vehicle contact recipient authenticated by phone OTP |

`Escalation` is an internal term. User-facing Korean copy uses “관리사무소에 알리기”.
