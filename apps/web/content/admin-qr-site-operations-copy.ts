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
  receiptReason: string;
  receiptTitle: string;
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
      assignmentAction: "Enter assignment",
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
          "Confirm that the complete delivered batch has arrived at this site and move its QR assets into stock.",
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
      exceptionAction: "Review lifecycle action",
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
        "Select one delivered batch and record the complete site receipt. Receipt changes its printed QR assets to in-stock.",
      receiptReason: "Receipt reason",
      receiptAction: "Confirm receipt",
      receiptTitle: "Delivery receipt",
      receiveAll: "Record complete receipt",
      sectionAriaLabel: "Site QR work areas",
      sectionDescriptions: {
        assignment:
          "Assign in-stock QR assets to vehicles one at a time, or validate a CSV for bulk assignment.",
        exceptions:
          "Replace or revoke an assigned QR asset without exposing its public token or owner contact details.",
        inventory:
          "Receive delivered batches and review every QR asset currently held by this site.",
        production:
          "Follow each generated batch through print handoff, printing, shipment, and delivery.",
      },
      sectionLabels: {
        assignment: "Vehicle assignment",
        exceptions: "Replace and revoke",
        inventory: "Receipt and inventory",
        production: "Production and delivery",
      },
      select: "Open",
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
      assignmentAction: "배정 정보 입력",
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
      exceptionAction: "수명주기 작업 검토",
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
        "배송 완료 묶음 하나를 선택해 사이트 입고를 기록합니다. 입고된 QR은 재고 상태로 전환됩니다.",
      receiptReason: "입고 사유",
      receiptAction: "입고 확인",
      receiptTitle: "배송 묶음 입고",
      receiveAll: "전체 입고 기록",
      sectionAriaLabel: "사이트 QR 작업 영역",
      sectionDescriptions: {
        assignment: "입고된 QR을 차량에 한 개씩 배정하거나 CSV로 일괄 배정을 검증합니다.",
        exceptions: "공개 QR 토큰과 차주 연락처를 노출하지 않고 배정 QR을 교체하거나 폐기합니다.",
        inventory: "배송 완료 묶음을 입고하고 사이트가 보유한 모든 QR의 현재 상태를 확인합니다.",
        production: "생성 묶음을 출력 전달, 출력 완료, 배송 시작, 배송 완료 순서로 처리합니다.",
      },
      sectionLabels: {
        assignment: "차량 배정",
        exceptions: "교체·폐기",
        inventory: "입고·재고",
        production: "제작·배송",
      },
      select: "열기",
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
