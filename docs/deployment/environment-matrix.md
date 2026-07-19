# Environment Matrix

| 항목 | Local | Staging | Production |
|---|---|---|---|
| Web | localhost | Vercel Preview | Vercel Production |
| Database | Supabase Local | `taptolk-staging` (`evpwzjkhfppdjivkyokh`) | 별도 Supabase project |
| Region | 개발자 로컬 | Supabase Seoul (`ap-northeast-2`) | Staging 검증 후 확정 |
| API key | Local key | `sb_publishable_…` / server `sb_secret_…` | 환경별 별도 key |
| SMS | mock | provider sandbox | provider production |
| Privacy cleanup Cron | manual/internal test | authenticated manual acceptance | Vercel hourly GET, operator approval pending |
| Sentry | console 또는 disabled | staging environment | production environment |
| 데이터 | synthetic only | test data only | approved live data |
| 배포 승인 | 개발자 로컬 | 사용자 승인 필요 | 사용자 승인 + release gate |

Vercel Function region은 Supabase region이 결정된 뒤 같은 지역 또는 가장 가까운
지역으로 설정한다.

## Staging 연결 상태

- 생성·연결일: 2026-07-18
- Supabase project: `taptolk-staging`
- Project ref: `evpwzjkhfppdjivkyokh`
- Region: Northeast Asia (Seoul), `ap-northeast-2`
- Data API: enabled
- New table auto exposure: disabled
- Automatic RLS: enabled
- 로컬/원격 migration history: 7개 일치
- Security Advisor: error 0, warning 1
- Performance Advisor: error 0, warning 0

Security warning은 Auth의 Leaked Password Protection 비활성 상태다. 이메일 가입을
운영에 열기 전 사용 가능한 요금제에서 활성화한다. 정보 수준의 unused-index 제안은
데이터가 없는 신규 staging 특성상 제거하지 않는다.
Publishable/Secret key와 DB password는 이 문서나 Git에 기록하지 않는다.
