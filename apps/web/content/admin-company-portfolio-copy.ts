import type { AppLocale } from "../i18n/config";

export interface AdminCompanyPortfolioCopy {
  activeQr: string;
  activeCompanies: string;
  allSummary: string;
  allStatuses: string;
  applyFilters: string;
  capacity: string;
  capacityUsage: string;
  clearFilters: string;
  companyColumnTitle: string;
  companyPortfolio: string;
  companyPortfolioDescription: string;
  companySearch: string;
  contractActive: string;
  contractEnd: string;
  contractExpired: string;
  contractExpiring: string;
  expiredSummary: string;
  expiringWindow: string;
  contractHealth: string;
  contractStatusActive: string;
  contractStatusDraft: string;
  contractStatusExpired: string;
  contractStatusSuspended: string;
  contractStatusTerminated: string;
  contractStatus: string;
  currentPageActive: string;
  currentPageQr: string;
  currentPageSites: string;
  decisionQueue: string;
  decisionQueueDescription: string;
  decisionQueueEmptyDescription: string;
  decisionQueueEmptyTitle: string;
  detailColumnTitle: string;
  details: string;
  directOperation: string;
  healthGood: string;
  healthNeedsAttention: string;
  hierarchyLabel: string;
  lowRiskCompanies: string;
  lowRiskRatio: string;
  noContract: string;
  noResponseData: string;
  pageSize: string;
  planStatus: string;
  portfolioDescription: string;
  portfolioTitle: string;
  qrActivationRate: string;
  responseGood: string;
  responseLow: string;
  responseNormal: string;
  responseQuality: string;
  resultCompanies: string;
  reviewItemLabel: string;
  riskGood: string;
  riskNormal: string;
  riskRisk: string;
  riskWatch: string;
  scopeAll: string;
  scopeManageCurrent: string;
  scopeManageRange: string;
  scopePanelTitle: string;
  scopeSearch: string;
  selectedCompanyEmpty: string;
  siteColumnTitle: string;
  siteCapacity: string;
  siteDetailAction: string;
  sites: string;
  statusFilter: string;
  totalCompanies: string;
  unresolved: string;
}

