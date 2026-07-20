import type { AppLocale } from "../i18n/config";

export interface OwnerActivationCopy {
  activationCode: string;
  activationCodeHint: string;
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
  activationCode: "활성화 코드",
  activationCodeHint: "스티커와 함께 전달받은 코드를 입력해 주세요.",
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
  next: "인증번호 받기",
  openOwner: "내 차량 보기",
  otp: "휴대전화 인증번호",
  otpHint: "3분 안에 6자리 인증번호를 입력해 주세요.",
  phone: "휴대전화 번호",
  phoneHint: "차주 확인에 사용할 번호를 입력해 주세요.",
  plate: "차량번호",
  plateHint: "공백 없이 입력해도 됩니다.",
  resend: "인증번호 다시 받기",
  security: "전화번호·인증번호·활성화 코드는 화면과 로그에 남기지 않습니다.",
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
  activationCode: "Activation code",
  activationCodeHint: "Enter the code supplied with the sticker.",
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
  next: "Send verification code",
  openOwner: "View my vehicle",
  otp: "Phone verification code",
  otpHint: "Enter the six-digit code within three minutes.",
  phone: "Mobile number",
  phoneHint: "Enter the number used to verify the vehicle owner.",
  plate: "Vehicle plate",
  plateHint: "Spaces and hyphens are optional.",
  resend: "Send a new code",
  security: "Phone, OTP, and activation codes are never retained in screen or application logs.",
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
