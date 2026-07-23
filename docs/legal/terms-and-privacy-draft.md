# Taptolk 이용약관 · 개인정보처리방침 초안 (KO/EN)

> 작성: Claude · 2026-07-21
> **상태: 법률 검토 전 초안** — 사용자 결정(2026-07-21)에 따라 법률 검토는 **서비스 개시 전**에
> 완료한다. 그 전까지 본 문서는 개발용 기본 문안으로만 사용한다.
> 이 문서가 약관·처리방침 문안의 **단일 원본(single source)** 이다.
> `docs/development/prd-public-surface-0721.md` Part C의 인라인 초안보다 이 문서가 우선한다.

---

## 1. 문서 상태와 취급 규칙

| 항목 | 값 |
|---|---|
| 이용약관 버전 | `TERMS_V1` |
| 개인정보처리방침 버전 | `PRIVACY_V1` |
| 법률 검토 | **미완료 — 서비스 개시 전 필수** |
| 시행일 | **미정** (법률 검토 완료 후 확정) |

### 1.1 버전을 `V1`로 맞춘 이유

`public.owners` 테이블은 `terms_version` / `privacy_version` / `consented_at`을 `not null`로
기록하고 있고, 현재 클라이언트가 `TERMS_V1`을 전송하고 있다. 초기 버전을 `V1`로 유지해야
**이미 기록된 동의 데이터와 정합**이 유지된다. 법률 검토 후 문안이 실질적으로 바뀌면
`V2`로 올리고 재동의 정책을 별도로 정한다.

버전 문자열은 도메인 정책의 정규식 `^[A-Z0-9][A-Z0-9._-]{0,31}$`을 만족해야 한다
(`packages/domain/src/owner-activation-policy.ts`).

### 1.2 값이 없으면 렌더링하지 않을 항목

아래는 아직 확정되지 않았다. **빈 값을 임의로 채우지 말고, 값이 없으면 해당 항목 자체를
화면에 렌더링하지 않는다.**

- 상호 · 대표자 · 사업자등록번호 · 주소 (사업자등록 진행 중)
- 개인정보 보호책임자 성명 · 직책 · 연락처
- 고객 문의 이메일 주소
- 수탁자 목록 (카카오 공식 딜러 · 클라우드 사업자) 및 보유 리전
- 국외 이전 해당 여부 및 내용
- 시행일

---

## 2. 이용약관 (한국어) — `TERMS_V1`

**제1조 (목적)**
본 약관은 Taptolk(이하 "회사")가 제공하는 차량 연락 중계 서비스(이하 "서비스")의 이용에 관한
회사와 이용자의 권리·의무 및 책임사항을 규정합니다.

**제2조 (용어의 정의)**
1. "서비스"란 차량에 부착된 QR을 통해 전화번호를 공개하지 않고 차량 관련 연락을 중계하는
   서비스를 말합니다.
2. "차주"란 QR을 자신의 차량 연락 수단으로 활성화한 이용자를 말합니다.
3. "방문자"란 차량에 부착된 QR을 스캔해 연락을 요청하는 이용자를 말합니다.
4. "계약사"란 회사와 서비스 이용 계약을 체결한 관리회사 및 그 운영 장소를 말합니다.
5. "연락 세션"이란 방문자의 요청부터 종료 또는 만료까지 유지되는 목적 제한형 임시 연락
   단위를 말합니다.

**제3조 (서비스의 내용)**
1. 회사는 다음 서비스를 제공합니다.
   - QR 스캔을 통한 목적 제한형 차량 연락 요청 중계
   - 차주에 대한 알림 발송 및 제한된 선택지 응답 중계
   - 차주의 QR 활성화 및 연결 차량 관리
   - 계약사에 대한 QR 발급·재고·운영 관리 기능
2. 회사는 방문자와 차주 어느 쪽에도 상대방의 전화번호를 제공하지 않습니다.
3. 서비스는 목적이 정해진 짧은 연락을 위한 것이며 자유로운 대화를 위한 메신저가 아닙니다.

