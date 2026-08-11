import type { AppLocale } from "../i18n/config";

export interface OwnerActivationCopy {
  /** A-1 · the sticker decides the site; the owner only confirms it. */
  locationQuestion: string;
  locationConfirm: string;
  locationWrong: string;
  /** A-1 · chosen "this is not my location". The flow stops here on purpose. */
  locationStopTitle: readonly [string, ...string[]];
  locationStopBody: string;
  /** A-1 · shown when the server has no address for this site yet. */
  locationAddressMissing: string;
  /** A-2 */
  plateTitle: readonly [string, ...string[]];
  plateFieldHint: string;
  siteContactLocation: string;
  siteContactLocationHint: string;
  siteContactLocationTitle: readonly [string, ...string[]];
  /** A-3 */
  phoneTitle: readonly [string, ...string[]];
  sendCode: string;
  otpMessage: string;
  resendIn: string;
  otpRemaining: string;
  phonePrivacy: string;
  otpExpired: string;
  otpMismatch: string;
  otpAttemptsExhausted: string;
  /** A-4 */
  doneTitle: readonly [string, ...string[]];
  doneChannel: string;
  start: string;
  /** Step counter, e.g. "2 / 3". Announced, not drawn as a stepper. */
  stepOf: string;
  back: string;
  consent: string;
  consentDescription: string;
  description: string;
  errorConflict: string;
  errorInvalid: string;
  errorLimited: string;
  errorUnavailable: string;
  homeLink: string;
  inspect: string;
  line1: string;
  line2: string;
  loading: string;
  manifestDescription: string;
  manifestName: string;
  next: string;
  openOwner: string;
  otp: string;
  otpHint: string;
  phone: string;
  phoneHint: string;
  plate: string;
  plateHint: string;
  resend: string;
  security: string;
  submit: string;
  successDescription: string;
  successTitle: string;
  verify: string;
  vehiclePlate: string;
  vehiclesEmpty: string;
  vehiclesTitle: string;
}

const ko: OwnerActivationCopy = {
  locationQuestion: "이 위치가 맞습니까?",
  locationConfirm: "맞습니다 · 등록 시작",
  locationWrong: "위치가 다릅니다",
  locationStopTitle: ["등록을", "진행하지 않았습니다"],
  locationStopBody:
    "스티커가 소속을 정하기 때문에 다른 현장을 고를 수 없습니다. 관리사무소에 문의해 주세요.",
  locationAddressMissing: "주소가 등록되어 있지 않습니다.",
  plateTitle: ["차량번호를", "입력하세요"],
  plateFieldHint: "스티커를 붙인 차량의 번호",
  siteContactLocation: "현장 호출 위치",
  siteContactLocationHint:
    "동·호수, 인터폰 호출명, 주차 위치 등. 이름과 전화번호는 입력하지 마세요.",
  siteContactLocationTitle: ["인터폰으로", "찾을 위치"],
  phoneTitle: ["연락받을", "번호"],
  sendCode: "인증번호 받기",
  otpMessage: "[Taptolk] 인증번호는 {otp}입니다. 3분 안에 입력해 주세요.",
  resendIn: "다시 받기까지 {seconds}초",
  otpRemaining: "남은 시간 {time}",
  phonePrivacy: "번호는 암호화해 저장하고 호출자에게 보이지 않습니다.",
  otpExpired: "인증번호가 만료되었습니다. 다시 받아 주세요.",
  otpMismatch: "인증번호가 맞지 않습니다.",
  otpAttemptsExhausted: "시도 횟수를 넘겼습니다. 인증번호를 다시 받아 주세요.",
  doneTitle: ["등록이", "끝났습니다."],
  doneChannel: "알림톡으로 연락을 받습니다.",
  start: "시작하기",
  stepOf: "{current} / {total} 단계",
  back: "이전 단계",
  consent: "이용약관과 개인정보 처리방침에 동의합니다.",
  consentDescription:
    "차량 연결과 전화번호를 공개하지 않는 연락 제공에 필요한 범위에서만 정보를 사용합니다.",
  description: "차량과 휴대전화 확인을 마치면 이 QR로 안전하게 연락받을 수 있습니다.",
  errorConflict: "이미 다른 연결이 완료되었습니다. 관리사무소에 확인해 주세요.",
  errorInvalid: "입력값 또는 활성화 상태를 다시 확인해 주세요.",
  errorLimited: "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  errorUnavailable: "안전한 연결을 준비할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  homeLink: "Taptolk 홈으로",
  inspect: "QR 상태 확인",
  line1: "차량 QR을",
  line2: "안전하게 활성화합니다.",
  loading: "활성화 가능 상태를 확인하고 있습니다.",
  manifestDescription: "전화번호를 공개하지 않는 차량 QR 연락 서비스",
  manifestName: "Taptolk 차주",
  next: "다음",
  openOwner: "내 차량 보기",
  otp: "휴대전화 인증번호",
  otpHint: "3분 안에 6자리 인증번호를 입력해 주세요.",
  phone: "휴대전화 번호",
  phoneHint: "차주 확인에 사용할 번호를 입력해 주세요.",
  plate: "차량번호",
  plateHint: "공백 없이 입력해도 됩니다.",
  resend: "인증번호 다시 받기",
  security: "전화번호와 인증번호는 화면과 로그에 남기지 않습니다.",
  submit: "동의하고 활성화 완료",
  successDescription:
    "차량과 QR 연결이 완료되었습니다. 이제 전화번호 공개 없이 연락받을 수 있습니다.",
  successTitle: "QR 활성화가 완료되었습니다.",
  verify: "인증번호 확인",
  vehiclePlate: "연결 차량",
  vehiclesEmpty: "이 세션에 연결된 차량이 없습니다.",
  vehiclesTitle: "내 차량",
};

