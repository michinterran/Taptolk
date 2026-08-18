import type { QrSiteOperationsSection } from "../components/qr-site-operations-model";
import type { AppLocale } from "../i18n/config";

export interface AdminQrSiteOperationsCopy {
  action: string;
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
  deliveryActionLabels: Readonly<Record<string, string>>;
  deliveryAdvancedStatus: string;
  deliveryDescription: string;
  deliveryReason: string;
}

export const ADMIN_QR_SITE_OPERATIONS_COPY: Readonly<Record<AppLocale, AdminQrSiteOperationsCopy>> =
  Object.freeze({
    en: {
      action: "Action",
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
      description:
        "Manage the QR assets already issued to this site. Taptolk supplies dynamic QR SVG files; site-specific sticker artwork is handled separately.",
      eyebrow: "Site QR operations",
      generate: "Generate additional QR",
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
      pendingActivation: "Activation pending",
      receiptDescription:
        "Select one delivered batch and record the complete site receipt. Receipt changes its printed QR assets to in-stock.",
      receiptReason: "Receipt reason",
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
      description:
        "이 사이트에 발행된 QR 자산을 운영합니다. Taptolk은 동적 QR SVG만 제공하며 사이트별 스티커 디자인은 별도로 적용합니다.",
      eyebrow: "사이트 QR 운영",
      generate: "QR 추가 생성",
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
      pendingActivation: "활성화 대기",
      receiptDescription:
        "배송 완료 묶음 하나를 선택해 사이트 입고를 기록합니다. 입고된 QR은 재고 상태로 전환됩니다.",
      receiptReason: "입고 사유",
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
