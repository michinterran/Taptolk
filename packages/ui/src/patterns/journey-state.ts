export const JOURNEY_STATES = [
  "idle",
  "loading",
  "waiting",
  "empty",
  "success",
  "error",
  "retrying",
  "completed",
] as const;

export type JourneyState = (typeof JOURNEY_STATES)[number];

const BUSY_STATES: ReadonlySet<JourneyState> = new Set(["loading", "waiting", "retrying"]);

export function isBusyJourneyState(state: JourneyState): boolean {
  return BUSY_STATES.has(state);
}

export function requiresRecoveryAction(state: JourneyState): boolean {
  return state === "error";
}
