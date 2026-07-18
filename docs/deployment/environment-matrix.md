# Environment Matrix

| 항목 | Local | Staging | Production |
|---|---|---|---|
| Web | localhost | Vercel Preview | Vercel Production |
| Database | Supabase Local | 별도 Supabase project | 별도 Supabase project |
| SMS | mock | provider sandbox | provider production |
| Sentry | console 또는 disabled | staging environment | production environment |
| 데이터 | synthetic only | test data only | approved live data |
| 배포 승인 | 개발자 로컬 | 사용자 승인 필요 | 사용자 승인 + release gate |

Vercel Function region은 Supabase region이 결정된 뒤 같은 지역 또는 가장 가까운
지역으로 설정한다. 현재 Phase 0에서는 원격 프로젝트를 만들거나 연결하지 않는다.
