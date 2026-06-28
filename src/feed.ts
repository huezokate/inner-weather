// Inner Weather — feed model + content sources.
// Each item has an intensity 1–5 (how activating/agitating it is).
// The shield shows items with intensity <= tier.ceiling; the rest get frosted.

import { fetchReddit } from "./sources/reddit";
import { fetchYouCom } from "./sources/youcom";
import { fetchHackerNews } from "./sources/hackernews";
import { classifyIntensity } from "./lib/classify";

export interface FeedItem {
  id: string;
  /** 1 soothing · 2 calm · 3 neutral · 4 activating · 5 agitating */
  intensity: number;
  kind: "cute" | "art" | "nature" | "poem" | "news" | "hottake" | "hype";
  title: string;
  body?: string;
  source: string; // "curated" | "reddit" | "you.com" | "youtube"
  emoji?: string; // stand-in thumbnail for the curated set
  url?: string;
  thumbnail?: string; // real image URL from a live source (Reddit), when present
}

// ── Curated hero set ────────────────────────────────────────────────────────
// Hand-tagged so the Sharp↔Fog flip ALWAYS looks perfect on stage. Demo-safe:
// works with zero API keys. Live sources (below) append to this at runtime.
export const HERO_FEED: FeedItem[] = [
  { id: "h1", intensity: 1, kind: "cute",    emoji: "🐢", title: "a turtle eating a strawberry, very slowly", source: "curated" },
  { id: "h2", intensity: 1, kind: "nature",  emoji: "🌿", title: "10 hours of rain on a tent", source: "curated" },
  { id: "h3", intensity: 1, kind: "poem",    emoji: "🕯️", title: "“rest is also a kind of arrival.”", source: "curated" },
  { id: "h4", intensity: 2, kind: "art",     emoji: "🎨", title: "slow watercolor timelapse — dusk over water", source: "curated" },
  { id: "h5", intensity: 2, kind: "cute",    emoji: "🦦", title: "otters holding hands so they don't drift apart", source: "curated" },
  { id: "h6", intensity: 2, kind: "nature",  emoji: "🍵", title: "how to brew tea like it matters", source: "curated" },
  { id: "h7", intensity: 3, kind: "news",    emoji: "📰", title: "a balanced recap of this week in tech", source: "curated" },
  { id: "h8", intensity: 3, kind: "news",    emoji: "🗺️", title: "explainer: what actually changed in the new release", source: "curated" },
  { id: "h9", intensity: 4, kind: "hype",    emoji: "🚀", title: "you have NO excuse — here's how to 10x your output", source: "curated" },
  { id: "h10", intensity: 5, kind: "hottake", emoji: "🔥", title: "unpopular opinion: your morning routine is cope", source: "curated" },
  { id: "h11", intensity: 5, kind: "hottake", emoji: "💢", title: "everyone shipping AI slop is ruining the craft. fight me.", source: "curated" },
  { id: "h12", intensity: 4, kind: "hype",   emoji: "📈", title: "if you're not building at 2am are you even serious?", source: "curated" },
];

// ── Live sources (loop wires these once keys are in) ────────────────────────
// Source-level intensity priors so we can show real content even before the
// LLM classifier runs. The classifier (InsForge AI gateway) refines per-item.

/** Reddit public JSON — no auth. Maps subreddit → rough intensity prior. */
export const REDDIT_LANES: { sub: string; intensity: number; kind: FeedItem["kind"] }[] = [
  { sub: "aww",            intensity: 1, kind: "cute" },
  { sub: "EarthPorn",      intensity: 1, kind: "nature" },
  { sub: "CozyPlaces",     intensity: 2, kind: "art" },
  { sub: "todayilearned",  intensity: 3, kind: "news" },
  { sub: "unpopularopinion", intensity: 5, kind: "hottake" },
  { sub: "rant",           intensity: 5, kind: "hottake" },
];

// Wired: classifyIntensity(items) -> InsForge AI gateway refines each live item's intensity to
// a real 1–5 model score (src/lib/classify.ts). Total — falls back to these priors on failure.

/** Drop duplicates by normalized url||title, keeping first occurrence (lane order). */
function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    const key = (it.url || it.title).toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** YouTube watch/short/embed/youtu.be URL → native hqdefault thumbnail (free, no key). */
function ytThumb(url: string): string | undefined {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : undefined;
}

/** Last-resort thumbnail: a live screenshot of the page (thum.io, no key). The card's <img>
 *  removes itself on error and reveals the emoji, so a slow/failed shot never blanks a card. */
function screenshotThumb(url: string): string {
  return `https://image.thum.io/get/width/600/crop/450/${url}`;
}

const KIND_EMOJI: Record<FeedItem["kind"], string> = {
  cute: "🐾", art: "🎨", nature: "🌿", poem: "🕯️", news: "📰", hottake: "🔥", hype: "🚀",
};

/** Give every live item a thumbnail (native YouTube → existing → page screenshot) and an
 *  emoji fallback by kind, so the grid reads as real content even before images load. */
function withMedia(items: FeedItem[]): FeedItem[] {
  return items.map((it) => ({
    ...it,
    thumbnail:
      (it.url ? ytThumb(it.url) : undefined) ||
      it.thumbnail ||
      (it.url ? screenshotThumb(it.url) : undefined),
    emoji: it.emoji || KIND_EMOJI[it.kind],
  }));
}

export async function fetchLiveFeed(): Promise<FeedItem[]> {
  try {
    // All adapters are total (never reject — each returns [] on failure), so run them
    // concurrently. You.com + Hacker News lead (richest thumbnails); Reddit trails (it
    // often 403s in prod). withMedia() then guarantees every live card has an image.
    const [you, hn, reddit] = await Promise.all([
      fetchYouCom(),
      fetchHackerNews(),
      fetchReddit(REDDIT_LANES),
    ]);
    const live = withMedia(dedupe([...you, ...hn, ...reddit])).slice(0, 24); // appended to HERO_FEED
    return classifyIntensity(live); // refine live intensities; returns `live` unchanged on any failure
  } catch {
    return []; // demo floor: never let a live source break the app
  }
}

/** Apply the shield: returns items with a `shielded` flag for intensity > ceiling. */
export function applyShield(items: FeedItem[], ceiling: number) {
  return items.map((it) => ({ ...it, shielded: it.intensity > ceiling }));
}