**제4조 (이용계약의 성립)**
1. 방문자는 회원가입 없이 QR 스캔을 통해 임시 세션으로 서비스를 이용합니다.
2. 차주는 휴대전화 본인확인과 본 약관 및 개인정보처리방침 동의를 완료함으로써 이용계약이
   성립합니다.
3. 계약사 관리자는 회사가 승인한 계정과 권한 범위에서 서비스를 이용합니다. 계정 생성만으로
   관리 권한이 부여되지 않으며 별도 승인이 필요합니다.

**제5조 (이용자의 의무)** 이용자는 다음 행위를 하여서는 안 됩니다.
1. 타인의 차량 QR을 무단으로 사용하거나 훼손·복제하는 행위
2. 협박·욕설·광고·스팸 등 서비스 목적에 반하는 내용을 전송하는 행위
3. 반복적·악의적으로 연락을 발생시켜 차주 또는 서비스에 부담을 주는 행위
4. 서비스를 통해 취득한 정보를 목적 외로 이용하거나 제3자에게 제공하는 행위
5. 자동화된 수단으로 서비스에 접근하거나 시스템을 우회하려는 행위

**제6조 (이용 제한)**
1. 회사는 제5조를 위반하거나 위반이 의심되는 이용자에 대해 요청 횟수 제한, 세션 종료, 차단
   등의 조치를 할 수 있습니다.
2. 회사는 신고가 접수된 연락 건에 대해 필요한 범위에서 확인할 수 있습니다.

**제7조 (연락 세션과 보존)**
1. 연락 세션은 목적 달성, 신고, 만료 또는 운영상 종료 시 닫힙니다.
2. 메시지 등 민감 정보는 개인정보처리방침에 정한 보존 기간이 지나면 삭제되거나 식별할 수
   없는 형태로 처리됩니다.
3. QR 자산과 연결 이력은 운영·감사 목적으로 상태 기록으로 보존되며, 이 경우에도 개인정보는
   최소한으로 처리됩니다.

**제8조 (서비스의 중단)**
1. 회사는 시스템 점검, 설비 장애, 통신사 또는 발송 사업자의 사정 등으로 서비스를 일시
   중단할 수 있습니다.
2. 회사는 알림 발송이 통신 환경, 단말기 설정, 발송 사업자 사정 등 회사의 책임 없는 사유로
   지연되거나 실패하는 경우 책임을 지지 않습니다.

**제9조 (책임의 제한)**
1. 서비스는 이용자 간 연락을 중계할 뿐이며, 연락의 내용·정확성·이행에 대해 회사는 책임지지
   않습니다.
2. 회사는 차량의 이동·주차 문제 등 실제 상황의 해결을 보장하지 않습니다.
3. 긴급 상황에서는 서비스에 의존하지 말고 관계 기관에 직접 연락해야 합니다.

**제10조 (약관의 변경)**
1. 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다.
2. 변경 시 시행일과 변경 내용을 서비스 화면에 시행일 7일 전부터 공지합니다. 이용자에게
   불리한 변경은 30일 전부터 공지합니다.
3. 이용자가 변경에 동의하지 않는 경우 이용을 중단하고 연결을 해지할 수 있습니다.

**부칙** 본 약관은 [시행일]부터 시행합니다. 버전: `TERMS_V1`

---

## 3. Terms of Service (English) — `TERMS_V1`

**Article 1 (Purpose)**
These Terms govern the rights, obligations, and responsibilities of Taptolk (the "Company") and
its users regarding the vehicle contact relay service (the "Service").

**Article 2 (Definitions)**
1. "Service" means relaying vehicle-related contact through a QR code attached to a vehicle
   without disclosing anyone's phone number.
2. "Owner" means a user who has activated a QR code as the contact channel for their vehicle.
3. "Caller" means a user who scans a vehicle's QR code to send a contact request.
4. "Customer" means a management company that has entered into a service agreement with the
   Company, together with the sites it operates.
5. "Contact session" means a purpose-limited temporary contact unit that lasts from a caller's
   request until it is closed or expires.

