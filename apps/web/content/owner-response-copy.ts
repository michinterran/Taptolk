import type { AppLocale } from "../i18n/config";

export interface OwnerResponseCopy {
  callerMessage: string;
  /** Canon 03 · reveals the rest of the reply catalogue. */
  moreReplies: string;
  /** Canon 03 · placeholder in the free-text box. */
  customPlaceholder: string;
  successTitle: readonly [string, ...string[]];
  errorTitle: readonly [string, ...string[]];
  back: string;
  customLabel: string;
  description: string;
  error: string;
  eyebrow: string;
  line1: string;
  line2: string;
  loading: string;
  replies: Record<string, string>;
  security: string;
  submit: string;
  success: string;
  vehicle: string;
}

export const OWNER_RESPONSE_COPY: Record<AppLocale, OwnerResponseCopy> = {
  ko: {
    callerMessage: "받은 메시지",
    moreReplies: "멘트 더 보기",
    customPlaceholder: "직접 메시지를 입력할 수도 있어요",
    successTitle: ["답장이", "전달되었습니다"],
    errorTitle: ["열 수 없는", "링크입니다"],
    back: "내 스티커 열기",
    customLabel: "직접 답장",
    description: "차량 정보 변경 권한 없이 이번 요청에만 답장합니다.",
    error: "링크가 만료되었거나 이미 사용되었습니다.",
    eyebrow: "차주 답장",
    line1: "차량 연락 요청을 확인하고",
    line2: "간단히 답장해 주세요.",
    loading: "안전한 요청을 확인하고 있습니다.",
    replies: {
      CANNOT_MOVE_NOW: "지금은 이동하기 어려워요",
      CONTACT_SITE_OFFICE: "관리사무소에 문의해 주세요",
      MOVE_IN_10_MINUTES: "10분 안에 이동할게요",
      MOVE_IN_3_MINUTES: "3분 안에 이동할게요",
      MOVE_IN_5_MINUTES: "5분 안에 이동할게요",
      MOVING_NOW: "지금 이동할게요",
    },
    security: "전화번호와 방문자 신원은 서로에게 공개되지 않습니다.",
    submit: "답장 보내기",
    success: "답장이 전달되었습니다.",
    vehicle: "등록 차량 끝자리",
  },
  en: {
    callerMessage: "Message received",
    moreReplies: "More replies",
    customPlaceholder: "Or write your own reply",
    successTitle: ["Your reply", "was delivered"],
    errorTitle: ["This link", "cannot be opened"],
    back: "Open my sticker",
    customLabel: "Custom reply",
    description: "This link can only reply to this request and cannot change vehicle details.",
    error: "This link has expired or was already used.",
    eyebrow: "Owner reply",
    line1: "Review the vehicle contact request",
    line2: "and send a quick reply.",
    loading: "Checking the secure request.",
    replies: {
      CANNOT_MOVE_NOW: "I cannot move it now",
      CONTACT_SITE_OFFICE: "Please contact the site office",
      MOVE_IN_10_MINUTES: "I will move it in 10 minutes",
      MOVE_IN_3_MINUTES: "I will move it in 3 minutes",
      MOVE_IN_5_MINUTES: "I will move it in 5 minutes",
      MOVING_NOW: "I am moving it now",
    },
    security: "Phone numbers and caller identity are not disclosed to either party.",
    submit: "Send reply",
    success: "Your reply was delivered.",
    vehicle: "Registered vehicle ending",
  },
};
