import type { AppLocale } from "../i18n/config";

export interface AdminCompanyPortfolioCopy {
  activeQr: string;
  activeCompanies: string;
  capacity: string;
  companyPortfolio: string;
  companyPortfolioDescription: string;
  companySearch: string;
  contractHealth: string;
  details: string;
  healthGood: string;
  healthNeedsAttention: string;
  portfolioDescription: string;
  portfolioTitle: string;
  sites: string;
  totalCompanies: string;
}

export const ADMIN_COMPANY_PORTFOLIO_COPY: Readonly<Record<AppLocale, AdminCompanyPortfolioCopy>> =
  Object.freeze({
    en: {
      activeQr: "Active QR",
      activeCompanies: "Active companies",
      capacity: "Vehicle capacity",
      companyPortfolio: "Company portfolio",
      companyPortfolioDescription:
        "Review each management company, its managed locations, QR activation, and approved operating capacity.",
      companySearch: "Search by management company name",
      contractHealth: "Operating health",
      details: "View workspace",
      healthGood: "Healthy",
      healthNeedsAttention: "Review",
      portfolioDescription:
        "Move from a management company to its locations, QR inventory, operations, and account scope without exposing internal customer identifiers.",
      portfolioTitle: "Manage companies and locations in one hierarchy",
      sites: "Managed locations",
      totalCompanies: "Management companies",
    },
    ko: {
      activeQr: "활성 QR",
      activeCompanies: "운영 중 회사",
      capacity: "계약 차량 규모",
      companyPortfolio: "관리회사 포트폴리오",
      companyPortfolioDescription:
        "관리회사별 관리 현장, QR 활성화, 승인된 운영 규모를 한 표에서 확인합니다.",
      companySearch: "관리회사명 검색",
      contractHealth: "운영 상태",
      details: "통합 현황 보기",
      healthGood: "양호",
      healthNeedsAttention: "확인 필요",
      portfolioDescription:
        "내부 고객 식별자를 노출하지 않고 관리회사에서 관리 현장, QR, 운영, 계정 범위로 이어지는 구조를 관리합니다.",
      portfolioTitle: "관리회사와 관리 현장을 하나의 체계로 관리합니다",
      sites: "관리 현장",
      totalCompanies: "전체 관리회사",
    },
  });
