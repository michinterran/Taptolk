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
  actionReports: string;
  actionReportsDescription: string;
  actionRevenue: string;
  actionRevenueDescription: string;
  actionsDescription: string;
  actionsTitle: string;
  activeQr: string;
  approvalQueue: string;
  attentionDescription: string;
  attentionTitle: string;
  activationRate: string;
  batches: string;
  company: string;
  contactCount: string;
  contractCapacity: string;
  customerPortfolio: string;
  customerPortfolioDescription: string;
  customerPortfolioTitle: string;
  deliveryHealth: string;
  deliveryHealthDescription: string;
  escalated: string;
  failedNotifications: string;
  freshAt: string;
  healthyDescription: string;
  healthyTitle: string;
  locationHierarchy: string;
  locationHierarchyDescription: string;
  operationFlow: string;
  operationFlowDescription: string;
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
  tableAction: string;
  tableCustomers: string;
  tableHealth: string;
  tableLocations: string;
  tableName: string;
  tableOpenIssues: string;
  tableQrActivation: string;
  tableRequests: string;
  tenant: string;
  unresolved: string;
  viewDetails: string;
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
    actionReports: "Reports",
    actionReportsDescription: "Review trends, risks, and operating quality by approved scope.",
    actionRevenue: "Revenue management",
    actionRevenueDescription: "Track contract, production, and provider-cost readiness.",
    actionsDescription: "Priority queues and routing helpers for work that needs a decision.",
    actionsTitle: "Decision queue",
    activeQr: "Active QR assets",
    approvalQueue: "Approvals waiting",
    attentionDescription: "These live signals may require an operator decision.",
    attentionTitle: "Items needing attention",
    activationRate: "Activation rate",
    batches: "Completed QR batches",
    company: "Management company",
    contactCount: "Contact requests · 24h",
    contractCapacity: "Vehicle capacity",
    customerPortfolio: "Customer portfolio",
    customerPortfolioDescription:
      "Contract customers > management companies > managed locations are handled as one operating hierarchy.",
    customerPortfolioTitle: "Customer and contract status at a glance",
    deliveryHealth: "Delivery health",
    deliveryHealthDescription: "Sent, retrying, failed, and missing-cost signals from providers.",
    escalated: "Site office alerts",
    failedNotifications: "Final delivery failures",
    freshAt: "Data refreshed",
    healthyDescription: "There are no unresolved, escalated, failed, or open-review signals.",
    healthyTitle: "No immediate action is required",
    locationHierarchy: "Location hierarchy",
    locationHierarchyDescription:
      "Each management company can operate multiple apartments, buildings, villas, or parking locations.",
    operationFlow: "Vehicle-contact flow",
    operationFlowDescription: "Scan, request, owner response, delivery, and review signals.",
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
    tableAction: "Action",
    tableCustomers: "Customers",
    tableHealth: "Health",
    tableLocations: "Locations",
    tableName: "Area",
    tableOpenIssues: "Open issues",
    tableQrActivation: "QR activation",
    tableRequests: "Requests",
    tenant: "Contract customer",
    unresolved: "Unresolved requests",
    viewDetails: "View details",
    workspaceDescription:
      "Manage QR inventory and vehicle-contact operations for the sites approved under your company.",
    workspaceEyebrow: "Management company workspace",
    workspaceLine1: "Run today’s site operations",
    workspaceLine2: "from one clear workspace.",
  },
  ko: {
    actionApprovals: "계정·권한",
    actionApprovalsDescription: "신규 운영 계정 승인과 역할·범위 부여 상태를 관리합니다.",
    actionCustomers: "계약 고객",
    actionCustomersDescription: "계약과 데이터 격리의 최상위 고객 범위를 확인합니다.",
    actionManagementCompanies: "관리회사",
    actionManagementCompaniesDescription: "계약된 운영 주체와 서비스 범위를 관리합니다.",
    actionOperations: "운영 모니터링",
    actionOperationsDescription: "차량 연락, 알림 전달, 안전 검토와 QR 신호를 확인합니다.",
    actionQr: "QR 제작 관리",
    actionQrDescription: "디자인 선택, 제작 묶음 요청, 승인, 입고와 차량 배정까지 관리합니다.",
    actionSites: "관리 현장",
    actionSitesDescription: "아파트, 빌딩, 빌라 등 실제 운영 현장을 관리합니다.",
    actionReports: "리포트",
    actionReportsDescription: "운영 흐름, 응답 품질, 위험 신호와 QR 성과를 분석합니다.",
    actionRevenue: "매출 관리",
    actionRevenueDescription: "계약, 제작, 알림 비용과 청구 준비 상태를 확인합니다.",
    actionsDescription: "중복 메뉴가 아니라 실제 판단이 필요한 업무만 모아 보여줍니다.",
    actionsTitle: "처리 우선순위",
    activeQr: "활성 QR",
    approvalQueue: "승인 대기",
    attentionDescription: "운영 담당자의 확인이나 판단이 필요한 실시간 신호입니다.",
    attentionTitle: "확인이 필요한 항목",
    activationRate: "가동률",
    batches: "제작 완료 QR 묶음",
    company: "관리회사",
    contactCount: "차량 연락 요청 · 24시간",
    contractCapacity: "계약 차량 용량",
    customerPortfolio: "고객 포트폴리오",
    customerPortfolioDescription:
      "계약 고객 > 관리회사 > 관리 현장 구조로 운영 범위와 책임을 정리합니다.",
    customerPortfolioTitle: "고객과 계약 상태를 한눈에 관리하세요",
    deliveryHealth: "전송 품질",
    deliveryHealthDescription: "전송·재시도·실패·비용 누락 신호를 함께 봅니다.",
    escalated: "관리사무소 알림",
    failedNotifications: "알림 최종 실패",
    freshAt: "데이터 기준 시각",
    healthyDescription: "미해결 요청, 관리사무소 알림, 전송 실패와 미처리 신고가 없습니다.",
    healthyTitle: "지금 바로 처리할 항목이 없습니다",
    locationHierarchy: "관리 현장 구조",
    locationHierarchyDescription:
      "하나의 관리회사가 여러 아파트 단지, 빌딩, 빌라, 주차 구역을 운영할 수 있습니다.",
    operationFlow: "차량 연락 흐름",
    operationFlowDescription: "스캔, 요청, 차주 응답, 전송, 신고 상태를 한 흐름으로 봅니다.",
    medianResponse: "차주 응답 중앙값",
    noResponseData: "응답 데이터 없음",
    openReports: "미처리 신고",
    overviewDescription: "이 계정에 승인된 범위의 실제 운영 집계를 보여줍니다.",
    overviewTitle: "운영 한눈에 보기",
    platformDescription:
      "서비스 운영 상태를 확인하고 계약 고객, 관리회사, 관리 현장, QR, 계정 업무 중 필요한 작업으로 바로 이동합니다.",
    platformEyebrow: "Taptolk 플랫폼 운영",
    platformLine1: "전체 서비스의 흐름을 보고,",
    platformLine2: "필요한 운영을 바로 처리합니다.",
    scopeNotice: "모든 수치는 서버가 승인한 역할과 데이터 범위 안에서만 집계됩니다.",
    seconds: "초",
    sentNotifications: "전송·도달",
    siteCount: "운영 현장",
    statusAttention: "확인 필요",
    statusHealthy: "안정",
    tableAction: "작업",
    tableCustomers: "고객",
    tableHealth: "상태",
    tableLocations: "현장",
    tableName: "운영 영역",
    tableOpenIssues: "미처리",
    tableQrActivation: "QR 활성",
    tableRequests: "요청",
    tenant: "계약 고객",
    unresolved: "미해결 요청",
    viewDetails: "상세 보기",
    workspaceDescription:
      "계약 회사에 승인된 관리 현장의 QR 재고와 차량 연락 운영을 한곳에서 관리합니다.",
    workspaceEyebrow: "관리회사 운영 공간",
    workspaceLine1: "오늘의 관리 현장 운영을,",
    workspaceLine2: "한눈에 보고 처리합니다.",
  },
});
