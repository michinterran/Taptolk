import type { AppLocale } from "../i18n/config";

export interface AdminRevenueCopy {
  activeContracts: string;
  back: string;
  billingReadiness: string;
  billingReadinessDescription: string;
  completedLots: string;
  contractPipeline: string;
  contractPipelineDescription: string;
  costMissing: string;
  description: string;
  eyebrow: string;
  freshAt: string;
  line1: string;
  line2: string;
  providerCost: string;
  providerCostDescription: string;
  qrProduction: string;
  qrProductionDescription: string;
  revenueNotice: string;
  sent: string;
  siteCount: string;
}

export const ADMIN_REVENUE_COPY: Readonly<Record<AppLocale, AdminRevenueCopy>> = Object.freeze({
  en: {
    activeContracts: "Active contract scope",
    back: "Back to dashboard",
    billingReadiness: "Billing readiness",
    billingReadinessDescription:
      "This page separates real recorded provider cost from future contract billing decisions.",
    completedLots: "Completed QR lots",
    contractPipeline: "Contract pipeline",
    contractPipelineDescription:
      "Track managed locations, QR production, and delivery records before formal billing is connected.",
    costMissing: "Deliveries missing cost records",
    description:
      "Monitor the commercial signals Taptolk needs for contract renewal, QR production billing, and provider-cost reconciliation.",
    eyebrow: "Revenue management",
    freshAt: "Data refreshed",
    line1: "Manage contract value",
    line2: "without mixing it with operating guesses.",
    providerCost: "Recorded provider cost",
    providerCostDescription:
      "Only costs recorded by approved server-side telemetry are shown here.",
    qrProduction: "QR production billing base",
    qrProductionDescription: "Completed lots and active QR assets define production follow-up.",
    revenueNotice:
      "Revenue amounts are not invented. Contract price, plan, and provider settlements are connected only after user-approved commercial setup.",
    sent: "Sent or delivered",
    siteCount: "Managed locations",
  },
  ko: {
    activeContracts: "활성 계약 범위",
    back: "대시보드로 돌아가기",
    billingReadiness: "청구 준비 상태",
    billingReadinessDescription:
      "실제 기록된 발송 비용과 앞으로 확정할 계약 청구 정보를 분리해서 봅니다.",
    completedLots: "제작 완료 QR 묶음",
    contractPipeline: "계약 파이프라인",
    contractPipelineDescription:
      "공식 청구 연결 전에도 관리 현장, QR 제작, 알림 전송 기록을 한곳에서 확인합니다.",
    costMissing: "비용 누락 발송",
    description:
      "계약 갱신, QR 제작 청구, 알림 Provider 비용 정산에 필요한 상업 신호를 관리합니다.",
    eyebrow: "매출 관리",
    freshAt: "데이터 기준 시각",
    line1: "운영 추정과 섞지 않고,",
    line2: "계약 가치를 관리합니다.",
    providerCost: "기록된 발송 비용",
    providerCostDescription: "승인된 서버 텔레메트리에 기록된 비용만 보여줍니다.",
    qrProduction: "QR 제작 청구 기준",
    qrProductionDescription: "제작 완료 묶음과 활성 QR을 기반으로 후속 청구를 준비합니다.",
    revenueNotice:
      "매출 금액은 임의로 만들지 않습니다. 계약 단가, 요금제, Provider 정산은 사용자 승인 후 연결합니다.",
    sent: "전송·도달",
    siteCount: "관리 현장",
  },
});
