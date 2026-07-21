import type { AppLocale } from "../i18n/config";

export interface AdminCompanyWorkspaceCopy {
  activeContracts: string;
  activeQr: string;
  administrators: string;
  allCompanies: string;
  batches: string;
  businessNumber: string;
  capacity: string;
  companyInformation: string;
  companyInformationDescription: string;
  companyWorkspace: string;
  locationHealth: string;
  locationName: string;
  locations: string;
  manageAccounts: string;
  manageQr: string;
  noLocations: string;
  operations: string;
  qrActivation: string;
  reports: string;
  scopeNote: string;
  status: string;
  totalQr: string;
  type: string;
  viewLocation: string;
  workspaceDescription: string;
}

export const ADMIN_COMPANY_WORKSPACE_COPY: Readonly<Record<AppLocale, AdminCompanyWorkspaceCopy>> =
  Object.freeze({
    en: {
      activeContracts: "Active contracts",
      activeQr: "Active QR",
      administrators: "Approved administrators",
      allCompanies: "All management companies",
      batches: "Production batches",
      businessNumber: "Business registration",
      capacity: "Vehicle capacity",
      companyInformation: "Company information",
      companyInformationDescription:
        "Contract identity and operating scope. Changes remain protected by server authorization and audit history.",
      companyWorkspace: "Management company workspace",
      locationHealth: "Location portfolio",
      locationName: "Managed location",
      locations: "Managed locations",
      manageAccounts: "Account permissions",
      manageQr: "QR production",
      noLocations: "No managed locations are connected yet.",
      operations: "Operations",
      qrActivation: "QR activation",
      reports: "Reports",
      scopeNote:
        "This view is read from the server-authorized company scope. Opening it does not grant company write permissions.",
      status: "Status",
      totalQr: "Total QR",
      type: "Type",
      viewLocation: "View location",
      workspaceDescription:
        "Review locations, QR readiness, approved users, and contract capacity for this management company.",
    },
    ko: {
      activeContracts: "운영 계약",
      activeQr: "활성 QR",
      administrators: "승인 관리자",
      allCompanies: "전체 관리회사",
      batches: "제작 묶음",
      businessNumber: "사업자번호",
      capacity: "계약 차량 규모",
      companyInformation: "관리회사 정보",
      companyInformationDescription:
        "계약 식별 정보와 운영 범위입니다. 변경은 서버 권한 확인과 감사 기록을 그대로 적용합니다.",
      companyWorkspace: "관리회사 통합 현황",
      locationHealth: "관리 현장 현황",
      locationName: "관리 현장",
      locations: "관리 현장",
      manageAccounts: "계정·권한",
      manageQr: "QR 제작",
      noLocations: "연결된 관리 현장이 아직 없습니다.",
      operations: "운영 모니터링",
      qrActivation: "QR 활성화율",
      reports: "리포트",
      scopeNote:
        "서버가 승인한 관리회사 범위를 조회합니다. 이 화면을 여는 것만으로 관리회사 쓰기 권한이 부여되지는 않습니다.",
      status: "운영 상태",
      totalQr: "전체 QR",
      type: "유형",
      viewLocation: "현장 상세",
      workspaceDescription:
        "이 관리회사의 현장, QR 준비도, 승인 계정과 계약 운영 규모를 확인합니다.",
    },
  });
