import type { AdminDirectoryChangeAction } from "@taptolk/application";
import type { AdminRole } from "@taptolk/domain";
import type { AppLocale } from "../i18n/config";

export interface AdminDirectoryCopy {
  account: string;
  actions: string;
  active: string;
  approveAccounts: string;
  allRoles: string;
  allScopes: string;
  allStatuses: string;
  ascending: string;
  cancel: string;
  cancelInvitation: string;
  close: string;
  created: string;
  description: string;
  descending: string;
  displayName: string;
  email: string;
  eyebrow: string;
  emptyResults: string;
  invited: string;
  invitationActions: string;
  invitationPending: string;
  invitationCancelReasonPlaceholder: string;
  lastChange: string;
  lastChangeActions: Readonly<Record<AdminDirectoryChangeAction, string>>;
  managementCompany: string;
  next: string;
  noEmail: string;
  noChange: string;
  noScopeTarget: string;
  permissionEdit: string;
  previous: string;
  reason: string;
  reasonPlaceholder: string;
  reset: string;
  resultSummary: string;
  revoked: string;
  role: string;
  roleDescriptions: Readonly<Record<AdminRole, string>>;
  save: string;
  search: string;
  searchPlaceholder: string;
  scope: string;
  scopeTarget: string;
  sort: string;
  sortCreated: string;
  sortName: string;
  sortRole: string;
  sortStatus: string;
  status: string;
  suspended: string;
  service: string;
  serviceAdmin: string;
  serviceSuperAdmin: string;
  site: string;
  title: string;
  designatedAdmin: string;
  updated: string;
}

