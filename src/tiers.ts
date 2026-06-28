// Inner Weather — tier system (ported from Kate-City's 3-era model)
// Oura readiness → tier → intensity ceiling + UI mood. Floor 50, ceiling 98 (human range).

export type TierKey = "SHARP" | "PERSEVERANCE" | "FOG";

export interface Tier {
  key: TierKey;
  /** NASI mode this tier maps to */
  mode: "Loom" | "Sprite" | "Shell";
  label: string;
  /** copy shown under the readiness header */
  blurb: string;
  /** max content intensity (1–5) allowed through the shield */
  ceiling: number;
  /** inclusive readiness floor for this tier */
  min: number;
}

export const TIERS: Record<TierKey, Tier> = {
  SHARP: {
    key: "SHARP",
    mode: "Loom",
    label: "Sharp",
    blurb: "Everything is clicking. Bring it on.",
    ceiling: 5, // everything flows
    min: 80,
  },
  PERSEVERANCE: {
    key: "PERSEVERANCE",
    mode: "Sprite",
    label: "Perseverance",
    blurb: "Warming up. Give it an hour.",
    ceiling: 3, // balanced — no doomscroll
    min: 70,
  },
  FOG: {
    key: "FOG",
    mode: "Shell",
    label: "Fog",
    blurb: "Foggy. Rest is data too.",
    ceiling: 2, // calm/cute only
    min: 50,
  },
};

/** Kate-City normalization: 0.0 … 1.0 across the human readiness range. */
export function power(score: number): number {
  return Math.min(1, Math.max(0, (score - 50) / (98 - 50)));
}

export function tierForScore(score: number): Tier {
  if (score >= TIERS.SHARP.min) return TIERS.SHARP;
  if (score >= TIERS.PERSEVERANCE.min) return TIERS.PERSEVERANCE;
  return TIERS.FOG;
}
