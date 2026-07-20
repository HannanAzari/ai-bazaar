/**
 * lib/identity — the Identity Lock pipeline. Priority: IDENTITY > FUNCTION > DNA.
 * Enforced deterministically (extract → validate → targeted-repair), never by trusting
 * the model to preserve identity.
 */

export * from "./types";
export { extractContract, clusterForeground, detailMaskOf } from "./extract";
export { validateIdentity, alphaIoU } from "./validator";
export { targetedRepair } from "./repair";
export { buildIdentityPrompt } from "./prompt";
