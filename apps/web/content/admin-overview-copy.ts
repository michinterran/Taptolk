import type { AppLocale } from "../i18n/config";

export interface AdminOverviewCopy {
  actionApprovals: string;
  actionApprovalsDescription: string;
  actionCustomers: string;
  actionCustomersDescription: string;
  actionManagementCompanies: string;
  actionManagementCompaniesDescription: string;
  actionOperations: string;
  actionOperationsDescription: string;
  actionQr: string;
  actionQrDescription: string;
  actionSites: string;
  actionSitesDescription: string;
  actionsDescription: string;
  actionsTitle: string;
  activeQr: string;
  attentionDescription: string;
  attentionTitle: string;
  batches: string;
  contactCount: string;
  escalated: string;
  failedNotifications: string;
  freshAt: string;
  healthyDescription: string;
  healthyTitle: string;
  medianResponse: string;
  noResponseData: string;
  openReports: string;
  overviewDescription: string;
  overviewTitle: string;
  platformDescription: string;
  platformEyebrow: string;
  platformLine1: string;
  platformLine2: string;
  scopeNotice: string;
  seconds: string;
  sentNotifications: string;
  siteCount: string;
  statusAttention: string;
  statusHealthy: string;
  unresolved: string;
  workspaceDescription: string;
  workspaceEyebrow: string;
  workspaceLine1: string;
  workspaceLine2: string;
}

export const ADMIN_OVERVIEW_COPY: Readonly<Record<AppLocale, AdminOverviewCopy>> = Object.freeze({
  en: {
    actionApprovals: "Account approvals",
    actionApprovalsDescription: "Review new administrator accounts and assign approved roles.",
    actionCustomers: "Customer organizations",
    actionCustomersDescription: "Review the top-level contract and isolation boundaries.",
    actionManagementCompanies: "Management companies",
    actionManagementCompaniesDescription: "Manage contracted operators and their service scope.",
    actionOperations: "Operations status",
    actionOperationsDescription: "Inspect contact, delivery, safety, and QR signals.",
    actionQr: "QR production and inventory",
    actionQrDescription: "Manage approval, production progress, intake, and assignment.",
    actionSites: "Sites",
    actionSitesDescription: "Manage the sites available within the approved scope.",
    actionsDescription: "Continue with the most common tasks for this role.",
    actionsTitle: "Workspace shortcuts",
    activeQr: "Active QR assets",
    attentionDescription: "These live signals may require an operator decision.",
    attentionTitle: "Items needing attention",
    batches: "Completed QR batches",
    contactCount: "Contact requests · 24h",
    escalated: "Site office alerts",
    failedNotifications: "Final delivery failures",
    freshAt: "Data refreshed",
    healthyDescription: "There are no unresolved, escalated, failed, or open-review signals.",
    healthyTitle: "No immediate action is required",
    medianResponse: "Median owner response",
    noResponseData: "No response data",
    openReports: "Open reports",
    overviewDescription: "Live totals from the scope approved for this account.",
    overviewTitle: "Operations at a glance",
    platformDescription:
      "Monitor service operations and move directly to the customer, site, QR, and access work that needs attention.",
    platformEyebrow: "Taptolk platform operations",
    platformLine1: "See the service clearly,",
    platformLine2: "then act on what matters.",
    scopeNotice: "All figures are limited by the server-approved role and data scope.",
    seconds: "s",
    sentNotifications: "Sent or delivered",
    siteCount: "Operating sites",
    statusAttention: "Review",
    statusHealthy: "Stable",
    unresolved: "Unresolved requests",
    workspaceDescription:
      "Manage QR inventory and vehicle-contact operations for the sites approved under your company.",
    workspaceEyebrow: "Management company workspace",
    workspaceLine1: "Run today’s site operations",
    workspaceLine2: "from one clear workspace.",
  },
  ko: {
    actionApprovals: "계정 승인",
    actionApprovalsDescription: "신규 관리자 계정을 검토하고 승인된 역할을 부여합니다.",
    actionCustomers: "고객사",
    actionCustomersDescription: "계약과 데이터 격리의 최상위 고객 범위를 확인합니다.",
    actionManagementCompanies: "관리회사",
    actionManagementCompaniesDescription: "계약된 운영 주체와 서비스 범위를 관리합니다.",
    actionOperations: "운영 현황",
    actionOperationsDescription: "차량 연락, 알림 전달, 안전 검토와 QR 신호를 확인합니다.",
    actionQr: "QR 제작·재고",
    actionQrDescription: "승인, 제작 진행, 입고와 차량 배정까지 관리합니다.",
    actionSites: "사업장",
    actionSitesDescription: "승인된 범위에서 운영할 사업장을 관리합니다.",
    actionsDescription: "현재 역할에서 자주 수행하는 업무로 바로 이동합니다.",
    actionsTitle: "주요 업무",
    activeQr: "활성 QR",
    attentionDescription: "운영 담당자의 확인이나 판단이 필요한 실시간 신호입니다.",
    attentionTitle: "확인이 필요한 항목",
    batches: "제작 완료 QR Batch",
    contactCount: "차량 연락 요청 · 24시간",
    escalated: "관리사무소 알림",
    failedNotifications: "알림 최종 실패",
    freshAt: "데이터 기준 시각",
    healthyDescription: "미해결 요청, 관리사무소 알림, 전송 실패와 미처리 신고가 없습니다.",
    healthyTitle: "지금 바로 처리할 항목이 없습니다",
    medianResponse: "차주 응답 중앙값",
    noResponseData: "응답 데이터 없음",
    openReports: "미처리 신고",
    overviewDescription: "이 계정에 승인된 범위의 실제 운영 집계를 보여줍니다.",
    overviewTitle: "운영 한눈에 보기",
    platformDescription:
      "서비스 운영 상태를 확인하고 고객사, 사업장, QR, 계정 업무 중 필요한 작업으로 바로 이동합니다.",
    platformEyebrow: "Taptolk 플랫폼 운영",
    platformLine1: "전체 서비스의 흐름을 보고,",
    platformLine2: "필요한 운영을 바로 처리합니다.",
    scopeNotice: "모든 수치는 서버가 승인한 역할과 데이터 범위 안에서만 집계됩니다.",
    seconds: "초",
    sentNotifications: "전송·도달",
    siteCount: "운영 사업장",
    statusAttention: "확인 필요",
    statusHealthy: "안정",
    unresolved: "미해결 요청",
    workspaceDescription:
      "계약 회사에 승인된 사업장의 QR 재고와 차량 연락 운영을 한곳에서 관리합니다.",
    workspaceEyebrow: "관리회사 운영 공간",
    workspaceLine1: "오늘의 사업장 운영을,",
    workspaceLine2: "한눈에 보고 처리합니다.",
  },
});
