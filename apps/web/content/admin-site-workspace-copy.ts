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
  close: string;
  closeDescription: string;
  contractLimit: string;
  contractLimitHelp: string;
  contractTitle: string;
  escalationQueue: string;
  escalationQueueDescription: string;
  escalationPrivacyNotice: string;
  escalatedAt: string;
  failedNotifications: string;
  generatedQr: string;
  locationInformation: string;
  locationName: string;
  locationWorkspace: string;
  lifecycleActionLabels: Readonly<Record<"CLOSE" | "REACTIVATE" | "SUSPEND", string>>;
  lifecycleCancel: string;
  managementCompany: string;
  managementCompanyHelp: string;
  noAddress: string;
  noBatches: string;
  noEscalations: string;
  openRequests: string;
  optional: string;
  operations: string;
  outputReadyBatches: string;
  pendingActivation: string;
  plateLast4: string;
  qrBatch: string;
  qrManagement: string;
  qrStickerStatus: string;
  qrStickerStatusDescription: string;
  quantity: string;
  receivedQuantity: string;
  remainingQuantity: string;
  receiptTitle: string;
  receiptDescription: string;
  receiptReason: string;
  receiptReasonPlaceholder: string;
  recordReceipt: string;
  receiptHistory: string;
  noReceiptHistory: string;
  changeReason: string;
  changeReasonPlaceholder: string;
  lifecycleReason: string;
  lifecycleReasonPlaceholder: string;
  reactivate: string;
  reports: string;
  required: string;
  requestDescription: string;
  requestTitle: string;
  saveContract: string;
  saveOperational: string;
  siteContactLocation: string;
  status: string;
  statusDescription: string;
  suspend: string;
  suspendDescription: string;
  totalQr: string;
  type: string;
  timezone: string;
  updateDescription: string;
  updateTitle: string;
  workspaceDescription: string;
}

