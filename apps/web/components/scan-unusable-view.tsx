import { MobileCard, MobileNotice, MobileShell, SemanticHeading } from "@taptolk/ui";
import type { ScanEntryCopy } from "../content/scan-entry-copy";

/**
 * [E] — one screen with the reason swapped (docs/design-canon/pwa/README.md §4).
 *
 * No tab bar: whoever is looking at this has no account behind it. No retry
 * button: the asset's state has to change before the sticker works again.
 */
export function ScanUnusableView({
  copy,
  reason,
}: {
  copy: ScanEntryCopy;
  reason: "SERVICE" | "UNKNOWN";
}) {
  return (
    <MobileShell
      brand={
        // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
        <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
      }
    >
      <MobileCard center>
        <SemanticHeading as="h1" className="tt-m-heading" lines={copy.title} />
        <p className="tt-m-card__note">
          {reason === "SERVICE" ? copy.reasonService : copy.reasonUnknown}
        </p>
      </MobileCard>
      <MobileNotice center>{copy.office}</MobileNotice>
    </MobileShell>
  );
}
