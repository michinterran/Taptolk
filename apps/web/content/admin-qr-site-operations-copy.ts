import type {
  QrActivationReadiness,
  QrDeliveryStatus,
  QrSiteOperationsSection,
} from "../components/qr-site-operations-model";
import type { AppLocale } from "../i18n/config";

export interface AdminQrSiteOperationsCopy {
  action: string;
  activationGuideDescription: string;
  activationGuideTitle: string;
  activationStepDescriptions: Readonly<Record<QrActivationReadiness, string>>;
  activationStepLabels: Readonly<Record<QrActivationReadiness, string>>;
  back: string;
  batchCode: string;
  description: string;
  eyebrow: string;
  generate: string;
  inventoryAssetDescription: string;
  inventoryAssetTitle: string;
  inventoryDescription: string;
  inventoryTitle: string;
  noDelivery: string;
  noExceptions: string;
  noInventory: string;
  noStock: string;
  receiptDescription: string;
  receiptExpectedQuantity: string;
  receiptPartial: string;
  receiptReason: string;
  receiptTitle: string;
  receiptQuantity: string;
  receiveAll: string;
  sectionAriaLabel: string;
  sectionDescriptions: Readonly<Record<QrSiteOperationsSection, string>>;
  sectionLabels: Readonly<Record<QrSiteOperationsSection, string>>;
  select: string;
  svgDownload: string;
  unassigned: string;
  siteStatusLabels: Readonly<Record<string, string>>;
  title: string;
  totalQr: string;
  activeQr: string;
  pendingActivation: string;
  batchCount: string;
  batchStatusLabels: Readonly<Record<string, string>>;
  deliveryAction: string;
  deliveryActionLabels: Readonly<Record<QrDeliveryStatus, string>>;
  deliveryAdvancedStatus: string;
  deliveryDescription: string;
  deliveryReason: string;
  assignmentAction: string;
  preassignmentDescription: string;
  preassignmentTitle: string;
  cancel: string;
  completed: string;
  confirmAction: string;
  confirmDescriptions: Readonly<
    Record<"assign" | "delivery" | "import" | "receive" | "replace" | "revoke", string>
  >;
  confirmTitles: Readonly<
    Record<"assign" | "delivery" | "import" | "receive" | "replace" | "revoke", string>
  >;
  currentStatus: string;
  exceptionAction: string;
  exceptionWorkflowDescription: string;
  exceptionWorkflowTitle: string;
  goToAssignment: string;
  goToInventory: string;
  goToProduction: string;
  notAvailable: string;
  receiptAction: string;
  scanReadiness: string;
  scanStatusLabels: Readonly<Record<QrActivationReadiness, string>>;
}