export const ADMIN_SITE_WORKSPACE_COPY: Readonly<Record<AppLocale, AdminSiteWorkspaceCopy>> =
  Object.freeze({
    en: {
      activeQr: "Active QR",
      address: "Address",
      allLocations: "All sites",
      batchHistory: "Recent production",
      batchHistoryDescription: "The five latest QR batches and their current production stage.",
      batchRequest: "Production request",
      capacity: "Vehicle capacity",
      contactRequests: "Contact requests",
      close: "End site operations",
      closeDescription:
        "Ending operations permanently closes this site. Its history is retained and the site cannot be reactivated.",
      contractLimit: "Contract vehicle limit",
      contractLimitHelp: "Set the maximum number of vehicles covered by this site contract.",
      contractTitle: "Contract scope",
      escalationPrivacyNotice:
        "Owner names and phone numbers are not shown here. Use the site location for intercom or on-site handling.",
      escalationQueue: "Site handling queue",
      escalationQueueDescription:
        "Escalated caller requests waiting for the site team to handle on site.",
      escalatedAt: "Escalated",
      failedNotifications: "Failed notifications",
      generatedQr: "Generated QR",
      locationInformation: "Site information",
      locationName: "Site",
      locationWorkspace: "Site details",
      lifecycleActionLabels: {
        CLOSE: "Close site",
        REACTIVATE: "Reactivate site",
        SUSPEND: "Suspend site",
      },
      lifecycleCancel: "Cancel request",
      managementCompany: "Management company",
      managementCompanyHelp:
        "This relationship is managed by the platform and cannot be edited here.",
      noAddress: "No address registered",
      noBatches: "No issued QR batches yet.",
      noEscalations: "No escalated site handling requests.",
      openRequests: "Open requests",
      optional: "Optional",
      operations: "Operations",
      outputReadyBatches: "Output-ready batches",
      pendingActivation: "Pending activation",
      plateLast4: "Plate ending",
      qrBatch: "QR batch",
      qrManagement: "QR operations",
      qrStickerStatus: "QR sticker status",
      qrStickerStatusDescription:
        "Review issued QR batches, quantities, and current operating status for this site.",
      quantity: "Quantity",
      receivedQuantity: "Received",
      remainingQuantity: "Remaining",
      receiptTitle: "Record site receipt",
      receiptDescription:
        "Record all or part of a delivered QR batch. Each receipt is kept in the batch history.",
      receiptReason: "Receipt reason",
      receiptReasonPlaceholder: "Explain the delivered quantity or the partial receipt.",
      recordReceipt: "Record receipt",
      receiptHistory: "Receipt history",
      noReceiptHistory: "No receipt recorded yet.",
      changeReason: "Change reason",
      changeReasonPlaceholder: "Explain why the site information or contract scope must change.",
      lifecycleReason: "Status change reason",
      lifecycleReasonPlaceholder: "Explain why this site must be suspended or ended.",
      reactivate: "Reactivate",
      reports: "Reports",
      required: "Required",
      requestDescription: "Request a status change when a second reviewer must approve it.",
      requestTitle: "Request a status change",
      saveContract: "Save contract scope",
      saveOperational: "Save site information",
      siteContactLocation: "Site call location",
      status: "Status",
      statusDescription:
        "Record the operational reason before changing the site state. Suspension preserves the site history and can be reversed.",
      suspend: "Pause site operations",
      suspendDescription:
        "Pausing operations stops new site activity while preserving the site record and QR history.",
      totalQr: "Total QR",
      type: "Location type",
      timezone: "Time zone",
      updateDescription:
        "Manage editable site information, contract scope, and lifecycle decisions in one workspace.",
      updateTitle: "Site operations workspace",
      workspaceDescription:
        "Monitor QR readiness, contact flow, and recent issuance for this site.",
    },
    ko: {
      activeQr: "활성 QR",
      address: "주소",
      allLocations: "전체 사이트",
      batchHistory: "최근 QR 발행",
      batchHistoryDescription: "최근 QR 발행 묶음 5건과 현재 진행 단계를 확인합니다.",
      batchRequest: "제작 요청",
      capacity: "계약 차량 규모",
      contactRequests: "차량 연락 요청",
      close: "사이트 운영 종료",
      closeDescription:
        "운영 종료는 사이트를 영구 종료 상태로 전환합니다. 기록은 보존되며 다시 운영할 수 없습니다.",
      contractLimit: "계약 차량 한도",
      contractLimitHelp: "이 사이트 계약에 포함되는 최대 차량 수를 설정합니다.",
      contractTitle: "계약 범위",
      escalationPrivacyNotice:
        "차주 이름과 전화번호는 표시하지 않습니다. 사이트 호출 위치로 인터폰 또는 현장 확인만 진행합니다.",
      escalationQueue: "사이트 조치 대기열",
      escalationQueueDescription:
        "차주 응답이 없어 사이트 쪽 확인으로 넘어온 요청을 개인정보 최소화 기준으로 확인합니다.",
      escalatedAt: "전환 시각",
      failedNotifications: "전송 실패",
      generatedQr: "생성된 QR",
      locationInformation: "사이트 기본 정보",
      locationName: "사이트",
      locationWorkspace: "사이트 상세",
      lifecycleActionLabels: {
        CLOSE: "사이트 종료 요청",
        REACTIVATE: "운영 재개 요청",
        SUSPEND: "일시 중지 요청",
      },
      lifecycleCancel: "요청 취소",
      managementCompany: "관리회사",
      managementCompanyHelp:
        "관리회사 연결은 플랫폼에서 관리하며 이 화면에서는 수정할 수 없습니다.",
      noAddress: "등록된 주소 없음",
      noBatches: "아직 발행된 QR 묶음이 없습니다.",
      noEscalations: "사이트 조치 대기 요청이 없습니다.",
      openRequests: "미해결 요청",
      optional: "선택",
      operations: "운영 모니터링",
      outputReadyBatches: "출력 준비 묶음",
      pendingActivation: "활성화 대기 QR",
      plateLast4: "차량 끝번호",
      qrBatch: "QR 묶음",
      qrManagement: "QR 운영 관리",
      qrStickerStatus: "QR 스티커 현황",
      qrStickerStatusDescription: "이 사이트에 발행된 QR 묶음, 수량과 현재 운영 상태를 확인합니다.",
      quantity: "수량",
      receivedQuantity: "입고",
      remainingQuantity: "잔량",
      receiptTitle: "사이트 입고 기록",
      receiptDescription:
        "배송 완료된 QR 묶음의 전체 또는 일부 수량을 기록합니다. 각 입고 내역은 묶음 이력으로 보존됩니다.",
      receiptReason: "입고 사유",
      receiptReasonPlaceholder: "배송 수량 또는 부분 입고 사유를 입력하세요.",
      recordReceipt: "입고 기록",
      receiptHistory: "입고 이력",
      noReceiptHistory: "아직 기록된 입고 이력이 없습니다.",
      changeReason: "변경 사유",
      changeReasonPlaceholder: "사이트 정보 또는 계약 범위를 변경하는 이유를 입력하세요.",
      lifecycleReason: "상태 변경 사유",
      lifecycleReasonPlaceholder: "사이트 운영을 일시 중지하거나 종료하는 사유를 입력하세요.",
      reactivate: "운영 재개",
      reports: "리포트",
      required: "필수",
      requestDescription: "두 번째 검토자의 승인이 필요한 상태 변경을 요청합니다.",
      requestTitle: "상태 변경 요청",
      saveContract: "계약 범위 저장",
      saveOperational: "사이트 기본 정보 저장",
      siteContactLocation: "사이트 호출 위치",
      status: "진행 상태",
      statusDescription:
        "사이트 상태를 변경하기 전에 운영 사유를 남깁니다. 일시 중지는 기록을 보존하며 되돌릴 수 있습니다.",
      suspend: "사이트 운영 일시 중지",
      suspendDescription:
        "일시 중지는 신규 사이트 운영을 멈추지만 사이트 정보와 QR 이력은 보존합니다.",
      totalQr: "전체 QR",
      type: "사이트 유형",
      timezone: "시간대",
      updateDescription: "사이트 정보, 계약 범위와 운영 상태 변경을 하나의 작업면에서 처리합니다.",
      updateTitle: "사이트 운영 워크스페이스",
      workspaceDescription:
        "이 사이트의 QR 준비도, 차량 연락 흐름과 최근 발행 진행 상황을 확인합니다.",
    },
  });