**Article 3 (Scope of the Service)**
1. The Company provides the following:
   - Relay of purpose-limited vehicle contact requests initiated by a QR scan
   - Delivery of owner notifications and relay of replies chosen from a fixed set of options
   - Owner QR activation and management of connected vehicles
   - QR issuance, inventory, and operational management for Customers
2. The Company never discloses either party's phone number to the other.
3. The Service is intended for short, purpose-limited contact and is not a general messenger.

**Article 4 (Formation of the Agreement)**
1. Callers use the Service through a temporary session initiated by a QR scan, without
   registration.
2. For owners, the agreement is formed upon completing mobile phone verification and agreeing to
   these Terms and the Privacy Policy.
3. Customer administrators use the Service only within an account and permission scope approved
   by the Company. Creating an account alone does not grant administrative rights; separate
   approval is required.

**Article 5 (User Obligations)** Users must not:
1. Use, damage, or duplicate another person's vehicle QR code without authorization
2. Send threats, abusive language, advertising, spam, or other content contrary to the purpose of
   the Service
3. Generate repeated or malicious contact that burdens an owner or the Service
4. Use information obtained through the Service for any other purpose or provide it to third
   parties
5. Access the Service by automated means or attempt to circumvent its systems

**Article 6 (Usage Restrictions)**
1. The Company may limit request frequency, close sessions, or block users who violate or are
   reasonably suspected of violating Article 5.
2. The Company may review reported contact records to the extent necessary.

**Article 7 (Contact Sessions and Retention)**
1. A contact session closes when its purpose is fulfilled, when it is reported, when it expires,
   or when it is closed for operational reasons.
2. Sensitive information such as message content is deleted or rendered non-identifiable once the
   retention period stated in the Privacy Policy has passed.
3. QR assets and connection history are retained as status records for operational and audit
   purposes, and personal data is processed to the minimum extent in those records.

**Article 8 (Service Interruption)**
1. The Company may temporarily suspend the Service for maintenance, equipment failure, or
   circumstances affecting carriers or messaging providers.
2. The Company is not liable when notification delivery is delayed or fails for reasons outside
   its control, including network conditions, device settings, or messaging provider issues.

**Article 9 (Limitation of Liability)**
1. The Service only relays contact between users. The Company is not responsible for the content,
   accuracy, or fulfillment of that contact.
2. The Company does not guarantee resolution of the underlying situation, such as moving a
   vehicle or resolving a parking issue.
3. In an emergency, contact the relevant authorities directly rather than relying on the Service.

**Article 10 (Changes to these Terms)**
1. The Company may amend these Terms within the limits of applicable law.
2. Changes are announced on the Service at least 7 days before the effective date, and at least
   30 days in advance where the change is unfavorable to users.
3. A user who does not accept a change may stop using the Service and terminate their connection.

**Addendum** These Terms take effect on [effective date]. Version: `TERMS_V1`

---

## 4. 개인정보처리방침 (한국어) — `PRIVACY_V1`

**1. 수집하는 개인정보 항목과 방법**

| 대상 | 항목 | 수집 방법 |
|---|---|---|
| 차주 | 휴대전화번호, 차량번호, 동의 일시·버전, 인증 일시 | QR 활성화 시 이용자 입력 |
| 차주(선택) | 기기 식별을 위한 비가역 해시 | 차량 확인 시 자동 생성 |
| 방문자 | 익명 식별 토큰, 연락 세션 토큰, 연락 사유, 직접 입력 내용(최대 200자) | QR 스캔 및 요청 시 |
| 관리자 | 이메일 주소, 표시 이름, 소속·역할 정보 | 계정 생성·승인 시 |
| 공통 | 접속 일시, 요청 식별자 등 서비스 운영 기록 | 자동 생성 |

**2. 개인정보의 이용 목적**
- 전화번호를 공개하지 않는 차량 연락 중계
- 차주 본인확인 및 QR과 차량의 연결
- 악의적·반복적 이용 방지 및 신고 처리
- 계약사에 대한 운영 현황 및 통계 제공(개인을 식별할 수 없는 형태)
- 서비스 안정성 확보 및 장애 대응

