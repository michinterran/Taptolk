import type { ContactReasonCode } from "@taptolk/domain";
import type { AppLocale } from "../i18n/config";

export interface PublicContactCopy {
  back: string;
  confirmDescription: string;
  confirmTitle: string;
  description: string;
  errorConflict: string;
  errorInvalid: string;
  errorLimited: string;
  errorUnavailable: string;
  freeMessage: string;
  freeMessageHint: string;
  inspectLabel: string;
  line1: string;
  line2: string;
  loading: string;
  ownerPrivacy: string;
  preparing: string;
  reasonDescription: string;
  reasonLabels: Readonly<Record<ContactReasonCode, string>>;
  reasonTitle: string;
  retry: string;
  security: string;
  send: string;
  siteLabel: string;
  templateMessages: Readonly<Record<ContactReasonCode, string>>;
  vehicleConfirm: string;
  vehicleDescription: string;
  vehicleTitle: string;
  waitDescription: string;
  waitExpired: string;
  waitLine1: string;
  waitLine2: string;
  waitQueued: string;
  waitReply: string;
  waitResolved: string;
}

const ko: PublicContactCopy = {
  back: "이전",
  confirmDescription: "아래 내용으로 요청을 접수하고 차주 알림을 준비합니다.",
  confirmTitle: "요청 내용을 확인해 주세요.",
  description: "전화번호를 공개하지 않고 필요한 차량 요청을 안전하게 전달합니다.",
  errorConflict: "같은 차량 요청이 이미 열려 있습니다. 기존 대기방을 확인해 주세요.",
  errorInvalid: "차량 또는 입력 내용을 다시 확인해 주세요.",
  errorLimited: "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  errorUnavailable: "지금 요청을 준비할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  freeMessage: "직접 입력",
  freeMessageHint: "전화번호, 이메일, URL 없이 200자 이내로 입력해 주세요.",
  inspectLabel: "차량 연락",
  line1: "전화번호 노출 없이",
  line2: "차주에게 메시지를 전달합니다.",
  loading: "QR과 차량 상태를 확인하고 있습니다.",
  ownerPrivacy: "차주의 이름과 전화번호는 표시되지 않습니다.",
  preparing: "요청을 접수하는 중",
  reasonDescription: "가장 가까운 상황 하나를 선택해 주세요.",
  reasonLabels: {
    ACCIDENT_CONTACT: "접촉사고 확인",
    DOUBLE_PARKED: "이중주차",
    EXIT_BLOCKED: "출입구 차단",
    LIGHT_ON: "라이트 켜짐",
    MOVE_REQUEST: "차량 이동",
    OTHER: "직접 입력",
    VEHICLE_DAMAGE: "차량 이상",
    VEHICLE_NOT_MOVING: "차량이 움직이지 않음",
    WINDOW_OPEN: "창문 열림",
  },
  reasonTitle: "어떤 도움이 필요한가요?",
  retry: "다시 시도",
  security: "요청 토큰과 익명 식별값은 브라우저 보안 쿠키와 서버 해시로만 처리합니다.",
  send: "요청 접수하기",
  siteLabel: "관리 장소",
  templateMessages: {
    ACCIDENT_CONTACT: "접촉사고 관련 확인이 필요합니다.",
    DOUBLE_PARKED: "이중주차 차량이 움직이지 않습니다.",
    EXIT_BLOCKED: "출입구를 막고 있어 이동을 부탁드립니다.",
    LIGHT_ON: "차량 라이트가 켜져 있습니다.",
    MOVE_REQUEST: "차량 이동을 부탁드립니다.",
    OTHER: "",
    VEHICLE_DAMAGE: "차량 이상이 확인되어 알려드립니다.",
    VEHICLE_NOT_MOVING: "이중주차 차량이 움직이지 않습니다.",
    WINDOW_OPEN: "차량 창문이 열려 있습니다.",
  },
  vehicleConfirm: "이 차량이 맞습니다",
  vehicleDescription: "스티커가 부착된 차량의 번호 끝 4자리를 확인해 주세요.",
  vehicleTitle: "이 차량이 맞나요?",
  waitDescription: "이 화면을 닫아도 같은 브라우저에서 대기 상태를 다시 확인할 수 있습니다.",
  waitExpired: "요청 시간이 만료되었습니다.",
  waitLine1: "차주 알림을",
  waitLine2: "안전하게 준비하고 있습니다.",
  waitQueued: "차주 알림을 준비하는 중",
  waitReply: "차주가 답장했습니다.",
  waitResolved: "요청이 완료되었습니다.",
};

const en: PublicContactCopy = {
  back: "Back",
  confirmDescription: "We will accept this request and prepare an owner notification.",
  confirmTitle: "Review your request.",
  description: "Send an essential vehicle request without exposing anyone's phone number.",
  errorConflict: "A matching vehicle request is already open. Check the existing waiting room.",
  errorInvalid: "Check the vehicle and the information you entered.",
  errorLimited: "The request limit was reached. Please try again later.",
  errorUnavailable: "The request cannot be prepared right now. Please try again shortly.",
  freeMessage: "Write a message",
  freeMessageHint: "Use up to 200 characters without phone numbers, email addresses, or URLs.",
  inspectLabel: "Vehicle contact",
  line1: "Send a message to the owner",
  line2: "without exposing a phone number.",
  loading: "Checking the QR and vehicle status.",
  ownerPrivacy: "The owner's name and phone number are never shown.",
  preparing: "Accepting your request",
  reasonDescription: "Choose the one option closest to the situation.",
  reasonLabels: {
    ACCIDENT_CONTACT: "Accident follow-up",
    DOUBLE_PARKED: "Double parked",
    EXIT_BLOCKED: "Exit blocked",
    LIGHT_ON: "Lights left on",
    MOVE_REQUEST: "Move vehicle",
    OTHER: "Write a message",
    VEHICLE_DAMAGE: "Vehicle issue",
    VEHICLE_NOT_MOVING: "Vehicle not moving",
    WINDOW_OPEN: "Window open",
  },
  reasonTitle: "What does the vehicle owner need to know?",
  retry: "Try again",
  security: "Request tokens and anonymous identity are handled only as secure cookies and hashes.",
  send: "Submit request",
  siteLabel: "Managed location",
  templateMessages: {
    ACCIDENT_CONTACT: "Please check a matter related to a vehicle contact incident.",
    DOUBLE_PARKED: "The double-parked vehicle is not moving.",
    EXIT_BLOCKED: "The vehicle is blocking an exit. Please move it.",
    LIGHT_ON: "The vehicle lights are still on.",
    MOVE_REQUEST: "Please move the vehicle.",
    OTHER: "",
    VEHICLE_DAMAGE: "A possible issue with the vehicle needs attention.",
    VEHICLE_NOT_MOVING: "The parked vehicle is not moving.",
    WINDOW_OPEN: "A vehicle window is open.",
  },
  vehicleConfirm: "Yes, this is the vehicle",
  vehicleDescription: "Confirm the last four characters of the plate on the stickered vehicle.",
  vehicleTitle: "Is this the right vehicle?",
  waitDescription: "You can close this screen and reopen the waiting status in the same browser.",
  waitExpired: "This request has expired.",
  waitLine1: "Preparing a secure",
  waitLine2: "notification for the owner.",
  waitQueued: "Preparing the owner notification",
  waitReply: "The owner replied.",
  waitResolved: "The request is complete.",
};

export const PUBLIC_CONTACT_COPY: Readonly<Record<AppLocale, PublicContactCopy>> = Object.freeze({
  en,
  ko,
});
