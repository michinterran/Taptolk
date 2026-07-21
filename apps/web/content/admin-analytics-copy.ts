import type { AppLocale } from "../i18n/config";

export interface AdminAnalyticsCopy {
  activeQr: string;
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
  line1: string;
  line2: string;
  openReports: string;
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
  unresolved: string;
}

export const ADMIN_ANALYTICS_COPY: Readonly<Record<AppLocale, AdminAnalyticsCopy>> = Object.freeze({
  en: {
    activeQr: "Active QR assets",
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
    line1: "Read the operating signal",
    line2: "before it becomes a service risk.",
    openReports: "Open reports",
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
    unresolved: "Unresolved requests",
  },
  ko: {
    activeQr: "활성 QR",
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
    line1: "서비스 리스크가 되기 전에",
    line2: "운영 신호를 먼저 읽습니다.",
    openReports: "미처리 신고",
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
    unresolved: "미해결 요청",
  },
});