**3. 보유 및 이용 기간**

| 항목 | 보유 기간 |
|---|---|
| 연락 메시지 본문 | 발송 후 **72시간** 이내 삭제 또는 비식별 처리 |
| 연락 세션 | 종료·만료 후 정해진 정리 주기에 따라 삭제 |
| 차주 연결 정보 | 연결 해지 또는 QR 폐기 시까지. 이후 이력은 식별 정보를 제거하고 보존 |
| 관리자 계정 | 계약 종료 또는 계정 종료 시까지 |
| 도입 문의 정보 | 접수일로부터 **1년** |
| 법령상 보존 의무가 있는 기록 | 관련 법령이 정한 기간 |

**4. 개인정보의 보호 조치**
- 휴대전화번호와 차량번호는 **암호화하여 저장**하며, 조회를 위한 값은 복호화가 불가능한
  해시로 별도 관리합니다.
- 화면에는 전화번호·차량번호의 전체 값을 표시하지 않으며 끝 일부만 표시합니다.
- 전화번호, 메시지 본문, 인증번호, 인증 토큰은 **운영 기록에 저장하지 않습니다.**
- 데이터 접근은 역할 기반 권한과 데이터베이스 수준의 접근 제어를 모두 통과해야 하며,
  주요 변경은 개인정보를 제거한 감사 기록으로 남깁니다.

**5. 개인정보의 제3자 제공**
회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 근거하거나 수사기관의
적법한 요청이 있는 경우는 예외로 합니다.

**6. 개인정보 처리의 위탁** — *(수탁자 확정 전까지 렌더링하지 않음)*

| 수탁자 | 위탁 업무 | 보유 리전 |
|---|---|---|
| (미정) | 카카오 알림톡 발송 | (미정) |
| (미정) | 데이터베이스·인증·파일 보관 | (미정) |
| (미정) | 서비스 호스팅 | (미정) |

**7. 국외 이전** — *(법률 검토 후 확정. 확정 전까지 렌더링하지 않음)*

**8. 이용자의 권리와 행사 방법**
이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다. 차주는
서비스 내에서 연결을 해지할 수 있으며, 그 밖의 요청은 아래 연락처로 접수할 수 있습니다.

**9. 개인정보 보호책임자** — *(지정 전까지 렌더링하지 않음)*

**10. 방침의 변경**
본 방침이 변경되는 경우 시행일과 변경 내용을 시행 7일 전부터 공지합니다.

**시행일** [시행일] · **버전** `PRIVACY_V1`

---

## 5. Privacy Policy (English) — `PRIVACY_V1`

**1. Personal data we collect and how**

| Subject | Data | Collection method |
|---|---|---|
| Owner | Mobile phone number, vehicle plate, consent time and version, verification time | Entered during QR activation |
| Owner (optional) | Irreversible hash used for device identification | Generated automatically when viewing vehicles |
| Caller | Anonymous identifier token, contact session token, contact reason, free-text message (up to 200 characters) | Collected on QR scan and request |
| Administrator | Email address, display name, membership and role information | Collected at account creation and approval |
| All | Access time, request identifiers, and other operational records | Generated automatically |

**2. Purposes of use**
- Relaying vehicle contact without disclosing phone numbers
- Verifying owners and connecting a QR code to a vehicle
- Preventing malicious or repeated misuse and handling reports
- Providing operational status and statistics to Customers in a non-identifiable form
- Maintaining service reliability and responding to incidents

**3. Retention periods**

| Data | Retention |
|---|---|
| Contact message content | Deleted or made non-identifiable within **72 hours** of delivery |
| Contact sessions | Deleted according to the defined cleanup cycle after they close or expire |
| Owner connection data | Until the connection ends or the QR is revoked; history is then retained with identifying data removed |
| Administrator accounts | Until the contract or the account ends |
| Sales inquiry data | **One year** from receipt |
| Records subject to statutory retention | For the period required by applicable law |

**4. Security measures**
- Phone numbers and vehicle plates are **stored encrypted**, and lookup values are kept
  separately as hashes that cannot be reversed.
