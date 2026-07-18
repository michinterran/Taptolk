export const ko = {
  "foundation.card.modular.description":
    "화면, 정책, 데이터 접근을 분리해 다음 단계의 기능이 안전하게 쌓이도록 구성합니다.",
  "foundation.card.modular.title": "모듈 경계",
  "foundation.card.standard.description":
    "Semantic HTML, 접근성, 디자인 토큰과 핵심 상태를 WCJ가 매 변경마다 검사합니다.",
  "foundation.card.standard.title": "WCJ 품질 게이트",
  "foundation.card.trust.description":
    "전화번호와 차량 정보를 화면과 로그에 불필요하게 노출하지 않는 기반을 먼저 만듭니다.",
  "foundation.card.trust.title": "Privacy by Design",
  "foundation.eyebrow": "QR 기반 익명 차량 커뮤니케이션",
  "foundation.hero.description":
    "Taptolk는 차주의 전화번호를 공개하지 않고도 꼭 필요한 차량 연락을 전달할 수 있도록 설계됩니다.",
  "foundation.hero.line1": "전화번호를 노출하지 않고",
  "foundation.hero.line2": "차주에게 필요한 말을 전합니다.",
  "foundation.logo.alt": "Taptolk",
  "foundation.phase.label": "현재 개발 단계",
  "foundation.phase.value": "Phase 0 · Foundation",
  "foundation.status.description":
    "모노레포, 환경 검증, 웹 표준과 데이터 경계를 먼저 구축하고 있습니다.",
  "foundation.status.title": "기초 구조 준비 중",
  "locale.english": "영어로 보기",
  "locale.korean": "한국어로 보기",
  "locale.switcher.label": "언어 선택",
  "metadata.description": "QR 기반 익명 차량 커뮤니케이션 플랫폼",
  "metadata.title": "Taptolk",
  "shared.error.description": "잠시 후 다시 시도해 주세요.",
  "shared.error.retry": "다시 시도",
  "shared.error.title": "화면을 불러오지 못했습니다.",
  "shared.loading": "안전한 연결을 준비하고 있습니다.",
  "shared.notFound.description": "요청한 주소를 확인한 뒤 다시 방문해 주세요.",
  "shared.notFound.title": "페이지를 찾을 수 없습니다.",
} as const;

export type MessageKey = keyof typeof ko;
export type MessageDictionary = Record<MessageKey, string>;

export const en = {
  "foundation.card.modular.description":
    "Screen, policy, and data boundaries keep later product work safe to extend.",
  "foundation.card.modular.title": "Module boundaries",
  "foundation.card.standard.description":
    "WCJ checks semantic HTML, accessibility, design tokens, and journey states on every change.",
  "foundation.card.standard.title": "WCJ quality gate",
  "foundation.card.trust.description":
    "The foundation avoids unnecessary exposure of phone and vehicle data in screens and logs.",
  "foundation.card.trust.title": "Privacy by Design",
  "foundation.eyebrow": "Anonymous vehicle communication initiated by QR",
  "foundation.hero.description":
    "Taptolk delivers essential vehicle messages without revealing the driver's phone number.",
  "foundation.hero.line1": "Reach the driver when it matters",
  "foundation.hero.line2": "without exposing a phone number.",
  "foundation.logo.alt": "Taptolk",
  "foundation.phase.label": "Current development phase",
  "foundation.phase.value": "Phase 0 · Foundation",
  "foundation.status.description":
    "We are establishing the monorepo, environment validation, web standards, and data boundaries first.",
  "foundation.status.title": "Foundation in progress",
  "locale.english": "View in English",
  "locale.korean": "View in Korean",
  "locale.switcher.label": "Language selection",
  "metadata.description": "QR-based anonymous vehicle communication platform",
  "metadata.title": "Taptolk",
  "shared.error.description": "Please try again in a moment.",
  "shared.error.retry": "Try again",
  "shared.error.title": "We could not load this screen.",
  "shared.loading": "Preparing a safe connection.",
  "shared.notFound.description": "Check the requested address and try again.",
  "shared.notFound.title": "Page not found.",
} as const satisfies MessageDictionary;

export const messages = Object.freeze({ en, ko });

export function getMessages(locale: keyof typeof messages): MessageDictionary {
  return messages[locale];
}
