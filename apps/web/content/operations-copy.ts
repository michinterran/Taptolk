import type { AppLocale } from "../i18n/config";

export interface OperationsCopy {
  activeBlocks: string;
  activeQr: string;
  back: string;
  batches: string;
  contactCount: string;
  cost: string;
  description: string;
  deliveryGroup: string;
  escalated: string;
  eyebrow: string;
  failed: string;
  freshAt: string;
  inventoryGroup: string;
  line1: string;
  line2: string;
  manualGates: string;
  manualGatesDescription: string;
  medianResponse: string;
  missingCost: string;
  openReports: string;
  retrying: string;
  safetyGroup: string;
  sent: string;
  siteCount: string;
  todayGroup: string;
  unresolved: string;
}

export const OPERATIONS_COPY: Readonly<Record<AppLocale, OperationsCopy>> = Object.freeze({
  en: {
    activeBlocks: "Active caller blocks",
    activeQr: "Active QR assets",
    back: "Back to dashboard",
    batches: "Completed QR batches",
    contactCount: "Contact requests",
    cost: "Recorded provider cost",
    description:
      "Review the last 24 hours of contact, delivery, safety, and inventory signals within your authorized site scope.",
    deliveryGroup: "Notification delivery",
    escalated: "Site office alerts",
    eyebrow: "Operations health",
    failed: "Final failures",
    freshAt: "Data refreshed",
    inventoryGroup: "QR operations",
    line1: "See what needs attention",
    line2: "across today’s vehicle-contact journey.",
    manualGates: "Some checks require on-site verification",
    manualGatesDescription:
      "Real-device QR scanning, screen-reader journeys, visual contrast, and physical 85mm sticker print quality must be verified on site.",
    medianResponse: "Median owner response",
    missingCost: "sent deliveries without recorded cost",
    openReports: "Open reports",
    retrying: "Retrying",
    safetyGroup: "Safety and review",
    sent: "Sent or delivered",
    siteCount: "Authorized sites",
    todayGroup: "Last 24 hours",
    unresolved: "Unresolved requests",
  },
  ko: {
    activeBlocks: "활성 방문자 차단",
    activeQr: "활성 QR",
    back: "대시보드로 돌아가기",
    batches: "완료된 QR 제작 묶음",
    contactCount: "차량 연락 요청",
    cost: "기록된 발송 비용",
    description:
      "승인된 관리 현장 범위에서 최근 24시간의 연락, 알림, 안전 검토와 QR 운영 신호를 확인합니다.",
    deliveryGroup: "알림 전달",
    escalated: "관리사무소 알림",
    eyebrow: "운영 건전성",
    failed: "최종 실패",
    freshAt: "데이터 기준 시각",
    inventoryGroup: "QR 운영",
    line1: "오늘의 차량 연락 여정에서",
    line2: "확인이 필요한 운영 신호를 봅니다.",
    manualGates: "현장 확인이 필요한 점검 항목이 있습니다",
    manualGatesDescription:
      "실기기 QR 스캔, 화면 낭독기 사용, 화면 대비, 실제 85mm 스티커 인쇄 품질은 현장에서 직접 확인해야 합니다.",
    medianResponse: "차주 응답 중앙값",
    missingCost: "비용이 기록되지 않은 발송 건",
    openReports: "미처리 신고",
    retrying: "재시도 중",
    safetyGroup: "안전·검토",
    sent: "전송·도달",
    siteCount: "관리 현장",
    todayGroup: "최근 24시간",
    unresolved: "미해결 요청",
  },
});