export const ADMIN_COMPANY_PORTFOLIO_COPY: Readonly<Record<AppLocale, AdminCompanyPortfolioCopy>> =
  Object.freeze({
    en: {
      activeQr: "Active QR",
      activeCompanies: "Active companies",
      allSummary: "Total",
      allStatuses: "All statuses",
      applyFilters: "Apply",
      capacity: "Vehicle capacity",
      capacityUsage: "Capacity usage",
      clearFilters: "Reset",
      companyColumnTitle: "Management companies",
      companyPortfolio: "Customer management",
      companyPortfolioDescription:
        "Review each management company, its managed locations, QR activation, and approved operating capacity.",
      companySearch: "Search by management company name",
      contractActive: "Active contracts",
      contractEnd: "Contract end",
      contractExpired: "Expired contracts",
      contractExpiring: "Expiring soon",
      expiredSummary: "Expired",
      expiringWindow: "Within 30 days",
      contractHealth: "Risk level",
      contractStatusActive: "Active",
      contractStatusDraft: "Draft",
      contractStatusExpired: "Expired",
      contractStatusSuspended: "Suspended",
      contractStatusTerminated: "Terminated",
      contractStatus: "Contract status",
      currentPageActive: "Active on this page",
      currentPageQr: "Active QR on this page",
      currentPageSites: "Sites on this page",
      decisionQueue: "Review queue",
      decisionQueueDescription:
        "Management companies in the current result that are suspended or closed.",
      decisionQueueEmptyDescription:
        "No suspended or closed management companies appear in the current result.",
      decisionQueueEmptyTitle: "No company needs status review",
      detailColumnTitle: "Operating detail",
      details: "View details",
      directOperation: "Direct Taptolk operation",
      healthGood: "Good",
      healthNeedsAttention: "Attention",
      hierarchyLabel: "Management company > Site",
      lowRiskCompanies: "Healthy customers",
      lowRiskRatio: "{ratio}%",
      noContract: "No contract",
      noResponseData: "No data",
      pageSize: "10 per page",
      planStatus: "Plan / status",
      portfolioDescription:
        "Monitor contracts, capacity, response quality, and risk so operators can act quickly.",
      portfolioTitle: "Customer management",
      qrActivationRate: "QR activation",
      responseGood: "Good",
      responseLow: "Low",
      responseNormal: "Normal",
      responseQuality: "Response quality",
      resultCompanies: "Companies in result",
      reviewItemLabel: "Risk level review",
      riskGood: "Good",
      riskNormal: "Normal",
      riskRisk: "Risk",
      riskWatch: "Watch",
      scopeAll: "All platforms",
      scopeManageCurrent: "Review current scope",
      scopeManageRange: "Manage scope",
      scopePanelTitle: "Management company dashboard",
      scopeSearch: "Search company and site",
      selectedCompanyEmpty: "Select a management company to review its sites and operating detail.",
      siteColumnTitle: "Site scope",
      siteCapacity: "Site vehicle capacity",
      siteDetailAction: "Open site catalog",
      sites: "Sites",
      statusFilter: "Filter by operating status",
      totalCompanies: "Companies",
      unresolved: "Unresolved",
    },
    ko: {
      activeQr: "활성 QR",
      activeCompanies: "운영 중 회사",
      allSummary: "전체",
      allStatuses: "전체 상태",
      applyFilters: "조회",
      capacity: "계약 차량 규모",
      capacityUsage: "차량 용량 사용률",
      clearFilters: "초기화",
      companyColumnTitle: "관리회사",
      companyPortfolio: "고객관리",
      companyPortfolioDescription:
        "관리회사별 사이트, 용량 사용률, 응답 품질, 계약 리스크를 한 표에서 확인합니다.",
      companySearch: "관리사·사이트명 검색",
      contractActive: "계약 중",
      contractEnd: "계약 만료일",
      contractExpired: "계약 만료",
      contractExpiring: "계약 만료 임박",
      expiredSummary: "만료됨",
      expiringWindow: "30일 이내",
      contractHealth: "리스크 등급",
      contractStatusActive: "계약",
      contractStatusDraft: "초안",
      contractStatusExpired: "만료",
      contractStatusSuspended: "중지",
      contractStatusTerminated: "종료",
      contractStatus: "계약 상태",
      currentPageActive: "현재 페이지 운영 중",
      currentPageQr: "현재 페이지 활성 QR",
      currentPageSites: "현재 페이지 사이트",
      decisionQueue: "검토 큐",
      decisionQueueDescription: "현재 조회 결과에서 일시 중지 또는 종료된 관리회사입니다.",
      decisionQueueEmptyDescription:
        "현재 조회 결과에는 일시 중지 또는 종료 상태의 관리회사가 없습니다.",
      decisionQueueEmptyTitle: "상태 검토가 필요한 회사가 없습니다",
      detailColumnTitle: "운영 상세",
      details: "상세 보기",
      directOperation: "Taptolk 직접 운영",
      healthGood: "양호",
      healthNeedsAttention: "주의",
      hierarchyLabel: "관리회사 > 사이트",
      lowRiskCompanies: "건강한 고객",
      lowRiskRatio: "{ratio}%",
      noContract: "계약 미등록",
      noResponseData: "미집계",
      pageSize: "페이지당 10개",
      planStatus: "플랜/상태",
      portfolioDescription:
        "계약, 용량, 응답 품질, 리스크를 모니터링하고 필요한 조치를 빠르게 취하세요.",
      portfolioTitle: "고객관리",
      qrActivationRate: "QR 활성화율",
      responseGood: "좋음",
      responseLow: "낮음",
      responseNormal: "보통",
      responseQuality: "응답 품질",
      resultCompanies: "조회 결과 관리회사",
      reviewItemLabel: "리스크 등급 검토",
      riskGood: "양호",
      riskNormal: "보통",
      riskRisk: "위험",
      riskWatch: "주의",
      scopeAll: "전체 플랫폼",
      scopeManageCurrent: "현재 범위 확인",
      scopeManageRange: "현재 범위 관리·수정",
      scopePanelTitle: "관리회사 대시보드",
      scopeSearch: "관리회사·사이트 검색",
      selectedCompanyEmpty: "관리회사를 선택하면 사이트와 운영 상세를 확인할 수 있습니다.",
      siteColumnTitle: "사이트 운영 범위",
      siteCapacity: "사이트 차량 용량",
      siteDetailAction: "사이트 목록 열기",
      sites: "사이트",
      statusFilter: "운영 상태 필터",
      totalCompanies: "관리사",
      unresolved: "미해결",
    },
  });
