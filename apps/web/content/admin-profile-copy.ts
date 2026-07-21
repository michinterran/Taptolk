import type { AppLocale } from "../i18n/config";

export interface AdminProfileCopy {
  description: string;
  displayName: string;
  email: string;
  emailHelp: string;
  eyebrow: string;
  reason: string;
  reasonPlaceholder: string;
  role: string;
  save: string;
  scope: string;
  status: string;
  title: string;
}

export const ADMIN_PROFILE_COPY: Readonly<Record<AppLocale, AdminProfileCopy>> = Object.freeze({
  en: {
    description:
      "Update the name shown in the operations console. Role and scope remain server-managed assignments.",
    displayName: "Display name",
    email: "Sign-in email",
    emailHelp: "Email changes require a separate verified authentication flow.",
    eyebrow: "My account",
    reason: "Change reason",
    reasonPlaceholder: "Enter why this profile information is changing.",
    role: "Current role",
    save: "Save profile",
    scope: "Current scope",
    status: "Profile status",
    title: "Keep your administrator profile current",
  },
  ko: {
    description:
      "운영 콘솔에 표시되는 이름을 수정합니다. 역할과 담당 범위는 서버에서 승인된 배정으로 유지됩니다.",
    displayName: "표시 이름",
    email: "로그인 이메일",
    emailHelp: "이메일 변경은 별도의 인증 확인 절차가 필요합니다.",
    eyebrow: "내 계정",
    reason: "변경 사유",
    reasonPlaceholder: "프로필 정보를 변경하는 이유를 입력하세요.",
    role: "현재 역할",
    save: "프로필 저장",
    scope: "현재 담당 범위",
    status: "프로필 상태",
    title: "관리자 계정 정보를 최신 상태로 유지하세요",
  },
});
