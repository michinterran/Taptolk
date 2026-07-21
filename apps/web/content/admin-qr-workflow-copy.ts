import type { StickerTemplateCode } from "@taptolk/application";
import type { AppLocale } from "../i18n/config";

export interface AdminQrWorkflowCopy {
  description: string;
  previewAlt: string;
  steps: readonly { description: string; title: string }[];
  templateDescriptions: Readonly<Record<StickerTemplateCode, string>>;
  templateLabels: Readonly<Record<StickerTemplateCode, string>>;
  templateLegend: string;
  title: string;
}

export const ADMIN_QR_WORKFLOW_COPY: Readonly<Record<AppLocale, AdminQrWorkflowCopy>> =
  Object.freeze({
    en: {
      description:
        "Choose the managed location, design and logo, confirm total quantity, and follow approval, print, delivery, and inventory receipt in one workflow.",
      previewAlt: "Scannable Taptolk QR sticker template preview",
      steps: [
        { title: "Location", description: "Choose the management company and managed location." },
        { title: "Template", description: "Compare four production-safe sticker layouts." },
        { title: "Brand", description: "Use an approved logo or upload a licensed asset." },
        { title: "Quantity", description: "Enter the total; batches stay at 100 or fewer." },
        { title: "Review", description: "Save, review, revise, and approve the design sample." },
        {
          title: "Production",
          description: "Track print, shipping, receipt, and inventory check-in.",
        },
      ],
      templateDescriptions: {
        ROUND_BLUE_HOLOGRAM_V1: "Blue circular hologram concept",
        ROUND_PURPLE_GRADIENT_V1: "Taptolk purple circular concept",
        ROUND_WHITE_MINIMAL_V1: "High-contrast white circular concept",
        SQUARE_DARK_PREMIUM_V1: "Dark square premium concept",
      },
      templateLabels: {
        ROUND_BLUE_HOLOGRAM_V1: "Blue hologram",
        ROUND_PURPLE_GRADIENT_V1: "Purple gradient",
        ROUND_WHITE_MINIMAL_V1: "White minimal",
        SQUARE_DARK_PREMIUM_V1: "Dark square",
      },
      templateLegend: "Choose a sticker template",
      title: "QR sticker production workflow",
    },
    ko: {
      description:
        "관리 현장, 디자인과 로고, 총수량을 선택하고 승인·인쇄·배송·입고 확인까지 한 흐름으로 관리합니다.",
      previewAlt: "스캔 가능한 Taptolk QR 스티커 템플릿 미리보기",
      steps: [
        { title: "현장 선택", description: "관리회사와 QR을 사용할 관리 현장을 선택합니다." },
        { title: "템플릿 선택", description: "인쇄 가능한 4개 스티커 구성을 비교합니다." },
        {
          title: "브랜드 적용",
          description: "승인된 로고를 선택하거나 사용권이 있는 파일을 등록합니다.",
        },
        { title: "수량 입력", description: "총수량을 입력하면 100개 이하 묶음으로 나눕니다." },
        { title: "검토·승인", description: "디자인을 저장하고 수정·샘플 검토·승인을 진행합니다." },
        { title: "제작·입고", description: "인쇄, 배송, 수령 확인과 재고 입고를 추적합니다." },
      ],
      templateDescriptions: {
        ROUND_BLUE_HOLOGRAM_V1: "파란색 원형 홀로그램 콘셉트",
        ROUND_PURPLE_GRADIENT_V1: "Taptolk 보라색 원형 콘셉트",
        ROUND_WHITE_MINIMAL_V1: "고대비 흰색 원형 콘셉트",
        SQUARE_DARK_PREMIUM_V1: "어두운 사각형 프리미엄 콘셉트",
      },
      templateLabels: {
        ROUND_BLUE_HOLOGRAM_V1: "블루 홀로그램",
        ROUND_PURPLE_GRADIENT_V1: "퍼플 그라데이션",
        ROUND_WHITE_MINIMAL_V1: "화이트 미니멀",
        SQUARE_DARK_PREMIUM_V1: "다크 스퀘어",
      },
      templateLegend: "스티커 템플릿 선택",
      title: "QR 스티커 제작 흐름",
    },
  });
