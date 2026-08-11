import type { AppLocale } from "../i18n/config";

export interface AdminCompanyWorkspaceCopy {
  addInformation: string;
  activeContracts: string;
  activeQr: string;
  applyFilters: string;
  address: string;
  administrators: string;
  allCompanies: string;
  batches: string;
  businessNumber: string;
  businessNumberRegistered: string;
  cancel: string;
  capacity: string;
  clearFilters: string;
  changeReason: string;
  companyInformation: string;
  companyInformationDescription: string;
  companyName: string;
  companyWorkspace: string;
  contactEmail: string;
  contactInformation: string;
  contactInformationDescription: string;
  contactName: string;
  contactPhone: string;
  contactPhoneRegistered: string;
  close: string;
  edit: string;
  editCompany: string;
  editCompanyDescription: string;
  generatedQr: string;
  locationHealth: string;
  locationHealthDescription: string;
  locationName: string;
  locations: string;
  managementCode: string;
  manageAccounts: string;
  manageQr: string;
  notRegistered: string;
  noLocations: string;
  operations: string;
  operationsManagerEmail: string;
  operationsManagerName: string;
  operationsManagerPhone: string;
  qrActivation: string;
  outputReadyBatches: string;
  pendingActivation: string;
  next: string;
  page: string;
  pageSizeLabel: string;
  paginationLabel: string;
  previous: string;
  reactivate: string;
  reason: string;
  reasonPlaceholder: string;
  registered: string;
  reports: string;
  representativePhone: string;
  save: string;
  searchSites: string;
  scopeNote: string;
  sensitiveUpdateHelp: string;
  status: string;
  statusActions: string;
  statusActionsDescription: string;
  suspend: string;
  totalQr: string;
  type: string;
  showing: string;
  viewQr: string;
  viewLocation: string;
  workspaceDescription: string;
}