export const ADMIN_DIRECTORY_COPY: Readonly<Record<AppLocale, AdminDirectoryCopy>> = Object.freeze({
  en: {
    account: "Account",
    actions: "Manage",
    active: "Active",
    approveAccounts: "Review pending accounts",
    allRoles: "All roles",
    allScopes: "All scopes",
    allStatuses: "All statuses",
    ascending: "Ascending",
    cancel: "Cancel",
    cancelInvitation: "Cancel invitation",
    close: "Close",
    created: "Created",
    description:
      "Review active administrator assignments in your server-approved scope and change role or access status with an audit reason.",
    descending: "Descending",
    displayName: "Name",
    email: "Email",
    eyebrow: "Accounts and permissions",
    emptyResults: "No accounts match the current filters.",
    invited: "Invited",
    invitationActions: "Manage invitation",
    invitationPending:
      "This account has not accepted the invitation yet. Cancel it here, then send a new invitation if the assigned scope needs to change.",
    invitationCancelReasonPlaceholder: "Enter why this invitation should be cancelled.",
    lastChange: "Last change",
    lastChangeActions: {
      ADMIN_ACCOUNT_APPROVED: "Account approved",
      ADMIN_ACCOUNT_INVITATION_ACCEPTED: "Invitation accepted",
      ADMIN_ACCOUNT_INVITED: "Invitation sent",
      ADMIN_ACCOUNT_REJECTED: "Account rejected",
      ADMIN_MEMBERSHIP_ASSIGNMENT_UPDATED: "Assignment updated",
    },
    managementCompany: "Management company",
    next: "Next",
    noEmail: "Auth email unavailable",
    noChange: "No recorded change",
    noScopeTarget: "Scope target unavailable",
    permissionEdit: "Edit permissions",
    previous: "Previous",
    reason: "Change reason",
    reasonPlaceholder: "Enter the operating reason for this permission change.",
    reset: "Reset",
    resultSummary: "Showing {from}-{to} of {total}",
    revoked: "Revoked",
    role: "Role",
    roleDescriptions: {
      MANAGEMENT_ADMIN: "Manages approved management-company operations.",
      PLATFORM_OPERATOR: "Operates approved platform-wide services.",
      READ_ONLY: "Can view assigned operational data.",
      SITE_ADMIN: "Manages the assigned site operations.",
      SITE_OPERATOR: "Handles day-to-day work at the assigned site.",
      SUPER_ADMIN: "Controls platform administration and approvals.",
    },
    save: "Save assignment",
    search: "Search",
    searchPlaceholder: "Search name, email, company, or site",
    scope: "Assigned scope",
    scopeTarget: "Scope target",
    sort: "Sort",
    sortCreated: "Created date",
    sortName: "Name",
    sortRole: "Role",
    sortStatus: "Status",
    status: "Access status",
    suspended: "Suspended",
    service: "Taptolk service",
    serviceAdmin: "Admin",
    serviceSuperAdmin: "Super Admin",
    site: "Site",
    title: "Accounts and permissions",
    designatedAdmin: "Designated admin",
    updated: "The account permission change was saved.",
  },
  ko: {
    account: "계정",
    actions: "관리",
    active: "사용 중",
    approveAccounts: "가입 승인 대기 계정 보기",
    allRoles: "전체 역할",
    allScopes: "전체 범위",
    allStatuses: "전체 상태",
    ascending: "오름차순",
    cancel: "취소",
    cancelInvitation: "초대 취소",
    close: "닫기",
    created: "생성일",
    description:
      "서버가 승인한 범위의 관리자 배정을 확인하고, 운영 사유를 남긴 뒤 역할과 접근 상태를 변경합니다.",
    descending: "내림차순",
    displayName: "이름",
    email: "이메일",
    eyebrow: "계정·권한",
    emptyResults: "현재 필터 조건에 맞는 계정이 없습니다.",
    invited: "초대됨",
    invitationActions: "초대 관리",
    invitationPending:
      "아직 초대를 수락하지 않은 계정입니다. 담당 범위를 바꾸려면 먼저 초대를 취소한 뒤 새 초대를 보내세요.",
    invitationCancelReasonPlaceholder: "이 초대를 취소하는 운영 사유를 입력하세요.",
    lastChange: "최근 변경",
    lastChangeActions: {
      ADMIN_ACCOUNT_APPROVED: "가입 승인",
      ADMIN_ACCOUNT_INVITATION_ACCEPTED: "초대 수락",
      ADMIN_ACCOUNT_INVITED: "초대 발송",
      ADMIN_ACCOUNT_REJECTED: "가입 거절",
      ADMIN_MEMBERSHIP_ASSIGNMENT_UPDATED: "권한 배정 변경",
    },
    managementCompany: "관리회사",
    next: "다음",
    noEmail: "인증 이메일 확인 불가",
    noChange: "기록된 변경 없음",
    noScopeTarget: "범위 대상 확인 불가",
    permissionEdit: "권한 수정",
    previous: "이전",
    reason: "변경 사유",
    reasonPlaceholder: "권한 변경의 운영 근거를 입력하세요.",
    reset: "초기화",
    resultSummary: "전체 {total}개 중 {from}-{to}개",
    revoked: "권한 해제",
    role: "역할",
    roleDescriptions: {
      MANAGEMENT_ADMIN: "승인된 관리회사 운영 범위를 관리합니다.",
      PLATFORM_OPERATOR: "승인된 플랫폼 전체 운영을 담당합니다.",
      READ_ONLY: "지정된 운영 데이터를 조회할 수 있습니다.",
      SITE_ADMIN: "지정된 사이트 운영을 관리합니다.",
      SITE_OPERATOR: "지정된 사이트의 일상 운영을 처리합니다.",
      SUPER_ADMIN: "플랫폼 관리와 가입 승인을 총괄합니다.",
    },
    save: "권한 저장",
    search: "검색",
    searchPlaceholder: "이름, 이메일, 관리회사 또는 사이트 검색",
    scope: "담당 범위",
    scopeTarget: "범위 대상",
    sort: "정렬",
    sortCreated: "생성일",
    sortName: "이름",
    sortRole: "역할",
    sortStatus: "상태",
    status: "접근 상태",
    suspended: "일시 중지",
    service: "Taptolk 서비스사",
    serviceAdmin: "Admin",
    serviceSuperAdmin: "슈퍼어드민",
    site: "사이트",
    title: "계정·권한",
    designatedAdmin: "지정 관리자",
    updated: "계정 권한 변경이 저장되었습니다.",
  },
});