- Full phone numbers and plate numbers are never displayed on screen; only a trailing portion is
  shown.
- Phone numbers, message content, verification codes, and authentication tokens are **never
  written to operational records**.
- Data access must pass both role-based authorization and database-level access control, and
  significant changes are recorded in audit entries with personal data removed.

**5. Disclosure to third parties**
We do not provide personal data to third parties, except where required by law or in response to
a lawful request from an investigative authority.

**6. Processing entrusted to service providers** — *(not rendered until providers are confirmed)*

| Provider | Entrusted work | Hosting region |
|---|---|---|
| (TBD) | Kakao AlimTalk delivery | (TBD) |
| (TBD) | Database, authentication, and file storage | (TBD) |
| (TBD) | Service hosting | (TBD) |

**7. Cross-border transfer** — *(to be confirmed after legal review; not rendered until then)*

**8. Your rights and how to exercise them**
You may request access, correction, deletion, or suspension of processing of your personal data.
Owners can end a connection within the Service; other requests can be submitted through the
contact details below.

**9. Data protection officer** — *(not rendered until appointed)*

**10. Changes to this policy**
When this policy changes, we announce the effective date and the changes at least 7 days in
advance.

**Effective date** [effective date] · **Version** `PRIVACY_V1`

---

## 6. 법률 검토 시 확인할 쟁점

서비스 개시 전 법률 검토를 의뢰할 때 아래를 함께 전달한다. 일반 약관 검토가 아니라
Taptolk 구조에 특유한 판단이 필요한 지점들이다.

| # | 쟁점 | 시스템의 실제 동작 |
|---|---|---|
| 1 | 차량번호가 개인정보에 해당하는가 | AES-GCM 암호문 + 조회용 keyed hash + 끝 4자리로 분리 저장. 전체 값은 화면에 표시하지 않음 |
| 2 | 방문자 익명 토큰이 개인정보에 해당하는가 | 회원가입 없이 HttpOnly 쿠키 기반 임시 식별자. 세션 종료 시 쿠키 제거 |
| 3 | **Supabase 이용이 국외이전에 해당하는가** | 데이터는 서울 리전에 저장되나 사업자는 해외 법인. 물리적 이전은 없음 |
| 4 | 메시지 72시간 보존이 적정한가 | 종료·만료 시 본문을 `[REDACTED]`로 대체하고 content hash를 tombstone 처리 |
| 5 | 카카오·딜러 위탁 고지 범위 | 알림톡에 전달되는 값은 연락 사유와 일회성 응답 링크 2개뿐. 전화번호는 수신자 필드로만 전달 |
| 6 | 차주 동의 방식이 유효한가 | 활성화 시 약관·처리방침 동의를 받고 버전·시각을 DB에 기록 |
| 7 | 계약사가 처리자인가 공동처리자인가 | 계약사는 자신의 사이트 범위 데이터만 조회. 개인 식별 정보는 마스킹 |
| 8 | 미성년자 차주 처리 | 현재 별도 절차 없음 |

**3번은 특히 확인이 필요하다.** 리전을 서울로 정한 것은 리스크를 줄이지만, 해외 법인이
처리자인 이상 국외이전 해당 여부는 법률 판단 영역이며 Claude가 단정하지 않는다.

---

## 7. 구현 시 준수 사항 (Codex)

- 문안은 **타입 있는 content 모듈**에 KO/EN 동시에 넣는다. 컴포넌트 하드코딩 금지.
- `apps/web/components/owner-activation-view.tsx`의 하드코딩된 `termsVersion: "TERMS_V1"`을
  제거하고 설정·content 모듈에서 주입받는다.
- 차주 동의 문구에 두 문서 링크를 연결한다.
- 1.2의 미확정 항목은 **값이 없으면 해당 섹션을 렌더링하지 않는다.** 빈 표나 `(미정)`
  문자열을 사용자에게 노출하지 않는다.
- 페이지는 공개 route group에 두고 인증을 요구하지 않는다.
- 320/768/1280/1920 CSS px에서 확인하고 WCJ를 통과시킨다.
