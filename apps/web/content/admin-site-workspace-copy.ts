import type { AppLocale } from "../i18n/config";

export interface AdminSiteWorkspaceCopy {
  activeQr: string;
  address: string;
  allLocations: string;
  batchHistory: string;
  batchHistoryDescription: string;
  batchRequest: string;
  capacity: string;
  contactRequests: string;
  failedNotifications: string;
  locationInformation: string;
  locationWorkspace: string;
  noAddress: string;
  noBatches: string;
  openRequests: string;
  operations: string;
  qrProduction: string;
  quantity: string;
  reports: string;
  status: string;
  totalQr: string;
  type: string;
  workspaceDescription: string;
}

export const ADMIN_SITE_WORKSPACE_COPY: Readonly<Record<AppLocale, AdminSiteWorkspaceCopy>> =
  Object.freeze({
    en: {
      activeQr: "Active QR",
      address: "Address",
      allLocations: "All managed locations",
      batchHistory: "Recent production",
      batchHistoryDescription: "The five latest QR batches and their current production stage.",
      batchRequest: "Production request",
      capacity: "Vehicle capacity",
      contactRequests: "Contact requests",
      failedNotifications: "Failed notifications",
      locationInformation: "Location information",
      locationWorkspace: "Managed location workspace",
      noAddress: "No address registered",
      noBatches: "No QR production batches yet.",
      openRequests: "Open requests",
      operations: "Operations",
      qrProduction: "QR production",
      quantity: "Quantity",
      reports: "Reports",
      status: "Status",
      totalQr: "Total QR",
      type: "Location type",
      workspaceDescription:
        "Monitor QR readiness, contact flow, and recent production for this managed location.",
    },
    ko: {
      activeQr: "활성 QR",
      address: "주소",
      allLocations: "전체 관리 현장",
      batchHistory: "최근 QR 제작",
      batchHistoryDescription: "최근 QR 제작 묶음 5건과 현재 진행 단계를 확인합니다.",
      batchRequest: "제작 요청",
      capacity: "계약 차량 규모",
      contactRequests: "차량 연락 요청",
      failedNotifications: "전송 실패",
      locationInformation: "관리 현장 정보",
      locationWorkspace: "관리 현장 통합 현황",
      noAddress: "등록된 주소 없음",
      noBatches: "아직 QR 제작 묶음이 없습니다.",
      openRequests: "미해결 요청",
      operations: "운영 모니터링",
      qrProduction: "QR 제작",
      quantity: "수량",
      reports: "리포트",
      status: "진행 상태",
      totalQr: "전체 QR",
      type: "현장 유형",
      workspaceDescription:
        "이 관리 현장의 QR 준비도, 차량 연락 흐름과 최근 제작 진행 상황을 확인합니다.",
    },
  });
