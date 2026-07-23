import type { AppLocale } from "../i18n/config";

export interface AdminCompanyPortfolioCopy {
  activeQr: string;
  activeCompanies: string;
  allStatuses: string;
  applyFilters: string;
  capacity: string;
  clearFilters: string;
  companyPortfolio: string;
  companyPortfolioDescription: string;
  companySearch: string;
  contractHealth: string;
  currentPageActive: string;
  currentPageQr: string;
  currentPageSites: string;
  decisionQueue: string;
  decisionQueueDescription: string;
  decisionQueueEmptyDescription: string;
  decisionQueueEmptyTitle: string;
  details: string;
  healthGood: string;
  healthNeedsAttention: string;
  hierarchyLabel: string;
  portfolioDescription: string;
  portfolioTitle: string;
  resultCompanies: string;
  reviewItemLabel: string;
  sites: string;
  statusFilter: string;
  totalCompanies: string;
}

export const ADMIN_COMPANY_PORTFOLIO_COPY: Readonly<Record<AppLocale, AdminCompanyPortfolioCopy>> =
  Object.freeze({
    en: {
      activeQr: "Active QR",
      activeCompanies: "Active companies",
      allStatuses: "All statuses",
      applyFilters: "Apply",
      capacity: "Vehicle capacity",
      clearFilters: "Reset",
      companyPortfolio: "Customer management",
      companyPortfolioDescription:
        "Review each management company, its managed locations, QR activation, and approved operating capacity.",
      companySearch: "Search by management company name",
      contractHealth: "Risk level",
      currentPageActive: "Active on this page",
      currentPageQr: "Active QR on this page",
      currentPageSites: "Sites on this page",
      decisionQueue: "Review queue",
      decisionQueueDescription:
        "Management companies in the current result that are suspended or closed.",
      decisionQueueEmptyDescription:
        "No suspended or closed management companies appear in the current result.",
      decisionQueueEmptyTitle: "No company needs status review",
      details: "View workspace",
      healthGood: "Good",
      healthNeedsAttention: "Attention",
      hierarchyLabel: "Management company > Site",
      portfolioDescription:
        "Move from a management company to its locations, QR inventory, operations, and account scope without exposing internal customer identifiers.",
      portfolioTitle: "Manage companies and sites in one hierarchy",
      resultCompanies: "Companies in result",
      reviewItemLabel: "Risk level review",
      sites: "Sites",
      statusFilter: "Filter by operating status",
      totalCompanies: "Management companies",
    },
    ko: {
      activeQr: "활성 QR",
      activeCompanies: "운영 중 회사",
      allStatuses: "전체 상태",
      applyFilters: "조회",
      capacity: "계약 차량 규모",
      clearFilters: "초기화",
      companyPortfolio: "고객관리",
      companyPortfolioDescription:
        "관리회사별 사이트, QR 활성화, 승인된 운영 규모를 한 표에서 확인합니다.",
      companySearch: "관리회사명 검색",
      contractHealth: "리스크 등급",
      currentPageActive: "현재 페이지 운영 중",
      currentPageQr: "현재 페이지 활성 QR",
      currentPageSites: "현재 페이지 사이트",
      decisionQueue: "검토 큐",
      decisionQueueDescription: "현재 조회 결과에서 일시 중지 또는 종료된 관리회사입니다.",
      decisionQueueEmptyDescription:
        "현재 조회 결과에는 일시 중지 또는 종료 상태의 관리회사가 없습니다.",
      decisionQueueEmptyTitle: "상태 검토가 필요한 회사가 없습니다",
      details: "통합 현황 보기",
      healthGood: "양호",
      healthNeedsAttention: "주의",
      hierarchyLabel: "관리회사 > 사이트",
      portfolioDescription:
        "내부 고객 식별자를 노출하지 않고 관리회사에서 사이트, QR, 운영, 계정 범위로 이어지는 구조를 관리합니다.",
      portfolioTitle: "관리회사와 사이트를 하나의 체계로 관리합니다",
      resultCompanies: "조회 결과 관리회사",
      reviewItemLabel: "리스크 등급 검토",
      sites: "사이트",
      statusFilter: "운영 상태 필터",
      totalCompanies: "전체 관리회사",
    },
  });
