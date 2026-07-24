import type { AppLocale } from "../i18n/config";

/**
 * Copy for [C], the owner's own screens (docs/design-canon/pwa/README.md §3).
 *
 * The tab bar belongs to the owner and to nobody else: the caller has no
 * account, and `apps/web/policies/route-policy.ts` keeps bottom navigation
 * hidden for them.
 *
 * No phone number appears anywhere here (operator, 2026-07-24). ALERT says the
 * channel is connected; SETTINGS says verification is done. The owner knows
 * their own number, and drawing it would mean sending it to the browser.
 */
export interface OwnerTabsCopy {
  /** Landmark name for the bottom bar. */
  navLabel: string;
  tabMessages: string;
  tabAlert: string;
  tabHistory: string;
  tabSettings: string;

  loading: string;
  unavailable: string;
  retry: string;

  /** MESSAGES */
  messagesTitle: readonly [string, ...string[]];
  messagesEmptyTitle: string;
  messagesEmptyBody: string;
  messagesReply: string;

  /** ALERT */
  alertTitle: readonly [string, ...string[]];
  alertChannel: string;
  alertConnected: string;
  /** Shown when the server cannot tell us the channel state. Never guessed. */
  alertUnknown: string;
  alertVerifiedNumber: string;
  alertBlockedWarning: string;
  alertDevice: string;
  alertDeviceEnable: string;

  /** HISTORY */
  historyTitle: readonly [string, ...string[]];
  historyEmptyTitle: string;
  historyEmptyBody: string;
  historyAnswered: string;
  historyUnanswered: string;

  /** SETTINGS */
  settingsTitle: readonly [string, ...string[]];
  settingsPlate: string;
  settingsContact: string;
  settingsContactVerified: string;
  settingsSite: string;
  settingsStickerState: string;
  settingsChange: string;
  suspend: string;
  suspendTitle: readonly [string, ...string[]];
  suspendBody: string;
  release: string;
  releaseTitle: readonly [string, ...string[]];
  releaseBody: string;
  releaseAuditNote: string;
  confirm: string;
  cancel: string;
}

const ko: OwnerTabsCopy = {
  navLabel: "차주 메뉴",
  tabMessages: "MESSAGES",
  tabAlert: "ALERT",
  tabHistory: "HISTORY",
  tabSettings: "SETTINGS",

  loading: "불러오는 중입니다.",
  unavailable: "지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",

  messagesTitle: ["받은 연락"],
  messagesEmptyTitle: "받은 연락이 없습니다",
  messagesEmptyBody: "누군가 스티커를 스캔하면 알림톡으로 알려드립니다.",
  messagesReply: "답장하기",

  alertTitle: ["알림"],
  alertChannel: "카카오 알림톡",
  alertConnected: "연결됨",
  alertUnknown: "상태 확인 불가",
  alertVerifiedNumber: "인증하신 번호로 연락을 받습니다.",
  alertBlockedWarning: "채널을 차단하면 연락을 받을 수 없습니다.",
  alertDevice: "이 기기 알림",
  alertDeviceEnable: "켜기",

  historyTitle: ["지난 호출"],
  historyEmptyTitle: "지난 호출이 없습니다",
  historyEmptyBody: "연락을 받으면 여기에 쌓입니다.",
  historyAnswered: "응답함",
  historyUnanswered: "미응답",

  settingsTitle: ["설정"],
  settingsPlate: "차량번호",
  settingsContact: "연락처",
  settingsContactVerified: "인증 완료",
  settingsSite: "관리 현장",
  settingsStickerState: "스티커 상태",
  settingsChange: "변경",
  suspend: "스티커 사용 중지",
  suspendTitle: ["스티커를", "중지할까요?"],
  suspendBody: "중지하는 동안에는 연락을 받지 않습니다. 언제든 다시 켤 수 있습니다.",
  release: "등록 해지",
  releaseTitle: ["등록을", "해지할까요?"],
  releaseBody: "차량과 스티커의 연결이 끊어집니다. 다시 쓰려면 처음부터 등록해야 합니다.",
  releaseAuditNote: "해지해도 지난 호출 기록은 감사 목적으로 남습니다.",
  confirm: "확인",
  cancel: "취소",
};

const en: OwnerTabsCopy = {
  navLabel: "Owner menu",
  tabMessages: "MESSAGES",
  tabAlert: "ALERT",
  tabHistory: "HISTORY",
  tabSettings: "SETTINGS",

  loading: "Loading.",
  unavailable: "This cannot be loaded right now. Please try again in a moment.",
  retry: "Try again",

  messagesTitle: ["Messages"],
  messagesEmptyTitle: "No messages yet",
  messagesEmptyBody: "When someone scans your sticker, you will be notified on KakaoTalk.",
  messagesReply: "Reply",

  alertTitle: ["Notifications"],
  alertChannel: "KakaoTalk notifications",
  alertConnected: "Connected",
  alertUnknown: "Status unknown",
  alertVerifiedNumber: "You are contacted on the number you verified.",
  alertBlockedWarning: "If you block the channel you will not receive messages.",
  alertDevice: "Notifications on this device",
  alertDeviceEnable: "Turn on",

  historyTitle: ["Past requests"],
  historyEmptyTitle: "No past requests",
  historyEmptyBody: "Requests you receive will be listed here.",
  historyAnswered: "Answered",
  historyUnanswered: "No answer",

  settingsTitle: ["Settings"],
  settingsPlate: "Vehicle plate",
  settingsContact: "Contact",
  settingsContactVerified: "Verified",
  settingsSite: "Site",
  settingsStickerState: "Sticker",
  settingsChange: "Change",
  suspend: "Pause this sticker",
  suspendTitle: ["Pause", "this sticker?"],
  suspendBody:
    "While it is paused you will not receive messages. You can turn it back on at any time.",
  release: "End registration",
  releaseTitle: ["End", "this registration?"],
  releaseBody:
    "The vehicle and the sticker will be disconnected. Using it again means registering from the start.",
  releaseAuditNote: "Past requests are kept for audit even after the registration ends.",
  confirm: "Confirm",
  cancel: "Cancel",
};

export const OWNER_TABS_COPY: Readonly<Record<AppLocale, OwnerTabsCopy>> = Object.freeze({
  en,
  ko,
});
