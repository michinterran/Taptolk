import { MobileShell, MobileTabBar } from "@taptolk/ui";
import type { ReactNode } from "react";
import type { OwnerTabsCopy } from "../content/owner-tabs-copy";
import type { AppLocale } from "../i18n/config";

/**
 * [C] shell — the four owner tabs (docs/design-canon/pwa/README.md §3).
 *
 * The tab bar is the owner's. The four mockups draw it on every frame including
 * the caller's, but the caller has no account to tab through and
 * `apps/web/policies/route-policy.ts` keeps bottom navigation hidden for them.
 */
export type OwnerTabId = "alert" | "history" | "messages" | "settings";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="24"
    >
      {children}
    </svg>
  );
}

const ICONS: Readonly<Record<OwnerTabId, ReactNode>> = {
  alert: (
    <Icon>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Icon>
  ),
  history: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  messages: (
    <Icon>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  ),
};

export function OwnerTabShell({
  active,
  children,
  copy,
  locale,
}: {
  active: OwnerTabId;
  children: ReactNode;
  copy: OwnerTabsCopy;
  locale: AppLocale;
}) {
  const tabs = [
    { href: `/${locale}/owner`, id: "messages" as const, label: copy.tabMessages },
    { href: `/${locale}/owner/alert`, id: "alert" as const, label: copy.tabAlert },
    { href: `/${locale}/owner/history`, id: "history" as const, label: copy.tabHistory },
    { href: `/${locale}/owner/settings`, id: "settings" as const, label: copy.tabSettings },
  ];

  return (
    <MobileShell
      brand={
        // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
        <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
      }
      tabs={
        <MobileTabBar
          label={copy.navLabel}
          tabs={tabs.map((tab) => ({
            active: tab.id === active,
            href: tab.href,
            icon: ICONS[tab.id],
            label: tab.label,
          }))}
        />
      }
    >
      {children}
    </MobileShell>
  );
}
