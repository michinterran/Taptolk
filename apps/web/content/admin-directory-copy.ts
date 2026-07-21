import type { AppLocale } from "../i18n/config";

export interface AdminDirectoryCopy {
  account: string;
  actions: string;
  active: string;
  approveAccounts: string;
  description: string;
  displayName: string;
  email: string;
  eyebrow: string;
  invited: string;
  noEmail: string;
  reason: string;
  reasonPlaceholder: string;
  revoked: string;
  role: string;
  save: string;
  scope: string;
  status: string;
  suspended: string;
  title: string;
}

export const ADMIN_DIRECTORY_COPY: Readonly<Record<AppLocale, AdminDirectoryCopy>> = Object.freeze({
  en: {
    account: "Account",
    actions: "Manage",
    active: "Active",
    approveAccounts: "Review pending accounts",
    description:
      "Review active administrator assignments in your server-approved scope and change role or access status with an audit reason.",
    displayName: "Name",
    email: "Email",
    eyebrow: "Accounts and permissions",
    invited: "Invited",
    noEmail: "Auth email unavailable",
    reason: "Change reason",
    reasonPlaceholder: "Enter the operating reason for this permission change.",
    revoked: "Revoked",
    role: "Role",
    save: "Save assignment",
    scope: "Assigned scope",
    status: "Access status",
    suspended: "Suspended",
    title: "Manage who can operate each approved workspace",
  },
  ko: {
    account: "계정",
    actions: "관리",
    active: "사용 중",
    approveAccounts: "가입 승인 대기 계정 보기",
    description:
      "서버가 승인한 범위의 관리자 배정을 확인하고, 운영 사유를 남긴 뒤 역할과 접근 상태를 변경합니다.",
    displayName: "이름",
    email: "이메일",
    eyebrow: "계정·권한",
    invited: "초대됨",
    noEmail: "인증 이메일 확인 불가",
    reason: "변경 사유",
    reasonPlaceholder: "권한 변경의 운영 근거를 입력하세요.",
    revoked: "권한 해제",
    role: "역할",
    save: "권한 저장",
    scope: "담당 범위",
    status: "접근 상태",
    suspended: "일시 중지",
    title: "승인된 업무 공간별 운영 권한을 관리하세요",
  },
});