export const ADMIN_QR_SITE_OPERATIONS_COPY: Readonly<Record<AppLocale, AdminQrSiteOperationsCopy>> =
  Object.freeze({
    en: {
      action: "Action",
      activationGuideDescription:
        "Admins confirm physical production, delivery, and site receipt. After receipt, an owner scan opens registration; the QR becomes usable only when the owner completes registration.",
      activationGuideTitle: "Path to a usable QR",
      activationStepDescriptions: {
        ACTIVE: "Owner registration is complete and public contact is available.",
        BLOCKED: "Review replacement, revocation, or an exceptional lifecycle state.",
        PENDING: "The owner started registration and still has a step to complete.",
        READY: "The QR is in stock or assigned and can open owner registration now.",
        WAITING_FOR_RECEIPT: "Complete print, delivery, and site receipt confirmations first.",
      },
      activationStepLabels: {
        ACTIVE: "Usable",
        BLOCKED: "Needs review",
        PENDING: "Registration in progress",
        READY: "Owner registration ready",
        WAITING_FOR_RECEIPT: "Production or receipt pending",
      },
      assignmentAction: "Preassign vehicle",
      activeQr: "Active QR",
      back: "Back to QR operations",
      batchCode: "Batch",
      batchCount: "Generation batches",
      batchStatusLabels: {
        CANCELLED: "Cancelled",
        COMPLETED: "Completed",
        DELIVERED: "Delivered",
        DISTRIBUTING: "Distributing",
        DRAFT: "Draft",
        FAILED: "Failed",
        FINAL_APPROVAL_PENDING: "Final approval pending",
        GENERATED: "Generated",
        GENERATING: "Generating",
        GENERATION_APPROVED: "Generation approved",
        GENERATION_QUEUED: "Queued",
        PARTIALLY_COMPLETED: "Partially completed",
        PARTIALLY_RECEIVED: "Partially received",
        PRINTED: "Printed",
        PRINT_FILE_READY: "Print file ready",
        QUALITY_CHECKED: "Quality checked",
        SAMPLE_APPROVED: "Sample approved",
        SAMPLE_READY: "Sample ready",
        SAMPLE_RENDERING: "Sample rendering",
        SENT_TO_PRINTER: "Sent to printer",
        SHIPPED: "Shipped",
      },
      deliveryAction: "Next delivery stage",
      deliveryActionLabels: {
        DELIVERED: "Confirm delivery",
        PRINTED: "Confirm printing",
        SENT_TO_PRINTER: "Confirm print handoff",
        SHIPPED: "Confirm shipment",
      },
      deliveryAdvancedStatus: "The QR production and delivery workflow advanced one stage.",
      deliveryDescription:
        "Super Admin confirms each real print and delivery event. The receiving site records inventory only after delivery.",
      deliveryReason: "Operator-confirmed print and delivery stage",
      cancel: "Cancel",
      completed: "Complete",
      confirmAction: "Confirm and continue",
      confirmDescriptions: {
        assign:
          "Confirm that this in-stock QR should be assigned to the vehicle entered in the form.",
        delivery:
          "Record the selected physical production or delivery event and advance the batch one stage.",
        import: "Apply every validated CSV row to vehicle assignment in one transaction.",
        receive:
          "Confirm the delivered batch quantity and move only the received QR assets into site stock.",
        replace:
          "Move the current vehicle binding to the selected replacement QR while preserving history.",
        revoke: "Revoke this QR and end its active binding. This action does not delete history.",
      },
      confirmTitles: {
        assign: "Confirm vehicle assignment",
        delivery: "Confirm production and delivery stage",
        import: "Confirm bulk assignment",
        receive: "Confirm site receipt",
        replace: "Confirm QR replacement",
        revoke: "Confirm QR revocation",
      },
      currentStatus: "Current status",
      description:
        "Manage the QR assets already issued to this site. Taptolk supplies dynamic QR SVG files; site-specific sticker artwork is handled separately.",
      eyebrow: "Site QR operations",
      exceptionAction: "Review request",
      exceptionWorkflowDescription:
        "Use this area after a site or owner reports a lost, damaged, or replacement-needed sticker. Review the reason first; replacement preserves history and revocation makes the QR unusable.",
      exceptionWorkflowTitle: "Exception handling",
      generate: "Generate additional QR",
      goToAssignment: "Go to vehicle assignment",
      goToInventory: "Go to receipt and inventory",
      goToProduction: "Go to production and delivery",
      inventoryAssetDescription:
        "Review every QR issued to this site in one compact inventory table.",
      inventoryAssetTitle: "Site QR inventory",
      inventoryDescription:
        "Track stock, vehicle assignment, activation, replacement, and revocation without exposing owner phone numbers or QR tokens.",
      inventoryTitle: "QR inventory and lifecycle",
      noDelivery: "There are no delivered batches waiting for receipt.",
      noExceptions: "There are no assigned QR assets requiring lifecycle action.",
      noInventory: "No QR assets have been issued to this site.",
      noStock: "There are no in-stock QR assets ready for vehicle assignment.",
      notAvailable: "Not available",
      pendingActivation: "Activation pending",
      receiptDescription:
        "Select a delivered batch, compare the expected quantity with the shipment, and record a full or partial receipt. Only received QR assets move into site stock.",
      receiptExpectedQuantity: "Expected quantity",
      receiptPartial: "Partial receipt",
      receiptReason: "Receipt reason",
      receiptAction: "Confirm receipt",
      receiptTitle: "Delivery receipt",
      receiptQuantity: "Quantity received now",
      receiveAll: "Record full receipt",
      sectionAriaLabel: "Site QR work areas",
      sectionDescriptions: {
        assignment:
          "Track owner registration readiness after site receipt. Vehicle and CSV assignment are optional advanced operations, not a prerequisite for owner registration.",
        exceptions:
          "Replace or revoke an assigned QR asset without exposing its public token or owner contact details.",
        inventory:
          "Receive delivered batches and review every QR asset currently held by this site.",
        production:
          "Follow each generated batch through print handoff, printing, shipment, and delivery.",
      },
      sectionLabels: {
        assignment: "Owner registration status",
        exceptions: "Exception requests",
        inventory: "Receipt and inventory",
        production: "Production and delivery",
      },
      select: "Open",
      preassignmentDescription:
        "Use only when the site already knows the vehicle before the owner scans. The normal path is owner scan → vehicle registration; this operation is recorded as an ADMIN or CSV preassignment.",
      preassignmentTitle: "Advanced operations · vehicle preassignment",
      scanReadiness: "Scan readiness",
      scanStatusLabels: {
        ACTIVE: "Usable",
        BLOCKED: "Unavailable",
        PENDING: "Owner registration in progress",
        READY: "Owner registration ready",
        WAITING_FOR_RECEIPT: "Receipt required",
      },
      siteStatusLabels: {
        ACTIVE: "Operating",
        CLOSED: "Closed",
        SUSPENDED: "Suspended",
      },
      title: "Site QR operations",
      totalQr: "Total QR",
      svgDownload: "Download SVG",
      unassigned: "Unassigned",
    },
    ko: {
      action: "작업",
      activationGuideDescription:
        "관리자는 실제 제작·배송·사이트 입고까지만 확인합니다. 입고 후 차주가 QR을 스캔하면 등록을 시작할 수 있고, 차주 등록을 완료하면 QR이 사용 가능 상태가 됩니다.",
      activationGuideTitle: "QR 사용 가능 경로",
      activationStepDescriptions: {
        ACTIVE: "차주 등록이 완료되어 연락 요청 기능을 사용할 수 있습니다.",
        BLOCKED: "교체·폐기 또는 예외 상태를 검토해야 합니다.",
        PENDING: "차주가 등록을 시작했으며 남은 절차를 완료해야 합니다.",
        READY: "입고 또는 차량 배정이 완료되어 지금 차주 등록을 시작할 수 있습니다.",
        WAITING_FOR_RECEIPT: "제작·배송·사이트 입고 확인을 먼저 완료해야 합니다.",
      },
      activationStepLabels: {
        ACTIVE: "사용 가능",
        BLOCKED: "검토 필요",
        PENDING: "차주 등록 중",
        READY: "차주 등록 가능",
        WAITING_FOR_RECEIPT: "제작·입고 대기",
      },
      assignmentAction: "차량 사전 배정",
      activeQr: "활성 QR",
      back: "QR 운영으로 돌아가기",
      batchCode: "생성 묶음",
      batchCount: "생성 묶음",
      batchStatusLabels: {
        CANCELLED: "취소됨",
        COMPLETED: "완료",
        DELIVERED: "배송 완료",
        DISTRIBUTING: "배포 중",
        DRAFT: "초안",
        FAILED: "실패",
        FINAL_APPROVAL_PENDING: "최종 승인 대기",
        GENERATED: "생성 완료",
        GENERATING: "생성 중",
        GENERATION_APPROVED: "생성 승인됨",
        GENERATION_QUEUED: "생성 대기",
        PARTIALLY_COMPLETED: "일부 완료",
        PARTIALLY_RECEIVED: "일부 입고",
        PRINTED: "출력 완료",
        PRINT_FILE_READY: "출력 파일 준비",
        QUALITY_CHECKED: "품질 확인",
        SAMPLE_APPROVED: "샘플 승인됨",
        SAMPLE_READY: "샘플 준비",
        SAMPLE_RENDERING: "샘플 생성 중",
        SENT_TO_PRINTER: "출력 전달",
        SHIPPED: "배송 중",
      },
      deliveryAction: "다음 배송 단계",
      deliveryActionLabels: {
        DELIVERED: "배송 완료 확인",
        PRINTED: "출력 완료 확인",
        SENT_TO_PRINTER: "출력 전달 확인",
        SHIPPED: "배송 시작 확인",
      },
      deliveryAdvancedStatus: "QR 제작·배송 단계가 다음 상태로 전환되었습니다.",
      deliveryDescription:
        "슈퍼어드민이 실제 출력·배송 사건을 단계별로 확인합니다. 배송 완료 후 받는 사이트가 입고를 기록합니다.",
      deliveryReason: "운영자가 출력·배송 단계를 확인함",
      cancel: "취소",
      completed: "처리 완료",
      confirmAction: "확인하고 진행",
      confirmDescriptions: {
        assign: "입력한 차량에 이 재고 QR을 배정할지 확인합니다.",
        delivery: "선택한 실제 제작·배송 사건을 기록하고 묶음을 다음 단계로 전환합니다.",
        import: "검증된 CSV의 모든 행을 한 번에 차량 배정으로 확정합니다.",
        receive: "배송된 묶음 전체가 사이트에 도착했음을 확인하고 QR을 재고 상태로 전환합니다.",
        replace: "현재 차량 배정을 선택한 교체 QR로 이전하며 기존 이력은 보존합니다.",
        revoke: "이 QR을 폐기하고 활성 배정을 종료합니다. 기존 이력은 삭제되지 않습니다.",
      },
      confirmTitles: {
        assign: "차량 배정 확인",
        delivery: "제작·배송 단계 확인",
        import: "일괄 배정 확인",
        receive: "사이트 입고 확인",
        replace: "QR 교체 확인",
        revoke: "QR 폐기 확인",
      },
      currentStatus: "현재 상태",
      description:
        "이 사이트에 발행된 QR 자산을 운영합니다. Taptolk은 동적 QR SVG만 제공하며 사이트별 스티커 디자인은 별도로 적용합니다.",
      eyebrow: "사이트 QR 운영",
      exceptionAction: "요청 검토",
      exceptionWorkflowDescription:
        "사이트 또는 차주가 분실·파손·교체 필요를 알린 뒤 이 영역에서 처리합니다. 사유를 먼저 확인하고, 교체는 이력을 보존하며 폐기는 QR을 사용할 수 없게 합니다.",
      exceptionWorkflowTitle: "예외 요청 처리",
      generate: "QR 추가 생성",
      goToAssignment: "차량 배정으로 이동",
      goToInventory: "입고·재고로 이동",
      goToProduction: "제작·배송으로 이동",
      inventoryAssetDescription:
        "이 사이트에 발행된 모든 QR을 하나의 재고 표에서 상태별로 확인합니다.",
      inventoryAssetTitle: "사이트 QR 재고",
      inventoryDescription:
        "차주 전화번호나 QR 원본 토큰을 노출하지 않고 재고·차량 배정·활성화·교체·폐기 상태를 관리합니다.",
      inventoryTitle: "QR 재고 및 라이프사이클",
      noDelivery: "입고를 기다리는 배송 완료 묶음이 없습니다.",
      noExceptions: "교체하거나 폐기할 배정 QR이 없습니다.",
      noInventory: "이 사이트에 발행된 QR이 없습니다.",
      noStock: "차량에 배정할 입고 QR이 없습니다.",
      notAvailable: "해당 없음",
      pendingActivation: "활성화 대기",
      receiptDescription:
        "배송 완료 묶음을 선택하고 기대 수량과 실제 도착 수량을 비교해 전량 또는 일부 입고를 기록합니다. 입력한 수량만 사이트 재고로 전환됩니다.",
      receiptExpectedQuantity: "기대 수량",
      receiptPartial: "부분 입고",
      receiptReason: "입고 사유",
      receiptAction: "입고 확인",
      receiptTitle: "배송 묶음 입고",
      receiptQuantity: "이번 입고 수량",
      receiveAll: "전량 입고 확인",
      sectionAriaLabel: "사이트 QR 작업 영역",
      sectionDescriptions: {
        assignment:
          "사이트 입고 후 차주 등록 가능·진행·완료 상태를 확인합니다. 차량번호와 CSV 배정은 차주 등록을 대신하지 않는 고급 사전 배정 기능입니다.",
        exceptions: "공개 QR 토큰과 차주 연락처를 노출하지 않고 배정 QR을 교체하거나 폐기합니다.",
        inventory: "배송 완료 묶음을 입고하고 사이트가 보유한 모든 QR의 현재 상태를 확인합니다.",
        production: "생성 묶음을 출력 전달, 출력 완료, 배송 시작, 배송 완료 순서로 처리합니다.",
      },
      sectionLabels: {
        assignment: "차주 등록 현황",
        exceptions: "예외 요청",
        inventory: "입고·재고",
        production: "제작·배송",
      },
      select: "열기",
      preassignmentDescription:
        "차주가 스캔하기 전에 사이트가 차량을 알고 있을 때만 사용합니다. 기본 경로는 차주 스캔 → 차량 등록이며, 이 작업은 관리자 또는 CSV 사전 배정으로 기록됩니다.",
      preassignmentTitle: "고급 운영 · 차량 사전 배정",
      scanReadiness: "스캔 준비 상태",
      scanStatusLabels: {
        ACTIVE: "사용 가능",
        BLOCKED: "사용 불가",
        PENDING: "차주 등록 중",
        READY: "차주 등록 가능",
        WAITING_FOR_RECEIPT: "입고 확인 필요",
      },
      siteStatusLabels: {
        ACTIVE: "운영 중",
        CLOSED: "종료",
        SUSPENDED: "일시정지",
      },
      title: "사이트 QR 운영",
      totalQr: "전체 QR",
      svgDownload: "SVG 다운로드",
      unassigned: "미배정",
    },
  });
