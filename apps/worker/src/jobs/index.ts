import type { QueueJobRegistry } from "../queue-consumer.js";

/**
 * Job handlers are registered with their owning feature. Phase 0 keeps this
 * registry empty rather than inventing SMS, rendering, or cleanup behavior.
 */
export const JOB_REGISTRY: QueueJobRegistry = Object.freeze({});