const en: OwnerActivationCopy = {
  locationQuestion: "Is this the right place?",
  locationConfirm: "Yes · start registration",
  locationWrong: "This is not my location",
  locationStopTitle: ["Registration", "did not continue"],
  locationStopBody:
    "The sticker decides which site it belongs to, so another site cannot be chosen here. Please contact the management office.",
  locationAddressMissing: "No address is on file for this site.",
  plateTitle: ["Enter the", "vehicle plate"],
  plateFieldHint: "The plate of the vehicle carrying this sticker",
  siteContactLocation: "Site call location",
  siteContactLocationHint:
    "Unit, intercom label, or parking location. Do not enter a name or phone number.",
  siteContactLocationTitle: ["Where the site", "can reach you"],
  phoneTitle: ["Number to", "be reached on"],
  sendCode: "Send a code",
  otpMessage: "[Taptolk] Your verification code is {otp}. Enter it within 3 minutes.",
  resendIn: "You can ask again in {seconds}s",
  otpRemaining: "{time} left",
  phonePrivacy: "Your number is stored encrypted and is never shown to the caller.",
  otpExpired: "That code has expired. Please ask for a new one.",
  otpMismatch: "That code does not match.",
  otpAttemptsExhausted: "Too many attempts. Please ask for a new code.",
  doneTitle: ["Registration", "is complete."],
  doneChannel: "You will be contacted through KakaoTalk notifications.",
  start: "Get started",
  stepOf: "Step {current} of {total}",
  back: "Previous step",
  consent: "I agree to the Terms and Privacy Policy.",
  consentDescription:
    "Your information is used only to link this vehicle and relay contact without sharing phone numbers.",
  description: "Verify the vehicle and phone to receive essential messages through this QR code.",
  errorConflict: "Another activation has already completed. Contact the site office.",
  errorInvalid: "Check the activation status and the information you entered.",
  errorLimited: "The request limit was reached. Please try again later.",
  errorUnavailable: "A secure connection is unavailable. Please try again shortly.",
  homeLink: "Go to Taptolk home",
  inspect: "Check QR status",
  line1: "Activate your vehicle QR",
  line2: "with a secure verification.",
  loading: "Checking whether this QR can be activated.",
  manifestDescription: "Vehicle QR contact without exposing a phone number",
  manifestName: "Taptolk Owner",
  next: "Next",
  openOwner: "View my vehicle",
  otp: "Phone verification code",
  otpHint: "Enter the six-digit code within three minutes.",
  phone: "Mobile number",
  phoneHint: "Enter the number used to verify the vehicle owner.",
  plate: "Vehicle plate",
  plateHint: "Spaces and hyphens are optional.",
  resend: "Send a new code",
  security:
    "Phone numbers and verification codes are never retained in screen or application logs.",
  submit: "Agree and complete activation",
  successDescription:
    "The vehicle and QR are connected. People can now contact you without seeing your phone number.",
  successTitle: "QR activation is complete.",
  verify: "Verify code",
  vehiclePlate: "Linked vehicle",
  vehiclesEmpty: "No vehicle is linked to this session.",
  vehiclesTitle: "My vehicles",
};

export const OWNER_ACTIVATION_COPY: Readonly<Record<AppLocale, OwnerActivationCopy>> =
  Object.freeze({ en, ko });