export const ADMIN_COMPANY_WORKSPACE_COPY: Readonly<Record<AppLocale, AdminCompanyWorkspaceCopy>> =
  Object.freeze({
    en: {
      addInformation: "Add",
      activeContracts: "Active contracts",
      activeQr: "Active QR",
      applyFilters: "Apply",
      address: "Address",
      administrators: "Approved administrators",
      allCompanies: "All management companies",
      batches: "Issued QR batches",
      businessNumber: "Business registration number",
      businessNumberRegistered: "Business registration on file",
      cancel: "Cancel",
      capacity: "Vehicle capacity",
      clearFilters: "Clear",
      changeReason: "Change reason",
      companyInformation: "Company information",
      companyInformationDescription:
        "Contract identity and operating scope. Changes remain protected by server authorization and audit history.",
      companyName: "Management company",
      companyWorkspace: "Management company details",
      contactEmail: "Contact email",
      contactInformation: "Company contact information",
      contactInformationDescription:
        "Contact registration status for this management company. Phone values are not returned to the browser.",
      contactName: "Available contact",
      contactPhone: "Contact phone",
      contactPhoneRegistered: "Contact phone on file",
      close: "Close operations",
      edit: "Edit",
      editCompany: "Edit company information",
      editCompanyDescription:
        "The management code is server-assigned. Sensitive identifiers remain hidden; enter a new value only when replacing it.",
      generatedQr: "Generated QR",
      locationHealth: "Site operations",
      locationHealthDescription:
        "Review capacity, QR activation, issued batches, and operating status by site.",
      locationName: "Site",
      locations: "Sites",
      managementCode: "Management code",
      manageAccounts: "Account permissions",
      manageQr: "QR operations",
      notRegistered: "Not registered",
      noLocations: "No sites are connected yet.",
      operations: "Operations",
      operationsManagerEmail: "Operations manager email",
      operationsManagerName: "Operations manager",
      operationsManagerPhone: "Operations manager phone",
      qrActivation: "QR activation",
      outputReadyBatches: "Output-ready batches",
      pendingActivation: "Pending activation",
      next: "Next",
      page: "Page {current} of {total}",
      pageSizeLabel: "Rows",
      paginationLabel: "Site pagination",
      previous: "Previous",
      reactivate: "Reactivate",
      reason: "Decision reason",
      reasonPlaceholder: "Enter at least three characters for the change record.",
      registered: "Registered",
      reports: "Reports",
      representativePhone: "Representative phone",
      save: "Save changes",
      searchSites: "Search sites",
      scopeNote:
        "This view is read from the server-authorized company scope. Opening it does not grant company write permissions.",
      sensitiveUpdateHelp: "Leave blank to keep the existing protected value.",
      status: "Status",
      statusActions: "Operating status",
      statusActionsDescription:
        "Suspension can be resumed. Closing operations is permanent and remains audit protected.",
      suspend: "Suspend",
      totalQr: "Total QR",
      type: "Type",
      showing: "Showing {from}-{to} of {total} sites",
      viewQr: "Open",
      viewLocation: "Site details",
      workspaceDescription:
        "Review sites, QR readiness, approved users, and contract capacity for this management company.",
    },
    ko: {
      addInformation: "추가",
      activeContracts: "운영 계약",
      activeQr: "활성 QR",
      applyFilters: "적용",
      address: "주소",
      administrators: "승인 관리자",
      allCompanies: "전체 관리회사",
      batches: "발행 QR 묶음",
      businessNumber: "사업자등록번호",
      businessNumberRegistered: "사업자번호 등록 여부",
      cancel: "취소",
      capacity: "계약 차량 규모",
      clearFilters: "초기화",
      changeReason: "변경 근거",
      companyInformation: "관리회사 정보",
      companyInformationDescription:
        "계약 식별 정보와 운영 범위입니다. 변경은 서버 권한 확인과 감사 기록을 그대로 적용합니다.",
      companyName: "관리회사",
      companyWorkspace: "관리회사 상세",
      contactEmail: "담당자 이메일",
      contactInformation: "관리회사 연락 정보",
      contactInformationDescription:
        "이 관리회사의 대표번호와 담당자 등록 상태입니다. 연락번호는 브라우저로 다시 표시하지 않습니다.",
      contactName: "연락 가능 담당자",
      contactPhone: "담당자 연락번호",
      contactPhoneRegistered: "담당자 연락번호 등록 여부",
      close: "운영 종료",
      edit: "수정",
      editCompany: "관리회사 정보 수정",
      editCompanyDescription:
        "관리번호는 서버 자동 부여값입니다. 민감 식별값은 숨김 유지하고 교체할 때만 새 값을 입력합니다.",
      generatedQr: "생성된 QR",
      locationHealth: "사이트 운영 현황",
      locationHealthDescription:
        "사이트별 계약 규모, QR 활성화, 발행 묶음과 운영 상태를 확인합니다.",
      locationName: "사이트",
      locations: "사이트",
      managementCode: "관리번호",
      manageAccounts: "계정·권한",
      manageQr: "QR 운영 관리",
      notRegistered: "미등록",
      noLocations: "연결된 사이트가 아직 없습니다.",
      operations: "운영 모니터링",
      operationsManagerEmail: "운영 책임자 이메일",
      operationsManagerName: "운영 책임자",
      operationsManagerPhone: "운영 책임자 연락번호",
      qrActivation: "QR 활성화율",
      outputReadyBatches: "출력 준비 묶음",
      pendingActivation: "활성화 대기",
      next: "다음",
      page: "{current} / {total} 페이지",
      pageSizeLabel: "표시 행",
      paginationLabel: "사이트 페이지 이동",
      previous: "이전",
      reactivate: "운영 재개",
      reason: "변경 근거",
      reasonPlaceholder: "변경 기록에 남길 근거를 3자 이상 입력해 주세요.",
      registered: "등록됨",
      reports: "리포트",
      representativePhone: "대표 연락번호",
      save: "변경 저장",
      searchSites: "사이트 검색",
      scopeNote:
        "서버가 승인한 관리회사 범위를 조회합니다. 이 화면을 여는 것만으로 관리회사 쓰기 권한이 부여되지는 않습니다.",
      sensitiveUpdateHelp: "미입력 시 기존 보호 값을 유지합니다.",
      status: "운영 상태",
      statusActions: "운영 상태 관리",
      statusActionsDescription:
        "일시 중지는 재개할 수 있습니다. 운영 종료는 복구할 수 없고 감사 기록으로 남습니다.",
      suspend: "일시 중지",
      totalQr: "전체 QR",
      type: "유형",
      showing: "{total}개 중 {from}-{to}개 사이트",
      viewQr: "열기",
      viewLocation: "사이트 상세",
      workspaceDescription:
        "이 관리회사의 사이트, QR 준비도, 승인 계정과 계약 운영 규모를 확인합니다.",
    },
  });
