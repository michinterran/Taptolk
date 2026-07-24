import type { AppLocale } from "../i18n/config";

/**
 * Copy for re-entry — the owner who changed phone, cleared their browser, or
 * opened the sticker in a private window (docs/design-canon/pwa/README.md §1).
 *
 * This is not registration again. The binding stays exactly as it is; only a
 * new owner session is opened on this device. The copy has to say that, or the
 * owner will think they are about to register their car a second time.
 *
 * A mismatch never says which of the two was wrong. Telling someone that the
 * plate matched but the phone did not turns two unknowns into one and helps
 * them guess the other (README §1).
 */
export interface OwnerReclaimCopy {
  /** The link at the foot of the contact screen that starts this. */
  entryLink: string;
  intro: readonly [string, ...string[]];
  introBody: string;
  plateLabel: string;
  plateTitle: readonly [string, ...string[]];
  plateHint: string;
  phoneLabel: string;
  phoneTitle: readonly [string, ...string[]];
  phoneHint: string;
  sendCode: string;
  resend: string;
  resendIn: string;
  otpLabel: string;
  otpRemaining: string;
  back: string;
  next: string;
  submit: string;
  /** One message for every mismatch. It does not say which field failed. */
  mismatch: string;
  limited: string;
  unavailable: string;
  doneTitle: readonly [string, ...string[]];
  doneBody: string;
  openOwner: string;
}

const ko: OwnerReclaimCopy = {
  entryLink: "이 차량의 차주이신가요?",
  intro: ["이 기기에서", "다시 확인합니다"],
  introBody: "등록을 다시 하지 않습니다. 차량 연결은 그대로 두고 이 기기에서만 다시 확인합니다.",
  plateLabel: "차량번호",
  plateTitle: ["차량번호를", "입력하세요"],
  plateHint: "이 스티커에 연결된 차량의 번호",
  phoneLabel: "휴대전화 번호",
  phoneTitle: ["등록하신", "번호"],
  phoneHint: "등록할 때 인증한 번호를 입력해 주세요.",
  sendCode: "인증번호 받기",
  resend: "인증번호 다시 받기",
  resendIn: "다시 받기까지 {seconds}초",
  otpLabel: "휴대전화 인증번호",
  otpRemaining: "남은 시간 {time}",
  back: "이전 단계",
  next: "다음",
  submit: "확인하고 열기",
  mismatch: "입력하신 내용이 이 스티커와 맞지 않습니다. 관리사무소에 문의해 주세요.",
  limited: "확인 횟수를 넘겼습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: "지금 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  doneTitle: ["이 기기에서", "다시 열렸습니다"],
  doneBody: "받은 연락을 이 기기에서 확인할 수 있습니다.",
  openOwner: "내 스티커 열기",
};

const en: OwnerReclaimCopy = {
  entryLink: "Are you the owner of this vehicle?",
  intro: ["Confirm again", "on this device"],
  introBody:
    "This is not registering again. The vehicle stays linked as it is; only this device is confirmed.",
  plateLabel: "Vehicle plate",
  plateTitle: ["Enter the", "vehicle plate"],
  plateHint: "The plate linked to this sticker",
  phoneLabel: "Mobile number",
  phoneTitle: ["The number", "you registered"],
  phoneHint: "Enter the number you verified when you registered.",
  sendCode: "Send a code",
  resend: "Send a new code",
  resendIn: "You can ask again in {seconds}s",
  otpLabel: "Verification code",
  otpRemaining: "{time} left",
  back: "Previous step",
  next: "Next",
  submit: "Confirm and open",
  mismatch: "That does not match this sticker. Please contact the management office.",
  limited: "Too many attempts. Please try again in a moment.",
  unavailable: "This cannot be checked right now. Please try again in a moment.",
  doneTitle: ["Opened again", "on this device"],
  doneBody: "You can now read the messages you receive on this device.",
  openOwner: "Open my sticker",
};

export const OWNER_RECLAIM_COPY: Readonly<Record<AppLocale, OwnerReclaimCopy>> = Object.freeze({
  en,
  ko,
});
