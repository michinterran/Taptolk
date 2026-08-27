import type { AppLocale } from "../i18n/config";

export interface AdminAnalyticsCopy {
  activeQr: string;
  apply: string;
  back: string;
  contactCount: string;
  dailyDetail: string;
  date: string;
  description: string;
  delivery: string;
  deliveryDescription: string;
  escalated: string;
  eyebrow: string;
  failed: string;
  freshAt: string;
  generatedQr: string;
  line1: string;
  line2: string;
  next: string;
  openReports: string;
  outputReadyBatches: string;
  page: string;
  pageSize: string;
  previous: string;
  period: string;
  periodCustom: string;
  periodToday: string;
  days: string;
  startDate: string;
  endDate: string;
  pendingActivation: string;
  deliveryRate: string;
  escalationRate: string;
  qrProduction: string;
  qrProductionDescription: string;
  responseQuality: string;
  responseQualityDescription: string;
  resolutionRate: string;
  scope: string;
  scopeAll: string;
  sent: string;
  siteCount: string;
  totalBatches: string;
  totalQr: string;
  unavailableDescription: string;
  unavailableTitle: string;
  unresolved: string;
  retry: string;
}

export const ADMIN_ANALYTICS_COPY: Readonly<Record<AppLocale, AdminAnalyticsCopy>> = Object.freeze({
  en: {
    activeQr: "Active QR assets",
    apply: "Apply",
    back: "Back to dashboard",
    contactCount: "Contact requests",
    dailyDetail: "Daily operating detail",
    date: "Date",
    description:
      "Review operating quality, provider delivery, QR readiness, and safety signals in the server-approved scope.",
    delivery: "Provider delivery",
    deliveryDescription: "Sent, retrying, failed, and missing-cost records show delivery quality.",
    escalated: "Escalated to office",
    eyebrow: "Operations report",
    failed: "Final failures",
    freshAt: "Data refreshed",
    generatedQr: "Generated QR",
    line1: "Reports",
    line2: "Operating quality and readiness",
    next: "Next",
    openReports: "Open reports",
    outputReadyBatches: "Output-ready batches",
    page: "Page {current} of {total}",
    pageSize: "Rows per page",
    previous: "Previous",
    period: "Report period",
    periodCustom: "Custom period",
    periodToday: "Today",
    days: " days",
    startDate: "Start date",
    endDate: "End date",
    pendingActivation: "Pending activation",
    deliveryRate: "Delivery success",
    escalationRate: "Office escalation rate",
    qrProduction: "QR production readiness",
    qrProductionDescription: "Managed locations, active QR assets, and completed production lots.",
    responseQuality: "Vehicle-contact quality",
    responseQualityDescription: "Requests, unresolved items, and escalation signals for today.",
    resolutionRate: "Resolution rate",
    scope: "Report scope",
    scopeAll: "All authorized locations",
    sent: "Sent or delivered",
    siteCount: "Managed locations",
    totalBatches: "QR batches",
    totalQr: "Total QR",
    unavailableDescription:
      "The approved operations data source is temporarily unavailable. No operational figures are shown until it recovers.",
    unavailableTitle: "Report data is temporarily unavailable",
    unresolved: "Unresolved requests",
    retry: "Try again",
  },
  ko: {
    activeQr: "활성 QR",
    apply: "적용",
    back: "대시보드로 돌아가기",
    contactCount: "차량 연락 요청",
    dailyDetail: "일별 운영 상세",
    date: "날짜",
    description:
      "서버가 승인한 범위 안에서 운영 품질, 알림 전송, QR 준비도, 안전 신호를 분석합니다.",
    delivery: "알림 전송 품질",
    deliveryDescription: "전송·재시도·최종 실패·비용 누락 기록으로 전송 상태를 확인합니다.",
    escalated: "관리사무소 알림",
    eyebrow: "운영 리포트",
    failed: "최종 실패",
    freshAt: "데이터 기준 시각",
    generatedQr: "생성된 QR",
    line1: "리포트",
    line2: "운영 품질과 준비도",
    next: "다음",
    openReports: "미처리 신고",
    outputReadyBatches: "출력 준비 묶음",
    page: "{current} / {total} 페이지",
    pageSize: "페이지당 표시",
    previous: "이전",
    period: "리포트 기간",
    periodCustom: "기간 설정",
    periodToday: "오늘",
    days: "일",
    startDate: "시작일",
    endDate: "종료일",
    pendingActivation: "활성화 대기",
    deliveryRate: "알림 전달 성공률",
    escalationRate: "관리사무소 전달률",
    qrProduction: "QR 제작 준비도",
    qrProductionDescription: "관리 현장, 활성 QR, 제작 완료 묶음을 함께 봅니다.",
    responseQuality: "차량 연락 품질",
    responseQualityDescription: "오늘의 요청, 미해결, 관리사무소 알림 흐름을 확인합니다.",
    resolutionRate: "요청 해결률",
    scope: "리포트 범위",
    scopeAll: "승인된 전체 관리 현장",
    sent: "전송·도달",
    siteCount: "관리 현장",
    totalBatches: "QR 묶음",
    totalQr: "전체 QR",
    unavailableDescription:
      "승인된 운영 데이터 원본에 일시적으로 연결할 수 없습니다. 복구될 때까지 운영 수치를 임의로 표시하지 않습니다.",
    unavailableTitle: "리포트 데이터를 불러올 수 없습니다",
    unresolved: "미해결 요청",
    retry: "다시 시도",
  },
});
