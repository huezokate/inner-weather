// Inner Weather — AI intensity classifier (the second InsForge demonstration: AI gateway).
// Live items (Reddit + You.com) arrive with a coarse *source-prior* intensity. This module
// sends their titles to the InsForge AI gateway and overwrites each live item's intensity with
// a real 1–5 model score. Like every adapter here it is fully error-isolated: missing keys, an
// unprovisioned gateway, a failed call, or unparseable output all resolve to "keep the priors"
// — the function never throws and HERO_FEED is never passed in, so the demo floor is untouched.
//
// Browser-safe by construction: it goes through the InsForge gateway using the public anon key
// (the same one already in the bundle for the diary DB). The OpenRouter key stays server-side on
// InsForge — we never ship one. See docs/active/work/T-001-05/design.md (Decision 1).

import { createClient } from "@insforge/sdk";
import type { FeedItem } from "../feed";

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined;

/** True only when both env vars are present — otherwise we never touch the network. */
export const classifyConfigured = Boolean(baseUrl && anonKey);

// Created once and reused. `null` when unconfigured so live items simply keep their priors.
const client = classifyConfigured ? createClient({ baseUrl, anonKey }) : null;

// Single point to swap models. A small, fast model is ideal for terse JSON rating work; this is
// reliably available on the OpenRouter catalog the gateway fronts. Swap to e.g.
// "anthropic/claude-3.5-haiku" here without touching anything else.
const CLASSIFY_MODEL = "openai/gpt-4o-mini";

// The rubric is the app's own intensity scale (see FeedItem in feed.ts).
const SYSTEM_PROMPT =
  "You rate how activating/agitating a piece of content is, on this scale: " +
  "1 soothing, 2 calm, 3 neutral, 4 activating, 5 agitating. " +
  "Judge from the title alone. Respond with data only, never prose.";

/** Clamp anything the model hands back to an integer in the valid 1..5 range. */
function clampIntensity(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Build the user turn: the live items as {id,title} plus a strict output instruction. */
function buildUserPrompt(items: FeedItem[]): string {
  const payload = items.map((it) => ({ id: it.id, title: it.title }));
  return (
    "Rate each item 1–5 for how activating/agitating it is. " +
    'Return ONLY a JSON array of {"id","intensity"} — no markdown, no commentary.\n\n' +
    JSON.stringify(payload)
  );
}

/** Pull the first [ … ] block out of model text, tolerating ```json fences and stray prose. */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

/**
 * Turn raw model content into a trustworthy id→intensity map. Treats the input as hostile:
 * any shape problem yields an empty map (→ caller keeps the priors). Never throws.
 */
function parseScores(content: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (typeof content !== "string" || content.trim().length === 0) return out;
  const json = extractJsonArray(content);
  if (!json) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const { id, intensity } = row as { id?: unknown; intensity?: unknown };
    if (typeof id !== "string") continue;
    const n = Number(intensity);
    if (!Number.isFinite(n)) continue;
    out.set(id, clampIntensity(n));
  }
  return out;
}

/**
 * Refine live item intensities with real model scores. Returns a new array the same length as
 * the input; only the `intensity` of items the model scored changes — every other field, and
 * any unscored item, is preserved. Total: on missing keys, an unconfigured/failed gateway, or
 * unusable output it returns `items` unchanged. HERO_FEED is never passed here.
 */
export async function classifyIntensity(items: FeedItem[]): Promise<FeedItem[]> {
  if (!client) {
    console.info("classify: InsForge keys not set — live items keep their source-prior intensities.");
    return items;
  }
  if (items.length === 0) return items;
  try {
    const completion = await client.ai.chat.completions.create({
      model: CLASSIFY_MODEL,
      temperature: 0, // deterministic so the demo scores the same every run (if honored)
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(items) },
      ],
    });
    const scores = parseScores(completion?.choices?.[0]?.message?.content);
    if (scores.size === 0) {
      console.warn("classify: gateway returned no usable scores — keeping source-prior intensities.");
      return items;
    }
    return items.map((it) =>
      scores.has(it.id) ? { ...it, intensity: scores.get(it.id)! } : it,
    );
  } catch (err) {
    console.warn("classify: AI gateway call failed — keeping source-prior intensities.", err);
    return items;
  }
}
