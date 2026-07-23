import "server-only";

import { createLogger } from "@taptolk/observability";
import { createOwnerActivationService } from "../owner/owner-activation-runtime";
import { OwnerActivationRepositoryError } from "../owner/supabase-owner-activation-repository";
import { createPublicContactService } from "../public-contact/public-contact-runtime";
import { PublicContactRepositoryError } from "../public-contact/supabase-public-contact-repository";
import { decideScanScreen, type ScanProbe, type ScanScreen } from "./scan-entry-decision";

const logger = createLogger({ service: "taptolk-web" });

/**
 * Resolve what a scan of this sticker shows. The screen is chosen here, on the
 * server, from the asset's own state — one sticker, one URL
 * (docs/design-canon/pwa/README.md §1).
 *
 * The public token is never logged: it is the credential the sticker carries
 * (AGENTS.md, Security).
 */
export async function resolveScanEntry(publicToken: string): Promise<ScanScreen> {
  const contact = await probeContact(publicToken);
  // Only ask the second repository when the first did not answer. An active,
  // bound sticker is a contact screen and nothing else needs to be looked up.
  const activation = contact === "MATCH" ? "NO_MATCH" : await probeActivation(publicToken);
  const decision = decideScanScreen({ activation, contact });
  logger.info("scan_entry.resolved", {
    activation,
    contact,
    screen: decision.screen,
  });
  return decision;
}

async function probeContact(publicToken: string): Promise<ScanProbe> {
  const service = createPublicContactService();
  if (!service) {
    return "UNAVAILABLE";
  }
  try {
    await service.inspect({ publicToken });
    return "MATCH";
  } catch (error) {
    return probeFromRepositoryError(
      error instanceof PublicContactRepositoryError ? error.code : null,
    );
  }
}

async function probeActivation(publicToken: string): Promise<ScanProbe> {
  const service = createOwnerActivationService();
  if (!service) {
    return "UNAVAILABLE";
  }
  try {
    await service.inspect({ publicToken });
    return "MATCH";
  } catch (error) {
    return probeFromRepositoryError(
      error instanceof OwnerActivationRepositoryError ? error.code : null,
    );
  }
}

/**
 * Both repositories map "this token is not one of mine" to `INVALID`. Everything
 * else — an outage, a rate limit, an unexpected shape — is a failure to ask, and
 * a failure to ask must never be shown as a revoked sticker.
 */
function probeFromRepositoryError(code: string | null): ScanProbe {
  return code === "INVALID" ? "NO_MATCH" : "UNAVAILABLE";
}
