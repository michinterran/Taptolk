import type { AppLocale } from "../i18n/config";

export interface AdminRevenueCopy {
  activeContracts: string;
  activeQr: string;
  actions: string;
  back: string;
  billingReadiness: string;
  billingReadinessDescription: string;
  completedLots: string;
  company: string;
  contractPipeline: string;
  contractPipelineDescription: string;
  costMissing: string;
  description: string;
  eyebrow: string;
  freshAt: string;
  effectiveFrom: string;
  line1: string;
  line2: string;
  providerCost: string;
  providerCostDescription: string;
  monthlyProjection: string;
  monthlyUnitPrice: string;
  notSet: string;
  pricedCompanies: string;
  producedStickers: string;
  qrProduction: string;
  qrProductionDescription: string;
  revenueNotice: string;
  reason: string;
  reasonPlaceholder: string;
  save: string;
  sent: string;
  siteCount: string;
}

export const ADMIN_REVENUE_COPY: Readonly<Record<AppLocale, AdminRevenueCopy>> = Object.freeze({
  en: {
    activeContracts: "Active contract scope",
    activeQr: "Active QR assets",
    actions: "Pricing",
    back: "Back to dashboard",
    billingReadiness: "Billing readiness",
    billingReadinessDescription:
      "This page separates real recorded provider cost from future contract billing decisions.",
    completedLots: "Completed QR lots",
    company: "Management company",
    contractPipeline: "Contract pipeline",
    contractPipelineDescription:
      "Track managed locations, QR production, and delivery records before formal billing is connected.",
    costMissing: "Deliveries missing cost records",
    description:
      "Monitor the commercial signals Taptolk needs for contract renewal, QR production billing, and provider-cost reconciliation.",
    eyebrow: "Revenue management",
    freshAt: "Data refreshed",
    effectiveFrom: "Effective from",
    line1: "Manage contract value",
    line2: "without mixing it with operating guesses.",
    providerCost: "Recorded provider cost",
    providerCostDescription:
      "Only costs recorded by approved server-side telemetry are shown here.",
    monthlyProjection: "Projected monthly operating revenue",
    monthlyUnitPrice: "Monthly price per active vehicle",
    notSet: "Not configured",
    pricedCompanies: "Companies with a current price",
    producedStickers: "Produced stickers",
    qrProduction: "QR production billing base",
    qrProductionDescription: "Completed lots and active QR assets define production follow-up.",
    revenueNotice:
      "The monthly projection is active QR count multiplied by each company’s versioned price. It is not an issued invoice or recognized accounting revenue.",
    reason: "Change reason",
    reasonPlaceholder: "Enter the contract basis for this pricing change.",
    save: "Save pricing policy",
    sent: "Sent or delivered",
    siteCount: "Managed locations",
  },
  ko: {
    activeContracts: "활성 계약 범위",
    activeQr: "활성 QR",
    actions: "단가 설정",
    back: "대시보드로 돌아가기",
    billingReadiness: "청구 준비 상태",
    billingReadinessDescription:
      "실제 기록된 발송 비용과 앞으로 확정할 계약 청구 정보를 분리해서 봅니다.",
    completedLots: "제작 완료 QR 묶음",
    company: "관리회사",
    contractPipeline: "계약 파이프라인",
    contractPipelineDescription:
      "공식 청구 연결 전에도 관리 현장, QR 제작, 알림 전송 기록을 한곳에서 확인합니다.",
    costMissing: "비용 누락 발송",
    description:
      "계약 갱신, QR 제작 청구, 알림 Provider 비용 정산에 필요한 상업 신호를 관리합니다.",
    eyebrow: "매출 관리",
    freshAt: "데이터 기준 시각",
    effectiveFrom: "적용 시작일",
    line1: "운영 추정과 섞지 않고,",
    line2: "계약 가치를 관리합니다.",
    providerCost: "기록된 발송 비용",
    providerCostDescription: "승인된 서버 텔레메트리에 기록된 비용만 보여줍니다.",
    monthlyProjection: "월 운영 매출 예상액",
    monthlyUnitPrice: "활성 차량 1대당 월 단가",
    notSet: "미설정",
    pricedCompanies: "현재 단가가 설정된 관리회사",
    producedStickers: "제작 완료 스티커",
    qrProduction: "QR 제작 청구 기준",
    qrProductionDescription: "제작 완료 묶음과 활성 QR을 기반으로 후속 청구를 준비합니다.",
    revenueNotice:
      "월 예상액은 활성 QR 수와 관리회사별 버전 단가를 곱한 값입니다. 세금계산서 발행액이나 회계상 확정 매출과는 구분됩니다.",
    reason: "변경 사유",
    reasonPlaceholder: "단가 변경의 계약 근거를 입력하세요.",
    save: "단가 정책 저장",
    sent: "전송·도달",
    siteCount: "관리 현장",
  },
});
