/**
 * One sticker, one URL. What the scanner sees is decided here, from the asset's
 * state — the screen never guesses (docs/design-canon/pwa/README.md §1).
 *
 * This module is pure so the branch can be tested without a database. The probes
 * are run by `scan-entry.ts`, which owns the service calls.
 */

/**
 * The outcome of asking one repository about this token.
 *
 * `UNAVAILABLE` is not `NO_MATCH`. "We could not ask" and "this sticker is not
 * usable" are different facts and the screen must not present one as the other
 * (DESIGN_SYSTEM.md §4).
 */
export type ScanProbe = "MATCH" | "NO_MATCH" | "UNAVAILABLE";

export type ScanScreen =
  /** [A] — the asset is not activated yet, so whoever holds the sticker registers it. */
  | { screen: "ACTIVATE" }
  /** [B] — the asset is active and bound, so this is a third party asking to reach the owner. */
  | { screen: "CONTACT" }
  /**
   * [E] — one screen, reason swapped. `SERVICE` means we could not reach the
   * repositories; `UNKNOWN` means neither of them recognised the token.
   *
   * Neither reason names the site. A revoked sticker must not be a way to learn
   * which site it belonged to (README §4).
   */
  | { reason: "SERVICE" | "UNKNOWN"; screen: "UNUSABLE" };

export interface ScanProbes {
  /** `inspect_owner_activation`: the asset exists and is not activated yet. */
  activation: ScanProbe;
  /** `inspect_public_contact`: the asset is active with a live primary binding. */
  contact: ScanProbe;
}

export function decideScanScreen({ activation, contact }: ScanProbes): ScanScreen {
  if (contact === "MATCH") {
    return { screen: "CONTACT" };
  }
  if (activation === "MATCH") {
    return { screen: "ACTIVATE" };
  }
  if (contact === "UNAVAILABLE" || activation === "UNAVAILABLE") {
    return { reason: "SERVICE", screen: "UNUSABLE" };
  }
  return { reason: "UNKNOWN", screen: "UNUSABLE" };
}
